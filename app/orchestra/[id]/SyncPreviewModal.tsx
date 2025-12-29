'use client';

import { useState } from 'react';
import { SyncPreviewData } from './page';

interface SyncPreviewModalProps {
  preview: SyncPreviewData;
  loading: boolean;
  onClose: () => void;
  onSync: (conflictResolutions: Array<{ action: 'requeue' | 'skip'; conflictIndex: number }>) => void;
}

export default function SyncPreviewModal({
  preview,
  loading,
  onClose,
  onSync,
}: SyncPreviewModalProps) {
  const { adds, updates, removes, conflicts, unchangedCount } = preview.preview;

  // Track conflict resolutions: key is conflict index, value is 'requeue' or 'skip'
  const [conflictActions, setConflictActions] = useState<Record<number, 'requeue' | 'skip'>>(() => {
    // Default completed_match to 'skip', active_match to 'skip' (can't change)
    const initial: Record<number, 'requeue' | 'skip'> = {};
    conflicts.forEach((conflict, index) => {
      initial[index] = 'skip';
    });
    return initial;
  });

  const handleSync = () => {
    const resolutions = Object.entries(conflictActions).map(([index, action]) => ({
      action,
      conflictIndex: parseInt(index, 10),
    }));
    onSync(resolutions);
  };

  const totalChanges = adds.length + updates.length + removes.length;
  const hasAnyChanges = totalChanges > 0 || conflicts.length > 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0, 0, 0, 0.4)' }}>
      <div
        className="rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Header */}
        <div className="px-8 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2
            className="text-3xl font-light"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)'
            }}
          >
            Sync Backlog
          </h2>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Review changes from your backlog file
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* Adds */}
          {adds.length > 0 && (
            <div>
              <h3
                className="text-sm font-medium mb-3 flex items-center gap-2"
                style={{ color: '#16a34a' }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: 'rgba(34, 197, 94, 0.1)' }}
                >
                  +
                </span>
                New items ({adds.length})
              </h3>
              <ul className="space-y-2">
                {adds.map((add, index) => (
                  <li
                    key={index}
                    className="rounded-lg p-3.5 text-sm"
                    style={{
                      background: 'rgba(34, 197, 94, 0.05)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    {add.content}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Updates */}
          {updates.length > 0 && (
            <div>
              <h3
                className="text-sm font-medium mb-3 flex items-center gap-2"
                style={{ color: '#2563eb' }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: 'rgba(59, 130, 246, 0.1)' }}
                >
                  ~
                </span>
                Updated items ({updates.length})
              </h3>
              <ul className="space-y-2">
                {updates.map((update, index) => (
                  <li
                    key={index}
                    className="rounded-lg p-3.5 text-sm"
                    style={{
                      background: 'rgba(59, 130, 246, 0.05)',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}
                  >
                    <div className="line-through mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                      {update.existingContent}
                    </div>
                    <div style={{ color: 'var(--text-primary)' }}>
                      {update.newContent}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Removes */}
          {removes.length > 0 && (
            <div>
              <h3
                className="text-sm font-medium mb-3 flex items-center gap-2"
                style={{ color: '#dc2626' }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: 'rgba(220, 38, 38, 0.1)' }}
                >
                  -
                </span>
                Removed items ({removes.length})
              </h3>
              <ul className="space-y-2">
                {removes.map((remove, index) => (
                  <li
                    key={index}
                    className="rounded-lg p-3.5 text-sm line-through"
                    style={{
                      background: 'rgba(220, 38, 38, 0.05)',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {remove.content}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div>
              <h3
                className="text-sm font-medium mb-3 flex items-center gap-2"
                style={{ color: '#ea580c' }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: 'rgba(249, 115, 22, 0.1)' }}
                >
                  !
                </span>
                Conflicts ({conflicts.length})
              </h3>
              <ul className="space-y-3">
                {conflicts.map((conflict, index) => (
                  <li
                    key={index}
                    className="rounded-lg p-4"
                    style={{
                      background: 'rgba(249, 115, 22, 0.05)',
                      border: '1px solid rgba(249, 115, 22, 0.2)'
                    }}
                  >
                    <div className="text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
                      "{conflict.markdownContent}"
                    </div>
                    <div className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                      Matches existing{' '}
                      <span
                        className="font-medium"
                        style={{
                          color: conflict.existingStatus === 'DONE'
                            ? '#16a34a'
                            : conflict.existingStatus === 'FAILED'
                            ? '#dc2626'
                            : '#2563eb'
                        }}
                      >
                        {conflict.existingStatus}
                      </span>{' '}
                      item: "{conflict.existingContent}"
                    </div>

                    {conflict.reason === 'completed_match' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setConflictActions((prev) => ({
                              ...prev,
                              [index]: 'requeue',
                            }))
                          }
                          className="flex-1 px-3 py-2 text-sm rounded-md transition-all font-medium cursor-pointer"
                          style={
                            conflictActions[index] === 'requeue'
                              ? { background: '#16a34a', color: 'white' }
                              : { background: 'var(--background)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
                          }
                        >
                          Re-queue
                        </button>
                        <button
                          onClick={() =>
                            setConflictActions((prev) => ({
                              ...prev,
                              [index]: 'skip',
                            }))
                          }
                          className="flex-1 px-3 py-2 text-sm rounded-md transition-all font-medium cursor-pointer"
                          style={
                            conflictActions[index] === 'skip'
                              ? { background: 'var(--text-secondary)', color: 'white' }
                              : { background: 'var(--background)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
                          }
                        >
                          Skip
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                        This item is currently active and cannot be modified.
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unchanged summary */}
          {unchangedCount > 0 && (
            <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {unchangedCount} item{unchangedCount > 1 ? 's' : ''} unchanged
            </div>
          )}

          {/* No changes */}
          {!hasAnyChanges && (
            <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
              No changes to sync
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium rounded-lg disabled:opacity-50 cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            Cancel
          </button>
          <button
            onClick={handleSync}
            disabled={loading || !hasAnyChanges}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            style={{
              background: 'var(--accent)',
              color: 'var(--surface-elevated)'
            }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent)')}
          >
            {loading && (
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {loading ? 'Syncing...' : 'Sync Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
