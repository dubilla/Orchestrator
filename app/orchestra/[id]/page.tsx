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
      <div className="flex justify-center items-center min-h-screen" style={{ background: 'var(--background)' }}>
        <div
          className="animate-spin rounded-full h-10 w-10 border-2"
          style={{
            borderColor: 'var(--border)',
            borderTopColor: 'var(--accent)'
          }}
        ></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Sync Banner */}
      {syncPreview?.hasChanges && (
        <SyncBanner
          preview={syncPreview}
          onReviewChanges={() => setShowSyncModal(true)}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <h1
            className="text-4xl font-light tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)'
            }}
          >
            {orchestra?.name}
          </h1>
          <button
            onClick={() => setShowAgentModal(true)}
            className="px-5 py-2.5 text-sm font-medium rounded-lg cursor-pointer"
            style={{
              background: 'var(--accent)',
              color: 'var(--surface-elevated)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
          >
            Spawn Agent
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agents Panel */}
          <div className="lg:col-span-1 space-y-4">
            <h2
              className="text-xl font-light mb-5"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--text-primary)'
              }}
            >
              Agents
            </h2>

            {/* Tab Switcher */}
            <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
              <button
                onClick={() => setShowTerminatedAgents(false)}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all cursor-pointer`}
                style={
                  !showTerminatedAgents
                    ? { background: 'var(--accent)', color: 'var(--surface-elevated)' }
                    : { background: 'transparent', color: 'var(--text-secondary)' }
                }
              >
                Active
              </button>
              <button
                onClick={() => setShowTerminatedAgents(true)}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all cursor-pointer`}
                style={
                  showTerminatedAgents
                    ? { background: 'var(--accent)', color: 'var(--surface-elevated)' }
                    : { background: 'transparent', color: 'var(--text-secondary)' }
                }
              >
                Terminated
              </button>
            </div>

            {agents.filter(a => showTerminatedAgents ? a.status === 'TERMINATED' : a.status !== 'TERMINATED').length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                {showTerminatedAgents ? 'No terminated agents' : 'No agents yet'}
              </p>
            ) : (
              agents.filter(a => showTerminatedAgents ? a.status === 'TERMINATED' : a.status !== 'TERMINATED').map((agent) => (
                <div
                  key={agent.id}
                  className={`rounded-xl p-4 cursor-pointer transition-all ${
                    selectedAgent?.id === agent.id
                      ? 'ring-2'
                      : ''
                  }`}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    ...(selectedAgent?.id === agent.id && { ringColor: 'var(--accent)', borderColor: 'var(--accent)' })
                  }}
                  onClick={() => setSelectedAgent(agent)}
                  onMouseEnter={(e) => {
                    if (selectedAgent?.id !== agent.id) {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-subtle)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedAgent?.id !== agent.id) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {agent.name}
                    </h3>
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                      style={
                        agent.status === 'WORKING'
                          ? { background: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04' }
                          : agent.status === 'PAUSED'
                          ? { background: 'rgba(249, 115, 22, 0.1)', color: '#ea580c' }
                          : agent.status === 'TERMINATED'
                          ? { background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }
                          : { background: 'var(--border)', color: 'var(--text-secondary)' }
                      }
                    >
                      {agent.status}
                    </span>
                  </div>
                  {agent.currentBacklogItemId && (
                    <p className="text-sm truncate mb-3" style={{ color: 'var(--text-secondary)' }}>
                      {backlogItems.find(item => item.id === agent.currentBacklogItemId)?.content}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {agent.status === 'WORKING' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          pauseAgent(agent.id);
                        }}
                        className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer"
                        style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#ea580c' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(249, 115, 22, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(249, 115, 22, 0.1)'}
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
                        className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer"
                        style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)'}
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
                        className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer"
                        style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'}
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
            <h2
              className="text-xl font-light mb-5"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--text-primary)'
              }}
            >
              Backlog
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {backlogItems.map((item) => {
                const isExpanded = expandedItems.has(item.id);
                const hasDescription = item.description && item.description.trim().length > 0;

                return (
                  <div
                    key={item.id}
                    className="rounded-lg p-3.5 transition-all"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div
                      className={`flex justify-between items-start ${hasDescription ? 'cursor-pointer' : ''}`}
                      onClick={() => hasDescription && toggleItemExpanded(item.id)}
                    >
                      <div className="flex items-start flex-grow min-w-0">
                        {hasDescription && (
                          <span className="mr-2 flex-shrink-0 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        )}
                        <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {item.content}
                        </p>
                      </div>
                      <span
                        className={`ml-2 flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium`}
                        style={
                          item.status === 'IN_PROGRESS'
                            ? { background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }
                            : item.status === 'WAITING'
                            ? { background: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04' }
                            : item.status === 'PR_OPEN'
                            ? { background: 'rgba(168, 85, 247, 0.1)', color: '#9333ea' }
                            : item.status === 'DONE'
                            ? { background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }
                            : item.status === 'FAILED'
                            ? { background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }
                            : { background: 'var(--border)', color: 'var(--text-secondary)' }
                        }
                      >
                        {item.status}
                      </span>
                    </div>
                    {isExpanded && hasDescription && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                          {item.description}
                        </div>
                      </div>
                    )}
                    {item.prUrl && (
                      <a
                        href={item.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs hover:underline mt-2 block"
                        style={{ color: 'var(--accent)' }}
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
              <div
                className="rounded-xl p-8 text-center"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)'
                }}
              >
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Select an agent to view conversation
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Agent Modal */}
      {showAgentModal && (
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
              Spawn Agent
            </h2>
            <form onSubmit={createAgent}>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Agent Name
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
                    placeholder="Agent-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowAgentModal(false)}
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