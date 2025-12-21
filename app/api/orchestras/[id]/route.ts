import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/orchestras/:id - Get orchestra details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orchestra = await prisma.orchestra.findUnique({
      where: { id },
      include: {
        agents: true,
        backlogItems: {
          orderBy: { position: 'asc' }
        }
      }
    });

    if (!orchestra) {
      return errorResponse('Orchestra not found', 404);
    }

    return successResponse(orchestra);
  } catch (error) {
    console.error('Error fetching orchestra:', error);
    return errorResponse('Failed to fetch orchestra', 500);
  }
}

// PATCH /api/orchestras/:id - Update orchestra
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const orchestra = await prisma.orchestra.update({
      where: { id },
      data: body
    });

    return successResponse(orchestra);
  } catch (error) {
    console.error('Error updating orchestra:', error);
    return errorResponse('Failed to update orchestra', 500);
  }
}

// DELETE /api/orchestras/:id - Delete orchestra
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.orchestra.delete({
      where: { id }
    });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Error deleting orchestra:', error);
    return errorResponse('Failed to delete orchestra', 500);
  }
}