import fs from 'fs';
import path from 'path';
import os from 'os';

export interface Session {
  id: string;
  type: 'cli' | 'sdk';
  projectPath: string;
  lastActivity: Date;
  messageCount: number;
  branch?: string;
}

export class SessionManager {
  private claudeProjectsDir: string;

  constructor(homeDir?: string) {
    const home = homeDir || os.homedir();
    this.claudeProjectsDir = path.join(home, '.claude', 'projects');
  }

  /**
   * Encode a repository path to match Claude's directory naming convention
   */
  private encodeRepositoryPath(repositoryPath: string): string {
    return repositoryPath.replace(/\//g, '-');
  }

  /**
   * Get all sessions for a given repository path
   */
  async getSessionsForRepository(repositoryPath: string): Promise<Session[]> {
    const encodedPath = this.encodeRepositoryPath(repositoryPath);
    const projectDir = path.join(this.claudeProjectsDir, encodedPath);

    // Check if project directory exists
    if (!fs.existsSync(projectDir)) {
      return [];
    }

    const files = fs.readdirSync(projectDir);
    const sessionFiles = files.filter(f => f.endsWith('.jsonl'));

    const sessions: Session[] = [];

    for (const file of sessionFiles) {
      const session = await this.parseSessionFile(path.join(projectDir, file), repositoryPath);
      if (session) {
        sessions.push(session);
      }
    }

    // Sort by last activity (most recent first)
    return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  /**
   * Parse a session .jsonl file to extract metadata
   */
  private async parseSessionFile(filePath: string, projectPath: string): Promise<Session | null> {
    try {
      const filename = path.basename(filePath, '.jsonl');
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        return null;
      }

      // Determine session type from filename
      const type: 'cli' | 'sdk' = filename.startsWith('agent-') ? 'sdk' : 'cli';

      // Parse messages to get metadata
      let lastTimestamp: Date | null = null;
      let messageCount = 0;
      let branch: string | undefined;

      for (const line of lines) {
        try {
          const message = JSON.parse(line);

          // Count user and assistant messages
          if (message.type === 'user' || message.type === 'assistant') {
            messageCount++;
          }

          // Get last timestamp
          if (message.timestamp) {
            const ts = new Date(message.timestamp);
            if (!lastTimestamp || ts > lastTimestamp) {
              lastTimestamp = ts;
            }
          }

          // Extract branch info if available
          if (message.cwd && !branch) {
            // Try to extract branch from git context if present
            // For now, we'll leave this as undefined and can enhance later
          }
        } catch (e) {
          // Skip malformed lines
          continue;
        }
      }

      // Fall back to file modification time if no timestamps found
      if (!lastTimestamp) {
        const stats = fs.statSync(filePath);
        lastTimestamp = stats.mtime;
      }

      return {
        id: filename,
        type,
        projectPath,
        lastActivity: lastTimestamp,
        messageCount,
        branch,
      };
    } catch (error) {
      console.error(`Error parsing session file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get a specific session by ID
   */
  async getSession(repositoryPath: string, sessionId: string): Promise<Session | null> {
    const sessions = await this.getSessionsForRepository(repositoryPath);
    return sessions.find(s => s.id === sessionId) || null;
  }
}

// Export function to get singleton instance
let _instance: SessionManager | null = null;
export function getSessionManager(): SessionManager {
  if (!_instance) {
    _instance = new SessionManager();
  }
  return _instance;
}

// For convenience in API routes
export const sessionManager = {
  getSessionsForRepository: (path: string) => getSessionManager().getSessionsForRepository(path),
  getSession: (path: string, id: string) => getSessionManager().getSession(path, id),
};
