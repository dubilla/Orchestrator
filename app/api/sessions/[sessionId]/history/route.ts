import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/sessions/:sessionId/history?repositoryPath=/path/to/repo - Get session history
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

    const history = await sessionManager.getSessionHistory(repositoryPath, sessionId);

    return successResponse(history);
  } catch (error) {
    console.error('Error fetching session history:', error);
    return errorResponse('Failed to fetch session history', 500);
  }
}
