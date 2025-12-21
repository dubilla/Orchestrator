import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AgentSession } from '@/lib/agent-session-manager';

// GET /api/agents/:id/messages - Get conversation history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!agent || !agent.conversations[0]) {
      return errorResponse('Agent or conversation not found', 404);
    }

    return successResponse(agent.conversations[0].messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return errorResponse('Failed to fetch messages', 500);
  }
}

// POST /api/agents/:id/messages - Send message to agent (with streaming via Agent SDK)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return errorResponse('Message content is required', 400);
    }

    // Get agent with orchestra and conversation
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        orchestra: true,
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!agent || !agent.conversations[0]) {
      return errorResponse('Agent or conversation not found', 404);
    }

    const conversation = agent.conversations[0];

    // Save user message to database
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content
      }
    });

    // Get conversation history (exclude system messages)
    const conversationHistory = conversation.messages
      .filter(msg => msg.role !== 'SYSTEM')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    // Create agent session and send message
    const session = new AgentSession({
      agentId: agent.id,
      agentName: agent.name,
      workingDirectory: agent.orchestra.repositoryPath,
    });

    const queryResult = session.send(content, conversationHistory);

    // Stream responses from query API
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          let fullToolOutput = '';

          // Stream messages from the query
          for await (const message of queryResult) {
            console.log('[Stream] Message type:', message.type);

            // Handle different message types from SDK
            if (message.type === 'stream_event') {
              // Streaming event (partial text chunks)
              const event = message.event;
              console.log('[Stream] Event type:', event.type);

              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                const chunk = event.delta.text || '';
                fullResponse += chunk;

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ chunk, type: 'text' })}\n\n`)
                );
              }
            } else if (message.type === 'assistant') {
              // Assistant message - extract text content
              console.log('[Stream] Assistant message received');
              const assistantMsg = message.message;

              // Extract text from content blocks
              if (assistantMsg.content) {
                for (const block of assistantMsg.content) {
                  if (block.type === 'text') {
                    const chunk = block.text;
                    fullResponse += chunk;

                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ chunk, type: 'text' })}\n\n`)
                    );
                  } else if (block.type === 'tool_use') {
                    console.log('[Stream] Tool use:', block.name, block.input);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        type: 'tool_use',
                        tool: block.name,
                        tool_use_id: block.id,
                        input: block.input
                      })}\n\n`)
                    );
                  }
                }
              }
            } else if (message.type === 'tool_progress') {
              // Tool execution progress
              console.log('[Stream] Tool progress:', message.tool_name);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'tool_use',
                  tool: message.tool_name,
                  tool_use_id: message.tool_use_id
                })}\n\n`)
              );
            } else if (message.type === 'result') {
              // Final result
              console.log('[Stream] Result received, is_error:', message.is_error);
              if (!message.is_error && 'result' in message) {
                fullToolOutput += message.result + '\n';
              }
              break; // Exit stream loop when we get the final result
            }
          }

          // Save assistant's response to database
          const assistantContent = fullResponse + (fullToolOutput ? `\n\nTool outputs:\n${fullToolOutput}` : '');

          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: 'ASSISTANT',
              content: assistantContent || '(Agent completed task)'
            }
          });

          // Send done signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Streaming failed: ' + (error as Error).message })}\n\n`)
          );
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return errorResponse('Failed to send message', 500);
  }
}