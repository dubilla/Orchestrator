'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { SessionMessage } from '@/lib/session-parser';
import SkillPalette from '@/components/SkillPalette';

interface Session {
  id: string;
  type: 'cli' | 'sdk';
  projectPath: string;
  lastActivity: Date;
  messageCount: number;
  branch?: string;
}

interface ToolExecution {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  timestamp: string;
  status: 'running' | 'completed';
}

interface Skill {
  name: string;
  description: string;
  source: 'global' | 'local';
}

// Helper to format tool input for display
function formatToolInput(input: Record<string, unknown>): string {
  // Show file_path if it exists
  if (input.file_path && typeof input.file_path === 'string') {
    return `on ${input.file_path.split('/').pop()}`;
  }
  // Show command if it exists
  if (input.command && typeof input.command === 'string') {
    const cmd = input.command;
    return cmd.length > 30 ? `${cmd.substring(0, 30)}...` : cmd;
  }
  // Show pattern if it exists (for Grep)
  if (input.pattern && typeof input.pattern === 'string') {
    return `"${input.pattern}"`;
  }
  return '';
}

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const sessionId = params?.sessionId as string;
  const repositoryPath = searchParams?.get('repo');

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showSkillPalette, setShowSkillPalette] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch session metadata and history
  const fetchSession = useCallback(async () => {
    if (!repositoryPath) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch session metadata
      const sessionRes = await fetch(`/api/sessions/${sessionId}?repositoryPath=${encodeURIComponent(repositoryPath)}`);
      if (!sessionRes.ok) throw new Error('Failed to fetch session');
      const sessionData = await sessionRes.json();

      if (sessionData.success) {
        setSession(sessionData.data);
      }

      // Fetch session history
      const historyRes = await fetch(`/api/sessions/${sessionId}/history?repositoryPath=${encodeURIComponent(repositoryPath)}`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        if (historyData.success) {
          setMessages(historyData.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, repositoryPath]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Fetch available skills
  useEffect(() => {
    const fetchSkills = async () => {
      if (!repositoryPath) return;

      try {
        const res = await fetch(`/api/skills?repositoryPath=${encodeURIComponent(repositoryPath)}`);
        const data = await res.json();

        if (data.success) {
          setSkills(data.data.skills);
        }
      } catch (error) {
        console.error('Failed to fetch skills:', error);
      }
    };

    fetchSkills();
  }, [repositoryPath]);

  // Handle ⌘K keyboard shortcut to open skill palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSkillPalette(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle skill selection
  const handleSkillSelect = (skillName: string) => {
    setInput(`/${skillName} `);
  };

  // Send message and stream response
  const sendMessage = async () => {
    if (!input.trim() || streaming || !repositoryPath) return;

    const userMessage: SessionMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages((prev: SessionMessage[]) => [...prev, userMessage]);
    setInput('');
    setStreaming(true);
    setStreamingMessage('');

    try {
      const response = await fetch(`/api/sessions/${sessionId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage.content,
          repositoryPath
        })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.chunk && data.type === 'text') {
                fullResponse += data.chunk;
                setStreamingMessage(fullResponse);
              } else if (data.type === 'tool_use') {
                // Track tool execution
                setToolExecutions(prev => [...prev, {
                  id: data.tool_use_id || crypto.randomUUID(),
                  name: data.tool,
                  input: data.input,
                  timestamp: new Date().toISOString(),
                  status: 'running'
                }]);
              } else if (data.done) {
                // Mark all tools as completed
                setToolExecutions(prev => prev.map(tool => ({
                  ...tool,
                  status: 'completed'
                })));

                // Finalize assistant message
                setMessages((prev: SessionMessage[]) => [...prev, {
                  role: 'assistant',
                  content: fullResponse,
                  timestamp: new Date().toISOString()
                }]);
                setStreamingMessage('');
                setToolExecutions([]); // Clear after message is complete
              } else if (data.error) {
                console.error('Stream error:', data.error);
                setStreamingMessage('');
                setToolExecutions([]);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setStreaming(false);
    }
  };

  if (!repositoryPath) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <h1>Error: Repository path required</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
          Please navigate from an Orchestra to continue a session.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
          Loading session...
        </p>
      </div>
    );
  }

  const projectName = repositoryPath.split('/').pop() || 'Unknown Project';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--background)'
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '1.25rem 2rem',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            href="/"
            style={{
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: '1.25rem'
            }}
          >
            ←
          </Link>
          <div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 300,
              margin: 0,
              color: 'var(--text-primary)'
            }}>
              {projectName}
            </h1>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              marginTop: '0.25rem'
            }}>
              <span style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.375rem',
                background: session?.type === 'cli'
                  ? 'rgba(168, 85, 247, 0.1)'
                  : 'rgba(59, 130, 246, 0.1)',
                color: session?.type === 'cli' ? '#9333ea' : '#3b82f6',
                fontWeight: 500
              }}>
                {session?.type?.toUpperCase() || 'SESSION'}
              </span>
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-geist-mono)'
              }}>
                {sessionId}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {messages.map((msg: SessionMessage, idx: number) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div style={{
              maxWidth: '80%',
              padding: '1rem 1.25rem',
              borderRadius: '0.75rem',
              background: msg.role === 'user'
                ? 'var(--accent)'
                : 'var(--surface)',
              border: msg.role === 'user'
                ? 'none'
                : '1px solid var(--border)',
              color: msg.role === 'user'
                ? 'white'
                : 'var(--text-primary)'
            }}>
              <p style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}>
                {msg.content}
              </p>
            </div>
          </div>
        ))}

        {/* Tool executions */}
        {toolExecutions.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {toolExecutions.map((tool) => (
                <div key={tool.id} style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(139, 92, 70, 0.05)',
                  border: '1px solid rgba(139, 92, 70, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  {tool.status === 'running' && (
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      border: '2px solid var(--accent)',
                      borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                  )}
                  <span style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-geist-mono)'
                  }}>
                    Using <strong style={{ color: 'var(--accent)' }}>{tool.name}</strong>
                    {tool.input && Object.keys(tool.input).length > 0 && (
                      <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                        {formatToolInput(tool.input)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Streaming message */}
        {streaming && streamingMessage && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              padding: '1rem 1.25rem',
              borderRadius: '0.75rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)'
            }}>
              <p style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}>
                {streamingMessage}
                <span className="cursor-blink">▊</span>
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '1.5rem 2rem',
        background: 'var(--surface)'
      }}>
        <div style={{
          display: 'flex',
          gap: '1rem',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Send a message..."
            disabled={streaming}
            style={{
              flex: 1,
              padding: '0.875rem 1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--text-primary)',
              fontSize: '0.9375rem',
              outline: 'none'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            style={{
              padding: '0.875rem 2rem',
              borderRadius: '0.75rem',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
              cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: streaming || !input.trim() ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!streaming && input.trim()) {
                e.currentTarget.style.background = 'var(--accent-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
            }}
          >
            {streaming ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Skill Palette */}
      <SkillPalette
        isOpen={showSkillPalette}
        onClose={() => setShowSkillPalette(false)}
        onSelectSkill={handleSkillSelect}
        skills={skills}
      />

      <style jsx>{`
        .cursor-blink {
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .loading-spinner {
          width: 2.5rem;
          height: 2.5rem;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
