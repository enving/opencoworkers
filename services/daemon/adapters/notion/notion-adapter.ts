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

export class NotionAdapter implements TicketAdapter {
  readonly name = 'notion';
  private client: AxiosInstance | null = null;
  private config: AdapterConfig | null = null;

  private readonly statusMap: Record<UnifiedStatus, string> = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'review': 'In Progress',
    'done': 'Done',
    'blocked': 'Blocked'
  };

  private readonly priorityMap: Record<UnifiedPriority, string> = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Critical'
  };

  async init(config: AdapterConfig): Promise<void> {
    this.config = config;
    this.client = axios.create({
      baseURL: 'https://api.notion.com/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });
  }

  async validateConfig(): Promise<boolean> {
    if (!this.client || !this.config) return false;
    try {
      await withRetry(() => this.client!.get(`/databases/${this.config!.projectId}`));
      return true;
    } catch (error) {
      console.error('[NotionAdapter] Validation failed:', error);
      return false;
    }
  }

  async getTicket(id: string): Promise<UnifiedTicket | null> {
    this.checkInit();

    try {
      const response = await withRetry(() => this.client!.get(`/pages/${id}`));
      const ticket = this.mapResponseToUnified(response.data);
      
      try {
        const blocksResponse = await withRetry(() => this.client!.get(`/blocks/${id}/children`));
        ticket.description = this.notionBlocksToMarkdown(blocksResponse.data.results);
      } catch (e) {
        console.warn(`[NotionAdapter] Failed to fetch content for ${ticket.id}`, e);
      }
      
      return ticket;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }

  async pullTasks(projectId: string): Promise<UnifiedTicket[]> {
    this.checkInit();
    
    try {
      const response = await withRetry(() => this.client!.post(`/databases/${projectId}/query`, {}));
      
      const tickets: UnifiedTicket[] = [];
      for (const page of response.data.results) {
        const ticket = this.mapResponseToUnified(page);
        try {
          const blocksResponse = await withRetry(() => this.client!.get(`/blocks/${page.id}/children`));
          ticket.description = this.notionBlocksToMarkdown(blocksResponse.data.results);
        } catch (e) {
          console.warn(`[NotionAdapter] Failed to fetch content for ${ticket.id}`, e);
        }
        tickets.push(ticket);
      }
      
      return tickets;
    } catch (error: any) {
      const details = error.response?.data?.message || error.message;
      throw new Error(`Failed to pull Notion pages: ${details}`);
    }
  }

  async createTicket(task: Task): Promise<UnifiedTicket> {
    this.checkInit();
    
    try {
      const payload: any = {
        parent: { database_id: this.config!.projectId },
        properties: {
          'Name': {
            title: [
              {
                text: {
                  content: task.title
                }
              }
            ]
          },
          'Status': {
            select: {
              name: this.mapStatusToNative(this.mapTaskStatusToUnified(task.status))
            }
          },
          'Priority': {
            select: {
              name: this.mapPriorityToNative(task.priority)
            }
          }
        }
      };

      if (task.description) {
        payload.children = this.markdownToNotionBlocks(task.description);
      }

      const response = await withRetry(() => this.client!.post('/pages', payload));
      const ticket = this.mapResponseToUnified(response.data);
      ticket.description = task.description;
      return ticket;
    } catch (error: any) {
      const details = error.response?.data?.message || error.message;
      throw new Error(`Failed to create Notion page: ${details}`);
    }
  }

  async updateTicket(id: string, updates: Partial<UnifiedTicket>): Promise<UnifiedTicket> {
    this.checkInit();
    
    try {
      const properties: any = {};
      
      if (updates.title) {
        properties['Name'] = {
          title: [{ text: { content: updates.title } }]
        };
      }
      
      if (updates.status) {
        properties['Status'] = {
          select: { name: this.mapStatusToNative(updates.status) }
        };
      }
      
      if (updates.priority) {
        properties['Priority'] = {
          select: { name: this.mapPriorityToNative(updates.priority) }
        };
      }

      const response = await withRetry(() => this.client!.patch(`/pages/${id}`, { properties }));
      const ticket = this.mapResponseToUnified(response.data);

      if (updates.description !== undefined) {
        try {
          const currentBlocks = await withRetry(() => this.client!.get(`/blocks/${id}/children`));
          for (const block of currentBlocks.data.results) {
             await withRetry(() => this.client!.delete(`/blocks/${block.id}`));
          }

          const newBlocks = this.markdownToNotionBlocks(updates.description);
          if (newBlocks.length > 0) {
             await withRetry(() => this.client!.patch(`/blocks/${id}/children`, { children: newBlocks }));
          }
          ticket.description = updates.description;
        } catch (e) {
          console.warn(`[NotionAdapter] Failed to update content for ${id}`, e);
        }
      }

      return ticket;
    } catch (error: any) {
      const details = error.response?.data?.message || error.message;
      throw new Error(`Failed to update Notion page: ${details}`);
    }
  }

  async postComment(id: string, text: string): Promise<void> {
    this.checkInit();

    try {
      const payload = {
        parent: { page_id: id },
        rich_text: [
          {
            text: {
              content: text
            }
          }
        ]
      };

      await withRetry(() => this.client!.post('/comments', payload));
    } catch (error: any) {
      const details = error.response?.data?.message || error.message;
      throw new Error(`Failed to post comment to Notion page ${id}: ${details}`);
    }
  }

  mapStatusToNative(status: UnifiedStatus): string {
    if (this.config?.mapping?.status && this.config.mapping.status) {
        const found = Object.entries(this.config.mapping.status).find(([_, val]) => val === status);
        if (found) return found[0];
    }
    return this.statusMap[status] || 'To Do';
  }

  mapStatusFromNative(status: string): UnifiedStatus {
    if (this.config?.mapping?.status && this.config.mapping.status[status]) {
        return this.config.mapping.status[status];
    }
    const found = Object.entries(this.statusMap).find(([_, val]) => val === status);
    return found ? (found[0] as UnifiedStatus) : 'todo';
  }

  mapPriorityToNative(priority: UnifiedPriority): string {
    if (this.config?.mapping?.priority) {
        const found = Object.entries(this.config.mapping.priority).find(([_, val]) => val === priority);
        if (found) return found[0];
    }
    return this.priorityMap[priority] || 'Medium';
  }

  private mapTaskStatusToUnified(status: Task['status']): UnifiedStatus {
    switch (status) {
      case 'pending': return 'todo';
      case 'in_progress': return 'in_progress';
      case 'completed': return 'done';
      case 'blocked': return 'blocked';
      default: return 'todo';
    }
  }

  private checkInit() {
    if (!this.client || !this.config) throw new Error('NotionAdapter not initialized');
  }

  private mapResponseToUnified(data: any): UnifiedTicket {
    const props = data.properties;
    
    return {
      id: data.id,
      title: props['Name']?.title?.[0]?.plain_text || 'Untitled',
      description: '',
      status: this.mapStatusFromNative(props['Status']?.select?.name),
      priority: (Object.entries(this.priorityMap).find(([_, val]) => val === props['Priority']?.select?.name)?.[0] as UnifiedPriority) || 'medium',
      createdAt: new Date(data.created_time),
      updatedAt: new Date(data.last_edited_time),
      url: data.url,
      nativeData: data
    };
  }

  private notionBlocksToMarkdown(blocks: any[]): string {
    return blocks.map(block => {
      const type = block.type;
      const text = block[type]?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      
      switch (type) {
        case 'heading_1': return `# ${text}`;
        case 'heading_2': return `## ${text}`;
        case 'heading_3': return `### ${text}`;
        case 'bulleted_list_item': return `- ${text}`;
        case 'numbered_list_item': return `1. ${text}`;
        case 'to_do': 
          const checked = block.to_do.checked ? 'x' : ' ';
          return `- [${checked}] ${text}`;
        case 'paragraph': return text ? text : '';
        case 'code': return `\`\`\`${block.code.language}\n${text}\n\`\`\``;
        default: return text;
      }
    }).join('\n\n');
  }

  private markdownToNotionBlocks(markdown: string): any[] {
    if (!markdown) return [];
    
    return markdown.split('\n').filter(line => line.trim() !== '').map(line => {
      if (line.startsWith('# ')) {
        return {
          object: 'block',
          type: 'heading_1',
          heading_1: { rich_text: [{ type: 'text', text: { content: line.substring(2) } }] }
        };
      } else if (line.startsWith('## ')) {
        return {
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ type: 'text', text: { content: line.substring(3) } }] }
        };
      } else if (line.startsWith('### ')) {
        return {
          object: 'block',
          type: 'heading_3',
          heading_3: { rich_text: [{ type: 'text', text: { content: line.substring(4) } }] }
        };
      } else if (line.startsWith('- [ ] ')) {
        return {
          object: 'block',
          type: 'to_do',
          to_do: { 
            rich_text: [{ type: 'text', text: { content: line.substring(6) } }],
            checked: false
          }
        };
      } else if (line.startsWith('- [x] ')) {
        return {
          object: 'block',
          type: 'to_do',
          to_do: { 
            rich_text: [{ type: 'text', text: { content: line.substring(6) } }],
            checked: true
          }
        };
      } else if (line.startsWith('- ')) {
        return {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.substring(2) } }] }
        };
      } else {
        return {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: line } }] }
        };
      }
    });
  }
}
