'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Agent = {
  id: string;
  name: string;
  status: string;
  currentBacklogItemId?: string;
};

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

interface AgentConversationProps {
  agent: Agent;
  onApprove: () => void;
  onRevise: () => void;
}

export default function AgentConversation({ agent, onApprove, onRevise }: AgentConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agent.id}/messages`);
      const result = await res.json();
      if (result.success) {
        setMessages(result.data);
      } else {
        console.error('Failed to fetch messages:', result.error);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages([]);
    }
  }, [agent.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    // Add user message optimistically
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'USER',
      content: content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch(`/api/agents/${agent.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let accumulatedContent = '';
        let toolActivity = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'text' && data.chunk) {
                  // Text response from Claude
                  accumulatedContent += data.chunk;
                  setStreamingContent(accumulatedContent + (toolActivity ? '\n\n' + toolActivity : ''));
                } else if (data.type === 'tool_use') {
                  // Tool being used (file edit, bash, etc.)
                  let toolInfo = `\n🔧 ${data.tool}`;

                  // Add tool details based on type
                  if (data.input) {
                    if (data.tool === 'Bash') {
                      toolInfo += `\n   $ ${data.input.command}`;
                    } else if (data.tool === 'Read') {
                      toolInfo += `\n   📄 ${data.input.file_path}`;
                    } else if (data.tool === 'Write') {
                      toolInfo += `\n   ✏️  ${data.input.file_path}`;
                    } else if (data.tool === 'Edit') {
                      toolInfo += `\n   ✏️  ${data.input.file_path}`;
                    } else if (data.tool === 'Grep') {
                      toolInfo += `\n   🔍 ${data.input.pattern}${data.input.path ? ' in ' + data.input.path : ''}`;
                    } else if (data.tool === 'Glob') {
                      toolInfo += `\n   📁 ${data.input.pattern}`;
                    } else {
                      // For other tools, show JSON input
                      toolInfo += `\n   ${JSON.stringify(data.input, null, 2).split('\n').join('\n   ')}`;
                    }
                  }

                  toolActivity += toolInfo;
                  setStreamingContent(accumulatedContent + '\n\n' + toolActivity);
                } else if (data.type === 'tool_result') {
                  // Tool result
                  toolActivity += `\n✓ Done`;
                } else if (data.chunk) {
                  // Fallback for old format
                  accumulatedContent += data.chunk;
                  setStreamingContent(accumulatedContent);
                } else if (data.done) {
                  // Add assistant message to messages
                  const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'ASSISTANT',
                    content: accumulatedContent || toolActivity || '(Completed)',
                    createdAt: new Date().toISOString(),
                  };
                  setMessages(prev => [...prev, assistantMessage]);
                  setStreamingContent('');
                } else if (data.error) {
                  console.error('Stream error:', data.error);
                  setStreamingContent(prev => prev + '\n\n❌ Error: ' + data.error);
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleApprove = async () => {
    if (!agent.currentBacklogItemId) return;

    try {
      await fetch(`/api/backlog/${agent.currentBacklogItemId}/approve`, {
        method: 'POST',
      });
      onApprove();
      fetchMessages(); // Refresh messages to show approval
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleRevise = async () => {
    if (!agent.currentBacklogItemId || !revisionFeedback.trim()) return;

    try {
      await fetch(`/api/backlog/${agent.currentBacklogItemId}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: revisionFeedback }),
      });
      setShowRevisionInput(false);
      setRevisionFeedback('');
      onRevise();
      fetchMessages(); // Refresh to show revision request
    } catch (error) {
      console.error('Failed to request revision:', error);
    }
  };

  return (
    <div
      className="rounded-xl h-[600px] flex flex-col"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)'
      }}
    >
      {/* Header */}
      <div className="p-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex justify-between items-center">
          <h3
            className="font-light text-lg"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)'
            }}
          >
            {agent.name}
          </h3>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
            style={
              agent.status === 'WORKING'
                ? { background: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04' }
                : agent.status === 'PAUSED'
                ? { background: 'rgba(249, 115, 22, 0.1)', color: '#ea580c' }
                : { background: 'var(--border)', color: 'var(--text-secondary)' }
            }
          >
            {agent.status}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-5 space-y-4">
        {messages
          .filter(msg => msg.role !== 'SYSTEM')
          .map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'USER' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-xl p-3.5`}
                style={
                  message.role === 'USER'
                    ? { background: 'var(--accent)', color: 'var(--surface-elevated)' }
                    : { background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
                }
              >
                <pre className="whitespace-pre-wrap font-sans text-sm" style={{ margin: 0 }}>
                  {message.content}
                </pre>
              </div>
            </div>
          ))}

        {/* Streaming message */}
        {streamingContent && (
          <div className="flex justify-start">
            <div
              className="max-w-[80%] rounded-xl p-3.5"
              style={{
                background: 'var(--background)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)'
              }}
            >
              <pre className="whitespace-pre-wrap font-sans text-sm" style={{ margin: 0 }}>
                {streamingContent}
              </pre>
              <span
                className="inline-block w-2 h-4 animate-pulse ml-1"
                style={{ background: 'var(--accent)' }}
              ></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Review Controls */}
      {agent.status === 'WORKING' && agent.currentBacklogItemId && (
        <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
          {!showRevisionInput ? (
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#16a34a'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)'}
              >
                Approve & Complete
              </button>
              <button
                onClick={() => setShowRevisionInput(true)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                style={{
                  background: 'rgba(249, 115, 22, 0.1)',
                  color: '#ea580c'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(249, 115, 22, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(249, 115, 22, 0.1)'}
              >
                Request Revision
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                placeholder="Describe what needs to be revised..."
                className="w-full px-4 py-2.5 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--text-primary)'
                }}
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRevise}
                  disabled={!revisionFeedback.trim()}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--surface-elevated)'
                  }}
                >
                  Send Revision Request
                </button>
                <button
                  onClick={() => {
                    setShowRevisionInput(false);
                    setRevisionFeedback('');
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isStreaming ? 'Agent is responding...' : 'Type a message...'}
            disabled={isStreaming}
            className="flex-grow px-4 py-2.5 rounded-lg text-sm disabled:opacity-50"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--text-primary)'
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{
              background: 'var(--accent)',
              color: 'var(--surface-elevated)'
            }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent)')}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}