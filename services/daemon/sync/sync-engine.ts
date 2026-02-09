import { TicketAdapter, UnifiedStatus, UnifiedTicket } from '../types/adapter.js';
import { TaskFileWatcher } from './file-watcher.js';
import { TasksJson, Task } from '../types/tasks.js';
import * as fs from 'fs/promises';
import { AppConfig } from '../config/config-loader.js';

import { AuditLogger } from '../orchestration/audit-trail.js';
import { BackupService } from '../server/backup-service.js';
import { OpenCodeServerBridge } from '../server/bridge.js';
import { WebhookServer } from '../server/webhook-server.js';
import { DaemonPersistence } from './daemon-persistence.js';
import { SSHTunnelManager } from '../server/ssh-tunnel.js';
import { SkillDetector } from '../skills/detector.js';
import { EventEmitter } from 'events';
import { CollaborationBridgePlugin } from '../plugins/collab-bridge.js';
import { SkillMapper } from '../skills/skill-mapper.js';
import { NextcloudWatcher } from './nextcloud-watcher.js';
import { WebDavStorageProvider } from '../storage/providers/webdav.js';

export interface SyncConfig {
  debounceMs?: number;
  tasksFilePath?: string;
  projectId?: string;
  fullConfig?: AppConfig;
  stateDir?: string;
  enableAutoSkillDetection?: boolean;
}

export class SyncEngine extends EventEmitter {
  private watcher: TaskFileWatcher;
  private adapter: TicketAdapter;
  private config: SyncConfig;
  private auditLogger: AuditLogger;
  private persistence: DaemonPersistence;
  private serverBridges: Map<string, OpenCodeServerBridge> = new Map();
  private sshTunnels: Map<string, SSHTunnelManager> = new Map();
  private webhookServer: WebhookServer | null = null;
  private collabPlugin: CollaborationBridgePlugin | null = null;
  private skillDetector: SkillDetector;
  private isSyncing: boolean = false;
  private isPulling: boolean = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private consecutiveFailures: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  public isPaused: boolean = false;
  private pauseTimer: NodeJS.Timeout | null = null;
  private permissionMap: Map<string, { bridge: OpenCodeServerBridge, remoteRequestId: string }> = new Map();
  private syncEnabled: boolean;

  constructor(watcher: TaskFileWatcher, adapter: TicketAdapter, config: SyncConfig = {}) {
    super();
    this.watcher = watcher;
    this.adapter = adapter;
    this.config = { debounceMs: 500, enableAutoSkillDetection: true, ...config };
    this.syncEnabled = (config.fullConfig?.adapter || 'none') !== 'none';
    this.auditLogger = new AuditLogger();
    this.persistence = new DaemonPersistence(config.stateDir || '.agent-config');
    this.skillDetector = new SkillDetector(config.fullConfig?.storage);
    this.collabPlugin = new CollaborationBridgePlugin(this);
    this.collabPlugin.start();

    // TASK-183: Start Backup Service
    const backupService = new BackupService();
    backupService.start();

    // TASK-184: Bootstrap MCP Servers
    this.bootstrapMcpServers().catch(err => console.error('[SyncEngine] MCP Bootstrap failed:', err));

    if (config.fullConfig?.server) {
      const serverConfig = config.fullConfig.server;

      if (serverConfig.instances && serverConfig.instances.length > 0) {
        for (const inst of serverConfig.instances) {

          const bridge = new OpenCodeServerBridge({
            baseUrl: inst.baseUrl,
            password: inst.password,
            directory: '/root'
          });
          this.serverBridges.set(inst.name, bridge);
          this.setupBridgeListeners(bridge);
        }
      } else {

        const bridge = new OpenCodeServerBridge({
          baseUrl: serverConfig.baseUrl,
          password: serverConfig.password,
          directory: '/root'
        });
        this.serverBridges.set('default', bridge);
        this.setupBridgeListeners(bridge);
      }
    }

    if (config.fullConfig?.daemon?.webhook?.enabled) {
      this.webhookServer = new WebhookServer(this, {
        port: config.fullConfig.daemon.webhook.port,
        secret: config.fullConfig.daemon.webhook.secret,
        tasksFilePath: config.tasksFilePath,
        storage: config.fullConfig.storage
      });

      this.webhookServer.getPermissionManager().on('resolved', (data) => {
        const mapping = this.permissionMap.get(data.id);
        if (mapping) {
          const reply = data.action === 'approve' ? (data.approvalType || 'once') : 'reject';
          mapping.bridge.replyToPermission(mapping.remoteRequestId, reply as any);
          this.permissionMap.delete(data.id);
        }
      });
    }

    // TASK-193: Nextcloud Watcher
    if (config.fullConfig?.storage?.webdav) {
      const { url, username, password } = config.fullConfig.storage.webdav;
      const webdavProvider = new WebDavStorageProvider(url, username, password);
      this.nextcloudWatcher = new NextcloudWatcher(webdavProvider, { intervalMs: 30000 });

      this.nextcloudWatcher.on('change', async ({ path, stat }) => {
        console.log(`[SyncEngine] File changed in Nextcloud: ${path}`);
        await this.handleRemoteFileChange(path, stat);
      });

      this.nextcloudWatcher.start();
    }
  }

  private nextcloudWatcher: NextcloudWatcher | null = null;

  async handleRemoteFileChange(path: string, stat: any) {
    // Find tasks that might be interested in this file
    const tasksJson = await this.watcher.getTasks();
    if (!tasksJson) return;

    // Simple heuristic: If a task description contains the filename, or if specific metadata links it.
    // For TASK-193 prototype, we check if any task is in 'in_review' status and mentions 'collaborative'.

    const relevantTasks = tasksJson.tasks.filter(t =>
      t.status === 'in_progress' || t.status === 'in_review'
    );

    for (const task of relevantTasks) {
      // Checking if task description contains filename creates loose coupling
      if (task.description && task.description.includes(path.split('/').pop() || '')) {
        console.log(`[SyncEngine] Triggering refinement for task ${task.id} due to file change: ${path}`);

        await this.auditLogger.logAction({
          agentId: 'nextcloud-watcher',
          taskId: task.id,
          action: 'file_changed',
          details: { path, stat },
          result: 'success'
        });

        await this.triggerRefinementLoop(task.id, `File ${path} has been updated by the user. Please review the changes.`);
      }
    }
  }

