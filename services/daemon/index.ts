// Dynamic imports for ESM packages
let PluginInput: any = null;
let Hooks: any = null;
let tool: any = null;
let path: any = null;
let ConfigLoader: any = null;
let PlaneAdapter: any = null;
let NotionAdapter: any = null;
let NoneAdapter: any = null;
let TaskFileWatcher: any = null;
let SyncEngine: any = null;
let TicketAdapter: any = null;

// Initialize dynamic imports
async function initDynamicImports() {
  try {
    PluginInput = (await import("@opencode-ai/plugin")).PluginInput;
    Hooks = (await import("@opencode-ai/plugin")).Hooks;
    tool = (await import("@opencode-ai/plugin/tool")).tool;
    path = (await import("path")).path;
    ConfigLoader = (await import("./config/config-loader.js")).ConfigLoader;
    PlaneAdapter = (await import("./adapters/plane/plane-adapter.js")).PlaneAdapter;
    NotionAdapter = (await import("./adapters/notion/notion-adapter.js")).NotionAdapter;
    NoneAdapter = (await import("./adapters/none/none-adapter.js")).NoneAdapter;
    TaskFileWatcher = (await import("./sync/file-watcher.js")).TaskFileWatcher;
    SyncEngine = (await import("./sync/sync-engine.js")).SyncEngine;
    TicketAdapter = (await import("./types/adapter.js")).TicketAdapter;
  } catch (err) {
    console.error("[pm-sync] Failed to initialize dynamic imports:", err);
    throw err;
  }
}

export default async function pmSyncPlugin(input: PluginInput): Promise<Hooks> {
  const { directory } = input;

  console.log("[pm-sync] Plugin loaded");

  let config;
  let syncEngine: SyncEngine | null = null;

  try {
    config = ConfigLoader.load();
    if (config) {
      console.log(`[pm-sync] Using adapter: ${config.adapter}`);
      console.log("[pm-sync] Auto-sync mode enabled");
    }
  } catch (err: any) {
    console.log('[pm-sync] No sync config found - plugin in passive mode');
    config = null;
  }

  if (config) {
    try {
      const tasksFilePath = path.resolve(directory, config.sync.tasksFile);
      let adapter: TicketAdapter;
      let projectId: string | undefined;

      if (config.adapter === 'none') {
        adapter = new NoneAdapter();
      } else if (config.adapter === 'plane' && config.plane) {
        adapter = new PlaneAdapter();
        await adapter.init({
          apiKey: config.plane.apiKey,
          baseUrl: config.plane.baseUrl || 'http://localhost:8000/api/v1',
          teamId: config.plane.workspaceSlug,
          projectId: config.plane.projectId,
        });
        projectId = config.plane.projectId;
      } else if (config.adapter === 'notion' && config.notion) {
        adapter = new NotionAdapter();
        await adapter.init({
          apiKey: config.notion.apiKey,
          projectId: config.notion.databaseId,
          mapping: config.notion.mapping
        });
        projectId = config.notion.databaseId;
      } else {
        throw new Error(`Adapter ${config.adapter} not configured or supported`);
      }

      const watcher = new TaskFileWatcher(tasksFilePath);
      syncEngine = new SyncEngine(watcher, adapter, {
        debounceMs: config.sync.debounceMs,
        tasksFilePath,
        projectId,
        fullConfig: config
      });

      await syncEngine.start();
      console.log(`[pm-sync] Sync engine started using ${adapter.name}`);
    } catch (err: any) {
      console.error('[pm-sync] Failed to start sync engine:', err.message);
      syncEngine = null;
    }
  }

  return {
    tool: {
      sync: tool({
        description: 'Run bidirectional sync (Pull from PM tool + Push local changes)',
        args: {
          dryRun: tool.schema.boolean().optional().describe('Show changes without applying them')
        },
        execute: async (args) => {
          if (!syncEngine) {
            return 'Sync engine not initialized. Check if sync.json exists.';
          }
          await syncEngine.sync(args.dryRun);
          return `Bidirectional sync complete${args.dryRun ? ' (DRY RUN)' : ''}`;
        },
      }),
      'sync-pull': tool({
        description: 'Manually trigger pull of remote tickets to tasks.json',
        args: {
          dryRun: tool.schema.boolean().optional().describe('Show changes without applying them')
        },
        execute: async (args) => {
          if (!syncEngine) {
            return 'Sync engine not initialized. Check if sync.json exists.';
          }
          await syncEngine.pull(args.dryRun);
          return `Remote tickets pulled to local tasks.json${args.dryRun ? ' (DRY RUN)' : ''}`;
        },
      }),
      'sync-push': tool({
        description: 'Manually trigger push of local tasks to PM tool',
        args: {
          dryRun: tool.schema.boolean().optional().describe('Show changes without applying them')
        },
        execute: async (args) => {
          if (!syncEngine) {
            return 'Sync engine not initialized. Check if sync.json exists.';
          }
          await syncEngine.push(args.dryRun);
          return `Local changes pushed to remote${args.dryRun ? ' (DRY RUN)' : ''}`;
        },
      }),
      'sync-status': tool({
        description: 'Check sync engine status',
        args: {},
        execute: async () => {
          if (!syncEngine) {
            return 'Sync engine not initialized. Create .agent-config/sync.json to enable.';
          }
          return `Active: true, Adapter: ${config?.adapter}, Mode: auto-sync, Paused: ${syncEngine.isPaused}`;
        },
      }),
      'server-test': tool({
        description: 'Test connection to OpenCode server and create a test session',
        args: {
          title: tool.schema.string().optional().default('CLI Test Session').describe('Session title')
        },
        execute: async (args) => {
          const serverConfig = ConfigLoader.load().server;
          if (!serverConfig) return 'No server configuration found.';

          const bridge = new (await import('./server/bridge.js')).OpenCodeServerBridge({
            baseUrl: serverConfig.baseUrl,
            password: serverConfig.password,
            directory: directory
          });

          const sessionId = await bridge.triggerTaskExecution({
            id: 'TASK-TEST' as any,
            title: args.title,
            description: 'This is a test task triggered from the CLI tool.',
            status: 'in_progress',
            skill: 'git',
            priority: 'medium',
            created: new Date().toISOString()
          });

          return sessionId ? `Test session created: ${sessionId}` : 'Failed to create test session. Check server logs.';
        }
      })
    },

    'chat.message': async (input, _output) => {
      if (input.agent && syncEngine) {
        console.log(`[pm-sync] Agent message tracked from ${input.agent}`);
      }
    },

    event: async ({ event }) => {
      if (event.type === 'server.instance.disposed' && syncEngine) {
        await syncEngine.stop();
        console.log('[pm-sync] Sync engine stopped');
      }
    },
  };
}
