import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/sessions/:sessionId?repositoryPath=/path/to/repo - Get session metadata
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const repositoryPath = searchParams.get('repositoryPath');

    if (!repositoryPath) {
      return errorResponse('repositoryPath query parameter is required', 400);
    }

    const session = await sessionManager.getSession(repositoryPath, sessionId);

    if (!session) {
      return errorResponse('Session not found', 404);
    }

    return successResponse(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    return errorResponse('Failed to fetch session', 500);
  }
}
