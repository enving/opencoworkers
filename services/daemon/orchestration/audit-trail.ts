import * as fs from 'fs/promises';
import * as path from 'path';

export interface AuditAction {
  timestamp: string;
  agentId: string;
  taskId?: string;
  thoughtId?: string;
  action: string;
  details?: any;
  result: 'success' | 'failure' | 'pending';
}

export class AuditLogger {
  private logPath: string;

  constructor(logDir: string = '.agent-config/logs') {
    this.logPath = path.join(logDir, 'audit-trail.json');
  }

  async logAction(action: Omit<AuditAction, 'timestamp'>): Promise<void> {
    const entry: AuditAction = {
      timestamp: new Date().toISOString(),
      ...action
    };

    console.log(`[Audit] ${entry.agentId} | ${entry.action} | ${entry.taskId || 'no-task'}`);

    try {
      await this.ensureLogDir();
      await fs.appendFile(this.logPath, JSON.stringify(entry) + '\n', 'utf-8');
    } catch (err) {
      console.error('[Audit] Failed to write log:', err);
    }
  }

  private async ensureLogDir(): Promise<void> {
    const dir = path.dirname(this.logPath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async getLogsByTask(taskId: string): Promise<AuditAction[]> {
    return this.getLogs({ taskId });
  }

  async getLogs(filters: { agentId?: string; taskId?: string; result?: string; limit?: number } = {}): Promise<AuditAction[]> {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      const lines = content.trim().split('\n');
      let logs = lines
        .filter(line => line.trim().length > 0)
        .map(line => JSON.parse(line))
        .reverse();

      if (filters.agentId) {
        logs = logs.filter(l => l.agentId === filters.agentId);
      }
      if (filters.taskId) {
        logs = logs.filter(l => l.taskId === filters.taskId);
      }
      if (filters.result) {
        logs = logs.filter(l => l.result === filters.result);
      }
      if (filters.limit) {
        logs = logs.slice(0, filters.limit);
      }

      return logs;
    } catch {
      return [];
    }
  }
}
