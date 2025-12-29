'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Agent = {
  id: string;
  name: string;
};

type BacklogItem = {
  id: string;
  content: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'WAITING' | 'PR_OPEN' | 'DONE' | 'FAILED';
};

type Orchestra = {
  id: string;
  name: string;
  repositoryPath: string;
  githubRemote?: string;
  wipLimit: number;
  status: string;
  createdAt: string;
  agents: Agent[];
  backlogItems: BacklogItem[];
};

export default function Home() {
  const [orchestras, setOrchestras] = useState<Orchestra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchOrchestras();
  }, []);

  const fetchOrchestras = async () => {
    try {
      const res = await fetch('/api/orchestras');
      const result = await res.json();

      if (result.success) {
        setOrchestras(result.data);
      } else {
        console.error('API error:', result.error);
        setOrchestras([]);
      }
    } catch (error) {
      console.error('Failed to fetch orchestras:', error);
      setOrchestras([]);
    } finally {
      setLoading(false);
    }
  };

  const createOrchestra = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/orchestras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          repositoryPath: formData.get('repositoryPath'),
          githubRemote: formData.get('githubRemote') || undefined,
          wipLimit: formData.get('wipLimit') ? parseInt(formData.get('wipLimit') as string, 10) : undefined,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchOrchestras();
      }
    } catch (error) {
      console.error('Failed to create orchestra:', error);
    }
  };

  return (
    <main className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        <div className="flex justify-between items-center mb-12">
          <h1
            className="text-5xl font-light tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)'
            }}
          >
            Orchestra
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 text-sm font-medium rounded-lg cursor-pointer"
            style={{
              background: 'var(--accent)',
              color: 'var(--surface-elevated)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
          >
            New Orchestra
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div
              className="animate-spin rounded-full h-10 w-10 border-2"
              style={{
                borderColor: 'var(--border)',
                borderTopColor: 'var(--accent)'
              }}
            ></div>
          </div>
        ) : orchestras.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              No orchestras yet. Create one to begin.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {orchestras.map((orchestra) => (
              <Link
                key={orchestra.id}
                href={`/orchestra/${orchestra.id}`}
                className="block rounded-xl p-6 transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 3px var(--shadow-subtle)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-medium)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px var(--shadow-subtle)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <h2
                  className="text-2xl font-light mb-3"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {orchestra.name}
                </h2>
                <p className="text-sm mb-5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {orchestra.repositoryPath}
                </p>
                <div className="flex justify-between text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  <span>
                    {orchestra.backlogItems.length} queued
                  </span>
                  <span>
                    WIP: {orchestra.backlogItems.filter(i => ['IN_PROGRESS', 'WAITING', 'PR_OPEN'].includes(i.status)).length}/{orchestra.wipLimit}
                  </span>
                </div>
                <div>
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                    style={
                      orchestra.status === 'ACTIVE'
                        ? {
                            background: 'rgba(139, 115, 85, 0.1)',
                            color: 'var(--accent)'
                          }
                        : {
                            background: 'var(--border)',
                            color: 'var(--text-secondary)'
                          }
                    }
                  >
                    {orchestra.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Orchestra Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0, 0, 0, 0.4)' }}>
          <div
            className="rounded-2xl p-8 w-full max-w-md"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
            }}
          >
            <h2
              className="text-3xl font-light mb-6"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--text-primary)'
              }}
            >
              New Orchestra
            </h2>
            <form onSubmit={createOrchestra}>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-4 py-2.5 rounded-lg text-sm"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)'
                    }}
                    placeholder="My Project Orchestra"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Repository Path
                  </label>
                  <input
                    type="text"
                    name="repositoryPath"
                    required
                    className="w-full px-4 py-2.5 rounded-lg text-sm"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)'
                    }}
                    placeholder="/Users/username/projects/my-app"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    GitHub Remote
                  </label>
                  <input
                    type="text"
                    name="githubRemote"
                    className="w-full px-4 py-2.5 rounded-lg text-sm"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)'
                    }}
                    placeholder="https://github.com/username/repo"
                  />
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Used for creating pull requests
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    WIP Limit
                  </label>
                  <input
                    type="number"
                    name="wipLimit"
                    min="1"
                    max="10"
                    defaultValue="2"
                    className="w-full px-4 py-2.5 rounded-lg text-sm"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Max concurrent work items
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2 text-sm font-medium rounded-lg cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-medium rounded-lg cursor-pointer"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--surface-elevated)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
