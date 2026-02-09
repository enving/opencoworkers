import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock dependencies
jest.unstable_mockModule('../../server/bridge.js', () => ({
  OpenCodeServerBridge: jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    (emitter as any).subscribeToEvents = jest.fn();
    (emitter as any).replyToPermission = jest.fn().mockResolvedValue(true);
    return emitter;
  })
}));

jest.unstable_mockModule('../../server/webhook-server.js', () => ({
  WebhookServer: jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    const pmEmitter = new EventEmitter();
    (pmEmitter as any).createRequest = jest.fn().mockReturnValue({ id: 'internal-perm-1' });
    (emitter as any).getPermissionManager = jest.fn().mockReturnValue(pmEmitter);
    (emitter as any).emitEvent = jest.fn();
    return emitter;
  })
}));

const { OpenCodeServerBridge } = await import('../../server/bridge.js');
const { WebhookServer } = await import('../../server/webhook-server.js');
const { SyncEngine } = await import('../../sync/sync-engine.js');

describe('Permission Integration', () => {
  let engine: any;
  let mockBridge: any;
  let mockWebhookServer: any;
  let mockWatcher: any;
  let mockAdapter: any;

  beforeEach(() => {
    mockWatcher = {
      on: jest.fn(),
      start: jest.fn(),
      getTasks: jest.fn().mockResolvedValue({ tasks: [], meta: {} })
    };
    mockAdapter = {
      validateConfig: jest.fn().mockResolvedValue(true)
    };

    const fullConfig = {
      server: {
        baseUrl: 'http://localhost:4096',
        autoTrigger: true
      },
      daemon: {
        webhook: {
          enabled: true,
          port: 3847
        }
      }
    };

    engine = new SyncEngine(mockWatcher, mockAdapter, { fullConfig } as any);
    mockBridge = engine.serverBridges.get('default');
    mockWebhookServer = engine.webhookServer;
  });

  it('should propagate permission asked event from bridge to webhook server', async () => {
    const mockRequest = { id: 'remote-perm-1', sessionID: 'session-1', permission: 'bash.run', patterns: ['ls'] };
    
    mockBridge.emit('permission_asked', mockRequest);

    const pm = mockWebhookServer.getPermissionManager();
    expect(pm.createRequest).toHaveBeenCalledWith(
      'bash.run',
      expect.stringContaining('ls'),
      { sessionId: 'session-1' }
    );
    
    expect(engine.permissionMap.get('internal-perm-1')).toEqual({
      bridge: mockBridge,
      remoteRequestId: 'remote-perm-1'
    });
  });

  it('should reply to bridge when permission is resolved in webhook server', async () => {
    const mockRequest = { id: 'remote-perm-1', sessionID: 'session-1', permission: 'bash.run', patterns: ['ls'] };
    mockBridge.emit('permission_asked', mockRequest);

    const pm = mockWebhookServer.getPermissionManager();
    pm.emit('resolved', { id: 'internal-perm-1', action: 'approve', approvalType: 'always' });

    expect(mockBridge.replyToPermission).toHaveBeenCalledWith('remote-perm-1', 'always');
    expect(engine.permissionMap.has('internal-perm-1')).toBe(false);
  });
});
