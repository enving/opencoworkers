import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockEventSourceInstance = {
  onmessage: null as ((e: any) => void) | null,
  onerror: null as ((e: any) => void) | null,
  close: jest.fn()
};

jest.unstable_mockModule('eventsource', () => ({
  EventSource: jest.fn(() => mockEventSourceInstance)
}));

jest.unstable_mockModule('@opencode-ai/sdk', () => ({
  createOpencodeClient: jest.fn().mockImplementation(() => ({
    session: {
      create: jest.fn(),
      prompt: jest.fn(),
      promptAsync: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      messages: jest.fn(),
      status: jest.fn()
    },
    global: {
      event: jest.fn()
    },
    permission: {
      reply: jest.fn()
    },
    file: {
      list: jest.fn(),
      read: jest.fn()
    },
    client: {
      getConfig: () => ({ baseUrl: 'http://localhost:4096' })
    }
  }))
}));

const { OpenCodeServerBridge } = await import('../../server/bridge.js');

describe('OpenCodeServerBridge', () => {
  let bridge: any;
  const mockConfig = {
    baseUrl: 'http://localhost:4096',
    directory: '/mock/dir'
  };

  beforeEach(() => {
    // Reset mock callbacks
    mockEventSourceInstance.onmessage = null;
    mockEventSourceInstance.onerror = null;
    mockEventSourceInstance.close.mockClear();

    bridge = new OpenCodeServerBridge(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should trigger task execution via OpenCode server', async () => {
    const mockTask: any = {
      id: 'TASK-123',
      title: 'Generate Presentation',
      description: 'Use sales.xlsx',
      skill: 'pptx'
    };

    const mockCreateResponse = { data: { id: 'session-abc' } };
    bridge.client.session.create.mockResolvedValue(mockCreateResponse);
    bridge.client.session.prompt.mockResolvedValue({ data: { status: 'queued' } });

    const sessionId = await bridge.triggerTaskExecution(mockTask);

    expect(sessionId).toBe('session-abc');
    expect(bridge.client.session.create).toHaveBeenCalledWith({
      body: {
        title: expect.stringContaining('Generate Presentation')
      }
    });
    expect(bridge.client.session.prompt).toHaveBeenCalledWith({
      path: { id: 'session-abc' },
      body: {
        agent: 'general',
        parts: [expect.objectContaining({
          text: expect.stringContaining('Use sales.xlsx'),
          type: 'text'
        })]
      }
    });
  });

  it('should handle permission asked events', async () => {
    const mockRequest = { id: 'perm-123', sessionID: 'session-abc', permission: 'bash.run', patterns: ['ls'] };

    const permissionAskedPromise = new Promise(resolve => {
      bridge.on('permission_asked', (properties: any) => {
        resolve(properties);
      });
    });

    bridge.subscribeToEvents();

    // Simulate event
    expect(mockEventSourceInstance.onmessage).toBeTruthy();

    if (mockEventSourceInstance.onmessage) {
      await mockEventSourceInstance.onmessage({
        data: JSON.stringify({
          type: 'permission.asked',
          properties: mockRequest
        })
      });
    }

    const received = await permissionAskedPromise;
    expect(received).toEqual(mockRequest);
  });

  it('should log warning when replying to permission requests without session context', async () => {
    const success = await bridge.replyToPermission('perm-123', 'once');
    expect(success).toBe(false);
  });

  it('should skip tasks without skills', async () => {
    const mockTask: any = { id: 'TASK-000', title: 'No Skill', skill: undefined };
    const sessionId = await bridge.triggerTaskExecution(mockTask);
    expect(sessionId).toBeNull();
    expect(bridge.client.session.create).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    const mockTask: any = { id: 'TASK-ERR', title: 'Fail', skill: 'pptx' };
    bridge.client.session.create.mockRejectedValue(new Error('API Down'));

    const sessionId = await bridge.triggerTaskExecution(mockTask);
    expect(sessionId).toBeNull();
  });
});
