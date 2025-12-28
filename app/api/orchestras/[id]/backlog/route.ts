import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/orchestras/:id/backlog - Return existing backlog items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orchestra = await prisma.orchestra.findUnique({
      where: { id },
    });

    if (!orchestra) {
      return errorResponse('Orchestra not found', 404);
    }

    // Get existing backlog items ordered by position
    const items = await prisma.backlogItem.findMany({
      where: { orchestraId: id },
      orderBy: { position: 'asc' },
    });

    return successResponse(items);
  } catch (error) {
    console.error('Error fetching backlog:', error);
    return errorResponse('Failed to fetch backlog', 500);
  }
}

// POST /api/orchestras/:id/backlog - Add a new backlog item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return errorResponse('Content is required', 400);
    }

    const orchestra = await prisma.orchestra.findUnique({
      where: { id },
    });

    if (!orchestra) {
      return errorResponse('Orchestra not found', 404);
    }

    // Get the maximum position to add at the end
    const maxPositionItem = await prisma.backlogItem.findFirst({
      where: { orchestraId: id },
      orderBy: { position: 'desc' },
    });

    const newPosition = (maxPositionItem?.position ?? 0) + 1;

    const item = await prisma.backlogItem.create({
      data: {
        orchestraId: id,
        content,
        status: 'QUEUED',
        position: newPosition,
      },
    });

    return successResponse(item, 201);
  } catch (error) {
    console.error('Error creating backlog item:', error);
    return errorResponse('Failed to create backlog item', 500);
  }
}
