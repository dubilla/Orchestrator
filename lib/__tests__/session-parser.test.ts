import { parseSessionHistory } from '../session-parser';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock fs and os modules
jest.mock('fs');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('parseSessionHistory', () => {
  const mockHomeDir = '/Users/testuser';
  const mockClaudeProjectsDir = '/Users/testuser/.claude/projects';
  const repositoryPath = '/Users/testuser/App1';
  const encodedPath = '-Users-testuser-App1';
  const sessionId = 'test-session-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockOs.homedir.mockReturnValue(mockHomeDir);
  });

  it('should return empty array if session file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = parseSessionHistory(sessionId, repositoryPath);

    expect(result).toEqual([]);
    expect(mockFs.existsSync).toHaveBeenCalledWith(
      path.join(mockClaudeProjectsDir, encodedPath, `${sessionId}.jsonl`)
    );
  });

  it('should parse user and assistant messages from CLI session', () => {
    const sessionContent = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Hello Claude' },
        timestamp: '2026-01-03T12:00:00Z'
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello! How can I help?' }]
        },
        timestamp: '2026-01-03T12:01:00Z'
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Can you help me with a bug?' },
        timestamp: '2026-01-03T12:02:00Z'
      })
    ].join('\n');

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(sessionContent);

    const result = parseSessionHistory(sessionId, repositoryPath);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      role: 'user',
      content: 'Hello Claude',
      timestamp: '2026-01-03T12:00:00Z'
    });
    expect(result[1]).toEqual({
      role: 'assistant',
      content: 'Hello! How can I help?',
      timestamp: '2026-01-03T12:01:00Z'
    });
    expect(result[2]).toEqual({
      role: 'user',
      content: 'Can you help me with a bug?',
      timestamp: '2026-01-03T12:02:00Z'
    });
  });

  it('should handle multiple text blocks in assistant message', () => {
    const sessionContent = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'First part.' },
          { type: 'text', text: 'Second part.' }
        ]
      },
      timestamp: '2026-01-03T12:00:00Z'
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(sessionContent);

    const result = parseSessionHistory(sessionId, repositoryPath);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('First part.\nSecond part.');
  });

  it('should filter out non-text content blocks', () => {
    const sessionContent = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Valid text' },
          { type: 'thinking', thinking: 'Internal thoughts' },
          { type: 'tool_use', name: 'Read', input: {} }
        ]
      },
      timestamp: '2026-01-03T12:00:00Z'
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(sessionContent);

    const result = parseSessionHistory(sessionId, repositoryPath);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Valid text');
  });

  it('should skip malformed JSON lines', () => {
    const sessionContent = [
      'invalid json line',
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Valid message' },
        timestamp: '2026-01-03T12:00:00Z'
      }),
      'another invalid line'
    ].join('\n');

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(sessionContent);

    const result = parseSessionHistory(sessionId, repositoryPath);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Valid message');
  });

  it('should skip non-user and non-assistant message types', () => {
    const sessionContent = [
      JSON.stringify({ type: 'file-history-snapshot', data: {} }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'User message' },
        timestamp: '2026-01-03T12:00:00Z'
      }),
      JSON.stringify({ type: 'tool_result', result: 'some output' }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Assistant message' }]
        },
        timestamp: '2026-01-03T12:01:00Z'
      })
    ].join('\n');

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(sessionContent);

    const result = parseSessionHistory(sessionId, repositoryPath);

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
  });

  it('should handle empty session file', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('');

    const result = parseSessionHistory(sessionId, repositoryPath);

    expect(result).toEqual([]);
  });

  it('should handle session file with only whitespace', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('\n\n  \n  \n');

    const result = parseSessionHistory(sessionId, repositoryPath);

    expect(result).toEqual([]);
  });
});
