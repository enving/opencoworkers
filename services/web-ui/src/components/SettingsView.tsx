import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server,
  Shield,
  Terminal,
  Activity,
  Plus,
  Trash2,
  Edit2,
  Globe,
  Box,
  Check,
  RefreshCw,
  // X,
  Zap
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  fetchServers,
  updateServer,
  deleteServer,
  pingServer,
  fetchSkills,
} from '../api/client';
import type { ServerProfile } from '../types';
import { PermissionManager } from './PermissionManager';
import { ErrorBoundary } from './ErrorBoundary';
import { ServerModal, StatusBadge } from './ServerManager';
import { AdminConfigPanel } from './AdminConfigPanel';

export function SettingsView() {
  const queryClient = useQueryClient();

  const [isAddingServer, setIsAddingServer] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerProfile | null>(null);

  const { data: servers, isLoading: loadingServers } = useQuery({
    queryKey: ['servers'],
    queryFn: fetchServers
  });

  const { data: skills, isLoading: loadingSkills } = useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills
  });

  const deleteMutation = useMutation({
    mutationFn: deleteServer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] })
  });

  const pingMutation = useMutation({
    mutationFn: pingServer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] })
  });

  const toggleDefaultMutation = useMutation({
    mutationFn: ({ id, isDefault }: { id: string, isDefault: boolean }) =>
      updateServer(id, { isDefault }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] })
  });

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section>
        <h2 className="text-2xl font-bold text-zinc-100">Settings</h2>
        <p className="text-zinc-500 mt-1">Manage your infrastructure and explore available agent capabilities.</p>
      </section>

      {/* FR-509: Visual Admin Config */}
      <section>
        <ErrorBoundary>
          <AdminConfigPanel />
        </ErrorBoundary>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={20} className="text-indigo-500" />
            <h3 className="text-lg font-semibold text-zinc-200">Server Manager</h3>
          </div>
          <button
            onClick={() => setIsAddingServer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Plus size={16} />
            Add Server
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loadingServers ? (
            <div className="h-48 flex items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse">
              <Activity className="text-zinc-700 animate-spin" />
            </div>
          ) : servers?.map((server) => (
            <div
              key={server.id}
              className={clsx(
                "group relative bg-zinc-900 border transition-all duration-300 rounded-2xl p-5 flex items-center justify-between",
                server.isDefault ? "border-indigo-500/50 bg-indigo-500/5" : "border-zinc-800 hover:border-zinc-700"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={clsx(
                  "w-12 h-12 rounded-xl flex items-center justify-center shadow-inner",
                  server.type === 'local' ? "bg-zinc-800 text-zinc-400" :
                    server.type === 'remote-api' ? "bg-indigo-500/10 text-indigo-400" :
                      "bg-emerald-500/10 text-emerald-400"
                )}>
                  {server.type === 'local' && <Terminal size={20} />}
                  {server.type === 'remote-api' && <Globe size={20} />}
                  {server.type === 'docker-managed' && <Box size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-zinc-200">{server.name}</h4>
                    {server.isDefault && (
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-500/20">
                        Default
                      </span>
                    )}
                    <StatusBadge status={server.status} />
                  </div>
                  <p className="text-sm text-zinc-500 font-mono mt-0.5">
                    {server.host}:{server.port}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => pingMutation.mutate(server.id)}
                  disabled={pingMutation.isPending && pingMutation.variables === server.id}
                  className={clsx(
                    "p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors",
                    pingMutation.isPending && pingMutation.variables === server.id && "animate-spin text-emerald-400"
                  )}
                  title="Check Health"
                >
                  <RefreshCw size={18} />
                </button>
                {!server.isDefault && (
                  <button
                    onClick={() => toggleDefaultMutation.mutate({ id: server.id, isDefault: true })}
                    className="p-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                    title="Set as Default"
                  >
                    <Check size={18} />
                  </button>
                )}
                <button
                  onClick={() => setEditingServer(server)}
                  className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(server.id)}
                  className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* API Integrations Section (TASK-178) */}
      {/* <ApiIntegrationsSection /> */}



      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-indigo-500" />
          <h3 className="text-lg font-semibold text-zinc-200">Skill Explorer</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingSkills ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
            ))
          ) : skills?.map((skill) => (
            <div
              key={skill.name}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                  <Terminal size={20} className="text-zinc-400 group-hover:text-white" />
                </div>
                <div className="flex gap-1">
                  {skill.scope === 'team' ? (
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase rounded-md border border-indigo-500/20">Team</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[10px] font-bold uppercase rounded-md border border-zinc-700">Personal</span>
                  )}
                </div>
              </div>
              <h4 className="font-bold text-zinc-100 mb-1">{skill.name}</h4>
              <p className="text-sm text-zinc-500 line-clamp-2 mb-4 leading-relaxed">
                {skill.description}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-auto">
                {skill.commands.map(cmd => (
                  <code key={cmd} className="text-[11px] px-2 py-0.5 bg-zinc-800 text-indigo-400 rounded-md border border-zinc-700 font-mono">
                    {cmd}
                  </code>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-amber-500" />
          <h3 className="text-lg font-semibold text-zinc-200">Advanced Features</h3>
        </div>

        <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl text-zinc-500 text-sm italic">
          Advanced features (Refinement Loop) coming soon.
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-indigo-500" />
          <h3 className="text-lg font-semibold text-zinc-200">OpenCode Agent Permissions</h3>
        </div>

        <ErrorBoundary>
          <PermissionManager />
        </ErrorBoundary>
      </section>

      {(isAddingServer || editingServer) && (
        <ServerModal
          server={editingServer}
          onClose={() => {
            setIsAddingServer(false);
            setEditingServer(null);
          }}
        />
      )}
    </div>
  );
}

// function PermissionManager() {
//   const queryClient = useQueryClient();
//   const { data: config, isLoading } = useQuery({
//     queryKey: ['opencodeConfig'],
//     queryFn: fetchOpenCodeConfig,
//     retry: 1
//   });

//   const mutation = useMutation({
//     mutationFn: updateOpenCodeConfig,
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ['opencodeConfig'] });
//     }
//   });

//   if (isLoading) {
//     return (
//       <div className="h-40 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse flex items-center justify-center">
//         <Activity className="text-zinc-700 animate-spin" />
//       </div>
//     );
//   }

//   if (!config) {
//     return (
//       <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-zinc-500">
//         Unable to load OpenCode configuration. Ensure a bridge is connected.
//       </div>
//     );
//   }

//   const agentName = 'general';
//   const permissions = config.agent?.[agentName]?.permission || {};
//   const allowedPaths = config.agent?.[agentName]?.allowedPaths || [];

//   const [newPath, setNewPath] = useState('');

//   const togglePermission = (perm: 'edit' | 'bash' | 'webfetch') => {
//     const currentVal = permissions[perm] || 'ask';
//     const newVal = currentVal === 'allow' ? 'ask' : 'allow';

//     // Deep clone to update
//     const newConfig = JSON.parse(JSON.stringify(config));
//     if (!newConfig.agent) newConfig.agent = {};
//     if (!newConfig.agent[agentName]) newConfig.agent[agentName] = {};
//     if (!newConfig.agent[agentName].permission) newConfig.agent[agentName].permission = {};

//     newConfig.agent[agentName].permission[perm] = newVal;
//     mutation.mutate(newConfig);
//   };

//   const addPath = () => {
//     if (!newPath.trim()) return;
//     const newConfig = JSON.parse(JSON.stringify(config));
//     if (!newConfig.agent) newConfig.agent = {};
//     if (!newConfig.agent[agentName]) newConfig.agent[agentName] = {};
//     if (!newConfig.agent[agentName].allowedPaths) newConfig.agent[agentName].allowedPaths = [];

//     // Avoid duplicates
//     if (!newConfig.agent[agentName].allowedPaths.includes(newPath.trim())) {
//       newConfig.agent[agentName].allowedPaths.push(newPath.trim());
//       mutation.mutate(newConfig);
//     }
//     setNewPath('');
//   };

//   const removePath = (pathToRemove: string) => {
//     const newConfig = JSON.parse(JSON.stringify(config));
//     if (!newConfig.agent?.[agentName]?.allowedPaths) return;

//     newConfig.agent[agentName].allowedPaths = newConfig.agent[agentName].allowedPaths.filter((p: string) => p !== pathToRemove);
//     mutation.mutate(newConfig);
//   };

//   return (
//     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-8">
//       <div>
//         <div className="flex items-center justify-between mb-4">
//           <div>
//             <h4 className="font-bold text-zinc-100">Global Agent ({agentName})</h4>
//             <p className="text-sm text-zinc-500">Manage permissions for the default agent.</p>
//           </div>
//           {mutation.isPending && <Activity size={16} className="text-indigo-500 animate-spin" />}
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           {(['edit', 'bash', 'webfetch'] as const).map(p => {
//             const isAllowed = permissions[p] === 'allow';
//             return (
//               <div key={p} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
//                 <span className="text-sm font-medium text-zinc-300 capitalize">{p}</span>
//                 <button
//                   onClick={() => togglePermission(p)}
//                   className={clsx(
//                     "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
//                     isAllowed ? "bg-indigo-600" : "bg-zinc-700"
//                   )}
//                 >
//                   <span
//                     className={clsx(
//                       "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
//                       isAllowed ? "translate-x-6" : "translate-x-1"
//                     )}
//                   />
//                 </button>
//               </div>
//             );
//           })}
//         </div>
//         <p className="text-xs text-zinc-500 mt-4">
//           Setting permissions to "Allow" grants the agent full autonomy for that tool without user approval.
//         </p>
//       </div>

//       <div className="pt-6 border-t border-zinc-800">
//         <h4 className="font-bold text-zinc-100 mb-2">Allowed Data Folders</h4>
//         <p className="text-sm text-zinc-500 mb-4">
//           Specify absolute paths that the agent is allowed to access and modify.
//           This helps the agent locate data and prevents unauthorized access.
//         </p>

//         <div className="space-y-3">
//           <div className="flex gap-2">
//             <input
//               value={newPath}
//               onChange={(e) => setNewPath(e.target.value)}
//               placeholder="/path/to/allowed/directory"
//               className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
//               onKeyDown={(e) => e.key === 'Enter' && addPath()}
//             />
//             <button
//               onClick={addPath}
//               className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition-colors"
//             >
//               Add
//             </button>
//           </div>

//           <div className="flex flex-wrap gap-2">
//             {allowedPaths.map((path: string) => (
//               <div key={path} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg group">
//                 <span className="text-sm text-indigo-300 font-mono">{path}</span>
//                 <button
//                   onClick={() => removePath(path)}
//                   className="text-indigo-400/50 hover:text-indigo-300 transition-colors"
//                 >
//                   <X size={14} />
//                 </button>
//               </div>
//             ))}
//             {allowedPaths.length === 0 && (
//               <p className="text-xs text-zinc-600 italic">No specific paths configured. Agent uses default workspace.</p>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function RefinementLoopToggle() {
//   const queryClient = useQueryClient();
//
//   const { data: isEnabled, isLoading } = useQuery({
//     queryKey: ['refinementLoopEnabled'],
//     queryFn: fetchRefinementLoopEnabled,
//     retry: 1
//   });
//
//   const mutation = useMutation({
//     mutationFn: (enabled: boolean) => setRefinementLoopEnabled(enabled),
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ['refinementLoopEnabled'] });
//     }
//   });
//
//   if (isLoading) {
//     return (
//       <div className="h-24 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse flex items-center justify-center">
//         <Activity className="text-zinc-700 animate-spin" />
//       </div>
//     );
//   }
//
//   return (
//     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
//       <div className="flex items-center justify-between">
//         <div className="flex-1">
//           <div className="flex items-center gap-2">
//             <h4 className="font-bold text-zinc-100">Refinement Loop</h4>
//             <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-amber-500/20">
//               Ralph Wiggum Loop
//             </span>
//           </div>
//           <p className="text-sm text-zinc-500 mt-1">
//             Enables automatic session archiving and context injection when a task is refined.
//             When a task needs refinement, the previous session is archived and feedback is injected into the new session.
//           </p>
//         </div>
//         <div className="ml-4 flex items-center gap-3">
//           {mutation.isPending && <Activity size={16} className="text-amber-500 animate-spin" />}
//           <button
//             onClick={() => mutation.mutate(!isEnabled)}
//             className={clsx(
//               "relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
//               isEnabled ? "bg-amber-600" : "bg-zinc-700"
//             )}
//           >
//             <span
//               className={clsx(
//                 "inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg",
//                 isEnabled ? "translate-x-8" : "translate-x-1"
//               )}
//             />
//           </button>
//         </div>
//       </div>
//
//       {isEnabled && (
//         <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
//           <p className="text-xs text-amber-400/80">
//             ✓ When enabled, tasks moved to "Refinement" status will automatically archive their current session
//             and create a new session with previous context injected.
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }

// Deleted large ServerModal and StatusBadge function blocks
