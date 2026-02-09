export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'in_review' | 'completed' | 'cancelled' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  skill?: string;
  created: string;
  updated?: string;
  completed?: string;
  verified?: boolean;
  verified_by?: string;
  phase?: string;
  repository?: string;
  refinement_loop?: number;
  refinement_feedback?: string;
  refinement_context?: string;
  external_refs?: string[];
  artifacts?: Array<{ name: string; url: string }>;
  // TASK-184 Context Selection
  active_integrations?: string[]; // IDs of enabled API integrations
  active_mcps?: string[];         // Names of enabled MCP servers
  active_skills?: string[];       // Names of enabled Skills (e.g. "python", "research")
}

export interface TicketsResponse {
  tickets: Ticket[];
  meta?: {
    version: string;
    project: string;
  };
}

export interface DaemonStatus {
  status: 'running' | 'stopped';
  uptime?: number;
  version?: string;
}

export interface ServerProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  apiKey?: string;
  type: 'local' | 'remote-api' | 'docker-managed';
  isDefault: boolean;
  lastHealthCheck?: string;
  status: 'online' | 'offline' | 'unknown';
}

export interface Skill {
  name: string;
  description: string;
  commands: string[];
  scope: 'team' | 'personal';
  path: string;
}

// API Integration types for Generic REST Connector (TASK-178)
export type AuthType = 'none' | 'bearer' | 'apiKey' | 'basic';

export interface ApiIntegration {
  id: string;
  name: string;
  description?: string;
  baseUrl: string;
  headers: Record<string, string>;
  authType: AuthType;
  authConfig?: {
    token?: string;
    apiKeyName?: string;
    apiKeyValue?: string;
    username?: string;
    password?: string;
  };
  // TASK-180
  semanticInstructions?: string;
  suggestedUseCases?: string[];

  isDefault: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiIntegrationCreate {
  name: string;
  description?: string;
  baseUrl: string;
  headers?: Record<string, string>;
  authType?: AuthType;
  authConfig?: ApiIntegration['authConfig'];
  isDefault?: boolean;
  enabled?: boolean;
  semanticInstructions?: string;
  suggestedUseCases?: string[];
}
