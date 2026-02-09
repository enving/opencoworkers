import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';

export interface ArchivedSession {
  sessionId: string;
  taskId: string;
  archivedAt: string;
  artifactSummary?: string;
  refinementFeedback?: string;
}

export interface DaemonState {
  lastPollTimestamp?: string;
  activeSessions: Record<string, { taskId: string; skill: string; startedAt: string }>;
  errorLog: Array<{ timestamp: string; message: string; code?: string }>;
  archivedSessions?: ArchivedSession[];
  refinementLoopEnabled?: boolean;
}

export class DaemonPersistence {
  private filePath: string;

  constructor(baseDir: string = '.agent-config') {
    this.filePath = path.join(baseDir, 'daemon-state.json');
  }

  async load(): Promise<DaemonState> {
    if (!existsSync(this.filePath)) {
      return this.getInitialState();
    }

    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      if (!content || content.trim() === '' || content === 'undefined') {
        return this.getInitialState();
      }
      return JSON.parse(content);
    } catch (err) {
      console.error(`[DaemonPersistence] Failed to load state from ${this.filePath}, returning initial state:`, err);
      return this.getInitialState();
    }
  }

  async save(state: DaemonState): Promise<void> {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DaemonPersistence] Failed to save state:', err);
    }
  }

  private getInitialState(): DaemonState {
    return {
      activeSessions: {},
      errorLog: []
    };
  }

  async updateLastPoll(timestamp: Date = new Date()): Promise<void> {
    const state = await this.load();
    state.lastPollTimestamp = timestamp.toISOString();
    await this.save(state);
  }

  async trackSession(sessionId: string, taskId: string, skill: string): Promise<void> {
    const state = await this.load();
    state.activeSessions[sessionId] = {
      taskId,
      skill,
      startedAt: new Date().toISOString()
    };
    await this.save(state);
  }

  async removeSession(sessionId: string): Promise<void> {
    const state = await this.load();
    delete state.activeSessions[sessionId];
    await this.save(state);
  }

  async logError(message: string, code?: string): Promise<void> {
    const state = await this.load();
    state.errorLog.push({
      timestamp: new Date().toISOString(),
      message,
      code
    });

    // Keep only last 50 errors
    if (state.errorLog.length > 50) {
      state.errorLog = state.errorLog.slice(-50);
    }

    await this.save(state);
  }

  async archiveSession(
    sessionId: string,
    taskId: string,
    artifactSummary?: string,
    refinementFeedback?: string
  ): Promise<void> {
    const state = await this.load();

    if (!state.archivedSessions) {
      state.archivedSessions = [];
    }

    state.archivedSessions.push({
      sessionId,
      taskId,
      archivedAt: new Date().toISOString(),
      artifactSummary,
      refinementFeedback
    });

    // Keep only last 100 archived sessions
    if (state.archivedSessions.length > 100) {
      state.archivedSessions = state.archivedSessions.slice(-100);
    }

    // Remove from active sessions if present
    delete state.activeSessions[sessionId];

    await this.save(state);
    console.log(`[DaemonPersistence] Archived session ${sessionId} for task ${taskId}`);
  }

  async setRefinementLoopEnabled(enabled: boolean): Promise<void> {
    const state = await this.load();
    state.refinementLoopEnabled = enabled;
    await this.save(state);
    console.log(`[DaemonPersistence] Refinement loop ${enabled ? 'enabled' : 'disabled'}`);
  }

  async isRefinementLoopEnabled(): Promise<boolean> {
    const state = await this.load();
    return state.refinementLoopEnabled ?? false;
  }

  async getArchivedSessionsForTask(taskId: string): Promise<ArchivedSession[]> {
    const state = await this.load();
    return (state.archivedSessions || []).filter(s => s.taskId === taskId);
  }
  async getIntegrations(): Promise<any[]> {
    // Integrations are in .agent-config/integrations.json
    const integrationsPath = path.resolve('.agent-config/integrations.json');
    if (!existsSync(integrationsPath)) return [];

    try {
      const content = await fs.readFile(integrationsPath, 'utf-8');
      const data = JSON.parse(content);
      return data.integrations || [];
    } catch (err) {
      console.error(`[DaemonPersistence] Failed to load integrations from ${integrationsPath}:`, err);
      return [];
    }
  }
}
