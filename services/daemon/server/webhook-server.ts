import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Agent } from 'undici';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import proxy from '@fastify/http-proxy';
import { SyncEngine } from '../sync/sync-engine.js';
import { Task } from '../types/tasks.js';
import { PermissionManager } from '../permissions/permission-manager.js';
import { ServerProfileManager } from './server-profile-manager.js';
import { SkillRegistry } from '../skills/registry.js';
import { ArtifactManager } from '../storage/artifact-manager.js';
import { ConfigManager } from '../occm/config-manager.js';
import { AgentGroupManager } from '../occm/agent-groups.js';
import { SkillsManager } from '../occm/skills-manager.js';
import { RulesManager } from '../occm/rules-manager.js';
import { BackupManager, ConfigValidator, ExternalConfigImporter } from '../occm/backup-manager.js';
import { PresetsManager } from '../occm/presets-manager.js';
import { ChatManager, ChatMessage } from '../chat/chat-manager.js';
import { MemoryService } from '../memory/memory-service.js';
import { PermissionGuard, ForbiddenError, subject } from '../authorization/permission-guard.js';
import { AbilityFactory } from '../authorization/ability-factory.js';
import { ActionType } from '../authorization/actions.js';
import { SubjectType } from '../authorization/subjects.js';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface WebhookServerConfig {
  port: number;
  secret?: string;
  jwtSecret?: string;
  enableCORS?: boolean;
  tasksFilePath?: string;
  storage?: any;
}

export class WebhookServer {
  private server: FastifyInstance;
  private syncEngine: SyncEngine;
  private config: WebhookServerConfig;
  private tasksFilePath: string;
  private sseClients: Set<any> = new Set();
  private permissionManager: PermissionManager;
  private serverProfileManager: ServerProfileManager;
  private skillRegistry: SkillRegistry;
  private artifactManager: ArtifactManager;
  private occmConfigManager: ConfigManager;
  private occmGroupManager: AgentGroupManager;
  private skillsManager: SkillsManager;
  private rulesManager: RulesManager;
  private backupManager: BackupManager;
  private configValidator: ConfigValidator;
  private externalConfigImporter: ExternalConfigImporter;
  private presetsManager: PresetsManager;
  private chatManager: ChatManager;
  private memoryService: MemoryService;
  private permissionGuard: PermissionGuard;
  private abilityFactory: AbilityFactory;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(syncEngine: SyncEngine, config: WebhookServerConfig) {
    this.syncEngine = syncEngine;
    this.config = config;
    this.tasksFilePath = config.tasksFilePath || '.agent-config/project/tasks.json';
    this.server = fastify({ logger: false });
    this.permissionManager = new PermissionManager();
    this.serverProfileManager = new ServerProfileManager();
    this.skillRegistry = new SkillRegistry(config.storage);
    this.artifactManager = new ArtifactManager(config.storage);
    this.occmConfigManager = new ConfigManager('.agent-config');
    this.occmGroupManager = new AgentGroupManager('.agent-config');
    this.skillsManager = new SkillsManager();
    this.rulesManager = new RulesManager();
    this.backupManager = new BackupManager('.agent-config');
    this.configValidator = new ConfigValidator();
    this.externalConfigImporter = new ExternalConfigImporter();
    this.presetsManager = new PresetsManager();
    this.chatManager = new ChatManager('.agent-config');
    this.memoryService = new MemoryService('.agent-config/memory');
    
    // Initialize new CASL-based authorization
    this.abilityFactory = new AbilityFactory({ configBaseDir: '.agent-config' });
    this.permissionGuard = new PermissionGuard({
      abilityFactory: this.abilityFactory,
      enableAuditLog: true,
      onDenied: async ({ actorId, action, subject, request }) => {
        // Log to audit trail
        console.warn(`[Authorization] Denied: ${actorId} attempted ${action} on ${subject} from ${request.ip}`);
      }
    });
  }

  public getPermissionManager(): PermissionManager {
    return this.permissionManager;
  }

  public getArtifactManager(): ArtifactManager {
    return this.artifactManager;
  }

  public async listen() {
    // Initialize chat manager
    await this.chatManager.init();
    await this.memoryService.init();

    await this.setupRoutes();
    return this.server.listen({ port: this.config.port, host: '0.0.0.0' });
  }

  emitEvent(event: { type: string; data: any }) {
    // Send as a default 'message' event so generic listeners (like EventSource default) catch it.
    // We wrap the data to include the type, similar to how standard OpenCode events are structured.
    // We wrap the data to include the type, similar to how standard OpenCode events are structured.


    // Check if we need to wrap it further or if the bridge expects specific structure
    // The bridge unwraps: event = raw.payload || raw.
    // So if we send: { type: "task_created", payload: {...} }
    // Bridge sees raw = {type, payload}. event = payload.
    // Then event.type is missing.

    // If we send: { type: "task_created", ...event.data }
    // Bridge sees raw = {type, ...data}. event = raw.
    // Then event.type is present.

    const messagePayload = {
      type: event.type,
      ...event.data
    };

    const message = `data: ${JSON.stringify(messagePayload)}\n\n`;

    this.sseClients.forEach(reply => {
      try {
        reply.raw.write(message);
      } catch (err) {
        this.sseClients.delete(reply);
      }
    });
  }

