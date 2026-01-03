import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sessionManager } from '@/lib/session-manager';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/orchestras/:id/sessions - Get all sessions for an orchestra
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get orchestra to retrieve repository path
    const orchestra = await prisma.orchestra.findUnique({
      where: { id },
      select: { repositoryPath: true },
    });

    if (!orchestra) {
      return errorResponse('Orchestra not found', 404);
    }

    // Get sessions from file system
    const sessions = await sessionManager.getSessionsForRepository(orchestra.repositoryPath);

    return successResponse(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return errorResponse('Failed to fetch sessions', 500);
  }
}
