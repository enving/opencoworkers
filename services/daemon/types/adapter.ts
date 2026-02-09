import { Task } from './tasks.js';

/**
 * UNIFIED TICKET STANDARD (MVP)
 * 
 * Instead of relying on a complex external standard (like OSLC), 
 * we define a pragmatic "Least Common Denominator" format that covers
 * 95% of use cases for Plane, Linear, and Notion.
 */

export type UnifiedStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type UnifiedPriority = 'low' | 'medium' | 'high' | 'critical';

export interface UnifiedTicket {
  id: string;
  title: string;
  description?: string;
  status: UnifiedStatus;
  priority: UnifiedPriority;
  skill?: string;
  workflow_type?: 'automatic-review' | 'manual' | 'orchestration';
  project_key?: string;
  url?: string;
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;

  nativeData?: Record<string, any>;
}

export interface AdapterConfig {
  apiKey: string;
  baseUrl?: string;
  projectId?: string;
  teamId?: string;

  mapping?: {
    status?: Record<string, UnifiedStatus>;
    priority?: Record<string, UnifiedPriority>;
  };
}

export interface TicketAdapter {
  readonly name: string;

  init(config: AdapterConfig): Promise<void>;
  validateConfig(): Promise<boolean>;

  createTicket(task: Task): Promise<UnifiedTicket>;
  updateTicket(id: string, updates: Partial<UnifiedTicket>): Promise<UnifiedTicket>;
  getTicket(id: string): Promise<UnifiedTicket | null>;
  pullTasks(projectId: string): Promise<UnifiedTicket[]>;
  postComment(id: string, text: string): Promise<void>;

  mapStatusToNative(status: UnifiedStatus): string;
  mapStatusFromNative(status: string): UnifiedStatus;
}
