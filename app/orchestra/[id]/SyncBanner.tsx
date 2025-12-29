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
    <div style={{ background: 'rgba(251, 191, 36, 0.08)', borderBottom: '1px solid rgba(251, 191, 36, 0.2)' }}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5"
                style={{ color: '#d97706' }}
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
            <div className="text-sm" style={{ color: '#92400e' }}>
              <span className="font-medium">Backlog file changed</span>
              {totalChanges > 0 && (
                <span className="ml-2">
                  {adds.length > 0 && (
                    <span style={{ color: '#16a34a' }}>
                      +{adds.length} new
                    </span>
                  )}
                  {updates.length > 0 && (
                    <span style={{ color: '#2563eb' }}>
                      {adds.length > 0 ? ', ' : ''}
                      {updates.length} updated
                    </span>
                  )}
                  {removes.length > 0 && (
                    <span style={{ color: '#dc2626' }}>
                      {(adds.length > 0 || updates.length > 0) ? ', ' : ''}
                      -{removes.length} removed
                    </span>
                  )}
                </span>
              )}
              {hasConflicts && (
                <span style={{ color: '#ea580c' }} className="ml-1.5">
                  ({conflicts.length} conflict{conflicts.length > 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onReviewChanges}
            className="text-sm font-medium underline cursor-pointer px-3 py-1.5 rounded-md transition-colors"
            style={{ color: '#92400e' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)';
              e.currentTarget.style.color = '#78350f';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#92400e';
            }}
          >
            Review & Sync
          </button>
        </div>
      </div>
    </div>
  );
}
