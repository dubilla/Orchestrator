import { AgentSession } from '../agent-session-manager';

// Mock the Claude Agent SDK
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: jest.fn(() => ({
    stream: jest.fn(),
  })),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';

describe('AgentSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('send', () => {
    it('should call query with correct parameters', () => {
      const session = new AgentSession({
        agentId: 'agent-1',
        agentName: 'TestAgent',
        workingDirectory: '/test/path',
      });

      session.send('Hello, agent!');

      expect(query).toHaveBeenCalledWith({
        prompt: expect.stringContaining('You are TestAgent'),
        options: {
          model: 'claude-sonnet-4-5-20250929',
          cwd: '/test/path',
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          maxTurns: 50,
          maxBudgetUsd: 5.0,
        },
      });
    });

    it('should build prompt with conversation history', () => {
      const session = new AgentSession({
        agentId: 'agent-1',
        agentName: 'TestAgent',
        workingDirectory: '/test/path',
      });

      const conversationHistory = [
        { role: 'USER', content: 'First message' },
        { role: 'ASSISTANT', content: 'First response' },
      ];

      session.send('Current message', conversationHistory);

      const callArgs = (query as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).toContain('=== Previous Conversation ===');
      expect(callArgs.prompt).toContain('USER: First message');
      expect(callArgs.prompt).toContain('ASSISTANT: First response');
      expect(callArgs.prompt).toContain('User: Current message');
    });

    it('should build prompt without conversation history when empty', () => {
      const session = new AgentSession({
        agentId: 'agent-1',
        agentName: 'TestAgent',
        workingDirectory: '/test/path',
      });

      session.send('Hello');

      const callArgs = (query as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).not.toContain('=== Previous Conversation ===');
      expect(callArgs.prompt).toContain('User: Hello');
    });

    it('should log agent information', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      const session = new AgentSession({
        agentId: 'agent-1',
        agentName: 'TestAgent',
        workingDirectory: '/test/path',
      });

      session.send('Hello');

      expect(consoleLogSpy).toHaveBeenCalledWith('[Agent] Sending message to agent:', 'TestAgent');
      expect(consoleLogSpy).toHaveBeenCalledWith('[Agent] Working directory:', '/test/path');
      expect(consoleLogSpy).toHaveBeenCalledWith('[Agent] Conversation history length:', 0);
    });
  });

  describe('close', () => {
    it('should be a no-op for query API', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      const session = new AgentSession({
        agentId: 'agent-1',
        agentName: 'TestAgent',
        workingDirectory: '/test/path',
      });

      await session.close();

      expect(consoleLogSpy).toHaveBeenCalledWith('[Agent] Close session called for:', 'agent-1');
    });
  });

  describe('getters', () => {
    it('should expose id and name', () => {
      const session = new AgentSession({
        agentId: 'agent-1',
        agentName: 'TestAgent',
        workingDirectory: '/test/path',
      });

      expect(session.id).toBe('agent-1');
      expect(session.name).toBe('TestAgent');
    });
  });
});
