import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { EventEmitter } from 'events';

jest.unstable_mockModule('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
}));

jest.unstable_mockModule('../../sync/file-watcher.js', () => ({
  TaskFileWatcher: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    suspend: jest.fn(),
    resume: jest.fn(),
    getTasks: jest.fn(),
  })),
}));

jest.unstable_mockModule('../../server/bridge.js', () => ({
  OpenCodeServerBridge: jest.fn().mockImplementation((config: any) => {
    const emitter = new EventEmitter();
    (emitter as any).config = config;
    (emitter as any).triggerTaskExecution = jest.fn().mockResolvedValue('session-id');
    (emitter as any).getActiveSessionsCount = jest.fn().mockResolvedValue(0);
    return emitter;
  }),
}));

const { SyncEngine }: any = await import('../../sync/sync-engine.js');

describe('SyncEngine Multi-Instance Support', () => {
  let engine: any;
  let mockWatcher: any;
  let mockAdapter: any;

  beforeEach(() => {
    mockWatcher = {
      on: jest.fn(),
      getTasks: jest.fn()
    };
    mockAdapter = {
      name: 'mock',
      validateConfig: jest.fn().mockResolvedValue(true)
    };
  });

  it('should initialize multiple server bridges', () => {
    engine = new SyncEngine(mockWatcher, mockAdapter, {
      fullConfig: {
        server: {
          instances: [
            { name: 'server-1', baseUrl: 'http://s1:4096', skills: ['pptx'] },
            { name: 'server-2', baseUrl: 'http://s2:4096', skills: ['xlsx'] }
          ]
        }
      } as any
    });

    const bridges = (engine as any).serverBridges;
    expect(bridges.size).toBe(2);
    expect(bridges.has('server-1')).toBe(true);
    expect(bridges.has('server-2')).toBe(true);
  });

  it('should route task to specialized server based on skill', async () => {
    engine = new SyncEngine(mockWatcher, mockAdapter, {
      fullConfig: {
        server: {
          autoTrigger: true,
          instances: [
            { name: 'ppt-server', baseUrl: 'http://ppt:4096', skills: ['pptx'] },
            { name: 'default', baseUrl: 'http://def:4096' }
          ]
        }
      } as any
    });

    const tasksJson = {
      tasks: [
        { id: 'T1', title: 'T1', status: 'in_progress', skill: 'pptx' }
      ]
    };

    await engine.processTaskExecutionQueue(tasksJson);

    const pptBridge = (engine as any).serverBridges.get('ppt-server');
    expect(pptBridge.triggerTaskExecution).toHaveBeenCalled();
    
    const defBridge = (engine as any).serverBridges.get('default');
    expect(defBridge.triggerTaskExecution).not.toHaveBeenCalled();
  });

  it('should fallback to any available server if no specialization matches', async () => {
    engine = new SyncEngine(mockWatcher, mockAdapter, {
      fullConfig: {
        server: {
          autoTrigger: true,
          instances: [
            { name: 'ppt-server', baseUrl: 'http://ppt:4096', skills: ['pptx'] },
            { name: 'default', baseUrl: 'http://def:4096' }
          ]
        }
      } as any
    });

    const pptBridge = (engine as any).serverBridges.get('ppt-server');
    const defBridge = (engine as any).serverBridges.get('default');
    
    pptBridge.getActiveSessionsCount.mockResolvedValue(10);
    defBridge.getActiveSessionsCount.mockResolvedValue(0);

    const tasksJson = {
      tasks: [
        { id: 'T2', title: 'T2', status: 'in_progress', skill: 'git' }
      ]
    };

    await engine.processTaskExecutionQueue(tasksJson);

    expect(defBridge.triggerTaskExecution).toHaveBeenCalled();
  });

  it('should load balance by session count', async () => {
    engine = new SyncEngine(mockWatcher, mockAdapter, {
      fullConfig: {
        server: {
          autoTrigger: true,
          instances: [
            { name: 's1', baseUrl: 'http://s1:4096' },
            { name: 's2', baseUrl: 'http://s2:4096' }
          ]
        }
      } as any
    });

    const s1 = (engine as any).serverBridges.get('s1');
    const s2 = (engine as any).serverBridges.get('s2');

    s1.getActiveSessionsCount.mockResolvedValue(5);
    s2.getActiveSessionsCount.mockResolvedValue(2);

    const tasksJson = {
      tasks: [
        { id: 'T3', title: 'T3', status: 'in_progress', skill: 'git' }
      ]
    };

    await engine.processTaskExecutionQueue(tasksJson);

    expect(s2.triggerTaskExecution).toHaveBeenCalled();
    expect(s1.triggerTaskExecution).not.toHaveBeenCalled();
  });
});
