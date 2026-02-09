#!/usr/bin/env node
import { ConfigLoader } from '../config/config-loader.js';
import { PlaneAdapter } from '../adapters/plane/plane-adapter.js';
import { WebhookServer } from '../server/webhook-server.js';
import { NoneAdapter } from '../adapters/none/none-adapter.js';

import { NotionAdapter } from '../adapters/notion/notion-adapter.js';
import { TaskFileWatcher } from '../sync/file-watcher.js';
import { SyncEngine } from '../sync/sync-engine.js';
import { TicketAdapter } from '../types/adapter.js';
import * as path from 'path';

async function main() {
  const command = process.argv[2];
  const subCommand = process.argv[3];
  const isDryRun = process.argv.includes('--dry-run');

  try {
    switch (command) {
      case 'start':
        await start();
        break;
      case 'sync':
        if (subCommand === 'pull') {
          await pull(isDryRun);
        } else if (subCommand === 'push') {
          await push(isDryRun);
        } else if (!subCommand || subCommand === '--dry-run') {
          await sync(isDryRun);
        } else {
          console.log('Usage: opencode-pm-sync sync [pull|push] [--dry-run]');
          process.exit(1);
        }
        break;
      case 'status':
        console.log('Status: Not running (daemon mode not implemented yet)');
        break;
      default:
        console.log('Usage: opencode-pm-sync <start|sync|status> [--dry-run]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

async function getEngine() {
  console.log('[DEBUG] getEngine() called');
  
  try {
    console.log('[DEBUG] Loading config...');
    const config = ConfigLoader.load();
    console.log('[DEBUG] Config loaded:', config.adapter);
    
    let adapter: TicketAdapter;

    if (config.adapter === 'none') {
      console.log('[DEBUG] Using NoneAdapter');
      adapter = new NoneAdapter();
    } else if (config.adapter === 'plane') {
      if (!config.plane) throw new Error('Plane configuration missing');
      console.log('[DEBUG] Using PlaneAdapter');
      adapter = new PlaneAdapter();
      await adapter.init({
        apiKey: config.plane.apiKey,
        teamId: config.plane.workspaceSlug,
        projectId: config.plane.projectId,
        baseUrl: config.plane.baseUrl
      });
      console.log('[DEBUG] PlaneAdapter initialized');

    } else if (config.adapter === 'notion') {
      if (!config.notion) throw new Error('Notion configuration missing');
      console.log('[DEBUG] Using NotionAdapter');
      adapter = new NotionAdapter();
      await adapter.init({
        apiKey: config.notion.apiKey,
        projectId: config.notion.databaseId
      });
      console.log('[DEBUG] NotionAdapter initialized');
    } else {
      throw new Error(`Adapter ${config.adapter} not supported yet`);
    }

    console.log('[DEBUG] Creating TaskFileWatcher...');
    const tasksPath = path.resolve(process.cwd(), '.agent-config/project/tasks.json');
    const watcher = new TaskFileWatcher(tasksPath);
    console.log('[DEBUG] TaskFileWatcher created');
    
    const projectId = config.adapter === 'plane' ? config.plane?.projectId :
      config.adapter === 'notion' ? config.notion?.databaseId : undefined;
    
    console.log('[DEBUG] Creating SyncEngine...');
    const engine = new SyncEngine(watcher, adapter, {
      debounceMs: config.sync.debounceMs,
      tasksFilePath: tasksPath,
      projectId: projectId,
      fullConfig: config,
      enableAutoSkillDetection: true
    });
    console.log('[DEBUG] SyncEngine created');
    
    return engine;
    
  } catch (error) {
    console.error('[DEBUG] Error in getEngine():', error);
    throw error;
  }
}

async function start() {
  console.log('[DEBUG] Starting daemon...');
  
  try {
    console.log('[DEBUG] Loading configuration...');
    const engine = await getEngine();
    console.log('[DEBUG] Engine created successfully');

    console.log('[DEBUG] Starting sync engine...');
    await engine.start();
    console.log('[DEBUG] Sync engine started successfully');

    console.log('[DEBUG] Starting Webhook API server...');
    const port = Number(process.env.OPENCODE_DAEMON_PORT || 7851);
    const server = new WebhookServer(engine, {
      port,
      enableCORS: true,
      storage: ConfigLoader.load().storage || {}
    });
    console.log('[DEBUG] Webhook server created');

    try {
      console.log('[DEBUG] Calling server.listen()...');
      const address = await server.listen();
      console.log(`[DEBUG] Server listening on ${address}`);
    } catch (err) {
      console.error('[DEBUG] Failed to start server:', err);
      process.exit(1);
    }

    process.on('SIGINT', async () => {
      console.log('\n[DEBUG] Stopping...');
      await engine.stop();
      process.exit(0);
    });
    
    console.log('[DEBUG] Daemon startup complete');
    
  } catch (error) {
    console.error('[DEBUG] Fatal error in daemon startup:', error);
    process.exit(1);
  }
}

async function pull(dryRun: boolean = false) {
  console.log(`🔍 Searching remote for updates...${dryRun ? ' (DRY RUN)' : ''}`);
  const engine = await getEngine();
  await engine.pull(dryRun);
  console.log(`✅ Pull complete${dryRun ? ' (No changes applied)' : ''}.`);
}

async function push(dryRun: boolean = false) {
  console.log(`📤 Pushing local changes to remote...${dryRun ? ' (DRY RUN)' : ''}`);
  const engine = await getEngine();
  await engine.push(dryRun);
  console.log(`✅ Push complete${dryRun ? ' (No changes applied)' : ''}.`);
}

async function sync(dryRun: boolean = false) {
  console.log(`🔄 Running bidirectional sync (Pull + Push)...${dryRun ? ' (DRY RUN)' : ''}`);
  const engine = await getEngine();
  await engine.sync(dryRun);
  console.log(`✅ Sync complete${dryRun ? ' (No changes applied)' : ''}.`);
}

main();
