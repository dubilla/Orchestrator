import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';
import { parseBacklogMarkdown } from '@/lib/backlog-parser';
import {
  computeSyncPreview,
  applyConflictResolutions,
  ConflictResolution,
} from '@/lib/backlog-sync';

interface SyncRequest {
  conflictResolutions?: ConflictResolution[];
}

interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  skippedConflicts: number;
  requeuedConflicts: number;
}

// POST /api/orchestras/:id/backlog/sync
// Executes the sync with optional conflict resolutions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: SyncRequest = await request.json();
    const conflictResolutions = body.conflictResolutions || [];

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
    const preview = computeSyncPreview(parsedItems, existingItems);

    // Apply conflict resolutions
    const resolvedActions = applyConflictResolutions(preview, conflictResolutions);

    // Track results
    const result: SyncResult = {
      added: 0,
      updated: 0,
      removed: 0,
      skippedConflicts: 0,
      requeuedConflicts: 0,
    };

    // Calculate how many conflicts were skipped vs requeued
    const requeuedCount = conflictResolutions.filter(
      (r) => r.action === 'requeue'
    ).length;
    result.requeuedConflicts = requeuedCount;
    result.skippedConflicts = preview.conflicts.length - requeuedCount;

    // Execute the sync in a transaction
    await prisma.$transaction(async (tx) => {
      // Calculate the next position for new items
      const maxPosition = existingItems.reduce(
        (max, item) => Math.max(max, item.position),
        0
      );
      let nextPosition = maxPosition + 1;

      // Process removes first (to free up positions)
      for (const remove of resolvedActions.removes) {
        await tx.backlogItem.delete({
          where: { id: remove.existingItem.id },
        });
        result.removed++;
      }

      // Process updates
      for (const update of resolvedActions.updates) {
        await tx.backlogItem.update({
          where: { id: update.existingItem.id },
          data: {
            content: update.newContent,
            description: update.newDescription || null,
          },
        });
        result.updated++;
      }

      // Process adds (sorted by line number to maintain order)
      const sortedAdds = [...resolvedActions.adds].sort(
        (a, b) => a.lineNumber - b.lineNumber
      );

      for (const add of sortedAdds) {
        await tx.backlogItem.create({
          data: {
            orchestraId: id,
            content: add.content,
            description: add.description || null,
            status: 'QUEUED',
            position: nextPosition++,
          },
        });
        result.added++;
      }

      // Update the orchestra's sync tracking fields
      await tx.orchestra.update({
        where: { id },
        data: {
          lastSyncedAt: new Date(),
          lastSyncedHash: currentHash,
        },
      });
    });

    return successResponse(result);
  } catch (error) {
    console.error('Error executing sync:', error);
    return errorResponse('Failed to execute sync', 500);
  }
}
