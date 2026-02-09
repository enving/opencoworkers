import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars
dotenv.config();

export const AdapterTypeSchema = z.enum(['none', 'plane', 'notion', 'linear']);
export type AdapterType = z.infer<typeof AdapterTypeSchema>;

export const ConfigSchema = z.object({
  adapter: AdapterTypeSchema.default('none'),
  plane: z.object({
    apiKey: z.string().min(1),
    workspaceSlug: z.string().min(1),
    projectId: z.string().min(1),
    baseUrl: z.string().optional()
  }).optional(),



  notion: z.object({
    apiKey: z.string().min(1),
    databaseId: z.string().min(1),
    mapping: z.object({
      status: z.record(z.string(), z.enum(['todo', 'in_progress', 'review', 'done', 'blocked'])).optional(),
      priority: z.record(z.string(), z.enum(['low', 'medium', 'high', 'critical'])).optional()
    }).optional()
  }).optional(),
  sync: z.object({
    debounceMs: z.number().default(500),
    tasksFile: z.string().default('.agent-config/project/tasks.json')
  }).default({
    debounceMs: 500,
    tasksFile: '.agent-config/project/tasks.json'
  }),
  server: z.object({
    baseUrl: z.string().url().default('http://127.0.0.1:4096'),
    password: z.string().optional(),
    autoTrigger: z.boolean().default(false),
    maxConcurrentAgents: z.number().int().min(1).default(3),
    instances: z.array(z.object({
      name: z.string(),
      baseUrl: z.string().url(),
      password: z.string().optional(),
      skills: z.array(z.string()).optional()
    })).optional()
  }).default({
    baseUrl: 'http://127.0.0.1:4096',
    autoTrigger: false,
    maxConcurrentAgents: 3
  }),
  daemon: z.object({
    enabled: z.boolean().default(false),
    pollingInterval: z.number().int().min(10).default(60),
    webhook: z.object({
      enabled: z.boolean().default(false),
      port: z.number().int().default(3005),
      secret: z.string().optional()
    }).default({
      enabled: false,
      port: 3005
    }),
    publicUrl: z.string().url().default('http://localhost:7851')
  }).default({
    enabled: false,
    pollingInterval: 60,
    webhook: {
      enabled: false,
      port: 3005
    },
    publicUrl: 'http://localhost:7851'
  }),
  storage: z.object({
    type: z.enum(['posix', 'webdav']).default('posix'),
    webdav: z.object({
      url: z.string().url(),
      username: z.string().optional(),
      password: z.string().optional()
    }).optional(),
    rootPath: z.string().optional()
  }).default({
    type: 'posix'
  })
}).refine(data => {
  if (data.adapter === 'plane') return !!data.plane;
  if (data.adapter === 'notion') return !!data.notion;
  return true;
}, {
  message: "Configuration for selected adapter is missing"
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export class ConfigLoader {
  static load(): AppConfig {
    let fileConfig = {};
    const configPath = path.resolve('.agent-config/sync.json');
    if (fs.existsSync(configPath)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {
        console.warn('Failed to parse .agent-config/sync.json', e);
      }
    }

    const envConfig = {
      adapter: process.env.PM_ADAPTER,
      plane: process.env.PLANE_API_KEY ? {
        apiKey: process.env.PLANE_API_KEY,
        workspaceSlug: process.env.PLANE_WORKSPACE_SLUG,
        projectId: process.env.PLANE_PROJECT_ID,
        baseUrl: process.env.PLANE_BASE_URL
      } : undefined,

      notion: process.env.NOTION_API_KEY ? {
        apiKey: process.env.NOTION_API_KEY,
        databaseId: process.env.NOTION_DATABASE_ID
      } : undefined,
      sync: {
        debounceMs: process.env.SYNC_DEBOUNCE_MS ? parseInt(process.env.SYNC_DEBOUNCE_MS) : undefined,
        tasksFile: process.env.SYNC_TASKS_FILE
      },
      server: {
        baseUrl: process.env.OPENCODE_SERVER_URL,
        password: process.env.OPENCODE_SERVER_PASSWORD
      },
      storage: {
        type: process.env.STORAGE_TYPE,
        webdav: process.env.WEBDAV_URL ? {
          url: process.env.WEBDAV_URL,
          username: process.env.WEBDAV_USER,
          password: process.env.WEBDAV_PASS
        } : undefined,
        rootPath: process.env.STORAGE_ROOT
      },
      daemon: {
        publicUrl: process.env.DAEMON_PUBLIC_URL
      }
    };

    const cleanEnv = JSON.parse(JSON.stringify(envConfig));

    const merged: any = {
      ...fileConfig,
      ...cleanEnv,
      sync: { ...(fileConfig as any).sync, ...cleanEnv.sync },
      server: { ...(fileConfig as any).server, ...cleanEnv.server },
      storage: { ...(fileConfig as any).storage, ...cleanEnv.storage }
    };

    if ((fileConfig as any).plane || cleanEnv.plane) {
      merged.plane = { ...((fileConfig as any).plane || {}), ...(cleanEnv.plane || {}) };
    }



    if ((fileConfig as any).notion || cleanEnv.notion) {
      merged.notion = { ...((fileConfig as any).notion || {}), ...(cleanEnv.notion || {}) };
    }

    return ConfigSchema.parse(merged);
  }

  static loadOpenCodeConfig(): any {
    // Try local path first
    let configPath = path.resolve('.agent-config/opencode.json');

    // If not found locally, try workspace root (assuming we are in services/daemon)
    if (!fs.existsSync(configPath)) {
      configPath = path.resolve('../../.agent-config/opencode.json');
    }

    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        console.log(`[ConfigLoader] Loaded OpenCode config from: ${configPath}`);
        return JSON.parse(content);
      } catch (err) {
        console.error('[ConfigLoader] Failed to parse OpenCode config:', err);
        return {};
      }
    }

    console.warn('[ConfigLoader] opencode.json not found in local or root .agent-config');
    return {};
  }
}
