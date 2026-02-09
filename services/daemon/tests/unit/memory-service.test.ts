import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import path from 'path';
import { MemoryService } from '../../memory/memory-service.js';

describe('MemoryService', () => {
  const testDir = '.test-memory';
  let memoryService: MemoryService;

  beforeEach(async () => {
    memoryService = new MemoryService(testDir);
    await memoryService.init();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should store and retrieve memory entries', async () => {
    const entry = {
      taskId: 'TASK-123',
      agentId: 'test-agent',
      category: 'test-cat',
      content: 'test content',
      tags: ['tag1', 'tag2']
    };

    await memoryService.store(entry);
    
    const results = await memoryService.retrieve({ agentId: 'test-agent' });
    expect(results.length).toBe(1);
    expect(results[0].content).toBe('test content');
    expect(results[0].taskId).toBe('TASK-123');
    expect(results[0].tags).toContain('tag1');
  });

  it('should filter entries by tags', async () => {
    await memoryService.store({
      taskId: 'T1',
      agentId: 'A1',
      category: 'C1',
      content: 'content 1',
      tags: ['blue']
    });

    await memoryService.store({
      taskId: 'T2',
      agentId: 'A1',
      category: 'C1',
      content: 'content 2',
      tags: ['red']
    });

    const blueResults = await memoryService.retrieve({ tags: ['blue'] });
    expect(blueResults.length).toBe(1);
    expect(blueResults[0].taskId).toBe('T1');
  });
});
