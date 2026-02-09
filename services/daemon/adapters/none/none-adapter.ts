import { TicketAdapter, UnifiedStatus, UnifiedTicket } from '../../types/adapter.js';
import { Task } from '../../types/tasks.js';

export class NoneAdapter implements TicketAdapter {
  readonly name = 'none';

  async init(): Promise<void> {
    // No-op: sync disabled
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }

  async createTicket(_task: Task): Promise<UnifiedTicket> {
    throw new Error('Sync disabled (adapter=none)');
  }

  async updateTicket(_id: string, _updates: Partial<UnifiedTicket>): Promise<UnifiedTicket> {
    throw new Error('Sync disabled (adapter=none)');
  }

  async getTicket(_id: string): Promise<UnifiedTicket | null> {
    return null;
  }

  async pullTasks(_projectId: string): Promise<UnifiedTicket[]> {
    return [];
  }

  async postComment(_id: string, _text: string): Promise<void> {
    // No-op
  }

  mapStatusToNative(status: UnifiedStatus): string {
    return status;
  }

  mapStatusFromNative(status: string): UnifiedStatus {
    return status as UnifiedStatus;
  }
}
