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
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Orchestra Dashboard
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            New Orchestra
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : orchestras.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No orchestras yet. Create one to get started!
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {orchestras.map((orchestra) => (
              <Link
                key={orchestra.id}
                href={`/orchestra/${orchestra.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {orchestra.name}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 truncate">
                  {orchestra.repositoryPath}
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {orchestra.backlogItems.length} queued
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    WIP: {orchestra.backlogItems.filter(i => ['IN_PROGRESS', 'WAITING', 'PR_OPEN'].includes(i.status)).length}/{orchestra.wipLimit}
                  </span>
                </div>
                <div className="mt-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      orchestra.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Create New Orchestra
            </h2>
            <form onSubmit={createOrchestra}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="My Project Orchestra"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Repository Path
                  </label>
                  <input
                    type="text"
                    name="repositoryPath"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="/Users/username/projects/my-app"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    GitHub Remote
                  </label>
                  <input
                    type="text"
                    name="githubRemote"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="https://github.com/username/repo"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Used for creating pull requests
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    WIP Limit
                  </label>
                  <input
                    type="number"
                    name="wipLimit"
                    min="1"
                    max="10"
                    defaultValue="2"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Max concurrent work items (in progress + waiting + open PRs)
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
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
