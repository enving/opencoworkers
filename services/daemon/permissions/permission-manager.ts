import { z } from 'zod';
import { EventEmitter } from 'events';

export const PermissionRequestSchema = z.object({
  id: z.string(),
  action: z.string(),
  description: z.string(),
  filePaths: z.array(z.string()).optional(),
  taskId: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string(),
  status: z.enum(['pending', 'approved', 'denied']).default('pending'),
  approvalType: z.enum(['once', 'always']).optional()
});

export type PermissionRequest = z.infer<typeof PermissionRequestSchema>;

export class PermissionManager extends EventEmitter {
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  private approvedActions: Set<string> = new Set();

  constructor() {
    super();
  }

  createRequest(
    action: string,
    description: string,
    options: {
      filePaths?: string[];
      taskId?: string;
      sessionId?: string;
    } = {}
  ): PermissionRequest {
    const id = `perm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const request: PermissionRequest = {
      id,
      action,
      description,
      filePaths: options.filePaths,
      taskId: options.taskId,
      sessionId: options.sessionId,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    this.pendingRequests.set(id, request);
    return request;
  }

  approveRequest(id: string, approvalType: 'once' | 'always'): boolean {
    const request = this.pendingRequests.get(id);
    if (!request) return false;

    request.status = 'approved';
    request.approvalType = approvalType;

    if (approvalType === 'always') {
      this.approvedActions.add(request.action);
    }

    this.pendingRequests.delete(id);
    this.emit('resolved', { id, action: 'approve', approvalType, request });
    return true;
  }

  denyRequest(id: string): boolean {
    const request = this.pendingRequests.get(id);
    if (!request) return false;

    request.status = 'denied';
    this.pendingRequests.delete(id);
    this.emit('resolved', { id, action: 'deny', request });
    return true;
  }

  isActionApproved(action: string): boolean {
    return this.approvedActions.has(action);
  }

  getPendingRequest(id: string): PermissionRequest | undefined {
    return this.pendingRequests.get(id);
  }

  getAllPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  clearApprovals(): void {
    this.approvedActions.clear();
  }
}
