import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

/**
 * Append messages to a Claude Code session .jsonl file
 * Matches the format used by the Claude Code CLI for interoperability
 */
export async function appendMessagesToSession(
  sessionId: string,
  repositoryPath: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
  const encodedPath = repositoryPath.replace(/\//g, '-');
  const sessionFilePath = path.join(claudeProjectsDir, encodedPath, `${sessionId}.jsonl`);

  if (!fs.existsSync(sessionFilePath)) {
    throw new Error(`Session file not found: ${sessionFilePath}`);
  }

  // Read existing file to get the last message UUID
  const content = fs.readFileSync(sessionFilePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());

  let parentUuid: string | null = null;
  if (lines.length > 0) {
    try {
      const lastEntry = JSON.parse(lines[lines.length - 1]);
      parentUuid = lastEntry.uuid || null;
    } catch {
      // If we can't parse, start with null parent
    }
  }

  // Get git branch if possible
  let gitBranch = 'main';
  try {
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repositoryPath,
      encoding: 'utf-8'
    }).trim();
  } catch {
    // Ignore git errors
  }

  const timestamp = new Date().toISOString();
  const userUuid = randomUUID();
  const assistantUuid = randomUUID();

  // Create user message entry
  const userEntry = {
    parentUuid,
    isSidechain: false,
    userType: 'external',
    cwd: repositoryPath,
    sessionId,
    version: '2.0.76', // Match CLI version
    gitBranch,
    type: 'user',
    message: {
      role: 'user',
      content: userMessage
    },
    uuid: userUuid,
    timestamp,
    thinkingMetadata: {
      level: 'high',
      disabled: false,
      triggers: []
    },
    todos: [],
    orchestraSource: true  // Mark as Orchestra-generated
  };

  // Create assistant message entry
  const assistantEntry = {
    parentUuid: userUuid,
    isSidechain: false,
    userType: 'external',
    cwd: repositoryPath,
    sessionId,
    version: '2.0.76',
    gitBranch,
    type: 'assistant',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      id: `msg_${randomUUID().replace(/-/g, '')}`,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: assistantMessage
        }
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0
      }
    },
    requestId: `req_${randomUUID().replace(/-/g, '')}`,
    uuid: assistantUuid,
    timestamp: new Date().toISOString(),
    orchestraSource: true  // Mark as Orchestra-generated
  };

  // Append both messages to file
  fs.appendFileSync(
    sessionFilePath,
    JSON.stringify(userEntry) + '\n' + JSON.stringify(assistantEntry) + '\n',
    'utf-8'
  );
}
