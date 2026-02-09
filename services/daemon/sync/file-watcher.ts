import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import { FullTasksJsonSchema, TasksJson } from '../types/tasks.js';

export declare interface TaskFileWatcher {
  on(event: 'change', listener: (tasks: TasksJson) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

export class TaskFileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private filePath: string;
  private isWatching: boolean = false;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  async start(): Promise<void> {
    if (this.isWatching) return;
    this.isWatching = true;

    try {
      await this.readAndEmit();
    } catch (error) {
      this.emit('error', error);
    }

    if (!this.isWatching) return;

    this.watcher = chokidar.watch(this.filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    this.watcher.on('change', async () => {
      try {
        await this.readAndEmit();
      } catch (error) {
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.watcher.on('error', (error) => {
      this.emit('error', error);
    });
  }

  async stop(): Promise<void> {
    if (!this.watcher) return;
    await this.watcher.close();
    this.watcher = null;
    this.isWatching = false;
  }

  async getTasks(): Promise<TasksJson | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const json = JSON.parse(content);
      const result = FullTasksJsonSchema.safeParse(json);
      return result.success ? result.data : null;
    } catch (error) {
      return null;
    }
  }

  private isSuspended: boolean = false;

  suspend(): void {
    this.isSuspended = true;
  }

  resume(): void {
    this.isSuspended = false;
  }

  private async readAndEmit(): Promise<void> {
    if (this.isSuspended) return;

    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const json = JSON.parse(content);
      const result = FullTasksJsonSchema.safeParse(json);

      if (result.success) {
        this.emit('change', result.data);
      } else {
        this.emit('error', new Error(`Invalid tasks.json schema: ${result.error.message}`));
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }
}
