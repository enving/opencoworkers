
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  fetchOpenCodeConfig,
  updateOpenCodeConfig
} from '../api/client';

export function PermissionManager() {
  const queryClient = useQueryClient();
  const [newPath, setNewPath] = useState('');
  const [newMode, setNewMode] = useState<'read' | 'write'>('read');

  const { data: config, isLoading } = useQuery({
    queryKey: ['opencodeConfig'],
    queryFn: fetchOpenCodeConfig,
    retry: 1
  });

  const mutation = useMutation({
    mutationFn: updateOpenCodeConfig,
    onSuccess: (data) => {
      console.log('Config updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['opencodeConfig'] });
    },
    onError: (error) => {
      console.error('Failed to update config:', error);
      alert('Failed to save permissions. Check console for details.');
    }
  });

  if (isLoading) {
    return (
      <div className="h-40 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse flex items-center justify-center">
        <Activity className="text-zinc-700 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-zinc-500">
        Unable to load OpenCode configuration. Ensure a bridge is connected.
      </div>
    );
  }

  const agentName = 'general';
  const permissions = config.agent?.[agentName]?.permission || {};
  // Migrate old string[] to object[] if needed, or default to empty
  const rawPaths = config.agent?.[agentName]?.allowedPaths || [];
  const allowedPaths: Array<{ path: string; mode: 'read' | 'write' }> = Array.isArray(rawPaths)
    ? rawPaths.map((p: any) => typeof p === 'string' ? { path: p, mode: 'read' } : p)
    : [];

  const togglePermission = (perm: 'edit' | 'bash' | 'webfetch') => {
    const currentVal = permissions[perm] || 'ask';
    const newVal = currentVal === 'allow' ? 'ask' : 'allow';

    // Deep clone to update
    const newConfig = JSON.parse(JSON.stringify(config));
    if (!newConfig.agent) newConfig.agent = {};
    if (!newConfig.agent[agentName]) newConfig.agent[agentName] = {};
    if (!newConfig.agent[agentName].permission) newConfig.agent[agentName].permission = {};

    newConfig.agent[agentName].permission[perm] = newVal;
    
    // Log for debugging
    console.log('Updating config:', newConfig);
    
    mutation.mutate(newConfig);
  };

  const addPath = () => {
    if (!newPath.trim()) return;
    const newConfig = JSON.parse(JSON.stringify(config));
    if (!newConfig.agent) newConfig.agent = {};
    if (!newConfig.agent[agentName]) newConfig.agent[agentName] = {};
    
    // Get existing paths, ensuring migration from string[] if necessary
    let currentPaths = newConfig.agent[agentName].allowedPaths || [];
    if (Array.isArray(currentPaths) && currentPaths.length > 0 && typeof currentPaths[0] === 'string') {
        currentPaths = currentPaths.map((p: string) => ({ path: p, mode: 'read' }));
    }
    
    // Check for duplicates
    if (!currentPaths.some((p: any) => p.path === newPath.trim())) {
      currentPaths.push({ path: newPath.trim(), mode: newMode });
      newConfig.agent[agentName].allowedPaths = currentPaths;
      mutation.mutate(newConfig);
    }
    setNewPath('');
  };

  const removePath = (pathToRemove: string) => {
    const newConfig = JSON.parse(JSON.stringify(config));
    if (!newConfig.agent?.[agentName]?.allowedPaths) return;

    let currentPaths = newConfig.agent[agentName].allowedPaths;
    // Normalize if string array
    if (Array.isArray(currentPaths) && currentPaths.length > 0 && typeof currentPaths[0] === 'string') {
        currentPaths = currentPaths.map((p: string) => ({ path: p, mode: 'read' }));
    }

    newConfig.agent[agentName].allowedPaths = currentPaths.filter((p: any) => p.path !== pathToRemove);
    mutation.mutate(newConfig);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-bold text-zinc-100">Global Agent ({agentName})</h4>
            <p className="text-sm text-zinc-500">Manage permissions for the default agent.</p>
          </div>
          {mutation.isPending && <Activity size={16} className="text-indigo-500 animate-spin" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['edit', 'bash', 'webfetch'] as const).map(p => {
            const isAllowed = permissions[p] === 'allow';
            return (
              <div key={p} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                <span className="text-sm font-medium text-zinc-300 capitalize">{p}</span>
                <button
                  onClick={() => togglePermission(p)}
                  className={clsx(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
                    isAllowed ? "bg-indigo-600" : "bg-zinc-700"
                  )}
                >
                  <span
                    className={clsx(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      isAllowed ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500 mt-4">
          Setting permissions to "Allow" grants the agent full autonomy for that tool without user approval.
        </p>
      </div>

      <div className="pt-6 border-t border-zinc-800">
        <h4 className="font-bold text-zinc-100 mb-2">Allowed Data Folders</h4>
        <p className="text-sm text-zinc-500 mb-4">
          Specify absolute paths that the agent is allowed to access and modify.
          This helps the agent locate data and prevents unauthorized access.
        </p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="/path/to/allowed/directory"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && addPath()}
            />
            <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value as 'read' | 'write')}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            >
                <option value="read">Read Only</option>
                <option value="write">Read/Write</option>
            </select>
            <button
              onClick={addPath}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {allowedPaths.map((item) => (
              <div key={item.path} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg group">
                <span className="text-sm text-indigo-300 font-mono">{item.path}</span>
                <span className={clsx(
                    "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                    item.mode === 'write' ? "bg-amber-500/20 text-amber-400" : "bg-zinc-700 text-zinc-400"
                )}>
                    {item.mode}
                </span>
                <button
                  onClick={() => removePath(item.path)}
                  className="text-indigo-400/50 hover:text-indigo-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {allowedPaths.length === 0 && (
              <p className="text-xs text-zinc-600 italic">No specific paths configured. Agent uses default workspace.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