  private async setupRoutes() {
    // TASK-181: Rate Limiting
    const rateLimit = new Map<string, { count: number, reset: number }>();
    const WINDOW_MS = 60 * 1000; // 1 minute
    const MAX_REQUESTS = 300; // 300 requests per minute

    this.server.addHook('onRequest', async (request, reply) => {
      const ip = request.ip;
      const now = Date.now();

      let record = rateLimit.get(ip);
      if (!record || now > record.reset) {
        record = { count: 0, reset: now + WINDOW_MS };
        rateLimit.set(ip, record);
      }

      record.count++;
      if (record.count > MAX_REQUESTS) {
        return reply.code(429).send({ error: "Too Many Requests" });
      }
    });

    if (this.config.enableCORS !== false) {
      await this.server.register(cors, {
        origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true
      });
    }

    await this.server.register(jwt, {
      secret: this.config.jwtSecret || 'dev-secret-keep-it-safe-123'
    });

    // Initialize authorization components
    await this.abilityFactory.init();
    await this.abilityFactory.createDefaultRolesConfig();

    // Error handler for ForbiddenError
    this.server.setErrorHandler((error, request, reply) => {
      if (error instanceof ForbiddenError) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: error.message,
          action: error.action,
          subject: error.subject,
          actorId: error.actorId
        });
      }
      // Re-throw for default error handling
      throw error;
    });

    await this.server.register(proxy, {
      upstream: 'http://localhost:9980',
      prefix: '/api/editor',
      rewritePrefix: '/',
      http2: false
    });

    // Collaborative Editing Endpoints (TASK-175)
    this.server.post('/api/editor/callback', async (request) => {
      const { taskId, fileName } = request.query as { taskId: string, fileName: string };
      const body = request.body as any;

      if (body.status === 2 || body.status === 6) {
        console.log(`[Editor] Received save callback for ${fileName} in task ${taskId}`);
      }
      return { error: 0 };
    });

    this.server.get('/api/editor/config/:taskId/:fileName', async (request, reply) => {
      const { taskId, fileName } = request.params as { taskId: string, fileName: string };
      const collabPlugin = this.syncEngine.getCollabPlugin();

      if (!collabPlugin) {
        return reply.code(503).send({ error: 'Collaboration plugin not active' });
      }

      const protocol = request.protocol;
      const host = request.hostname;
      const baseUrl = `${protocol}://${host}`;

      const config = collabPlugin.getEditorConfig(taskId, fileName, baseUrl);

      if (!config) {
        return reply.code(400).send({ error: 'File type not supported' });
      }

      return config;
    });

    this.server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    });



    this.server.post('/webhooks/plane', async (request, reply) => {
      if (this.config.secret && request.headers['authorization'] !== this.config.secret) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as any;
      if (body.data && body.data.id && (body.event === 'issue.updated' || body.event === 'issue.created')) {
        console.log(`[Webhook] Plane issue updated: ${body.data.id}`);
        await this.syncEngine.pullOne(body.data.id);
      }
      return { received: true };
    });

    this.server.get('/health', async () => {
      return { status: 'ok', engine: 'pm-sync-webhook' };
    });

    const loginSchema = {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' }
        }
      }
    };

    this.server.post('/api/login', { schema: loginSchema }, async (request, reply) => {
      const { username, password } = request.body as any;

      if (username === 'admin' && password === 'admin') {
        const token = this.server.jwt.sign({ id: 'user-admin', username: 'admin' });
        return { token };
      }

      return reply.code(401).send({ error: 'Invalid credentials' });
    });

    this.server.get('/api/tickets', async (request, reply) => {
      try {
        const tasksFile = await fs.readFile(this.tasksFilePath, 'utf-8');
        const tasksData = JSON.parse(tasksFile);

        const query = request.query as any;
        let tasks = (tasksData.tasks || []) as Task[];

        if (!Array.isArray(tasks)) {
          console.warn('[API] Warning: tasks is not an array, resetting to empty');
          tasks = [];
        }

        // Hide development tasks from the dashboard to reduce clutter
        // We now call them 'tickets' in the UI
        tasks = tasks.filter(t => t.category !== 'core' && t.category !== 'test');

        if (query.status) {
          tasks = tasks.filter(t => t.status === query.status);
        }
        if (query.priority) {
          tasks = tasks.filter(t => t.priority === query.priority);
        }
        if (query.repository) {
          tasks = tasks.filter(t => t.repository === query.repository);
        }

        return {
          tickets: tasks,
          total: tasks.length,
          meta: tasksData.meta
        };
      } catch (err) {
        console.error('[API] Failed to list tickets:', err);
        return reply.code(500).send({ error: 'Failed to load tickets' });
      }
    });

    // TEMPORARY LEGACY ENDPOINT to support frontend before restart
    this.server.get('/api/tasks', async (_request, reply) => {
      try {
        const tasksFile = await fs.readFile(this.tasksFilePath, 'utf-8');
        const tasksData = JSON.parse(tasksFile);
        let tasks = (tasksData.tasks || []) as Task[];

        // Return same structure as tickets
        return {
          tasks: tasks,
          total: tasks.length,
          meta: tasksData.meta
        };
      } catch (err) {
        return reply.code(500).send({ error: 'Failed to load tasks' });
      }
    });

    this.server.get('/api/tickets/:id', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const tasksFile = await fs.readFile(this.tasksFilePath, 'utf-8');
        const tasksData = JSON.parse(tasksFile);

        const task = tasksData.tasks.find((t: Task) => t.id === id);

        if (!task) {
          return reply.code(404).send({ error: 'Ticket not found' });
        }

        return { ticket: task };
      } catch (err) {
        console.error('[API] Failed to get ticket:', err);
        return reply.code(500).send({ error: 'Failed to load ticket' });
      }
    });

    const ticketUpdateSchema = {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          status: { type: 'string' },
          skill: { type: 'string' },
          category: { type: 'string' },
          repository: { type: 'string' },
          refined: { type: 'boolean' }
        }
      }
    };

    this.server.patch('/api/tickets/:id', { schema: ticketUpdateSchema }, async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const updates = request.body as Partial<Task>;

        const tasksFile = await fs.readFile(this.tasksFilePath, 'utf-8');
        const tasksData = JSON.parse(tasksFile);

        const taskIndex = tasksData.tasks.findIndex((t: Task) => t.id === id);

        if (taskIndex === -1) {
          return reply.code(404).send({ error: 'Ticket not found' });
        }

        tasksData.tasks[taskIndex] = {
          ...tasksData.tasks[taskIndex],
          ...updates,
          updated: new Date().toISOString()
        };

        await fs.writeFile(this.tasksFilePath, JSON.stringify(tasksData, null, 2), 'utf-8');

        console.log(`[API] Updated ticket ${id}:`, Object.keys(updates));

        this.emitEvent({
          type: 'ticket_updated',
          data: {
            ticketId: id,
            updates,
            timestamp: new Date().toISOString()
          }
        });

        if (this.syncEngine) {
          this.syncEngine.emit('task_updated', {
            taskId: id,
            updates,
            timestamp: new Date().toISOString()
          });
        }

        return {
          ticket: tasksData.tasks[taskIndex],
          updated: true
        };
      } catch (err) {
        console.error('[API] Failed to update ticket:', err);
        return reply.code(500).send({ error: 'Failed to update ticket' });
      }
    });

    const ticketCreateSchema = {
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          skill: { type: 'string' },
          category: { type: 'string' },
          repository: { type: 'string' },
          active_integrations: { type: 'array', items: { type: 'string' } },
          active_mcps: { type: 'array', items: { type: 'string' } },
          active_skills: { type: 'array', items: { type: 'string' } }
        }
      }
    };

    this.server.post('/api/tickets', { schema: ticketCreateSchema }, async (request, reply) => {
      try {
        const newTaskData = request.body as {
          title: string;
          description?: string;
          priority: Task['priority'];
          skill?: string;
          category?: string;
          repository?: string;
          active_integrations?: string[];
          active_mcps?: string[];
          active_skills?: string[];
        };

        // Schema validation handles the title check check
        // if (!newTaskData.title) { return reply.code(400).send({ error: 'Task title is required' }); }

        const tasksFile = await fs.readFile(this.tasksFilePath, 'utf-8');
        const tasksData = JSON.parse(tasksFile);

        const existingIds = tasksData.tasks.map((t: Task) => t.id);
        const nextNum = existingIds.length > 0
          ? Math.max(...existingIds.map((id: string) => parseInt(id.replace('TASK-', '')) || 0)) + 1
          : 1;
        const newId = `TASK-${String(nextNum).padStart(3, '0')}`;

        const newTask: Task = {
          id: newId,
          title: newTaskData.title,
          description: newTaskData.description,
          status: 'pending',
          priority: newTaskData.priority || 'medium',
          category: newTaskData.category,
          skill: newTaskData.skill,
          repository: newTaskData.repository,
          active_integrations: newTaskData.active_integrations || [],
          active_mcps: newTaskData.active_mcps || [],
          active_skills: newTaskData.active_skills || [],
          created: new Date().toISOString()
        };

        tasksData.tasks.push(newTask);

        await fs.writeFile(this.tasksFilePath, JSON.stringify(tasksData, null, 2), 'utf-8');

        console.log(`[API] Created ticket ${newId}: ${newTask.title}`);

        this.emitEvent({
          type: 'ticket_created',
          data: {
            ticket: newTask,
            timestamp: new Date().toISOString()
          }
        });

        if (this.syncEngine) {
          this.syncEngine.push().catch(err => {
            console.error('[API] Failed to push new ticket to PM tool:', err);
          });
        }

        return reply.code(201).send({
          ticket: newTask,
          created: true
        });
      } catch (err) {
        console.error('[API] Failed to create ticket:', err);
        return reply.code(500).send({ error: 'Failed to create ticket' });
      }
    });

    this.server.delete('/api/tickets/:id', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const tasksFile = await fs.readFile(this.tasksFilePath, 'utf-8');
        const tasksData = JSON.parse(tasksFile);

        const taskIndex = tasksData.tasks.findIndex((t: Task) => t.id === id);
        if (taskIndex === -1) {
          return reply.code(404).send({ error: 'Ticket not found' });
        }

        const task = tasksData.tasks[taskIndex];
        tasksData.tasks.splice(taskIndex, 1);

        await fs.writeFile(this.tasksFilePath, JSON.stringify(tasksData, null, 2), 'utf-8');

        console.log(`[API] Deleted ticket ${id}: ${task.title}`);

        this.emitEvent({
          type: 'ticket_deleted',
          data: {
            ticketId: id,
            timestamp: new Date().toISOString()
          }
        });

        if (this.syncEngine) {
          this.syncEngine.push().catch(err => {
            console.error('[API] Failed to push deletion to PM tool:', err);
          });
        }

        return reply.code(200).send({ success: true });
      } catch (err) {
        console.error('[API] Failed to delete ticket:', err);
        return reply.code(500).send({ error: 'Failed to delete ticket' });
      }
    });

    this.server.get('/api/status', async () => {
      try {
        const persistence = this.syncEngine.getPersistence();
        const state = await persistence.load();

        return {
          status: 'running',
          lastPoll: state.lastPollTimestamp || null,
          activeSessions: Object.keys(state.activeSessions).length,
          recentErrors: state.errorLog.slice(-5),
          uptime: process.uptime(),
          version: '1.0.0'
        };
      } catch (err) {
        console.error('[API] Failed to get status:', err);
        return {
          status: 'error',
          error: 'Failed to load daemon state'
        };
      }
    });

    this.server.get('/api/agents', async () => {
      try {
        const persistence = this.syncEngine.getPersistence();
        const state = await persistence.load();

        const agents = Object.entries(state.activeSessions).map(([sessionId, session]) => {
          const sessionData = session as { taskId: string; skill: string; startedAt: string };
          return {
            sessionId,
            taskId: sessionData.taskId,
            skill: sessionData.skill,
            startedAt: sessionData.startedAt,
            duration: Date.now() - new Date(sessionData.startedAt).getTime()
          };
        });

        return {
          agents,
          count: agents.length
        };
      } catch (err) {
        console.error('[API] Failed to get agents:', err);
        return {
          agents: [],
          count: 0,
          error: 'Failed to load active sessions'
        };
      }
    });

    this.server.get('/api/repos', async (_request, reply) => {
      try {


        const repos: Array<{ id: string; name: string; path: string; description?: string }> = [];

        if (repos.length === 0) {
          const defaultRepo = {
            id: 'default',
            name: 'Default',
            path: process.cwd(),
            description: 'Default repository'
          };
          repos.push(defaultRepo);
        }

        return {
          repos,
          count: repos.length
        };
      } catch (err) {
        console.error('[API] Failed to get repositories:', err);
        return reply.code(500).send({
          error: 'Failed to load repositories',
          repos: [],
          count: 0
        });
      }
    });

    this.server.get('/api/servers', async () => {
      const profiles = await this.serverProfileManager.getAllProfiles();
      return { servers: profiles, count: profiles.length };
    });

    this.server.post('/api/servers', async (request, reply) => {
      try {
        const profile = await this.serverProfileManager.addProfile(request.body as any);
        return reply.code(201).send(profile);
      } catch (err) {
        return reply.code(400).send({ error: 'Failed to create server profile' });
      }
    });

    this.server.patch('/api/servers/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const profile = await this.serverProfileManager.updateProfile(id, request.body as any);
      if (!profile) return reply.code(404).send({ error: 'Server not found' });
      return profile;
    });

    this.server.delete('/api/servers/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const success = await this.serverProfileManager.deleteProfile(id);
      if (!success) return reply.code(404).send({ error: 'Server not found' });
      return { success: true };
    });

    this.server.post('/api/servers/:id/ping', async (request, reply) => {
      const { id } = request.params as { id: string };
      const profile = await this.serverProfileManager.pingServer(id);
      if (!profile) return reply.code(404).send({ error: 'Server not found' });

      this.emitEvent({
        type: 'server_status_updated',
        data: {
          serverId: id,
          status: profile.status,
          timestamp: profile.lastHealthCheck
        }
      });

      return profile;
    });

    this.server.get('/api/skills', async () => {
      const skills = await this.skillRegistry.discover();
      return { skills, count: skills.length };
    });

    this.server.get('/api/logs', async (request) => {
      const query = request.query as any;
      const filters = {
        agentId: query.agentId,
        taskId: query.taskId,
        result: query.result,
        limit: query.limit ? parseInt(query.limit) : 100
      };
      const logs = await this.syncEngine.getAuditLogger().getLogs(filters);
      return { logs, count: logs.length };
    });

    // TASK-182: System Telemetry & Metrics
    this.server.get('/api/metrics', async () => {
      try {
        const tasksFile = await fs.readFile(this.tasksFilePath, 'utf-8');
        const tasksData = JSON.parse(tasksFile);
        const tasks = tasksData.tasks || [];

        const byStatus: Record<string, number> = {};
        tasks.forEach((t: any) => {
          byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        });

        return {
          tasks: {
            total: tasks.length,
            byStatus
          },
          system: {
            uptime: process.uptime(),
            memory: process.memoryUsage()
          },
          timestamp: new Date().toISOString()
        };
      } catch (err) {
        console.error('[API] Metrics failed:', err);
        return { error: 'Failed to generate metrics' };
      }
    });

    // TASK-184: Real Context Options Endpoint
    this.server.get('/api/context/options', async () => {
      // 1. Integrations
      let integrations: any[] = [];
      try {
        const content = await fs.readFile('.agent-config/integrations.json', 'utf-8');
        const data = JSON.parse(content);
        integrations = Array.isArray(data) ? data : (data.integrations || []);
      } catch { /* ignore if missing */ }

      // 2. MCP Servers
      let mcps: string[] = [];
      try {
        // Also include config-defined ones as fallback or supplement
        const configContent = await fs.readFile('.agent-config/mcp/config.json', 'utf-8');
        const config = JSON.parse(configContent);
        if (config.mcpServers) mcps.push(...Object.keys(config.mcpServers));

        // Merge with live servers from bridge
        const bridge = await this.syncEngine.selectServerBridge();
        if (bridge) {
          const liveMcps = await bridge.getMcpServers();
          if (liveMcps) {
            const liveKeys = Object.keys(liveMcps);
            // Combine unique
            mcps = Array.from(new Set([...mcps, ...liveKeys]));
          }
        }
      } catch (e) { console.warn('Failed to load MCPs', e); }

      // 3. Skills
      let skills: string[] = [];
      try {
        const discovered = await this.skillRegistry.discover();
        skills = discovered.map(s => s.name);
      } catch (e) { console.warn('Failed to load skills', e); }

      return { integrations, mcps, skills };
    });

    this.server.get('/api/opencode/config', async (_request, reply) => {
      try {
        let localConfig = {};
        try {
          const content = await fs.readFile('.agent-config/opencode-ui.json', 'utf-8');
          localConfig = JSON.parse(content);
        } catch { /* ignore missing file */ }

        // Try to fetch from bridge as base, but don't fail if unavailable
        let remoteConfig = {};
        try {
          const bridge = await this.syncEngine.selectServerBridge();
          if (bridge) {
            remoteConfig = await bridge.getConfig();
          }
        } catch (e) { console.warn('[API] Failed to fetch remote config base', e); }

        // Merge: local overrides remote
        const config = { ...remoteConfig, ...localConfig };
        return { config };
      } catch (err) {
        console.error('[API] Failed to fetch OpenCode config:', err);
        return reply.code(500).send({ error: 'Failed to fetch config' });
      }
    });

    this.server.get('/api/occm/config', async (_request, reply) => {
      try {
        const configs = await this.occmConfigManager.loadConfigs();
        return configs;
      } catch (err) {
        console.error('[OCCM] Failed to load configs:', err);
        return reply.code(500).send({ error: 'Failed to load configs' });
      }
    });

    this.server.post('/api/occm/config', async (request, reply) => {
      try {
        const { opencode, omo } = request.body as { opencode: any, omo: any };
        await this.occmConfigManager.saveConfigs(opencode, omo);
        return { success: true };
      } catch (err) {
        console.error('[OCCM] Failed to save configs:', err);
        return reply.code(500).send({ error: 'Failed to save configs' });
      }
    });

    this.server.get('/api/occm/groups', async (_request, reply) => {
      try {
        await this.occmGroupManager.loadGroups();
        const groups = this.occmGroupManager.listGroups(true); // Include presets
        return { groups };
      } catch (err) {
        console.error('[OCCM] Failed to list groups:', err);
        return reply.code(500).send({ error: 'Failed to list groups' });
      }
    });

    this.server.post('/api/occm/groups', async (request, reply) => {
      try {
        const group = request.body as any;
        await this.occmGroupManager.addOrUpdateGroup(group);
        return { success: true };
      } catch (err) {
        console.error('[OCCM] Failed to save group:', err);
        return reply.code(500).send({ error: 'Failed to save group' });
      }
    });

    this.server.delete('/api/occm/groups/:id', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const success = await this.occmGroupManager.deleteGroup(id);
        return { success };
      } catch (err) {
        console.error('[OCCM] Failed to delete group:', err);
        return reply.code(500).send({ error: 'Failed to delete group' });
      }
    });

    // Skills Endpoints
    this.server.get('/api/occm/skills', async () => {
      return await this.skillsManager.discoverAll();
    });

    this.server.post('/api/occm/skills', async (request, reply) => {
      try {
        const { skill, location } = request.body as any;
        const path = await this.skillsManager.saveSkill(skill, location);
        return { success: true, path };
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }
    });

    this.server.delete('/api/occm/skills/:name', async (request, reply) => {
      try {
        const { name } = request.params as { name: string };
        const success = await this.skillsManager.deleteSkill(name);
        return { success };
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }
    });

    // Rules/Instructions Endpoints
    this.server.get('/api/occm/rules/agents-md', async (request) => {
      const { isGlobal } = request.query as { isGlobal?: string };
      return await this.rulesManager.getAgentsMd(isGlobal === 'true');
    });

    this.server.post('/api/occm/rules/agents-md', async (request, reply) => {
      try {
        const { content, isGlobal } = request.body as any;
        await this.rulesManager.saveAgentsMd(content, isGlobal);
        return { success: true };
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }
    });

    this.server.get('/api/occm/rules/template', async () => {
      return { template: this.rulesManager.getTemplate() };
    });

    // Monitor/Ping Endpoints
    this.server.post('/api/occm/monitor/ping', async (request) => {
      const { url } = request.body as { url: string };
      const start = Date.now();
      try {
        // Use a simple fetch with timeout for ping
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'OCCM-Monitor/1.0' }
        }).catch(() => fetch(url, { method: 'GET', signal: controller.signal }));

        clearTimeout(timeoutId);
        const latency = Date.now() - start;
        return { success: true, latency, status: res.status };
      } catch (err) {
        return { success: false, error: (err as Error).message, latency: Date.now() - start };
      }
    });

    // Plugins Endpoints (Basic)
    this.server.get('/api/occm/plugins', async () => {
      try {
        const { stdout } = await execAsync('npm list -g --json');
        const data = JSON.parse(stdout);
        // Map to a simpler format
        return Object.entries(data.dependencies || {}).map(([name, info]: [string, any]) => ({
          name,
          version: info.version,
          status: 'installed'
        }));
      } catch {
        return [];
      }
    });

    this.server.post('/api/occm/groups/:id/apply', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { opencode: currentOpencode, omo: currentOmo } = await this.occmConfigManager.loadConfigs();

        // Load groups first to ensure we have custom ones
        await this.occmGroupManager.loadGroups();

        const newConfigs = await this.occmGroupManager.applyGroup(id, currentOpencode, currentOmo);

        // Save immediately
        await this.occmConfigManager.saveConfigs(newConfigs.opencode, newConfigs.omo);

        return { success: true, configs: newConfigs };
      } catch (err) {
        console.error('[OCCM] Failed to apply group:', err);
        return reply.code(500).send({ error: 'Failed to apply group' });
      }
    });

    // ========== NEW OCCM ENDPOINTS ==========

    // Skill Import from GitHub
    this.server.post('/api/occm/skills/import/github', async (request) => {
      const { source, location } = request.body as { source: string; location: string };
      return this.skillsManager.importFromGithub(source, location);
    });

    // Skill Import from Local Path
    this.server.post('/api/occm/skills/import/local', async (request) => {
      const { path, location } = request.body as { path: string; location: string };
      return this.skillsManager.importFromLocal(path, location);
    });

    // Skill Marketplace
    this.server.get('/api/occm/skills/marketplace', async () => {
      return this.skillsManager.getMarketplace();
    });

    this.server.post('/api/occm/skills/marketplace/install', async (request) => {
      const { skillId, location } = request.body as { skillId: string; location: string };
      return this.skillsManager.installMarketplaceSkill(skillId, location);
    });

    // Skill Updates
    this.server.get('/api/occm/skills/updates', async () => {
      const skills = await this.skillsManager.checkUpdates();
      return { skills };
    });

    this.server.post('/api/occm/skills/:name/update', async (request) => {
      const { name } = request.params as { name: string };
      return this.skillsManager.updateSkill(name);
    });

    // Config Backup & Restore
    this.server.get('/api/occm/backups', async () => {
      return this.backupManager.listBackups();
    });

    this.server.post('/api/occm/backups', async (request) => {
      const { description } = request.body as { description?: string };
      const { opencode, omo } = await this.occmConfigManager.loadConfigs();
      return this.backupManager.createBackup(opencode, omo, description);
    });

    this.server.post('/api/occm/backups/:id/restore', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await this.backupManager.restoreBackup(id);
        if ('error' in result) {
          return reply.code(400).send({ success: false, error: result.error });
        }
        // Save restored config
        await this.occmConfigManager.saveConfigs(result.opencode, result.omo);
        return { success: true };
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }
    });

    this.server.delete('/api/occm/backups/:id', async (request) => {
      const { id } = request.params as { id: string };
      return this.backupManager.deleteBackup(id);
    });

    // Config Validation & Auto-Fix
    this.server.get('/api/occm/config/validate', async () => {
      const { opencode, omo } = await this.occmConfigManager.loadConfigs();
      const opencodeErrors = this.configValidator.validateOpencode(opencode);
      const omoErrors = this.configValidator.validateOmo(omo);
      const allErrors = [...opencodeErrors, ...omoErrors];
      return { valid: allErrors.length === 0, errors: allErrors };
    });

    this.server.post('/api/occm/config/auto-fix', async () => {
      const { opencode, omo } = await this.occmConfigManager.loadConfigs();
      const { opencode: fixedOpencode, omo: fixedOmo, fixedIssues } = this.configValidator.autoFix(opencode, omo);
      if (fixedIssues.length > 0) {
        await this.occmConfigManager.saveConfigs(fixedOpencode, fixedOmo);
      }
      return { success: true, fixedIssues };
    });

    // External Config Import (Claude Code, Cursor, etc.)
    this.server.get('/api/occm/config/external/detect', async () => {
      return this.externalConfigImporter.detectAll();
    });

    this.server.post('/api/occm/config/external/import', async (request) => {
      const { source } = request.body as { source: string };
      return this.externalConfigImporter.importConfig(source);
    });

    // Raw Config View
    this.server.get('/api/occm/config/raw', async () => {
      const { opencode, omo } = await this.occmConfigManager.loadConfigs();
      return {
        opencode: JSON.stringify(opencode, null, 2),
        omo: JSON.stringify(omo, null, 2)
      };
    });

    // ========== STARTER PACKS (FEAT-PREPOPULATE) ==========

    // List all available starter packs
    this.server.get('/api/occm/presets', async () => {
      return this.presetsManager.getStarterPacks();
    });

    // Get a specific starter pack by ID
    this.server.get('/api/occm/presets/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const pack = this.presetsManager.getStarterPack(id);
      if (!pack) {
        return reply.code(404).send({ error: 'Starter pack not found' });
      }
      return pack;
    });

    // Get recommended starter pack based on environment
    this.server.get('/api/occm/presets/recommended', async () => {
      return this.presetsManager.getRecommended();
    });

    // Apply a starter pack (merge with existing config)
    this.server.post('/api/occm/presets/:id/apply', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { opencode: currentOpencode, omo: currentOmo } = await this.occmConfigManager.loadConfigs();

        const result = this.presetsManager.applyStarterPack(id, currentOpencode, currentOmo);
        if (!result) {
          return reply.code(404).send({ error: 'Starter pack not found' });
        }

        // Save the merged configs
        await this.occmConfigManager.saveConfigs(result.opencode, result.omo);

        console.log(`[OCCM] Applied starter pack: ${id}`);

        this.emitEvent({
          type: 'preset_applied',
          data: { packId: id, timestamp: new Date().toISOString() }
        });

        return { success: true, configs: result };
      } catch (err) {
        console.error('[OCCM] Failed to apply starter pack:', err);
        return reply.code(500).send({ error: 'Failed to apply starter pack' });
      }
    });

    // Preview what applying a starter pack would do (dry run)
    this.server.get('/api/occm/presets/:id/preview', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { opencode: currentOpencode, omo: currentOmo } = await this.occmConfigManager.loadConfigs();

        const result = this.presetsManager.applyStarterPack(id, currentOpencode, currentOmo);
        if (!result) {
          return reply.code(404).send({ error: 'Starter pack not found' });
        }

        // Return preview without saving
        return {
          preview: true,
          currentConfig: { opencode: currentOpencode, omo: currentOmo },
          resultConfig: result
        };
      } catch (err) {
        console.error('[OCCM] Failed to preview starter pack:', err);
        return reply.code(500).send({ error: 'Failed to preview starter pack' });
      }
    });


    this.server.get('/api/artifacts/:id/:fileName', async (request, reply) => {
      try {
        const { id, fileName } = request.params as { id: string; fileName: string };

        // 1. Try local artifact manager (Tasks/Storage)
        const buffer = await this.artifactManager.getArtifact(id, fileName);
        if (buffer) {
          return this.sendBuffer(reply, fileName, buffer);
        }

        // 2. Fallback to session-based bridge (Real-time Agent sessions)
        const bridge = await this.syncEngine.selectServerBridge();
        if (bridge) {
          const sessionBuffer = await bridge.getFileContent(id, fileName);
          if (sessionBuffer) {
            return this.sendBuffer(reply, fileName, sessionBuffer);
          }
        }

        return reply.code(404).send({ error: 'Artifact not found' });
      } catch (err) {
        console.error('[API] Failed to fetch artifact:', err);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    });

    // Refinement Loop Settings
    this.server.get('/api/settings/refinement-loop', async (_request, reply) => {
      try {
        const persistence = this.syncEngine.getPersistence();
        const enabled = await persistence.isRefinementLoopEnabled();
        return { enabled };
      } catch (err) {
        console.error('[API] Failed to get refinement loop setting:', err);
        return reply.code(500).send({ error: 'Failed to get setting' });
      }
    });

    this.server.post('/api/settings/refinement-loop', async (request, reply) => {
      try {
        const { enabled } = request.body as { enabled: boolean };
        const persistence = this.syncEngine.getPersistence();
        await persistence.setRefinementLoopEnabled(enabled);

        this.emitEvent({
          type: 'refinement_loop_toggled',
          data: { enabled, timestamp: new Date().toISOString() }
        });

        return { success: true, enabled };
      } catch (err) {
        console.error('[API] Failed to update refinement loop setting:', err);
        return reply.code(500).send({ error: 'Failed to update setting' });
      }
    });

    // Trigger Refinement for a Ticket (Ralph Wiggum Loop)
    this.server.post('/api/tickets/:id/refine', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { feedback } = request.body as { feedback?: string };

        console.log(`[API] Triggering refinement for ticket ${id}`);

        const result = await this.syncEngine.triggerRefinementLoop(id, feedback);

        if (!result.success) {
          return reply.code(400).send({ error: result.error });
        }

        return {
          success: true,
          ticketId: id,
          message: 'Refinement loop triggered',
          newSessionId: result.newSessionId
        };
      } catch (err) {
        console.error('[API] Failed to trigger refinement:', err);
        return reply.code(500).send({ error: 'Failed to trigger refinement' });
      }
    });

    // TASK-195: Live Session Inspection
    this.server.get('/api/tickets/:id/messages', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const persistence = this.syncEngine.getPersistence();
        const state = await persistence.load();

        // Find active session for this ticket
        let sessionId = '';
        let skill = 'general';

        const activeSessionEntry = Object.entries(state.activeSessions).find(
          ([_, info]) => (info as any).taskId === id
        );

        if (activeSessionEntry) {
          sessionId = activeSessionEntry[0];
          skill = (activeSessionEntry[1] as any).skill || 'general';
        } else {
          // Check archived sessions
          const archivedSessions = state.archivedSessions || [];
          const archived = archivedSessions
            .filter((s: any) => s.taskId === id)
            .sort((a: any, b: any) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime())[0];

          if (archived) {
            sessionId = archived.sessionId;
            // Attempt to find skill from task definition
            try {
              const tasksFile = await fs.readFile(this.tasksFilePath, 'utf-8');
              const tasksData = JSON.parse(tasksFile);
              const task = tasksData.tasks.find((t: Task) => t.id === id);
              if (task && task.skill) {
                skill = task.skill;
              }
            } catch (e) {
              console.warn('[API] Failed to look up skill for archived session, defaulting to general');
            }
          }
        }

        if (!sessionId) {
          return reply.code(404).send({ error: 'No active or archived session found for this ticket' });
        }

        const bridge = await this.syncEngine.selectServerBridge(skill);
        if (!bridge) {
          return reply.code(503).send({ error: 'Server bridge not available' });
        }

        const messages = await bridge.getSessionMessages(sessionId);
        return { messages };

      } catch (err) {
        console.error('[API] Failed to get session messages:', err);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    });

    this.server.get('/api/events', async (request, reply) => {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const keepAliveInterval = setInterval(() => {
        reply.raw.write(': keepalive\n\n');
      }, 30000);

      this.sseClients.add(reply);

      reply.raw.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

      request.raw.on('close', () => {
        clearInterval(keepAliveInterval);
        this.sseClients.delete(reply);
      });
    });

    // ========================================
    // API Integrations CRUD (TASK-178)
    // ========================================
    const integrationsFilePath = '.agent-config/integrations.json';

    const loadIntegrations = async () => {
      try {
        const content = await fs.readFile(integrationsFilePath, 'utf-8');
        return JSON.parse(content);
      } catch {
        return { version: '1.0.0', integrations: [] };
      }
    };

    const saveIntegrations = async (data: any) => {
      await fs.writeFile(integrationsFilePath, JSON.stringify(data, null, 2), 'utf-8');
    };

    this.server.get('/api/integrations', async () => {
      const data = await loadIntegrations();
      return { integrations: data.integrations, count: data.integrations.length };
    });

    this.server.post('/api/integrations', async (request, reply) => {
      try {
        const body = request.body as any;
        const data = await loadIntegrations();

        const newIntegration = {
          id: crypto.randomUUID(),
          name: body.name,
          description: body.description || '',
          baseUrl: body.baseUrl,
          headers: body.headers || {},
          authType: body.authType || 'none',
          authConfig: body.authConfig || {},
          isDefault: body.isDefault || false,
          enabled: body.enabled !== false,
          // TASK-180: Semantic mapping fields
          semanticInstructions: body.semanticInstructions || '',
          suggestedUseCases: body.suggestedUseCases || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // If this is marked as default, unset other defaults
        if (newIntegration.isDefault) {
          data.integrations.forEach((i: any) => { i.isDefault = false; });
        }

        data.integrations.push(newIntegration);
        await saveIntegrations(data);

        console.log(`[API] Created integration: ${newIntegration.name}`);

        this.emitEvent({
          type: 'integration_created',
          data: { integration: newIntegration, timestamp: new Date().toISOString() }
        });

        return reply.code(201).send(newIntegration);
      } catch (err) {
        console.error('[API] Failed to create integration:', err);
        return reply.code(500).send({ error: 'Failed to create integration' });
      }
    });

    this.server.patch('/api/integrations/:id', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const updates = request.body as any;
        const data = await loadIntegrations();

        const index = data.integrations.findIndex((i: any) => i.id === id);
        if (index === -1) {
          return reply.code(404).send({ error: 'Integration not found' });
        }

        // If setting as default, unset others
        if (updates.isDefault) {
          data.integrations.forEach((i: any) => { i.isDefault = false; });
        }

        data.integrations[index] = {
          ...data.integrations[index],
          ...updates,
          updatedAt: new Date().toISOString()
        };

        await saveIntegrations(data);

        console.log(`[API] Updated integration: ${id}`);

        this.emitEvent({
          type: 'integration_updated',
          data: { integration: data.integrations[index], timestamp: new Date().toISOString() }
        });

        return data.integrations[index];
      } catch (err) {
        console.error('[API] Failed to update integration:', err);
        return reply.code(500).send({ error: 'Failed to update integration' });
      }
    });

    this.server.delete('/api/integrations/:id', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const data = await loadIntegrations();

        const index = data.integrations.findIndex((i: any) => i.id === id);
        if (index === -1) {
          return reply.code(404).send({ error: 'Integration not found' });
        }

        const deleted = data.integrations.splice(index, 1)[0];
        await saveIntegrations(data);

        console.log(`[API] Deleted integration: ${deleted.name}`);

        this.emitEvent({
          type: 'integration_deleted',
          data: { integrationId: id, timestamp: new Date().toISOString() }
        });

        return { success: true };
      } catch (err) {
        console.error('[API] Failed to delete integration:', err);
        return reply.code(500).send({ error: 'Failed to delete integration' });
      }
    });

    this.server.post('/api/integrations/:id/test', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const data = await loadIntegrations();

        const integration = data.integrations.find((i: any) => i.id === id);
        if (!integration) {
          return reply.code(404).send({ error: 'Integration not found' });
        }

        // Build headers
        const headers: Record<string, string> = { ...integration.headers };

        if (integration.authType === 'bearer' && integration.authConfig?.token) {
          headers['Authorization'] = `Bearer ${integration.authConfig.token}`;
        } else if (integration.authType === 'apiKey' && integration.authConfig?.apiKeyName && integration.authConfig?.apiKeyValue) {
          headers[integration.authConfig.apiKeyName] = integration.authConfig.apiKeyValue;
        } else if (integration.authType === 'basic' && integration.authConfig?.username && integration.authConfig?.password) {
          const b64 = Buffer.from(`${integration.authConfig.username}:${integration.authConfig.password}`).toString('base64');
          headers['Authorization'] = `Basic ${b64}`;
        }

        // Test the connection
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
          // Allow self-signed certs/custom CAs for generic integrations
          const dispatcher = new Agent({
            connect: {
              rejectUnauthorized: false
            }
          });

          const response = await fetch(integration.baseUrl, {
            method: 'GET',
            headers,
            signal: controller.signal,
            dispatcher: dispatcher as any
          });
          clearTimeout(timeout);

          return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText
          };
        } catch (fetchErr: any) {
          clearTimeout(timeout);
          let errorMessage = fetchErr.message;
          if (fetchErr.cause) {
            errorMessage += ` (Cause: ${fetchErr.cause.message || fetchErr.cause})`;
          }
          return {
            success: false,
            error: fetchErr.name === 'AbortError' ? 'Connection timeout' : errorMessage
          };
        }
      } catch (err) {
        console.error('[API] Failed to test integration:', err);
        return reply.code(500).send({ error: 'Failed to test integration' });
      }
    });



    this.server.post('/api/tickets/:id/context', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { active_integrations, active_mcps, active_skills } = request.body as any;

        const tasksFile = await fs.readFile(this.tasksFilePath, 'utf-8');
        const tasksData = JSON.parse(tasksFile);

        const taskIndex = tasksData.tasks.findIndex((t: Task) => t.id === id);
        if (taskIndex === -1) {
          return reply.code(404).send({ error: 'Ticket not found' });
        }

        // Update task
        const task = tasksData.tasks[taskIndex];
        if (active_integrations !== undefined) task.active_integrations = active_integrations;
        if (active_mcps !== undefined) task.active_mcps = active_mcps;
        if (active_skills !== undefined) task.active_skills = active_skills;

        // Auto-save: Update tasks.json
        await this.syncEngine.saveTasks(tasksData);

        console.log(`[Context] Updated context for ticket ${id}`);

        // Notify UI
        this.emitEvent({
          type: 'ticket_context_updated',
          data: {
            ticketId: id,
            updates: { active_integrations, active_mcps, active_skills },
            timestamp: new Date().toISOString()
          }
        });

        return { success: true, ticket: task };
      } catch (err) {
        console.error('[Context] Failed to update ticket context:', err);
        return reply.code(500).send({ error: 'Failed to update context' });
      }
    });

    // ========================================
    // Chat API Routes (FEAT-CHAT)
    // ========================================

    // List all conversations
    this.server.get('/api/chat/conversations', async (_request, reply) => {
      try {
        const conversations = this.chatManager.listConversations();
        // Return minimal data for the list (without full message history)
        return conversations.map(c => ({
          id: c.id,
          title: c.title,
          model: c.model,
          messageCount: c.messages.length,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }));
      } catch (err) {
        console.error('[Chat] Failed to list conversations:', err);
        return reply.code(500).send({ error: 'Failed to list conversations' });
      }
    });

    // Get a specific conversation with messages
    this.server.get('/api/chat/conversations/:id', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const conversation = this.chatManager.getConversation(id);

        if (!conversation) {
          return reply.code(404).send({ error: 'Conversation not found' });
        }

        return conversation;
      } catch (err) {
        console.error('[Chat] Failed to get conversation:', err);
        return reply.code(500).send({ error: 'Failed to get conversation' });
      }
    });

    // Create a new conversation
    this.server.post('/api/chat/conversations', async (request, reply) => {
      try {
        const { title, model } = request.body as { title?: string; model?: string };
        const conversation = await this.chatManager.createConversation(title, model);
        return reply.code(201).send(conversation);
      } catch (err) {
        console.error('[Chat] Failed to create conversation:', err);
        return reply.code(500).send({ error: 'Failed to create conversation' });
      }
    });

    // Delete a conversation
    this.server.delete('/api/chat/conversations/:id', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const success = await this.chatManager.deleteConversation(id);

        if (!success) {
          return reply.code(404).send({ error: 'Conversation not found' });
        }

        return { success: true };
      } catch (err) {
        console.error('[Chat] Failed to delete conversation:', err);
        return reply.code(500).send({ error: 'Failed to delete conversation' });
      }
    });

    // Rename a conversation
    this.server.patch('/api/chat/conversations/:id', async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { title } = request.body as { title: string };

        const success = await this.chatManager.renameConversation(id, title);

        if (!success) {
          return reply.code(404).send({ error: 'Conversation not found' });
        }

        return { success: true };
      } catch (err) {
        console.error('[Chat] Failed to rename conversation:', err);
        return reply.code(500).send({ error: 'Failed to rename conversation' });
      }
    });

    // Send a message (with streaming support)
    this.server.post('/api/chat/message', async (request, reply) => {
      try {
        const { content, conversationId, model, systemPrompt, stream = true } = request.body as {
          content: string;
          conversationId?: string;
          model?: string;
          systemPrompt?: string;
          stream?: boolean;
        };

        if (!content?.trim()) {
          return reply.code(400).send({ error: 'Message content is required' });
        }

        // Get or create conversation
        let convId = conversationId;
        if (!convId) {
          const newConv = await this.chatManager.createConversation(
            content.slice(0, 50),
            model
          );
          convId = newConv.id;
        }

        // Add user message to conversation
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: content.trim(),
          timestamp: new Date().toISOString(),
        };
        await this.chatManager.addMessage(convId, userMessage);

        // Get the bridge to make the API call
        const bridge = await this.syncEngine.selectServerBridge();

        if (!bridge) {
          // No bridge available - return a helpful error
          const errorMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '⚠️ No AI model is currently connected. Please configure a model in Settings → Admin Config.',
            timestamp: new Date().toISOString(),
          };
          await this.chatManager.addMessage(convId, errorMessage);
          return { message: errorMessage, conversationId: convId };
        }

        // Build messages for the API
        const messages = this.chatManager.buildMessagesForApi(convId);

        // For now, send non-streaming response
        // TODO: Implement proper streaming when bridge supports it

        try {
          // Use the bridge to send a chat message
          // This is a simplified implementation - in production you'd want
          // to use the proper streaming API
          const config = this.chatManager.getConfig();
          const useModel = model || config.model;

          // Create a simple completion using the bridge
          // The bridge method depends on what's available in OpenCodeServerBridge
          const response = await bridge.sendChatMessage?.(messages, {
            model: useModel,
            systemPrompt: systemPrompt || config.systemPrompt,
            maxTokens: config.maxTokens,
            temperature: config.temperature,
          });

          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response?.content || 'I apologize, but I was unable to generate a response. Please try again.',
            timestamp: new Date().toISOString(),
            model: useModel,
            tokens: response?.tokens,
            thinking: response?.thinking,
          };

          await this.chatManager.addMessage(convId, assistantMessage);

          if (stream) {
            // For streaming, we simulate SSE response
            reply.raw.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            });

            // Send complete message as single chunk (TODO: implement real streaming)
            reply.raw.write(`data: ${JSON.stringify({ type: 'complete', message: assistantMessage })}\n\n`);
            reply.raw.write('data: [DONE]\n\n');
            reply.raw.end();
            return;
          }

          return { message: assistantMessage, conversationId: convId };
        } catch (apiError: any) {
          console.error('[Chat] API call failed:', apiError);

          const errorMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `❌ Error: ${apiError.message || 'Failed to get response from AI model'}`,
            timestamp: new Date().toISOString(),
          };
          await this.chatManager.addMessage(convId, errorMessage);

          return { message: errorMessage, conversationId: convId };
        }
      } catch (err) {
        console.error('[Chat] Failed to send message:', err);
        return reply.code(500).send({ error: 'Failed to send message' });
      }
    });

    // Get chat configuration
    this.server.get('/api/chat/config', async (_request, reply) => {
      try {
        const config = this.chatManager.getConfig();
        return config;
      } catch (err) {
        console.error('[Chat] Failed to get config:', err);
        return reply.code(500).send({ error: 'Failed to get chat config' });
      }
    });

    // Update chat configuration
    this.server.post('/api/chat/config', async (request, reply) => {
      try {
        const updates = request.body as any;
        await this.chatManager.updateConfig(updates);
        return { success: true };
      } catch (err) {
        console.error('[Chat] Failed to update config:', err);
        return reply.code(500).send({ error: 'Failed to update chat config' });
      }
    });

    // Clear all chat history
    this.server.delete('/api/chat/history', async (_request, reply) => {
      try {
        await this.chatManager.clearHistory();
        return { success: true };
      } catch (err) {
        console.error('[Chat] Failed to clear history:', err);
        return reply.code(500).send({ error: 'Failed to clear chat history' });
      }
    });

    // ========================================
    // Memory API Routes (FEAT-MEMORIES)
    // ========================================

    // Search/Retrieve Memories
    this.server.get('/api/memories', async (request, reply) => {
      try {
        const query = request.query as any;
        const results = await this.memoryService.retrieve({
          search: query.search,
          category: query.category,
          agentId: query.agentId,
          tags: query.tags ? query.tags.split(',') : undefined,
          limit: query.limit ? parseInt(query.limit) : 20
        });
        return { memories: results };
      } catch (err) {
        console.error('[Memory] Failed to search memories:', err);
        return reply.code(500).send({ error: 'Failed to search memories' });
      }
    });

    // Manually Add Memory
    this.server.post('/api/memories', async (request, reply) => {
      try {
        const entry = request.body as any;
        if (!entry.content || !entry.agentId) {
          return reply.code(400).send({ error: 'Content and Agent ID are required' });
        }

        await this.memoryService.store({
          taskId: entry.taskId || 'manual',
          agentId: entry.agentId,
          category: entry.category || 'user-input',
          tags: entry.tags || ['manual'],
          content: entry.content
        });

        return { success: true };
      } catch (err) {
        console.error('[Memory] Failed to add memory:', err);
        return reply.code(500).send({ error: 'Failed to add memory' });
      }
    });
  }

  private sendBuffer(reply: FastifyReply, fileName: string, buffer: Buffer) {
    let contentType = 'application/octet-stream';
    if (fileName.endsWith('.pdf')) contentType = 'application/pdf';
    else if (fileName.endsWith('.xlsx')) contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (fileName.endsWith('.pptx')) contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    else if (fileName.endsWith('.png')) contentType = 'image/png';
    else if (fileName.endsWith('.csv')) contentType = 'text/csv';

    return reply
      .header('Content-Type', contentType)
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(buffer);
  }

  async start(): Promise<void> {
    try {
      await this.setupRoutes();
      await this.server.listen({ port: this.config.port, host: '0.0.0.0' });
      console.log(`[WebhookServer] Listening on port ${this.config.port}`);

      this.healthCheckTimer = setInterval(async () => {
        console.log('[WebhookServer] Running periodic server health checks...');
        await this.serverProfileManager.checkAllHealth();
      }, 300000);
    } catch (err) {
      console.error('[WebhookServer] Failed to start:', err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    await this.server.close();
    console.log('[WebhookServer] Stopped');
  }
}
