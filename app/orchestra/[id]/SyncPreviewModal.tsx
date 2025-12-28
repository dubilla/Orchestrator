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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Sync Backlog Changes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review changes from your backlog.md file before syncing
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Adds */}
          {adds.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs">
                  +
                </span>
                New items ({adds.length})
              </h3>
              <ul className="space-y-2">
                {adds.map((add, index) => (
                  <li
                    key={index}
                    className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 text-sm text-gray-900 dark:text-white"
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
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs">
                  ~
                </span>
                Updated items ({updates.length})
              </h3>
              <ul className="space-y-2">
                {updates.map((update, index) => (
                  <li
                    key={index}
                    className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm"
                  >
                    <div className="text-gray-500 dark:text-gray-400 line-through mb-1">
                      {update.existingContent}
                    </div>
                    <div className="text-gray-900 dark:text-white">
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
              <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-xs">
                  -
                </span>
                Removed items ({removes.length})
              </h3>
              <ul className="space-y-2">
                {removes.map((remove, index) => (
                  <li
                    key={index}
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-gray-900 dark:text-white line-through"
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
              <h3 className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-xs">
                  !
                </span>
                Conflicts ({conflicts.length})
              </h3>
              <ul className="space-y-3">
                {conflicts.map((conflict, index) => (
                  <li
                    key={index}
                    className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md p-3"
                  >
                    <div className="text-sm text-gray-900 dark:text-white mb-2">
                      &ldquo;{conflict.markdownContent}&rdquo;
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                      Matches existing{' '}
                      <span
                        className={`font-medium ${
                          conflict.existingStatus === 'DONE'
                            ? 'text-green-700 dark:text-green-400'
                            : conflict.existingStatus === 'FAILED'
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-blue-700 dark:text-blue-400'
                        }`}
                      >
                        {conflict.existingStatus}
                      </span>{' '}
                      item: &ldquo;{conflict.existingContent}&rdquo;
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
                          className={`flex-1 px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${
                            conflictActions[index] === 'requeue'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
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
                          className={`flex-1 px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${
                            conflictActions[index] === 'skip'
                              ? 'bg-gray-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          Skip
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400 italic">
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
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {unchangedCount} item{unchangedCount > 1 ? 's' : ''} unchanged
            </div>
          )}

          {/* No changes */}
          {!hasAnyChanges && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No changes to sync
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSync}
            disabled={loading || !hasAnyChanges}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
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
