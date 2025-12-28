import { BacklogItem, BacklogItemStatus } from '@prisma/client';
import { ParsedBacklogItem, findBestMatch } from './backlog-parser';

/**
 * Represents a backlog item that will be added
 */
export interface SyncAdd {
  type: 'add';
  content: string;
  description: string;
  lineNumber: number;
  position: number;
}

/**
 * Represents a backlog item whose content will be updated
 */
export interface SyncUpdate {
  type: 'update';
  existingItem: BacklogItem;
  newContent: string;
  newDescription: string;
  lineNumber: number;
  similarity: number;
}

/**
 * Represents a backlog item that will be removed
 * Only QUEUED items can be removed
 */
export interface SyncRemove {
  type: 'remove';
  existingItem: BacklogItem;
}

/**
 * Represents a conflict where markdown item matches a completed/failed item
 * User must decide: re-queue or skip
 */
export interface SyncConflict {
  type: 'conflict';
  existingItem: BacklogItem;
  markdownContent: string;
  markdownDescription: string;
  lineNumber: number;
  similarity: number;
  reason: 'completed_match' | 'active_match';
}

export type SyncAction = SyncAdd | SyncUpdate | SyncRemove | SyncConflict;

export interface SyncPreview {
  adds: SyncAdd[];
  updates: SyncUpdate[];
  removes: SyncRemove[];
  conflicts: SyncConflict[];
  unchanged: BacklogItem[];
}

/**
 * Status values that indicate work is "active" and should not be modified
 */
const ACTIVE_STATUSES: BacklogItemStatus[] = [
  'IN_PROGRESS',
  'WAITING',
  'PR_OPEN',
];

/**
 * Status values that indicate work is "done" and could be re-queued
 */
const COMPLETED_STATUSES: BacklogItemStatus[] = ['DONE', 'FAILED'];

/**
 * Status values that can be modified during sync
 */
const MODIFIABLE_STATUSES: BacklogItemStatus[] = ['QUEUED'];

/**
 * Computes the sync preview between markdown items and existing backlog items.
 *
 * Rules:
 * - Only QUEUED items can be updated or removed
 * - Active items (IN_PROGRESS, WAITING, PR_OPEN) are never touched
 * - Completed items (DONE, FAILED) matching markdown items create conflicts
 * - Unchecked markdown items not matching anything are added
 * - QUEUED items not matching any markdown item are removed
 */
export function computeSyncPreview(
  parsedItems: ParsedBacklogItem[],
  existingItems: BacklogItem[]
): SyncPreview {
  const adds: SyncAdd[] = [];
  const updates: SyncUpdate[] = [];
  const removes: SyncRemove[] = [];
  const conflicts: SyncConflict[] = [];
  const unchanged: BacklogItem[] = [];

  // Track which existing items have been matched
  const matchedExistingIds = new Set<string>();

  // Filter to only unchecked items (checked items are already done)
  const uncheckedMarkdownItems = parsedItems.filter((item) => !item.checked);

  // Process each unchecked markdown item
  uncheckedMarkdownItems.forEach((mdItem, index) => {
    // Try to find a matching existing item
    const unmatched = existingItems.filter(
      (item) => !matchedExistingIds.has(item.id)
    );

    const match = findBestMatch(mdItem.content, unmatched);

    if (match) {
      matchedExistingIds.add(match.item.id);
      const existingItem = match.item;

      // Check the status of the matched item
      if (ACTIVE_STATUSES.includes(existingItem.status)) {
        // Active item - create conflict
        conflicts.push({
          type: 'conflict',
          existingItem,
          markdownContent: mdItem.content,
          markdownDescription: mdItem.description,
          lineNumber: mdItem.lineNumber,
          similarity: match.similarity,
          reason: 'active_match',
        });
      } else if (COMPLETED_STATUSES.includes(existingItem.status)) {
        // Completed item - create conflict for potential re-queue
        conflicts.push({
          type: 'conflict',
          existingItem,
          markdownContent: mdItem.content,
          markdownDescription: mdItem.description,
          lineNumber: mdItem.lineNumber,
          similarity: match.similarity,
          reason: 'completed_match',
        });
      } else if (MODIFIABLE_STATUSES.includes(existingItem.status)) {
        // QUEUED item - check if content or description changed
        const descriptionChanged = mdItem.description !== (existingItem.description || '');
        if (match.similarity === 1 && !descriptionChanged) {
          // Exact match, no change needed
          unchanged.push(existingItem);
        } else {
          // Content or description changed, update it
          updates.push({
            type: 'update',
            existingItem,
            newContent: mdItem.content,
            newDescription: mdItem.description,
            lineNumber: mdItem.lineNumber,
            similarity: match.similarity,
          });
        }
      }
    } else {
      // No match found - this is a new item
      adds.push({
        type: 'add',
        content: mdItem.content,
        description: mdItem.description,
        lineNumber: mdItem.lineNumber,
        position: index + 1, // Position based on order in markdown
      });
    }
  });

  // Find QUEUED items that weren't matched - these should be removed
  existingItems.forEach((item) => {
    if (
      !matchedExistingIds.has(item.id) &&
      MODIFIABLE_STATUSES.includes(item.status)
    ) {
      removes.push({
        type: 'remove',
        existingItem: item,
      });
    }
  });

  // Add active and completed items that weren't matched to unchanged
  existingItems.forEach((item) => {
    if (
      !matchedExistingIds.has(item.id) &&
      !MODIFIABLE_STATUSES.includes(item.status)
    ) {
      unchanged.push(item);
    }
  });

  return { adds, updates, removes, conflicts, unchanged };
}

/**
 * Conflict resolution action
 */
export type ConflictResolution =
  | { action: 'requeue'; conflictIndex: number }
  | { action: 'skip'; conflictIndex: number };

/**
 * Applies conflict resolutions to convert conflicts into actions
 */
export function applyConflictResolutions(
  preview: SyncPreview,
  resolutions: ConflictResolution[]
): { adds: SyncAdd[]; updates: SyncUpdate[]; removes: SyncRemove[] } {
  const additionalAdds: SyncAdd[] = [];

  resolutions.forEach((resolution) => {
    const conflict = preview.conflicts[resolution.conflictIndex];
    if (!conflict) return;

    if (resolution.action === 'requeue' && conflict.reason === 'completed_match') {
      // Re-queue the item - treat as a new add
      additionalAdds.push({
        type: 'add',
        content: conflict.markdownContent,
        description: conflict.markdownDescription,
        lineNumber: conflict.lineNumber,
        position: 0, // Will be recalculated
      });
    }
    // 'skip' means do nothing - the item stays as-is
    // 'active_match' conflicts are always skipped (can't touch active items)
  });

  return {
    adds: [...preview.adds, ...additionalAdds],
    updates: preview.updates,
    removes: preview.removes,
  };
}

/**
 * Recalculates positions for all adds to maintain order
 */
export function calculatePositions(
  adds: SyncAdd[],
  updates: SyncUpdate[],
  existingQueuedCount: number
): Map<SyncAdd, number> {
  const positions = new Map<SyncAdd, number>();

  // Sort adds by line number to maintain markdown order
  const sortedAdds = [...adds].sort((a, b) => a.lineNumber - b.lineNumber);

  // Start position after existing queued items
  let nextPosition = existingQueuedCount + 1;

  sortedAdds.forEach((add) => {
    positions.set(add, nextPosition++);
  });

  return positions;
}