  public getCollabPlugin(): CollaborationBridgePlugin | null {
    return this.collabPlugin;
  }

  private setupBridgeListeners(bridge: OpenCodeServerBridge) {
    bridge.on('permission_asked', (request: any) => {
      console.log(`[SyncEngine] Permission asked: ${request.permission} for session ${request.sessionID}`);
      if (this.webhookServer) {
        const internalRequest = this.webhookServer.getPermissionManager().createRequest(
          request.permission,
          `Action: ${request.permission}\nPatterns: ${request.patterns.join(', ')}`,
          { sessionId: request.sessionID }
        );

        this.permissionMap.set(internalRequest.id, {
          bridge,
          remoteRequestId: request.id
        });
      }
    });

    bridge.on('message_part_updated', (properties: any) => {
      if (this.webhookServer) {
        this.webhookServer.emitEvent({
          type: 'agent_output',
          data: properties
        });
      }
    });

    bridge.on('thought_updated', (data: any) => {
      if (this.webhookServer) {
        this.webhookServer.emitEvent({
          type: 'agent_thought',
          data: data
        });
      }
    });
  }

  async start(): Promise<void> {
    console.log('[SyncEngine] Starting...');

    if (this.webhookServer) {
      await this.webhookServer.start();
    }

    for (const [name, tunnel] of this.sshTunnels) {
      console.log(`[SyncEngine] Connecting SSH tunnel for instance: ${name}`);
      try {
        await tunnel.connect();
      } catch (err: any) {
        console.error(`[SyncEngine] Failed to connect SSH tunnel for ${name}:`, err.message);
      }
    }

    await this.skillDetector.initialize();
    console.log('[SyncEngine] Skill detector initialized');

    if (!this.syncEnabled) {
      console.log('[SyncEngine] Sync disabled (adapter=none)');
    } else {
      let isAdapterValid = false;
      try {
        isAdapterValid = await this.adapter.validateConfig();
      } catch (e) {
        console.error(`[SyncEngine] Adapter validation check failed:`, e);
      }

      if (!isAdapterValid) {
        console.error(`[SyncEngine] Adapter ${this.adapter.name} configuration invalid or unreachable. Sync disabled until fixed.`);
        // throw new Error(`[SyncEngine] Adapter ${this.adapter.name} configuration invalid`);
      } else {
        const currentTasks = await this.watcher.getTasks();
        if (currentTasks) {
          await this.syncRemoteToLocal(currentTasks);
        }
      }
    }

    this.watcher.on('change', (tasksJson: TasksJson) => this.handleLocalChange(tasksJson));
    this.watcher.on('error', (err: Error) => console.error('[SyncEngine] Watcher error:', err));

    await this.watcher.start();

    if (this.config.fullConfig?.daemon?.enabled) {
      this.startPolling();
      this.startSessionMonitoring();
    }

    console.log('[SyncEngine] Started');
  }

