import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/backlog/:itemId/revise - Request revision
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { feedback } = body;

    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback is required' },
        { status: 400 }
      );
    }

    const item = await prisma.backlogItem.findUnique({
      where: { id: itemId },
      include: { assignedAgent: true }
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Backlog item not found' },
        { status: 404 }
      );
    }

    if (!item.assignedAgent) {
      return NextResponse.json(
        { error: 'No agent assigned to this item' },
        { status: 400 }
      );
    }

    // Update item status back to IN_PROGRESS
    const updatedItem = await prisma.backlogItem.update({
      where: { id: itemId },
      data: { status: 'IN_PROGRESS' }
    });

    // Update agent status back to WORKING
    await prisma.agent.update({
      where: { id: item.assignedAgentId! },
      data: { status: 'WORKING' }
    });

    // Add revision request to conversation
    const conversation = await prisma.conversation.findFirst({
      where: { agentId: item.assignedAgentId! },
      orderBy: { createdAt: 'desc' }
    });

    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'USER',
          content: `Please revise your work on "${item.content}". Feedback: ${feedback}`
        }
      });
    }

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error requesting revision:', error);
    return NextResponse.json(
      { error: 'Failed to request revision' },
      { status: 500 }
    );
  }
}