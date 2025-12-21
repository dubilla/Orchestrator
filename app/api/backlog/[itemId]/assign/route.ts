import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import simpleGit from 'simple-git';

// POST /api/backlog/:itemId/assign - Assign item to agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { agentId } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Get the backlog item and its orchestra
    const item = await prisma.backlogItem.findUnique({
      where: { id: itemId },
      include: { orchestra: true }
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Backlog item not found' },
        { status: 404 }
      );
    }

    // Get the agent
    const agent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Create branch name from item content
    const branchSlug = item.content
      .toLowerCase()
      .substring(0, 50)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const branchName = `agent-${agent.name.toLowerCase()}-${branchSlug}`;

    // Initialize git in the repository
    const git = simpleGit(item.orchestra.repositoryPath);

    try {
      // Check out main/master branch
      const branches = await git.branch();
      const mainBranch = branches.all.includes('main') ? 'main' : 'master';
      await git.checkout(mainBranch);

      // Create and checkout new branch
      await git.checkoutLocalBranch(branchName);
    } catch (gitError) {
      console.error('Git operation failed:', gitError);
      // Continue even if git operations fail (might not be a git repo)
    }

    // Update backlog item
    const updatedItem = await prisma.backlogItem.update({
      where: { id: itemId },
      data: {
        status: 'IN_PROGRESS',
        assignedAgentId: agentId,
        branch: branchName
      },
      include: { assignedAgent: true }
    });

    // Update agent
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: 'WORKING',
        currentBacklogItemId: itemId,
        currentBranch: branchName
      }
    });

    // Add system message to agent's conversation about the new task
    const conversation = await prisma.conversation.findFirst({
      where: { agentId },
      orderBy: { createdAt: 'desc' }
    });

    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'SYSTEM',
          content: `You have been assigned a new task: "${item.content}". You are working on branch: ${branchName}. Please complete this task and let me know when you're done.`
        }
      });
    }

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error assigning backlog item:', error);
    return NextResponse.json(
      { error: 'Failed to assign backlog item' },
      { status: 500 }
    );
  }
}