import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

interface PermissionRequest {
  id: string;
  action: string;
  description: string;
  filePaths?: string[];
  taskId?: string;
  sessionId?: string;
  timestamp: string;
}

interface PermissionModalProps {
  request: PermissionRequest | null;
  onClose: () => void;
}

const respondToPermission = async (
  id: string,
  action: 'approve' | 'deny',
  approvalType?: 'once' | 'always'
): Promise<void> => {
  const response = await fetch(`/api/permissions/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, approvalType }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to respond to permission request');
  }
};

export function PermissionModal({ request, onClose }: PermissionModalProps) {
  const [selectedApproval, setSelectedApproval] = useState<'once' | 'always'>('once');

  const respondMutation = useMutation({
    mutationFn: ({ action, approvalType }: { action: 'approve' | 'deny'; approvalType?: 'once' | 'always' }) =>
      respondToPermission(request!.id, action, approvalType),
    onSuccess: () => {
      onClose();
    },
  });

  const handleApprove = () => {
    respondMutation.mutate({ action: 'approve', approvalType: selectedApproval });
  };

  const handleDeny = () => {
    respondMutation.mutate({ action: 'deny' });
  };

  if (!request) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg border border-yellow-700/50 p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-900/30 flex items-center justify-center border border-yellow-700/50">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-yellow-100">Agent Permission Required</h2>
            <p className="text-sm text-zinc-400 mt-1">An agent needs your approval to perform an action</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-md p-4">
            <div className="text-sm font-medium text-zinc-300 mb-2">Action</div>
            <div className="text-base text-zinc-100 font-mono">{request.action}</div>
          </div>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-md p-4">
            <div className="text-sm font-medium text-zinc-300 mb-2">Description</div>
            <div className="text-sm text-zinc-100">{request.description}</div>
          </div>

          {request.filePaths && request.filePaths.length > 0 && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-md p-4">
              <div className="text-sm font-medium text-zinc-300 mb-2">Affected Files</div>
              <div className="space-y-1">
                {request.filePaths.map((path, idx) => (
                  <div key={idx} className="text-sm text-zinc-400 font-mono truncate">
                    {path}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {request.taskId && <span>Task: {request.taskId}</span>}
            {request.sessionId && <span>Session: {request.sessionId.slice(0, 8)}...</span>}
          </div>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-md p-4">
            <div className="text-sm font-medium text-zinc-300 mb-3">Approval Type</div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="approvalType"
                  value="once"
                  checked={selectedApproval === 'once'}
                  onChange={() => setSelectedApproval('once')}
                  className="w-4 h-4 text-blue-600 bg-zinc-700 border-zinc-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-zinc-200">Allow Once</div>
                  <div className="text-xs text-zinc-500">Approve this action for this request only</div>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="approvalType"
                  value="always"
                  checked={selectedApproval === 'always'}
                  onChange={() => setSelectedApproval('always')}
                  className="w-4 h-4 text-blue-600 bg-zinc-700 border-zinc-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-zinc-200">Allow Always</div>
                  <div className="text-xs text-zinc-500">Approve this action for all future requests</div>
                </div>
              </label>
            </div>
          </div>

          {respondMutation.isError && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md p-3">
              {respondMutation.error instanceof Error
                ? respondMutation.error.message
                : 'Failed to respond to permission request'}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleDeny}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={respondMutation.isPending}
            >
              {respondMutation.isPending ? 'Processing...' : 'Deny'}
            </button>
            <button
              onClick={handleApprove}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={respondMutation.isPending}
            >
              {respondMutation.isPending ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
