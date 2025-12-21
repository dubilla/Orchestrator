import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import simpleGit from 'simple-git';

// POST /api/backlog/:itemId/approve - Approve changes
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const item = await prisma.backlogItem.findUnique({
      where: { id: itemId },
      include: {
        orchestra: true,
        assignedAgent: true
      }
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

    // Commit changes if we're in a git repo
    if (item.branch) {
      const git = simpleGit(item.orchestra.repositoryPath);
      try {
        await git.checkout(item.branch);
        await git.add('.');
        await git.commit(`Complete: ${item.content}`);
      } catch (gitError) {
        console.error('Git commit failed:', gitError);
        // Continue even if git operations fail
      }
    }

    // Update item status to DONE
    const updatedItem = await prisma.backlogItem.update({
      where: { id: itemId },
      data: { status: 'DONE' }
    });

    // Free up the agent
    await prisma.agent.update({
      where: { id: item.assignedAgentId! },
      data: {
        status: 'IDLE',
        currentBacklogItemId: null,
        currentBranch: null
      }
    });

    // Add approval message to conversation
    const conversation = await prisma.conversation.findFirst({
      where: { agentId: item.assignedAgentId! },
      orderBy: { createdAt: 'desc' }
    });

    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'SYSTEM',
          content: `Great work! The task "${item.content}" has been approved and marked as complete. The changes have been committed to branch: ${item.branch}. You are now available for new tasks.`
        }
      });
    }

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error approving backlog item:', error);
    return NextResponse.json(
      { error: 'Failed to approve backlog item' },
      { status: 500 }
    );
  }
}