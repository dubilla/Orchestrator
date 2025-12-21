import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/backlog/:itemId - Update item status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { status } = body;

    const item = await prisma.backlogItem.update({
      where: { id: itemId },
      data: { status },
      include: { assignedAgent: true }
    });

    // If item is being marked as TODO, release the agent
    if (status === 'TODO' && item.assignedAgentId) {
      await prisma.agent.update({
        where: { id: item.assignedAgentId },
        data: {
          status: 'IDLE',
          currentBacklogItemId: null,
          currentBranch: null
        }
      });

      await prisma.backlogItem.update({
        where: { id: itemId },
        data: {
          assignedAgentId: null,
          branch: null
        }
      });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating backlog item:', error);
    return NextResponse.json(
      { error: 'Failed to update backlog item' },
      { status: 500 }
    );
  }
}