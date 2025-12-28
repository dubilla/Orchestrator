import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';
import { parseBacklogMarkdown } from '@/lib/backlog-parser';
import { computeSyncPreview } from '@/lib/backlog-sync';

export interface SyncPreviewResponse {
  preview: {
    adds: Array<{ content: string; lineNumber: number; position: number }>;
    updates: Array<{
      existingItemId: string;
      existingContent: string;
      newContent: string;
      similarity: number;
    }>;
    removes: Array<{ existingItemId: string; content: string }>;
    conflicts: Array<{
      existingItemId: string;
      existingContent: string;
      existingStatus: string;
      markdownContent: string;
      similarity: number;
      reason: 'completed_match' | 'active_match';
    }>;
    unchangedCount: number;
  };
  currentHash: string;
  lastSyncedHash: string | null;
  hasChanges: boolean;
}

// POST /api/orchestras/:id/backlog/sync-preview
// Returns a preview of what sync would do without executing it
export async function POST(
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

    // Read and parse the backlog markdown file
    const backlogPath = `${orchestra.repositoryPath}/backlog.md`;

    let markdownContent: string;
    try {
      markdownContent = await fs.readFile(backlogPath, 'utf-8');
    } catch {
      return errorResponse(`Backlog file not found at ${backlogPath}`, 404);
    }

    const { items: parsedItems, hash: currentHash } =
      parseBacklogMarkdown(markdownContent);

    // Get existing backlog items
    const existingItems = await prisma.backlogItem.findMany({
      where: { orchestraId: id },
      orderBy: { position: 'asc' },
    });

    // Compute the sync preview
    const syncPreview = computeSyncPreview(parsedItems, existingItems);

    // Transform the preview for the API response
    const response: SyncPreviewResponse = {
      preview: {
        adds: syncPreview.adds.map((add) => ({
          content: add.content,
          lineNumber: add.lineNumber,
          position: add.position,
        })),
        updates: syncPreview.updates.map((update) => ({
          existingItemId: update.existingItem.id,
          existingContent: update.existingItem.content,
          newContent: update.newContent,
          similarity: update.similarity,
        })),
        removes: syncPreview.removes.map((remove) => ({
          existingItemId: remove.existingItem.id,
          content: remove.existingItem.content,
        })),
        conflicts: syncPreview.conflicts.map((conflict) => ({
          existingItemId: conflict.existingItem.id,
          existingContent: conflict.existingItem.content,
          existingStatus: conflict.existingItem.status,
          markdownContent: conflict.markdownContent,
          similarity: conflict.similarity,
          reason: conflict.reason,
        })),
        unchangedCount: syncPreview.unchanged.length,
      },
      currentHash,
      lastSyncedHash: orchestra.lastSyncedHash,
      hasChanges:
        currentHash !== orchestra.lastSyncedHash ||
        syncPreview.adds.length > 0 ||
        syncPreview.updates.length > 0 ||
        syncPreview.removes.length > 0 ||
        syncPreview.conflicts.length > 0,
    };

    return successResponse(response);
  } catch (error) {
    console.error('Error generating sync preview:', error);
    return errorResponse('Failed to generate sync preview', 500);
  }
}
