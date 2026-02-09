import axios, { AxiosInstance } from 'axios';
import { 
  TicketAdapter, 
  AdapterConfig, 
  UnifiedTicket, 
  UnifiedStatus, 
  UnifiedPriority 
} from '../../types/adapter.js';
import { Task } from '../../types/tasks.js';
import { withRetry } from '../../utils/retry.js';

export class PlaneAdapter implements TicketAdapter {
  readonly name = 'plane';
  private client: AxiosInstance | null = null;
  private config: AdapterConfig | null = null;

  // Plane.so specific mappings
  private readonly statusMap: Record<UnifiedStatus, string> = {
    'todo': 'Backlog',      // Default, can be overridden by config
    'in_progress': 'In Progress',
    'review': 'In Progress',
    'done': 'Done',
    'blocked': 'Blocked'
  };

  private readonly priorityMap: Record<UnifiedPriority, string> = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Urgent'
  };

  async init(config: AdapterConfig): Promise<void> {
    this.config = config;
    
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api.plane.so/api/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Apply custom mappings if provided
    if (config.mapping?.status) {
      Object.assign(this.statusMap, config.mapping.status);
    }
    if (config.mapping?.priority) {
      Object.assign(this.priorityMap, config.mapping.priority);
    }
  }

  async validateConfig(): Promise<boolean> {
    if (!this.client || !this.config) return false;
    try {
      // Try to fetch current user to validate token
      await withRetry(() => this.client!.get('/users/me/'));
      return true;
    } catch (error) {
      console.error('[PlaneAdapter] Validation failed:', error);
      return false;
    }
  }

  async createTicket(task: Task): Promise<UnifiedTicket> {
    this.checkInit();
    
    try {
      const payload = {
        name: task.title,
        description: task.description || '',
        priority: this.priorityMap[task.priority]
      };

      const { workspaceSlug, projectId } = this.getParams();

      const response = await withRetry(() => this.client!.post(
        `/workspaces/${workspaceSlug}/projects/${projectId}/issues/`, 
        payload
      ));
      
      return this.mapResponseToUnified(response.data);
    } catch (error) {
      throw new Error(`Failed to create ticket: ${error}`);
    }
  }

  async updateTicket(id: string, updates: Partial<UnifiedTicket>): Promise<UnifiedTicket> {
    this.checkInit();
    
    try {
      const payload: any = {};
      if (updates.title) payload.name = updates.title;
      if (updates.description) payload.description = updates.description;
      if (updates.priority) payload.priority = this.priorityMap[updates.priority];
      
      const { workspaceSlug, projectId } = this.getParams();

      const response = await withRetry(() => this.client!.patch(
        `/workspaces/${workspaceSlug}/projects/${projectId}/issues/${id}/`,
        payload
      ));

      return this.mapResponseToUnified(response.data);
    } catch (error) {
       throw new Error(`Failed to update ticket: ${error}`);
    }
  }

  async getTicket(id: string): Promise<UnifiedTicket | null> {
    this.checkInit();

    try {
      const { workspaceSlug, projectId } = this.getParams();
      const response = await withRetry(() => this.client!.get(
        `/workspaces/${workspaceSlug}/projects/${projectId}/issues/${id}/`
      ));
      return this.mapResponseToUnified(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }

  async pullTasks(_projectId: string): Promise<UnifiedTicket[]> {
    console.warn('[PlaneAdapter] pullTasks not implemented');
    return [];
  }

  async postComment(_id: string, _text: string): Promise<void> {
    console.warn('[PlaneAdapter] postComment not implemented');
  }

  mapStatusToNative(status: UnifiedStatus): string {
    return this.statusMap[status]!;
  }

  mapStatusFromNative(status: string): UnifiedStatus {
    // Reverse lookup
    const found = Object.entries(this.statusMap).find(([_, val]) => val === status);
    return found ? (found[0] as UnifiedStatus) : 'todo';
  }

  private checkInit() {
    if (!this.client || !this.config) throw new Error('PlaneAdapter not initialized');
  }

  private getParams() {
    if (!this.config?.teamId) throw new Error('Workspace Slug (teamId) is required for Plane');
    if (!this.config?.projectId) throw new Error('Project ID is required for Plane');
    
    return {
      workspaceSlug: this.config.teamId,
      projectId: this.config.projectId
    };
  }

  private mapResponseToUnified(data: any): UnifiedTicket {
    return {
      id: data.id,
      title: data.name,
      description: data.description,
      status: this.mapStatusFromNative(data.state?.name || 'Backlog'), // Simplified
      priority: (Object.entries(this.priorityMap).find(([_, val]) => val === data.priority)?.[0] as UnifiedPriority) || 'medium',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      nativeData: data
    };
  }
}
