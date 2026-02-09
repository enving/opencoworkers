import { jest, describe, it, expect } from '@jest/globals';
import { FullTasksJsonSchema, TaskSchema } from '../../types/tasks.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Tasks Type Definitions', () => {
  it('should validate the current tasks.json file', () => {
    const tasksJsonPath = path.resolve(__dirname, '../../.agent-config/tasks.json');
    const tasksJsonContent = fs.readFileSync(tasksJsonPath, 'utf-8');
    const tasksJson = JSON.parse(tasksJsonContent);

    const result = FullTasksJsonSchema.safeParse(tasksJson);

    if (!result.success) {
      console.error(JSON.stringify(result.error.format(), null, 2));
    }

    expect(result.success).toBe(true);
  });

  it('should validate a valid minimal task object', () => {
    const validTask = {
      id: 'TASK-123',
      title: 'Test Task',
      status: 'pending',
      priority: 'medium',
      created: '2026-01-16T12:00:00Z'
    };
    
    const result = TaskSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it('should reject an invalid task object', () => {
    const invalidTask = {
      id: 'TASK-123',
      status: 'pending',
      priority: 'medium',
      created: '2026-01-16T12:00:00Z'
    };

    const result = TaskSchema.safeParse(invalidTask);
    expect(result.success).toBe(false);
  });
});
