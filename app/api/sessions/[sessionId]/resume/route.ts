import { NextRequest, NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { errorResponse } from '@/lib/api-response';
import { appendMessagesToSession } from '@/lib/session-writer';

// POST /api/sessions/:sessionId/resume - Resume a session and stream responses
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { prompt, repositoryPath } = body;

    if (!prompt || !repositoryPath) {
      return errorResponse('prompt and repositoryPath are required', 400);
    }

    // Use Agent SDK's query() with resume option
    const queryResult = query({
      prompt,
      options: {
        resume: sessionId,
        cwd: repositoryPath,
        model: 'claude-sonnet-4-5-20250929',
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        maxTurns: 50,
        maxBudgetUsd: 5.0
      }
    });

    // Stream responses via SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';

          // Stream messages from the query
          for await (const message of queryResult) {
            console.log('[Session Resume] Message type:', message.type);

            // Handle different message types from SDK
            if (message.type === 'stream_event') {
              // Streaming event (partial text chunks)
              const event = message.event;
              console.log('[Session Resume] Event type:', event.type);

              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                const chunk = event.delta.text || '';
                fullResponse += chunk;

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ chunk, type: 'text' })}\n\n`)
                );
              }
            } else if (message.type === 'assistant') {
              // Assistant message - extract text content
              console.log('[Session Resume] Assistant message received');
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
                    console.log('[Session Resume] Tool use:', block.name, block.input);
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
              console.log('[Session Resume] Tool progress:', message.tool_name);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'tool_use',
                  tool: message.tool_name,
                  tool_use_id: message.tool_use_id
                })}\n\n`)
              );
            } else if (message.type === 'result') {
              // Final result
              console.log('[Session Resume] Result received, is_error:', message.is_error);
              break; // Exit stream loop when we get the final result
            }
          }

          // Persist messages to .jsonl file for CLI interoperability
          console.log('[Session Resume] Attempting to persist messages. fullResponse length:', fullResponse.length);
          if (fullResponse) {
            try {
              await appendMessagesToSession(sessionId, repositoryPath, prompt, fullResponse);
              console.log('[Session Resume] Messages persisted to .jsonl file');
            } catch (error) {
              console.error('[Session Resume] Failed to persist messages:', error);
            }
          } else {
            console.warn('[Session Resume] No response to persist - fullResponse is empty');
          }

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
    console.error('Error resuming session:', error);
    return errorResponse('Failed to resume session', 500);
  }
}
