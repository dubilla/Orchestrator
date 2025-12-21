import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';

// PATCH /api/agents/:id - Update agent (pause/resume)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, currentBranch, currentBacklogItemId } = body;

    const agent = await prisma.agent.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(currentBranch !== undefined && { currentBranch }),
        ...(currentBacklogItemId !== undefined && { currentBacklogItemId })
      }
    });

    return successResponse(agent);
  } catch (error) {
    console.error('Error updating agent:', error);
    return errorResponse('Failed to update agent', 500);
  }
}

// DELETE /api/agents/:id - Kill agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Note: Session cleanup is a no-op with stateless query API

    // Update status to TERMINATED
    await prisma.agent.update({
      where: { id },
      data: { status: 'TERMINATED' }
    });

    // Release any assigned backlog items
    await prisma.backlogItem.updateMany({
      where: { assignedAgentId: id },
      data: {
        status: 'TODO',
        assignedAgentId: null,
        branch: null
      }
    });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Error killing agent:', error);
    return errorResponse('Failed to kill agent', 500);
  }
}