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
    <div className="bg-white dark:bg-gray-800 rounded-lg h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {agent.name}
          </h3>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              agent.status === 'WORKING'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : agent.status === 'PAUSED'
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {agent.status}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
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
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'USER'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {message.content}
                </pre>
              </div>
            </div>
          ))}

        {/* Streaming message */}
        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {streamingContent}
              </pre>
              <span className="inline-block w-2 h-4 bg-gray-600 dark:bg-gray-400 animate-pulse ml-1"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Review Controls */}
      {agent.status === 'WORKING' && agent.currentBacklogItemId && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          {!showRevisionInput ? (
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-sm"
              >
                Approve & Complete
              </button>
              <button
                onClick={() => setShowRevisionInput(true)}
                className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors text-sm"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRevise}
                  disabled={!revisionFeedback.trim()}
                  className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Revision Request
                </button>
                <button
                  onClick={() => {
                    setShowRevisionInput(false);
                    setRevisionFeedback('');
                  }}
                  className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
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
            className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}