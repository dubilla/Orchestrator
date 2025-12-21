import { query } from '@anthropic-ai/claude-agent-sdk';

export interface AgentSessionConfig {
  agentId: string;
  agentName: string;
  workingDirectory: string;
}

export class AgentSession {
  private agentId: string;
  private agentName: string;
  private workingDirectory: string;

  constructor(config: AgentSessionConfig) {
    this.agentId = config.agentId;
    this.agentName = config.agentName;
    this.workingDirectory = config.workingDirectory;
  }

  /**
   * Send a message to the agent using the query() API.
   * Returns a Query object that can be iterated over for streaming responses.
   */
  send(userMessage: string, conversationHistory: Array<{ role: string; content: string }> = []) {
    console.log('[Agent] Sending message to agent:', this.agentName);
    console.log('[Agent] Working directory:', this.workingDirectory);
    console.log('[Agent] Conversation history length:', conversationHistory.length);

    // Build the full prompt with conversation history
    let fullPrompt = `You are ${this.agentName}, an AI agent working on a software project.\n\n`;

    // Add conversation history
    if (conversationHistory.length > 0) {
      fullPrompt += '=== Previous Conversation ===\n';
      conversationHistory.forEach(msg => {
        fullPrompt += `${msg.role}: ${msg.content}\n\n`;
      });
      fullPrompt += '=== End Previous Conversation ===\n\n';
    }

    // Add current user message
    fullPrompt += `User: ${userMessage}`;

    // Execute query with working directory set via cwd option
    const queryResult = query({
      prompt: fullPrompt,
      options: {
        model: 'claude-sonnet-4-5-20250929',
        cwd: this.workingDirectory,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        maxTurns: 50,  // Prevent infinite loops
        maxBudgetUsd: 5.0,  // Cost control per query
      }
    });

    console.log('[Agent] Query started, returning stream');

    return queryResult;
  }

  /**
   * Close the session. Currently a no-op since query() API is stateless.
   */
  async close(): Promise<void> {
    console.log('[Agent] Close session called for:', this.agentId);
    // No-op for query() API - each query is independent
  }

  get id(): string {
    return this.agentId;
  }

  get name(): string {
    return this.agentName;
  }
}

// Cleanup on process exit
process.on('exit', () => {
  // No cleanup needed for query() API
});

process.on('SIGINT', async () => {
  process.exit(0);
});

process.on('SIGTERM', async () => {
  process.exit(0);
});
