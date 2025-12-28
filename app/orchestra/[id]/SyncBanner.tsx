'use client';

import { SyncPreviewData } from './page';

interface SyncBannerProps {
  preview: SyncPreviewData;
  onReviewChanges: () => void;
}

export default function SyncBanner({ preview, onReviewChanges }: SyncBannerProps) {
  const { adds, updates, removes, conflicts } = preview.preview;
  const totalChanges = adds.length + updates.length + removes.length;
  const hasConflicts = conflicts.length > 0;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-amber-600 dark:text-amber-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">Backlog file changed:</span>{' '}
              {totalChanges > 0 && (
                <span>
                  {adds.length > 0 && (
                    <span className="text-green-700 dark:text-green-400">
                      +{adds.length} new
                    </span>
                  )}
                  {updates.length > 0 && (
                    <span className="text-blue-700 dark:text-blue-400">
                      {adds.length > 0 ? ', ' : ''}
                      {updates.length} updated
                    </span>
                  )}
                  {removes.length > 0 && (
                    <span className="text-red-700 dark:text-red-400">
                      {(adds.length > 0 || updates.length > 0) ? ', ' : ''}
                      -{removes.length} removed
                    </span>
                  )}
                </span>
              )}
              {hasConflicts && (
                <span className="text-orange-700 dark:text-orange-400 ml-1">
                  ({conflicts.length} conflict{conflicts.length > 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onReviewChanges}
            className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline cursor-pointer"
          >
            Review & Sync
          </button>
        </div>
      </div>
    </div>
  );
}
