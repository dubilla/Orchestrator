import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/backlog/:itemId - Update item (content, position)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { content, position } = body;

    const item = await prisma.backlogItem.update({
      where: { id: itemId },
      data: {
        ...(content !== undefined && { content }),
        ...(position !== undefined && { position }),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating backlog item:', error);
    return NextResponse.json(
      { error: 'Failed to update backlog item' },
      { status: 500 }
    );
  }
}

// DELETE /api/backlog/:itemId - Remove item from backlog
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;

    await prisma.backlogItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Error deleting backlog item:', error);
    return NextResponse.json(
      { error: 'Failed to delete backlog item' },
      { status: 500 }
    );
  }
}