import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as path from 'path';

jest.unstable_mockModule('fs/promises', () => ({
  appendFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
}));

const fs: any = await import('fs/promises');
const { AuditLogger }: any = await import('../../orchestration/audit-trail.js');

describe('AuditLogger', () => {
  let logger: any;
  const logDir = '.agent-config/logs';
  const logPath = path.join(logDir, 'audit-trail.json');

  beforeEach(() => {
    logger = new AuditLogger(logDir);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should log an action using appendFile (JSONL format)', async () => {
    await logger.logAction({
      agentId: 'test-agent',
      action: 'test-action',
      result: 'success'
    });

    expect(fs.appendFile).toHaveBeenCalledWith(
      logPath,
      expect.stringMatching(/\{"timestamp":".*","agentId":"test-agent","action":"test-action","result":"success"\}\n/),
      'utf-8'
    );
  });

  it('should read and parse JSONL format in getLogsByTask', async () => {
    const mockContent =
      JSON.stringify({ timestamp: '2026-01-18T10:00:00Z', agentId: 'a1', taskId: 'T1', action: 'act1', result: 'success' }) + '\n' +
      JSON.stringify({ timestamp: '2026-01-18T10:01:00Z', agentId: 'a2', taskId: 'T2', action: 'act2', result: 'success' }) + '\n' +
      JSON.stringify({ timestamp: '2026-01-18T10:02:00Z', agentId: 'a1', taskId: 'T1', action: 'act3', result: 'success' }) + '\n';

    fs.readFile.mockResolvedValue(mockContent);

    const logs = await logger.getLogsByTask('T1');

    expect(logs.length).toBe(2);
    expect(logs[0].action).toBe('act3');
    expect(logs[1].action).toBe('act1');
  });

  it('should handle empty or missing log file in getLogsByTask', async () => {
    fs.readFile.mockRejectedValue(new Error('File not found'));

    const logs = await logger.getLogsByTask('T1');

    expect(logs).toEqual([]);
  });
});
