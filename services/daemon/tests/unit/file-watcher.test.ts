import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TaskFileWatcher } from '../../sync/file-watcher';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_FILE = path.resolve(__dirname, 'test-tasks.json');

const validTasksJson = {
  meta: {
    version: '0.1.0',
    last_updated: new Date().toISOString(),
    last_agent: 'test-agent',
    project_phase: 'development'
  },
  tasks: [],
  features: [],
  rules: {
    review_policy: 'none',
    hallucination_prevention: []
  }
};

describe('TaskFileWatcher', () => {
  let watcher: TaskFileWatcher;

  beforeEach(() => {
    fs.writeFileSync(TEST_FILE, JSON.stringify(validTasksJson));
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
    if (fs.existsSync(TEST_FILE)) {
      fs.unlinkSync(TEST_FILE);
    }
  });

  it('should emit change event on start', (done) => {
    watcher = new TaskFileWatcher(TEST_FILE);
    
    watcher.on('change', (tasks) => {
      expect(tasks.meta.last_agent).toBe('test-agent');
      done();
    });

    watcher.start();
  });

  it('should emit error on invalid json', (done) => {
    watcher = new TaskFileWatcher(TEST_FILE);
    
    fs.writeFileSync(TEST_FILE, '{ invalid json');

    watcher.on('error', (error) => {
      expect(error).toBeDefined();
      done();
    });
    
    watcher.start();
  });

  it('should emit change on file update', (done) => {
    watcher = new TaskFileWatcher(TEST_FILE);
    let changeCount = 0;

    watcher.on('change', (tasks) => {
      changeCount++;
      if (changeCount === 1) {
        setTimeout(() => {
           const newJson = { ...validTasksJson, meta: { ...validTasksJson.meta, last_agent: 'updated-agent' } };
           fs.writeFileSync(TEST_FILE, JSON.stringify(newJson));
        }, 500);
      } else if (changeCount === 2) {
        expect(tasks.meta.last_agent).toBe('updated-agent');
        done();
      }
    });

    watcher.start();
  });
});
