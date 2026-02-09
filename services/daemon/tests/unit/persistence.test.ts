import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { DaemonPersistence } from '../../sync/daemon-persistence.js';
import * as path from 'path';

describe('DaemonPersistence', () => {
  const testDir = './test-temp';
  let persistence: DaemonPersistence;

  beforeEach(async () => {
    if (!existsSync(testDir)) {
      await fs.mkdir(testDir);
    }
    persistence = new DaemonPersistence(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should initialize with empty state', async () => {
    const state = await persistence.load();
    expect(state.activeSessions).toEqual({});
    expect(state.errorLog).toEqual([]);
  });

  it('should track and remove sessions', async () => {
    await persistence.trackSession('session-1', 'TASK-1', 'git');
    let state = await persistence.load();
    expect(state.activeSessions['session-1']).toBeDefined();
    expect(state.activeSessions['session-1'].taskId).toBe('TASK-1');

    await persistence.removeSession('session-1');
    state = await persistence.load();
    expect(state.activeSessions['session-1']).toBeUndefined();
  });

  it('should update last poll timestamp', async () => {
    const now = new Date();
    await persistence.updateLastPoll(now);
    const state = await persistence.load();
    expect(state.lastPollTimestamp).toBe(now.toISOString());
  });

  it('should log errors and limit log size', async () => {
    for (let i = 0; i < 60; i++) {
      await persistence.logError(`Error ${i}`);
    }
    const state = await persistence.load();
    expect(state.errorLog.length).toBe(50);
    expect(state.errorLog[49].message).toBe('Error 59');
  });
});