  async bootstrapMcpServers() {
    try {
      const mcpPath = '.agent-config/mcp/config.json';
      const bridge = await this.selectServerBridge();
      if (!bridge) return;

      try {
        const content = await fs.readFile(mcpPath, 'utf-8');
        const config = JSON.parse(content);
        if (config.mcpServers) {
          for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
            // Inject WebDAV credentials if this is the webdav server
            if (name === 'webdav' && this.config.fullConfig?.storage?.webdav) {
              const conf: any = serverConfig;
              if (!conf.env) conf.env = {};
              conf.env.WEBDAV_URL = this.config.fullConfig.storage.webdav.url;
              conf.env.WEBDAV_USER = this.config.fullConfig.storage.webdav.username || '';
              conf.env.WEBDAV_PASS = this.config.fullConfig.storage.webdav.password || '';
            }
            await bridge.registerMcpServer(name, serverConfig);
          }
        }
      } catch (e) {
        // Ignore if file doesn't exist
      }
    } catch (err) {
      console.error('[SyncEngine] Failed to bootstrap MCP:', err);
    }
  }

  async stop(): Promise<void> {
    await this.watcher.stop();
    this.stopPolling();
    if (this.webhookServer) {
      await this.webhookServer.stop();
    }

    for (const [name, tunnel] of this.sshTunnels) {
      console.log(`[SyncEngine] Disconnecting SSH tunnel for instance: ${name}`);
      await tunnel.disconnect();
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    console.log('[SyncEngine] Stopped');
  }

  private startPolling(): void {
    if (this.pollingTimer) return;

    const interval = (this.config.fullConfig?.daemon?.pollingInterval || 60) * 1000;
    console.log(`[SyncEngine] Starting polling service (Interval: ${interval / 1000}s)`);

    this.pollingTimer = setInterval(async () => {
      console.log('[SyncEngine] Polling for remote changes...');
      try {
        await this.pull();
        await this.persistence.updateLastPoll();
      } catch (err) {
        console.error('[SyncEngine] Polling failed:', err);
        // Do not crash the process, just log and continue next interval
      }
    }, interval);
  }

  private startSessionMonitoring(): void {
    console.log('[SyncEngine] Starting session monitoring (Interval: 5s)');
    setInterval(async () => {
      await this.checkActiveSessions();
    }, 5000);
  }

  private async checkActiveSessions(): Promise<void> {
    const state = await this.persistence.load();
    const activeSessions = Object.entries(state.activeSessions);

    if (activeSessions.length === 0) return;

    const tasksJson = await this.watcher.getTasks();
    if (!tasksJson) return;

    let modified = false;

    for (const [sessionId, info] of activeSessions) {
      const sessionInfo = info as { taskId: string; skill: string };
      const task = tasksJson.tasks.find(t => t.id === sessionInfo.taskId);
      if (!task) continue;

      try {
        const bridge = await this.selectServerBridge(sessionInfo.skill);
        if (!bridge) continue;

        const status = await bridge.getSessionStatus(sessionId);
        if (status === 'idle') {
          console.log(`[SyncEngine] Task ${task.id} (Session ${sessionId}) completed. Detecting artifacts...`);

          const artifacts: any[] = [];

          try {
            const remoteFiles = await bridge.getArtifacts(sessionId);
            for (const name of remoteFiles) {
              artifacts.push({
                name,
                url: `http://localhost:3847/api/artifacts/${sessionId}/${name}`
              });
            }
          } catch (e) {
            console.error(`[SyncEngine] Failed to list artifacts for ${task.id}:`, e);
          }

          const messagesResult = await bridge['client'].session.messages({ path: { id: sessionId } });
          try {
            if (messagesResult.data) {
              const text = messagesResult.data.map((m: any) =>
                m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
              ).join('\n');

              const fileRegex = /['"]?([\w-]+\.(?:pdf|pptx|xlsx|docx|png|csv))['"]?/gi;
              let match;
              while ((match = fileRegex.exec(text)) !== null) {
                const fileName = match[1];
                if (!artifacts.some(a => a.name === fileName)) {
                  artifacts.push({
                    name: fileName,
                    url: `http://localhost:3847/api/artifacts/${sessionId}/${fileName}`
                  });
                }
              }
            }
          } catch (e) {
            console.error(`[SyncEngine] Failed to scan messages for artifacts for ${task.id}:`, e);
          }

          if (artifacts.length > 0) {
            console.log(`[SyncEngine] Detected ${artifacts.length} artifacts for ${task.id}`);
            task.artifacts = artifacts;
          }

          const hasResponse = messagesResult.data && messagesResult.data.some((m: any) => m.role === 'assistant' && m.parts.length > 0);

          if (!hasResponse && artifacts.length === 0) {
             console.warn(`[SyncEngine] Task ${task.id} (Session ${sessionId}) reached idle with no response or artifacts. Marking as failed.`);
             task.status = 'pending';
             task.orchestration_state = 'failed';
          } else {
             task.status = 'in_review';
             task.orchestration_state = 'completed';
          }

          await this.persistence.removeSession(sessionId);
          modified = true;
        } else if (status === 'error') {
          console.warn(`[SyncEngine] Task ${task.id} (Session ${sessionId}) failed on remote.`);
          task.status = 'pending';
          task.orchestration_state = 'failed';
          await this.persistence.removeSession(sessionId);
          modified = true;
        }
      } catch (err) {
        // Ignore temporary network errors
      }
    }

    if (modified) {
      await this.writeBack(tasksJson);
    }
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log('[SyncEngine] Polling service stopped');
    }
  }

  public async pull(dryRun: boolean = false): Promise<void> {
    if (!this.syncEnabled) {
      console.log('[SyncEngine] Pull skipped (adapter=none)');
      return;
    }
    const isValid = await this.adapter.validateConfig();
    if (!isValid) {
      throw new Error(`[SyncEngine] Adapter ${this.adapter.name} configuration invalid`);
    }
    const currentTasks = await this.watcher.getTasks();
    if (currentTasks) {
      await this.syncRemoteToLocal(currentTasks, dryRun);
    }
  }

  public async push(dryRun: boolean = false): Promise<void> {
    if (!this.syncEnabled) {
      console.log('[SyncEngine] Push skipped (adapter=none)');
      return;
    }
    const isValid = await this.adapter.validateConfig();
    if (!isValid) {
      throw new Error(`[SyncEngine] Adapter ${this.adapter.name} configuration invalid`);
    }
    const currentTasks = await this.watcher.getTasks();
    if (currentTasks) {
      await this.syncLocalToRemote(currentTasks, dryRun);
    }
  }

  public async sync(dryRun: boolean = false): Promise<void> {
    if (!this.syncEnabled) {
      console.log('[SyncEngine] Sync skipped (adapter=none)');
      return;
    }
    const isValid = await this.adapter.validateConfig();
    if (!isValid) {
      throw new Error(`[SyncEngine] Adapter ${this.adapter.name} configuration invalid`);
    }
    const currentTasks = await this.watcher.getTasks();
    if (currentTasks) {
      console.log(`[SyncEngine] Running bidirectional sync...${dryRun ? ' (DRY RUN)' : ''}`);
      // 1. Pull remote changes to local
      await this.syncRemoteToLocal(currentTasks, dryRun);
      // 2. Push local changes to remote
      await this.syncLocalToRemote(currentTasks, dryRun);
    }
  }

  private handleLocalChange(tasksJson: TasksJson): void {
    if (this.isPaused) {
      console.log('[SyncEngine] Sync is paused due to consecutive failures. Skipping local change.');
      return;
    }
    console.log(`[SyncEngine] Detected ${tasksJson.tasks.length} tasks locally`);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(async () => {
      this.checkParentCompletion(tasksJson);
      if (this.syncEnabled) {
        await this.syncLocalToRemote(tasksJson);
      }

      const triggered = await this.processTaskExecutionQueue(tasksJson);
      if (triggered) {
        await this.writeBack(tasksJson);
      }
    }, this.config.debounceMs);
  }

  public async pullOne(ticketId: string): Promise<void> {
    if (!this.syncEnabled) {
      console.log('[SyncEngine] PullOne skipped (adapter=none)');
      return;
    }
    const isValid = await this.adapter.validateConfig();
    if (!isValid) {
      throw new Error(`[SyncEngine] Adapter ${this.adapter.name} configuration invalid`);
    }

    const ticket = await this.adapter.getTicket(ticketId);
    if (!ticket) {
      console.warn(`[SyncEngine] Ticket ${ticketId} not found in remote`);
      return;
    }

    const currentTasks = await this.watcher.getTasks();
    if (currentTasks) {
      const modified = await this.processRemoteTickets([ticket], currentTasks, false);
      if (modified) {
        await this.writeBack(currentTasks);
      }
    }
  }

  private async syncRemoteToLocal(tasksJson: TasksJson, dryRun: boolean = false): Promise<void> {
    if (!this.syncEnabled) {
      return;
    }
    if (this.isPaused) return;
    if (this.isPulling) {
      console.log('[SyncEngine] Pull already in progress, skipping');
      return;
    }

    if (!this.config.projectId) {
      console.warn('[SyncEngine] No projectId configured, skipping remote -> local sync');
      return;
    }

    this.isPulling = true;
    console.log(`[SyncEngine] Syncing remote changes to local...${dryRun ? ' (DRY RUN)' : ''}`);

    try {
      const remoteTickets = await this.adapter.pullTasks(this.config.projectId);
      this.consecutiveFailures = 0;

      const modified = await this.processRemoteTickets(remoteTickets, tasksJson, dryRun);

      if (modified && !dryRun) {
        await this.writeBack(tasksJson);
      }
    } catch (error) {
      console.error('[SyncEngine] Remote -> Local sync error:', error);
      this.handleFailure();
    } finally {
      this.isPulling = false;
    }
  }

  private async processRemoteTickets(remoteTickets: UnifiedTicket[], tasksJson: TasksJson, dryRun: boolean): Promise<boolean> {
    let modified = false;

    for (const ticket of remoteTickets) {
      const repository = this.resolveRepository(ticket.project_key);

      const localTask = tasksJson.tasks.find(t =>
        t.external_refs?.includes(`${this.adapter.name}:${ticket.id}`)
      );

      let detectedSkill = ticket.skill;

      if (this.config.enableAutoSkillDetection && !detectedSkill) {
        try {
          const labels = ticket.nativeData?.labels || [];
          const category = ticket.nativeData?.category || localTask?.category;

          detectedSkill = await this.skillDetector.detectSkill({
            labels: labels,
            category: category,
            description: ticket.description,
            existingSkill: ticket.skill
          });

          if (detectedSkill && detectedSkill !== 'general') {
            console.log(`[pm-sync] Auto-detected skill for ${ticket.id}: ${detectedSkill}`);
          }
        } catch (error) {
          console.error(`[pm-sync] Failed to auto-detect skill for ${ticket.id}:`, error);
        }
      }

      const skillToUse = detectedSkill || ticket.skill;
      const skillInstruction = skillToUse ? `\n\n[pm-sync] 🤖 Agent instruction: Use /${skillToUse} skill for this task.` : '';

      const cleanDescription = (ticket.description || '').replace(/\n\n\[pm-sync\] 🤖 Agent instruction: Use \/\w+ skill for this task\./g, '');
      const descriptionWithSkill = cleanDescription + skillInstruction;

      if (localTask) {
        const remoteUpdated = ticket.updatedAt.getTime();
        const localUpdated = localTask.updated ? new Date(localTask.updated).getTime() : 0;
        const lastSynced = localTask.last_synced_at ? new Date(localTask.last_synced_at).getTime() : 0;

        const localChanged = localUpdated > lastSynced;
        const remoteChanged = remoteUpdated > lastSynced;

        if (localChanged && remoteChanged) {
          console.warn(`[SyncEngine] Conflict detected for task ${localTask.id}. Strategy: tasks_json_wins - skipping remote update.`);
          continue;
        }

        if (remoteChanged && !localChanged) {
          console.log(`[SyncEngine] ${dryRun ? 'Plan update' : 'Updating'} local task ${localTask.id} from remote ticket ${ticket.id}`);

          if (!dryRun && ticket.skill && localTask.skill !== ticket.skill) {
            console.log(`[pm-sync] Skill changed for ${localTask.id}: ${localTask.skill} -> ${ticket.skill}`);
            try {
              // await this.adapter.postComment(ticket.id, `🤖 Agent workforce update: Switching to /${ticket.skill} skill for this task.`);
            } catch (e) {
              console.error(`[pm-sync] Failed to post comment to remote:`, e);
            }
          }

          if (!dryRun) {
            localTask.title = ticket.title;
            localTask.description = descriptionWithSkill;
            localTask.status = this.mapUnifiedToTaskStatus(ticket.status);
            localTask.priority = ticket.priority;
            localTask.skill = skillToUse;
            localTask.workflow_type = ticket.workflow_type;
            localTask.repository = repository;
            localTask.project_key = ticket.project_key;
            localTask.updated = ticket.updatedAt.toISOString();
            localTask.last_synced_at = ticket.updatedAt.toISOString();
          }
          modified = true;
        }

        if (localTask.workflow_type === 'automatic-review' && localTask.status === 'in_progress') {
          console.log(`[AutoReview] Task ${localTask.id} (${ticket.id}) queued for automatic execution`);
        }

        if (localTask.workflow_type === 'orchestration' && localTask.status === 'in_progress' && !localTask.orchestration_state) {
          if (localTask.template) {
            await this.expandTemplate(localTask, tasksJson);
          } else {
            await this.decomposeTask(localTask, tasksJson);
          }
          modified = true;
        }
      } else {
        const newId = this.getNextTaskId(tasksJson);
        console.log(`[SyncEngine] ${dryRun ? 'Plan creation' : 'Creating'} local task ${newId} from remote ticket ${ticket.id}`);

        if (!dryRun) {
          const newTask: Task = {
            id: newId as any,
            title: ticket.title,
            description: descriptionWithSkill,
            status: this.mapUnifiedToTaskStatus(ticket.status),
            priority: ticket.priority,
            skill: skillToUse,
            workflow_type: ticket.workflow_type,
            repository: repository,
            project_key: ticket.project_key,
            created: ticket.createdAt.toISOString(),
            updated: ticket.updatedAt.toISOString(),
            last_synced_at: ticket.updatedAt.toISOString(),
            external_refs: [`${this.adapter.name}:${ticket.id}`]
          };

          tasksJson.tasks.push(newTask);

          if (newTask.workflow_type === 'automatic-review' && newTask.status === 'in_progress') {
            console.log(`[AutoReview] Task ${newTask.id} (${ticket.id}) queued for automatic execution`);
          }

          if (newTask.workflow_type === 'orchestration' && newTask.status === 'in_progress') {
            if (newTask.template) {
              await this.expandTemplate(newTask, tasksJson);
            } else {
              await this.decomposeTask(newTask, tasksJson);
            }
          }

          if (ticket.skill) {
            console.log(`[pm-sync] Task ${newId} (${ticket.id}) requires skill: ${ticket.skill}`);
            try {
              // await this.adapter.postComment(ticket.id, `🤖 Agent workforce initialized. Using /${ticket.skill} skill for this task.`);
            } catch (e) {
              console.error(`[pm-sync] Failed to post comment to remote:`, e);
            }
          }
        }
        modified = true;
      }
    }
    return modified;
  }

  private async expandTemplate(task: Task, tasksJson: TasksJson): Promise<void> {
    if (!task.template) return;

    console.log(`[Orchestration] Expanding template '${task.template}' for task ${task.id}`);
    task.orchestration_state = 'decomposing';

    try {
      const templatePath = `.agent-config/templates/${task.template}.json`;
      let templateContent;

      try {
        templateContent = await fs.readFile(templatePath, 'utf-8');
      } catch (err) {
        console.error(`[Orchestration] Template not found: ${templatePath}`);
        throw new Error(`Template '${task.template}' not found`);
      }

      const template = JSON.parse(templateContent);
      const subtasks: Task[] = [];

      for (const tplTask of template.tasks) {
        const subtaskId = this.getNextTaskId({ ...tasksJson, tasks: [...tasksJson.tasks, ...subtasks] });

        subtasks.push({
          id: subtaskId as any,
          title: tplTask.title,
          description: tplTask.description,
          status: 'pending',
          priority: tplTask.priority || task.priority,
          skill: tplTask.skill,
          parent_id: task.id,
          project_key: task.project_key,
          repository: task.repository,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        });
      }

      if (subtasks.length > 0) {
        task.subtasks = subtasks.map(s => s.id);
        tasksJson.tasks.push(...subtasks);
        task.orchestration_state = 'ready';

        console.log(`[Orchestration] Successfully expanded template '${task.template}' into ${subtasks.length} sub-tasks`);

        await this.auditLogger.logAction({
          agentId: 'sisyphus-orchestrator',
          taskId: task.id,
          action: 'expand_template',
          details: { template: task.template, subtasks: task.subtasks },
          result: 'success'
        });

        const adapterRef = task.external_refs?.find(ref => ref.startsWith(`${this.adapter.name}:`));
        const ticketId = adapterRef?.split(':')[1];
        if (ticketId) {
          const subtaskList = subtasks.map(s => `- ${s.id}: ${s.title} (Skill: /${s.skill || 'none'})`).join('\n');
          await this.adapter.postComment(
            ticketId,
            `🤖 Template '${template.name}' applied. Created ${subtasks.length} sub-tasks:\n${subtaskList}`
          );
        }
      }
    } catch (e) {
      task.orchestration_state = 'failed';
      console.error(`[Orchestration] Failed to expand template for ${task.id}:`, e);

      await this.auditLogger.logAction({
        agentId: 'sisyphus-orchestrator',
        taskId: task.id,
        action: 'expand_template',
        details: { error: e instanceof Error ? e.message : String(e) },
        result: 'failure'
      });
    }
  }

  private async decomposeTask(task: Task, tasksJson: TasksJson): Promise<void> {
    console.log(`[Orchestration] Decomposing task ${task.id}: ${task.title}`);
    task.orchestration_state = 'decomposing';

    await this.auditLogger.logAction({
      agentId: 'sisyphus-orchestrator',
      taskId: task.id,
      action: 'decompose',
      details: { title: task.title },
      result: 'pending'
    });

    try {
      const adapterRef = task.external_refs?.find(ref => ref.startsWith(`${this.adapter.name}:`));
      const ticketId = adapterRef?.split(':')[1];

      if (ticketId) {
        await this.adapter.postComment(
          ticketId,
          `🤖 Orchestrator initialized: Decomposing task into sub-tasks for specialized agents...`
        );
      }

      const subtasks: Task[] = [];
      const lines = (task.description || '').split('\n');
      const taskLines = lines.filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* ') || /^\d+\./.test(l.trim()));

      if (taskLines.length > 0) {
        for (const line of taskLines) {
          const subtaskTitle = line.replace(/^[-*\d.]+\s*/, '').trim();
          if (subtaskTitle.length < 3) continue;

          const subtaskId = this.getNextTaskId({ ...tasksJson, tasks: [...tasksJson.tasks, ...subtasks] });
          const skillMatch = subtaskTitle.toLowerCase().match(/\/(pptx|xlsx|calendar|email|docx|pdf)/);
          const skill = skillMatch ? skillMatch[1] : undefined;

          subtasks.push({
            id: subtaskId as any,
            title: subtaskTitle,
            status: 'pending',
            priority: task.priority,
            parent_id: task.id,
            skill: skill,
            project_key: task.project_key,
            repository: task.repository,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          });
        }
      }

      if (subtasks.length > 0) {
        task.subtasks = subtasks.map(s => s.id);
        tasksJson.tasks.push(...subtasks);
        task.orchestration_state = 'ready';

        console.log(`[Orchestration] Successfully decomposed ${task.id} into ${subtasks.length} sub-tasks`);

        await this.auditLogger.logAction({
          agentId: 'sisyphus-orchestrator',
          taskId: task.id,
          action: 'decompose',
          details: { subtasks: task.subtasks },
          result: 'success'
        });

        if (ticketId) {
          const subtaskList = subtasks.map(s => `- ${s.id}: ${s.title}${s.skill ? ` (Skill: /${s.skill})` : ''}`).join('\n');
          await this.adapter.postComment(
            ticketId,
            `🤖 Task successfully decomposed into ${subtasks.length} sub-tasks:\n${subtaskList}`
          );
        }
      } else {
        task.orchestration_state = 'failed';
        console.warn(`[Orchestration] No sub-tasks identified for ${task.id}`);

        await this.auditLogger.logAction({
          agentId: 'sisyphus-orchestrator',
          taskId: task.id,
          action: 'decompose',
          details: { reason: 'No sub-tasks identified in description' },
          result: 'failure'
        });
      }
    } catch (e) {
      task.orchestration_state = 'failed';
      console.error(`[Orchestration] Failed to decompose task ${task.id}:`, e);

      await this.auditLogger.logAction({
        agentId: 'sisyphus-orchestrator',
        taskId: task.id,
        action: 'decompose',
        details: { error: e instanceof Error ? e.message : String(e) },
        result: 'failure'
      });
    }
  }

  private async handleHandoff(task: Task): Promise<void> {
    const from = task.assigned_to || 'unassigned';
    const to = task.handoff_to!;
    const notes = task.handoff_notes ? `\n\nNotes: ${task.handoff_notes}` : '';

    if (!task.handoff_state) {
      task.handoff_state = 'pending';
    }

    if (task.handoff_state === 'pending') {
      console.log(`[Handoff] Task ${task.id} handoff requested: ${from} -> ${to}. Waiting for acceptance.`);
      try {
        const adapterRef = task.external_refs?.find(ref => ref.startsWith(`${this.adapter.name}:`));
        const ticketId = adapterRef?.split(':')[1];
        if (ticketId) {
          await this.adapter.postComment(
            ticketId,
            `🤖 Agent Handoff Requested: ${from} -> ${to}${notes}\n\n[Action Required] New agent must accept to proceed.`
          );
        }
      } catch (e) {
        console.error(`[Handoff] Failed to post handoff request:`, e);
      }
      return;
    }

    if (task.handoff_state === 'rejected') {
      console.log(`[Handoff] Task ${task.id} handoff rejected by ${to}`);
      task.handoff_to = undefined;
      task.handoff_notes = undefined;
      task.handoff_state = undefined;
      return;
    }

    if (task.handoff_state === 'accepted') {
      console.log(`[Handoff] Task ${task.id} handoff accepted by ${to}`);

      await this.auditLogger.logAction({
        agentId: from,
        taskId: task.id,
        action: 'handoff',
        details: { to, notes: task.handoff_notes },
        result: 'success'
      });

      try {
        const adapterRef = task.external_refs?.find(ref => ref.startsWith(`${this.adapter.name}:`));
        const ticketId = adapterRef?.split(':')[1];

        if (ticketId) {
          await this.adapter.postComment(
            ticketId,
            `🤖 Agent Handoff Complete: ${from} -> ${to}${notes}`
          );
        }

        task.assigned_to = to;
        task.handoff_to = undefined;
        task.handoff_notes = undefined;
        task.handoff_state = undefined;
        task.updated = new Date().toISOString();
      } catch (e) {
        console.error(`[Handoff] Failed to post handoff complete comment:`, e);
      }
    }
  }

  private resolveRepository(projectKey?: string): string | undefined {
    if (!projectKey) return undefined;
    const config = this.config.fullConfig;
    if (!config) return undefined;



    return undefined;
  }

  private handleFailure(): void {
    this.consecutiveFailures++;
    this.persistence.logError(`Sync failure #${this.consecutiveFailures}`, 'SYNC_ERROR').catch(() => { });
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.pauseSync();
    }
  }

  private async resumeSync(): Promise<void> {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.isPaused = false;
    this.consecutiveFailures = 0;
    console.log('[SyncEngine] Sync resumed.');
  }

  private async processTaskExecutionQueue(tasksJson: TasksJson): Promise<boolean> {
    if (!this.config.fullConfig?.server?.autoTrigger) return false;

    const maxConcurrent = this.config.fullConfig?.server?.maxConcurrentAgents || 3;
    const activeTasks = tasksJson.tasks.filter(t => t.orchestration_state === 'in_progress');
    let modified = false;

    for (const task of tasksJson.tasks) {
      if (activeTasks.length >= maxConcurrent) break;

      const isAutoReview = task.workflow_type === 'automatic-review';

      if (task.status === 'in_progress' && !task.skill && !isAutoReview) {
        const detected = await this.skillDetector.detectSkill({
          title: task.title,
          description: task.description,
          category: task.category
        });
        console.log(`[SyncEngine] Skill for ${task.id}: ${detected}`);
        task.skill = detected;
      }

      if (task.status === 'in_progress' &&
        task.orchestration_state !== 'in_progress' && !this.isTaskBlocked(task, tasksJson)) {

        const skillToUse = task.skill || 'general';
        const bridge = await this.selectServerBridge(skillToUse);
        if (bridge) {
          console.log(`[SyncEngine] Triggering task ${task.id} (Active: ${activeTasks.length}/${maxConcurrent})`);
          task.orchestration_state = 'in_progress';
          activeTasks.push(task);

          const taskToTrigger = task.skill ? task : { ...task, skill: 'general' };

          // TASK-180: Inject Semantic Skill Context (Integration Tools)
          const integrations = await this.persistence.getIntegrations();
          const semanticContext = SkillMapper.generateToolContext(integrations);

          // NEW: Fetch Skill Instruction
          const skillInstruction = await this.skillDetector.getSkillInstruction(skillToUse);

          const sessionId = await bridge.triggerTaskExecution(taskToTrigger, semanticContext, skillInstruction);
          if (sessionId) {
            await this.persistence.trackSession(sessionId, task.id, skillToUse);
          }
          modified = true;
        }
      }
    }
    return modified;
  }

  public async selectServerBridge(skill?: string): Promise<OpenCodeServerBridge | undefined> {
    if (this.serverBridges.size === 0) return undefined;

    const serverCfg = this.config.fullConfig?.server;
    const instances = serverCfg?.instances;

    let candidateBridges = Array.from(this.serverBridges.entries());

    if (skill && instances) {
      const specializedInstances = instances.filter(inst => inst.skills?.includes(skill));
      if (specializedInstances.length > 0) {
        candidateBridges = candidateBridges.filter(([name]) =>
          specializedInstances.some(inst => inst.name === name)
        );
      }
    }

    if (candidateBridges.length === 1) {
      return candidateBridges[0]?.[1];
    }

    if (candidateBridges.length === 0) {
      return this.serverBridges.get('default') || Array.from(this.serverBridges.values())[0];
    }

    let bestBridge: OpenCodeServerBridge | undefined;
    let minSessions = Infinity;

    for (const [, bridge] of candidateBridges) {
      const count = await bridge.getActiveSessionsCount();
      if (count < minSessions) {
        minSessions = count;
        bestBridge = bridge;
      }
    }

    return bestBridge || this.serverBridges.get('default') || Array.from(this.serverBridges.values())[0];
  }

  private getNextTaskId(tasksJson: TasksJson): string {

    const ids = tasksJson.tasks.map(t => {
      const match = t.id.match(/TASK-(\d+)/);
      return (match && match[1]) ? parseInt(match[1]) : 0;
    });
    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
    return `TASK-${(maxId + 1).toString().padStart(3, '0')}`;
  }

  private mapUnifiedToTaskStatus(status: UnifiedStatus): Task['status'] {
    switch (status) {
      case 'todo': return 'pending';
      case 'in_progress': return 'in_progress';
      case 'review': return 'completed';
      case 'done': return 'completed';
      case 'blocked': return 'blocked';
      default: return 'pending';
    }
  }

  private async syncLocalToRemote(tasksJson: TasksJson, dryRun: boolean = false): Promise<void> {
    if (!this.syncEnabled) {
      return;
    }
    if (this.isSyncing) {
      console.log('[SyncEngine] Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    console.log(`[SyncEngine] Syncing local changes to remote...${dryRun ? ' (DRY RUN)' : ''}`);

    let modified = false;
    let failed = false;

    try {
      for (const task of tasksJson.tasks) {
        const adapterRef = task.external_refs?.find((ref: string) => ref.startsWith(`${this.adapter.name}:`));

        if (!adapterRef) {
          console.log(`[SyncEngine] ${dryRun ? 'Plan creation' : 'Creating'} ticket for task ${task.id}: ${task.title}`);

          try {
            if (!dryRun) {
              const ticket = await this.adapter.createTicket(task);

              if (!task.external_refs) task.external_refs = [];
              task.external_refs.push(`${this.adapter.name}:${ticket.id}`);
              task.last_synced_at = ticket.updatedAt.toISOString();
            }
            modified = true;

            if (!dryRun) console.log(`[SyncEngine] Created ticket for ${task.id}`);
          } catch (err: any) {
            console.error(`[SyncEngine] Failed to create ticket for ${task.id}:`, err.message || err);
            this.handleFailure();
            failed = true;
          }
        } else {
          const ticketId = adapterRef.split(':')[1]?.replace('issue-', '');

          if (ticketId) {
            const localUpdatedVal = task.updated ? new Date(task.updated).getTime() : 0;
            const lastSyncedAt = task.last_synced_at ? new Date(task.last_synced_at).getTime() : 0;

            if (localUpdatedVal > lastSyncedAt) {
              console.log(`[SyncEngine] ${dryRun ? 'Plan update' : 'Updating'} remote ticket ${ticketId} for task ${task.id}`);

              try {
                if (!dryRun) {
                  const ticket = await this.adapter.updateTicket(ticketId, {
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    status: this.mapTaskStatusToUnified(task.status)
                  });

                  if (task.handoff_to) {
                    await this.handleHandoff(task);
                  }

                  task.last_synced_at = ticket.updatedAt.toISOString();
                }
                modified = true;
                if (!dryRun) console.log(`[SyncEngine] Updated ticket ${ticketId}`);
              } catch (err: any) {
                console.error(`[SyncEngine] Failed to update ticket ${ticketId} for ${task.id}:`, err.message || err);
                this.handleFailure();
                failed = true;
              }
            }
          }
        }

        if (task.workflow_type === 'orchestration' && task.status === 'in_progress' && !task.orchestration_state) {
          if (task.template) {
            await this.expandTemplate(task, tasksJson);
          } else {
            await this.decomposeTask(task, tasksJson);
          }
          modified = true;
        }
      }

      if (modified && this.config.tasksFilePath && !dryRun) {
        await this.writeBack(tasksJson);
      }

      if (!failed) {
        this.consecutiveFailures = 0;
      }
    } catch (error) {
      console.error('[SyncEngine] Sync error:', error);
      this.handleFailure();
    } finally {
      this.isSyncing = false;
    }
  }

  private async writeBack(tasksJson: TasksJson): Promise<void> {
    console.log('[SyncEngine] Writing back changes to tasks.json...');

    this.watcher.suspend();

    try {
      tasksJson.meta.last_updated = new Date().toISOString();
      tasksJson.meta.last_agent = 'pm-sync-plugin';

      await fs.writeFile(
        this.config.tasksFilePath!,
        JSON.stringify(tasksJson, null, 2),
        'utf-8'
      );
    } catch (err) {
      console.error('[SyncEngine] Failed to write back:', err);
    } finally {
      setTimeout(() => {
        this.watcher.resume();
      }, 1000);
    }
  }

  public async saveTasks(tasksJson: TasksJson): Promise<void> {
    return this.writeBack(tasksJson);
  }

  private mapTaskStatusToUnified(status: Task['status']): UnifiedStatus {
    switch (status) {
      case 'pending': return 'todo';
      case 'in_progress': return 'in_progress';
      case 'completed': return 'review';
      case 'blocked': return 'blocked';
      default: return 'todo';
    }
  }

  private isTaskBlocked(task: Task, tasksJson: TasksJson): boolean {
    if (!task.blocked_by || task.blocked_by.length === 0) return false;

    for (const blockedById of task.blocked_by) {
      const blockingTask = tasksJson.tasks.find(t => t.id === blockedById);
      if (!blockingTask || blockingTask.status !== 'completed') {
        return true;
      }
    }

    return false;
  }

  private checkParentCompletion(tasksJson: TasksJson): boolean {
    let modified = false;
    for (const task of tasksJson.tasks) {
      if (task.subtasks && task.subtasks.length > 0 && task.status !== 'completed') {
        const allCompleted = task.subtasks.every(subtaskId => {
          const subtask = tasksJson.tasks.find(t => t.id === subtaskId);
          return subtask && subtask.status === 'completed';
        });

        if (allCompleted) {
          console.log(`[Orchestration] All sub-tasks of ${task.id} completed. Marking parent as completed.`);
          task.status = 'completed';
          task.updated = new Date().toISOString();
          modified = true;
        }
      }
    }
    return modified;
  }

  public getPersistence(): DaemonPersistence {
    return this.persistence;
  }

  public getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  public getConfig(): AppConfig | undefined {
    return this.config.fullConfig;
  }

  private pauseSync(): void {
    if (this.isPaused) return;

    this.isPaused = true;
    const pauseDuration = 60000;
    console.error(`[SyncEngine] Too many consecutive failures (${this.consecutiveFailures}). Pausing sync for ${pauseDuration / 1000}s.`);

    this.pauseTimer = setTimeout(() => {
      this.resumeSync();
    }, pauseDuration);
  }

  public async pullOneByTicketId(ticketId: string): Promise<void> {
    const isValid = await this.adapter.validateConfig();
    if (!isValid) {
      throw new Error(`[SyncEngine] Adapter ${this.adapter.name} configuration invalid`);
    }

    const ticket = await this.adapter.getTicket(ticketId);
    if (!ticket) {
      console.warn(`[SyncEngine] Ticket ${ticketId} not found in remote`);
      return;
    }

    const currentTasks = await this.watcher.getTasks();
    if (currentTasks) {
      const modified = await this.processRemoteTickets([ticket], currentTasks, false);
      if (modified) {
        await this.writeBack(currentTasks);
      }
    }
  }

  /**
   * Triggers a refinement loop for a task (Ralph Wiggum Loop).
   * This archives the current session, creates a new one, and injects feedback.
   */
  public async triggerRefinementLoop(taskId: string, refinementFeedback?: string): Promise<{
    success: boolean;
    newSessionId?: string;
    error?: string
  }> {
    // Check if refinement loop is enabled
    const isEnabled = await this.persistence.isRefinementLoopEnabled();
    if (!isEnabled) {
      console.warn(`[RefinementLoop] Feature is disabled. Enable it in Settings.`);
      return { success: false, error: 'Refinement loop feature is disabled' };
    }

    console.log(`[RefinementLoop] Triggering refinement for task ${taskId}`);

    const tasksJson = await this.watcher.getTasks();
    if (!tasksJson) {
      return { success: false, error: 'Could not load tasks' };
    }

    const task = tasksJson.tasks.find(t => t.id === taskId);
    if (!task) {
      return { success: false, error: `Task ${taskId} not found` };
    }

    // Find the current session for this task
    const state = await this.persistence.load();
    const currentSessionEntry = Object.entries(state.activeSessions)
      .find(([_, info]) => (info as any).taskId === taskId);

    let artifactSummary: string | undefined;
    let oldSessionId: string | undefined;

    if (currentSessionEntry) {
      oldSessionId = currentSessionEntry[0];
      console.log(`[RefinementLoop] Found active session ${oldSessionId} for task ${taskId}`);

      // Try to get artifact summary from the old session
      try {
        const bridge = await this.selectServerBridge(task.skill);
        if (bridge) {
          const artifacts = await bridge.getArtifacts(oldSessionId);
          if (artifacts.length > 0) {
            artifactSummary = `Previous session produced: ${artifacts.join(', ')}`;
          }
        }
      } catch (e) {
        console.warn(`[RefinementLoop] Could not fetch artifacts from old session:`, e);
      }

      // Archive the old session
      await this.persistence.archiveSession(
        oldSessionId,
        taskId,
        artifactSummary,
        refinementFeedback || task.refinement_feedback
      );
    }

    // Update task state
    task.status = 'in_progress';
    task.orchestration_state = 'queued';

    // Increment refinement loop counter
    task.refinement_loop = (task.refinement_loop || 0) + 1;
    task.refinement_feedback = refinementFeedback || task.refinement_feedback;
    task.updated = new Date().toISOString();

    // Build context message for the new session
    const previousArchivedSessions = await this.persistence.getArchivedSessionsForTask(taskId);
    const contextMessage = this.buildRefinementContextMessage(
      task,
      previousArchivedSessions,
      refinementFeedback
    );

    // Store the context for injection when session starts
    task.refinement_context = contextMessage;

    await this.writeBack(tasksJson);

    // Trigger the task execution queue to start a new session
    const triggered = await this.processTaskExecutionQueue(tasksJson);
    if (triggered) {
      await this.writeBack(tasksJson);
    }

    console.log(`[RefinementLoop] Refinement loop #${task.refinement_loop} triggered for ${taskId}`);

    // Log to audit trail
    await this.auditLogger.logAction({
      agentId: 'refinement-controller',
      taskId: taskId,
      action: 'refinement_loop',
      details: {
        loop: task.refinement_loop,
        feedback: refinementFeedback,
        archivedSession: oldSessionId
      },
      result: 'success'
    });

    if (this.webhookServer) {
      this.webhookServer.emitEvent({
        type: 'refinement_triggered',
        data: {
          taskId,
          loop: task.refinement_loop,
          timestamp: new Date().toISOString()
        }
      });
    }

    return {
      success: true,
      newSessionId: undefined // Will be set when session actually starts
    };
  }

  /**
   * Builds a context message for the new refinement session
   */
  private buildRefinementContextMessage(
    task: Task,
    archivedSessions: { sessionId: string; archivedAt: string; artifactSummary?: string; refinementFeedback?: string }[],
    currentFeedback?: string
  ): string {
    const lines: string[] = [
      `🔄 **REFINEMENT LOOP #${task.refinement_loop || 1}**`,
      ``,
      `This task is being refined based on feedback from a previous attempt.`,
      ``
    ];

    if (currentFeedback) {
      lines.push(`## 📝 Feedback to Address:`);
      lines.push(currentFeedback);
      lines.push(``);
    }

    if (archivedSessions.length > 0) {
      lines.push(`## 📚 Previous Attempts:`);
      for (const session of archivedSessions.slice(-3)) { // Show last 3
        lines.push(`- Session ${session.sessionId} (archived ${session.archivedAt})`);
        if (session.artifactSummary) {
          lines.push(`  Artifacts: ${session.artifactSummary}`);
        }
        if (session.refinementFeedback) {
          lines.push(`  Feedback: ${session.refinementFeedback}`);
        }
      }
      lines.push(``);
    }

    lines.push(`## 🎯 Original Task:`);
    lines.push(`Title: ${task.title}`);
    if (task.description) {
      lines.push(`Description: ${task.description}`);
    }

    return lines.join('\n');
  }
}
