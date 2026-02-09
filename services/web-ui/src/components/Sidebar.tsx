import { LayoutGrid, ListTodo, Activity, Settings, Terminal, Globe, Box, MessageCircle, Brain } from 'lucide-react';
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { fetchServers } from '../api/client';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { id: 'chat', icon: MessageCircle, label: 'Chat' },
  { id: 'memories', icon: Brain, label: 'Memories' },
  { id: 'tickets', icon: ListTodo, label: 'Tickets' },
  { id: 'agents', icon: Activity, label: 'Agents' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: fetchServers,
    refetchInterval: 30000,
  });

  const onlineCount = servers?.filter(s => s.status === 'online').length || 0;

  return (
    <aside className="w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col py-6">
      <div className="flex items-center gap-3 px-6 mb-10">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <span className="text-white font-bold text-xl">O</span>
        </div>
        <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100 tracking-tight">OpenCoworkers</span>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              )}
            >
              <Icon size={18} className={clsx(
                'transition-colors',
                isActive ? 'text-white' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'
              )} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="px-6 mt-auto space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">Agent Fleet</span>
            <span className="text-[10px] font-bold text-emerald-500">{onlineCount}/{servers?.length || 0} UP</span>
          </div>
          <div className="flex flex-wrap gap-1.5 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            {servers?.map(server => (
              <div
                key={server.id}
                title={`${server.name}: ${server.status}`}
                className={clsx(
                  "w-7 h-7 rounded-lg flex items-center justify-center border transition-all",
                  server.status === 'online' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                    server.status === 'offline' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                      "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400"
                )}
              >
                {server.type === 'local' && <Terminal size={14} />}
                {server.type === 'remote-api' && <Globe size={14} />}
                {server.type === 'docker-managed' && <Box size={14} />}
              </div>
            ))}
            {(!servers || servers.length === 0) && (
              <p className="text-[10px] text-zinc-500 italic py-1">No servers configured</p>
            )}
          </div>
        </div>

        <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">Default Node</p>
            {servers?.find(s => s.isDefault)?.status === 'online' && (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {servers?.find(s => s.isDefault)?.name || 'Local Runtime'}
          </p>
          <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
            {servers?.find(s => s.isDefault)?.host || 'localhost'}
          </p>
        </div>
      </div>
    </aside>
  );
}

