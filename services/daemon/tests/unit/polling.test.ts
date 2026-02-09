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

const fs: any = await import('fs/promises');
const { TaskFileWatcher }: any = await import('../../sync/file-watcher.js');
const { SyncEngine }: any = await import('../../sync/sync-engine.js');

describe('SyncEngine Polling Service', () => {
  let engine: any;
  let mockWatcher: any;
  let mockAdapter: any;

  beforeEach(() => {
    mockWatcher = {
      start: jest.fn().mockResolvedValue(undefined as any),
      stop: jest.fn().mockResolvedValue(undefined as any),
      on: jest.fn(),
      getTasks: jest.fn().mockResolvedValue({ tasks: [], meta: {} } as any)
    };

    mockAdapter = {
      name: 'mock-adapter',
      validateConfig: jest.fn().mockResolvedValue(true as any) as any,
      pullTasks: jest.fn().mockResolvedValue([] as any) as any,
    } as any;

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should start polling if enabled in config', async () => {
    engine = new SyncEngine(mockWatcher, mockAdapter, { 
      projectId: 'PROJ',
      fullConfig: {
        daemon: {
          enabled: true,
          pollingInterval: 10
        }
      } as any
    });

    await engine.start();
    
    expect(mockAdapter.pullTasks).toHaveBeenCalledTimes(1); 

    jest.advanceTimersByTime(10000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    
    expect(mockAdapter.pullTasks).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(10000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    
    expect(mockAdapter.pullTasks).toHaveBeenCalledTimes(3);
  });

  it('should not poll if disabled', async () => {
    engine = new SyncEngine(mockWatcher, mockAdapter, { 
      projectId: 'PROJ',
      fullConfig: {
        daemon: {
          enabled: false
        }
      } as any
    });

    await engine.start();
    expect(mockAdapter.pullTasks).toHaveBeenCalledTimes(1); 

    jest.advanceTimersByTime(60000);
    expect(mockAdapter.pullTasks).toHaveBeenCalledTimes(1);
  });
});
