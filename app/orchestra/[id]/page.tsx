'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import AgentConversation from './AgentConversation';
import SyncBanner from './SyncBanner';
import SyncPreviewModal from './SyncPreviewModal';

type Agent = {
  id: string;
  name: string;
  status: string;
  currentBacklogItemId?: string;
  currentBranch?: string;
};

type BacklogItem = {
  id: string;
  content: string;
  description?: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'WAITING' | 'PR_OPEN' | 'DONE' | 'FAILED';
  branch?: string;
  prUrl?: string;
  prNumber?: number;
  position: number;
};

type Orchestra = {
  id: string;
  name: string;
  repositoryPath: string;
  githubRemote?: string;
  wipLimit: number;
  status: 'ACTIVE' | 'PAUSED';
  lastSyncedAt?: string;
  lastSyncedHash?: string;
};

export type SyncPreviewData = {
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
};

export default function OrchestraDetail() {
  const params = useParams();
  const orchestraId = params.id as string;

  const [orchestra, setOrchestra] = useState<Orchestra | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showTerminatedAgents, setShowTerminatedAgents] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync-related state
  const [syncPreview, setSyncPreview] = useState<SyncPreviewData | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  // Expandable backlog items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const fetchOrchestra = useCallback(async () => {
    try {
      const res = await fetch(`/api/orchestras/${orchestraId}`);
      const result = await res.json();
      if (result.success) {
        setOrchestra(result.data);
      } else {
        console.error('Failed to fetch orchestra:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch orchestra:', error);
    } finally {
      setLoading(false);
    }
  }, [orchestraId]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`/api/orchestras/${orchestraId}/agents`);
      const result = await res.json();
      if (result.success) {
        setAgents(result.data);
      } else {
        console.error('Failed to fetch agents:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  }, [orchestraId]);

  const fetchBacklog = useCallback(async () => {
    try {
      const res = await fetch(`/api/orchestras/${orchestraId}/backlog`);
      const result = await res.json();
      if (result.success) {
        setBacklogItems(result.data);
      } else {
        console.error('Failed to fetch backlog:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch backlog:', error);
    }
  }, [orchestraId]);

  const checkForSyncChanges = useCallback(async () => {
    try {
      const res = await fetch(`/api/orchestras/${orchestraId}/backlog/sync-preview`, {
        method: 'POST',
      });
      const result = await res.json();
      if (result.success) {
        setSyncPreview(result.data);
      } else {
        console.error('Failed to check sync:', result.error);
        setSyncPreview(null);
      }
    } catch (error) {
      console.error('Failed to check sync:', error);
      setSyncPreview(null);
    }
  }, [orchestraId]);

  const executeSync = async (conflictResolutions: Array<{ action: 'requeue' | 'skip'; conflictIndex: number }>) => {
    setSyncLoading(true);
    try {
      const res = await fetch(`/api/orchestras/${orchestraId}/backlog/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conflictResolutions }),
      });
      const result = await res.json();
      if (result.success) {
        setShowSyncModal(false);
        setSyncPreview(null);
        // Refresh data after sync
        await fetchBacklog();
        await fetchOrchestra();
        await checkForSyncChanges();
      } else {
        console.error('Failed to execute sync:', result.error);
      }
    } catch (error) {
      console.error('Failed to execute sync:', error);
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    if (orchestraId) {
      fetchOrchestra();
      fetchAgents();
      fetchBacklog();
      checkForSyncChanges();
    }
  }, [orchestraId, fetchOrchestra, fetchAgents, fetchBacklog, checkForSyncChanges]);

  const createAgent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch(`/api/orchestras/${orchestraId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
        }),
      });

      if (res.ok) {
        setShowAgentModal(false);
        fetchAgents();
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const pauseAgent = async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAUSED' }),
      });
      fetchAgents();
    } catch (error) {
      console.error('Failed to pause agent:', error);
    }
  };

  const resumeAgent = async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WORKING' }),
      });
      fetchAgents();
    } catch (error) {
      console.error('Failed to resume agent:', error);
    }
  };

  const killAgent = async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
      });
      fetchAgents();
      fetchBacklog();
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
    } catch (error) {
      console.error('Failed to kill agent:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sync Banner */}
      {syncPreview?.hasChanges && (
        <SyncBanner
          preview={syncPreview}
          onReviewChanges={() => setShowSyncModal(true)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {orchestra?.name}
          </h1>
          <button
            onClick={() => setShowAgentModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer"
          >
            Spawn Agent
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agents Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Agents
              </h2>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowTerminatedAgents(false)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  !showTerminatedAgents
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setShowTerminatedAgents(true)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  showTerminatedAgents
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Terminated
              </button>
            </div>

            {agents.filter(a => showTerminatedAgents ? a.status === 'TERMINATED' : a.status !== 'TERMINATED').length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                {showTerminatedAgents ? 'No terminated agents' : 'No agents yet'}
              </p>
            ) : (
              agents.filter(a => showTerminatedAgents ? a.status === 'TERMINATED' : a.status !== 'TERMINATED').map((agent) => (
                <div
                  key={agent.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedAgent?.id === agent.id
                      ? 'ring-2 ring-blue-600'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {agent.name}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        agent.status === 'WORKING'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : agent.status === 'PAUSED'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          : agent.status === 'TERMINATED'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                  {agent.currentBacklogItemId && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      Working on: {backlogItems.find(item => item.id === agent.currentBacklogItemId)?.content}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    {agent.status === 'WORKING' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          pauseAgent(agent.id);
                        }}
                        className="text-sm px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                      >
                        Pause
                      </button>
                    )}
                    {agent.status === 'PAUSED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resumeAgent(agent.id);
                        }}
                        className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        Resume
                      </button>
                    )}
                    {agent.status !== 'TERMINATED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          killAgent(agent.id);
                        }}
                        className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        Kill
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Backlog Panel */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Backlog
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {backlogItems.map((item) => {
                const isExpanded = expandedItems.has(item.id);
                const hasDescription = item.description && item.description.trim().length > 0;

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-800 rounded-lg p-3"
                  >
                    <div
                      className={`flex justify-between items-start ${hasDescription ? 'cursor-pointer' : ''}`}
                      onClick={() => hasDescription && toggleItemExpanded(item.id)}
                    >
                      <div className="flex items-start flex-grow min-w-0">
                        {hasDescription && (
                          <span className="mr-2 text-gray-400 dark:text-gray-500 flex-shrink-0 text-sm">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        )}
                        <p className="text-sm text-gray-900 dark:text-white truncate">
                          {item.content}
                        </p>
                      </div>
                      <span
                        className={`ml-2 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : item.status === 'WAITING'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : item.status === 'PR_OPEN'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : item.status === 'DONE'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : item.status === 'FAILED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    {isExpanded && hasDescription && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                          {item.description}
                        </div>
                      </div>
                    )}
                    {item.prUrl && (
                      <a
                        href={item.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        PR #{item.prNumber}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent Conversation Panel */}
          <div className="lg:col-span-1">
            {selectedAgent ? (
              <AgentConversation
                agent={selectedAgent}
                onApprove={() => {
                  fetchBacklog();
                  fetchAgents();
                }}
                onRevise={() => {
                  fetchBacklog();
                  fetchAgents();
                }}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Select an agent to view conversation
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Agent Modal */}
      {showAgentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Spawn New Agent
            </h2>
            <form onSubmit={createAgent}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="Agent-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAgentModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-pointer"
                >
                  Spawn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sync Preview Modal */}
      {showSyncModal && syncPreview && (
        <SyncPreviewModal
          preview={syncPreview}
          loading={syncLoading}
          onClose={() => setShowSyncModal(false)}
          onSync={executeSync}
        />
      )}
    </div>
  );
}