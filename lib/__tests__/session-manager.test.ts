import { SessionManager } from '../session-manager';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const mockHomeDir = '/Users/testuser';
  const mockClaudeProjectsDir = '/Users/testuser/.claude/projects';

  beforeEach(() => {
    jest.clearAllMocks();
    mockOs.homedir.mockReturnValue(mockHomeDir);
    sessionManager = new SessionManager(mockHomeDir);
  });

  describe('getSessionsForRepository', () => {
    it('should return empty array if project directory does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const sessions = await sessionManager.getSessionsForRepository('/Users/testuser/App1');

      expect(sessions).toEqual([]);
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(mockClaudeProjectsDir, '-Users-testuser-App1')
      );
    });

    it('should return empty array if no session files exist', async () => {
      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([]);

      const sessions = await sessionManager.getSessionsForRepository('/Users/testuser/App1');

      expect(sessions).toEqual([]);
    });

    it('should parse CLI session files correctly', async () => {
      const sessionId = '9a2989a0-b1b0-4f7b-870d-2636cdbb4a10';
      const sessionFile = `${sessionId}.jsonl`;
      const projectPath = '/Users/testuser/App1';

      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([sessionFile]);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ type: 'user', timestamp: '2026-01-03T12:00:00Z' }) + '\n' +
        JSON.stringify({ type: 'assistant', timestamp: '2026-01-03T12:01:00Z' }) + '\n' +
        JSON.stringify({ type: 'user', timestamp: '2026-01-03T12:02:00Z' })
      );
      mockFs.statSync.mockReturnValue({ mtime: new Date('2026-01-03T12:02:00Z') } as unknown as fs.Stats);

      const sessions = await sessionManager.getSessionsForRepository(projectPath);

      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        id: sessionId,
        type: 'cli',
        projectPath,
        messageCount: 3,
      });
      expect(sessions[0].lastActivity).toBeInstanceOf(Date);
    });

    it('should parse SDK session files correctly', async () => {
      const sessionId = 'agent-a68daa6';
      const sessionFile = `${sessionId}.jsonl`;
      const projectPath = '/Users/testuser/App1';

      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([sessionFile]);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ type: 'user', timestamp: '2026-01-03T12:00:00Z' }) + '\n' +
        JSON.stringify({ type: 'assistant', timestamp: '2026-01-03T12:01:00Z' })
      );
      mockFs.statSync.mockReturnValue({ mtime: new Date('2026-01-03T12:01:00Z') } as unknown as fs.Stats);

      const sessions = await sessionManager.getSessionsForRepository(projectPath);

      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        id: sessionId,
        type: 'sdk',
        projectPath,
        messageCount: 2,
      });
    });

    it('should sort sessions by last activity (most recent first)', async () => {
      const olderSession = 'session-1.jsonl';
      const newerSession = 'session-2.jsonl';
      const projectPath = '/Users/testuser/App1';

      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([olderSession, newerSession]);

      // First session (older)
      mockFs.readFileSync.mockReturnValueOnce(
        JSON.stringify({ type: 'user', timestamp: '2026-01-01T12:00:00Z' })
      );
      mockFs.statSync.mockReturnValueOnce({ mtime: new Date('2026-01-01T12:00:00Z') } as unknown as fs.Stats);

      // Second session (newer)
      mockFs.readFileSync.mockReturnValueOnce(
        JSON.stringify({ type: 'user', timestamp: '2026-01-03T12:00:00Z' })
      );
      mockFs.statSync.mockReturnValueOnce({ mtime: new Date('2026-01-03T12:00:00Z') } as unknown as fs.Stats);

      const sessions = await sessionManager.getSessionsForRepository(projectPath);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-2');
      expect(sessions[1].id).toBe('session-1');
    });

    it('should handle malformed JSON gracefully', async () => {
      const sessionFile = 'test-session.jsonl';
      const projectPath = '/Users/testuser/App1';

      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([sessionFile]);
      mockFs.readFileSync.mockReturnValue(
        'invalid json\n' +
        JSON.stringify({ type: 'user', timestamp: '2026-01-03T12:00:00Z' }) + '\n' +
        'more invalid json'
      );
      mockFs.statSync.mockReturnValue({ mtime: new Date('2026-01-03T12:00:00Z') } as unknown as fs.Stats);

      const sessions = await sessionManager.getSessionsForRepository(projectPath);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].messageCount).toBe(1); // Only counted the valid line
    });
  });

  describe('getSession', () => {
    it('should return specific session by ID', async () => {
      const sessionId = 'test-session';
      const sessionFile = `${sessionId}.jsonl`;
      const projectPath = '/Users/testuser/App1';

      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([sessionFile]);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ type: 'user', timestamp: '2026-01-03T12:00:00Z' })
      );
      mockFs.statSync.mockReturnValue({ mtime: new Date('2026-01-03T12:00:00Z') } as unknown as fs.Stats);

      const session = await sessionManager.getSession(projectPath, sessionId);

      expect(session).not.toBeNull();
      expect(session?.id).toBe(sessionId);
    });

    it('should return null if session not found', async () => {
      const projectPath = '/Users/testuser/App1';

      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([]);

      const session = await sessionManager.getSession(projectPath, 'non-existent');

      expect(session).toBeNull();
    });
  });
});
