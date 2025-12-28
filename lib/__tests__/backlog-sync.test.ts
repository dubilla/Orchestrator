import { BacklogItem, BacklogItemStatus } from '@prisma/client';
import {
  computeSyncPreview,
  applyConflictResolutions,
} from '../backlog-sync';
import { ParsedBacklogItem } from '../backlog-parser';

// Helper to create mock BacklogItem
function createBacklogItem(
  overrides: Partial<BacklogItem> & { content: string; status: BacklogItemStatus }
): BacklogItem {
  const { content, status, ...rest } = overrides;
  return {
    id: `id-${Math.random()}`,
    orchestraId: 'orchestra-1',
    description: null,
    branch: null,
    position: 1,
    prUrl: null,
    prNumber: null,
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...rest,
    content,
    status,
  };
}

// Helper to create parsed markdown item
function createParsedItem(
  content: string,
  lineNumber: number,
  checked = false,
  description = ''
): ParsedBacklogItem {
  return { content, description, lineNumber, checked };
}

describe('computeSyncPreview', () => {
  describe('adds', () => {
    it('adds new items not matching existing items', () => {
      const parsed = [
        createParsedItem('New task', 1),
        createParsedItem('Another new task', 2),
      ];
      const existing: BacklogItem[] = [];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.adds).toHaveLength(2);
      expect(preview.adds[0].content).toBe('New task');
      expect(preview.adds[1].content).toBe('Another new task');
    });

    it('ignores checked items in markdown', () => {
      const parsed = [
        createParsedItem('New task', 1, false),
        createParsedItem('Completed task', 2, true),
      ];
      const existing: BacklogItem[] = [];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.adds).toHaveLength(1);
      expect(preview.adds[0].content).toBe('New task');
    });
  });

  describe('updates', () => {
    it('updates QUEUED items with changed content', () => {
      const parsed = [createParsedItem('Implement user authentication system', 1)];
      const existing = [
        createBacklogItem({ content: 'Implement user authentication', status: 'QUEUED' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.updates).toHaveLength(1);
      expect(preview.updates[0].newContent).toBe('Implement user authentication system');
      expect(preview.updates[0].existingItem.content).toBe('Implement user authentication');
    });

    it('does not update items with identical content', () => {
      const parsed = [createParsedItem('Exact same content', 1)];
      const existing = [
        createBacklogItem({ content: 'Exact same content', status: 'QUEUED' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.updates).toHaveLength(0);
      expect(preview.unchanged).toHaveLength(1);
    });
  });

  describe('removes', () => {
    it('removes QUEUED items not in markdown', () => {
      const parsed: ParsedBacklogItem[] = [];
      const existing = [
        createBacklogItem({ content: 'Old task to remove', status: 'QUEUED' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.removes).toHaveLength(1);
      expect(preview.removes[0].existingItem.content).toBe('Old task to remove');
    });

    it('does not remove non-QUEUED items', () => {
      const parsed: ParsedBacklogItem[] = [];
      const existing = [
        createBacklogItem({ content: 'Active task', status: 'IN_PROGRESS' }),
        createBacklogItem({ content: 'Done task', status: 'DONE' }),
        createBacklogItem({ content: 'Failed task', status: 'FAILED' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.removes).toHaveLength(0);
      expect(preview.unchanged).toHaveLength(3);
    });
  });

  describe('conflicts', () => {
    it('creates conflict for markdown matching DONE item', () => {
      const parsed = [createParsedItem('Completed task', 1)];
      const existing = [
        createBacklogItem({ content: 'Completed task', status: 'DONE' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.conflicts).toHaveLength(1);
      expect(preview.conflicts[0].reason).toBe('completed_match');
      expect(preview.conflicts[0].existingItem.status).toBe('DONE');
    });

    it('creates conflict for markdown matching FAILED item', () => {
      const parsed = [createParsedItem('Failed task', 1)];
      const existing = [
        createBacklogItem({ content: 'Failed task', status: 'FAILED' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.conflicts).toHaveLength(1);
      expect(preview.conflicts[0].reason).toBe('completed_match');
      expect(preview.conflicts[0].existingItem.status).toBe('FAILED');
    });

    it('creates conflict for markdown matching IN_PROGRESS item', () => {
      const parsed = [createParsedItem('Active task', 1)];
      const existing = [
        createBacklogItem({ content: 'Active task', status: 'IN_PROGRESS' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.conflicts).toHaveLength(1);
      expect(preview.conflicts[0].reason).toBe('active_match');
    });

    it('creates conflict for markdown matching WAITING item', () => {
      const parsed = [createParsedItem('Waiting task', 1)];
      const existing = [
        createBacklogItem({ content: 'Waiting task', status: 'WAITING' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.conflicts).toHaveLength(1);
      expect(preview.conflicts[0].reason).toBe('active_match');
    });

    it('creates conflict for markdown matching PR_OPEN item', () => {
      const parsed = [createParsedItem('PR open task', 1)];
      const existing = [
        createBacklogItem({ content: 'PR open task', status: 'PR_OPEN' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.conflicts).toHaveLength(1);
      expect(preview.conflicts[0].reason).toBe('active_match');
    });
  });

  describe('complex scenarios', () => {
    it('handles mix of all action types', () => {
      const parsed = [
        createParsedItem('New task', 1),
        createParsedItem('Updated queued task v2', 2),
        createParsedItem('Unchanged task', 3),
        createParsedItem('Done task to maybe re-queue', 4),
        createParsedItem('Active task conflict', 5),
      ];
      const existing = [
        createBacklogItem({ content: 'Updated queued task', status: 'QUEUED' }),
        createBacklogItem({ content: 'Unchanged task', status: 'QUEUED' }),
        createBacklogItem({ content: 'Task to remove', status: 'QUEUED' }),
        createBacklogItem({ content: 'Done task to maybe re-queue', status: 'DONE' }),
        createBacklogItem({ content: 'Active task conflict', status: 'IN_PROGRESS' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      expect(preview.adds).toHaveLength(1);
      expect(preview.adds[0].content).toBe('New task');

      expect(preview.updates).toHaveLength(1);
      expect(preview.updates[0].newContent).toBe('Updated queued task v2');

      expect(preview.removes).toHaveLength(1);
      expect(preview.removes[0].existingItem.content).toBe('Task to remove');

      expect(preview.conflicts).toHaveLength(2);

      expect(preview.unchanged).toHaveLength(1);
      expect(preview.unchanged[0].content).toBe('Unchanged task');
    });

    it('matches items by similarity, not just exact match', () => {
      const parsed = [
        createParsedItem('Implement user authentication feature', 1),
      ];
      const existing = [
        createBacklogItem({ content: 'Implement user authentication', status: 'QUEUED' }),
      ];

      const preview = computeSyncPreview(parsed, existing);

      // Should match and update, not add a new one
      expect(preview.adds).toHaveLength(0);
      expect(preview.updates).toHaveLength(1);
      expect(preview.updates[0].newContent).toBe('Implement user authentication feature');
    });
  });
});

describe('applyConflictResolutions', () => {
  it('re-queues completed item when resolution is requeue', () => {
    const preview = {
      adds: [],
      updates: [],
      removes: [],
      conflicts: [
        {
          type: 'conflict' as const,
          existingItem: createBacklogItem({ content: 'Done task', status: 'DONE' }),
          markdownContent: 'Done task - try again',
          markdownDescription: 'Some description',
          lineNumber: 1,
          similarity: 0.8,
          reason: 'completed_match' as const,
        },
      ],
      unchanged: [],
    };

    const result = applyConflictResolutions(preview, [
      { action: 'requeue', conflictIndex: 0 },
    ]);

    expect(result.adds).toHaveLength(1);
    expect(result.adds[0].content).toBe('Done task - try again');
  });

  it('skips item when resolution is skip', () => {
    const preview = {
      adds: [],
      updates: [],
      removes: [],
      conflicts: [
        {
          type: 'conflict' as const,
          existingItem: createBacklogItem({ content: 'Done task', status: 'DONE' }),
          markdownContent: 'Done task',
          markdownDescription: '',
          lineNumber: 1,
          similarity: 1,
          reason: 'completed_match' as const,
        },
      ],
      unchanged: [],
    };

    const result = applyConflictResolutions(preview, [
      { action: 'skip', conflictIndex: 0 },
    ]);

    expect(result.adds).toHaveLength(0);
  });

  it('preserves original adds and updates', () => {
    const preview = {
      adds: [{ type: 'add' as const, content: 'Original add', description: '', lineNumber: 1, position: 1 }],
      updates: [],
      removes: [{ type: 'remove' as const, existingItem: createBacklogItem({ content: 'To remove', status: 'QUEUED' }) }],
      conflicts: [
        {
          type: 'conflict' as const,
          existingItem: createBacklogItem({ content: 'Done task', status: 'DONE' }),
          markdownContent: 'Done task requeue',
          markdownDescription: '',
          lineNumber: 2,
          similarity: 0.9,
          reason: 'completed_match' as const,
        },
      ],
      unchanged: [],
    };

    const result = applyConflictResolutions(preview, [
      { action: 'requeue', conflictIndex: 0 },
    ]);

    expect(result.adds).toHaveLength(2);
    expect(result.adds[0].content).toBe('Original add');
    expect(result.adds[1].content).toBe('Done task requeue');
    expect(result.removes).toHaveLength(1);
  });

  it('handles invalid conflict index gracefully', () => {
    const preview = {
      adds: [],
      updates: [],
      removes: [],
      conflicts: [],
      unchanged: [],
    };

    const result = applyConflictResolutions(preview, [
      { action: 'requeue', conflictIndex: 99 },
    ]);

    expect(result.adds).toHaveLength(0);
  });
});
