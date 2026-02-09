
import { useQuery } from '@tanstack/react-query';
import { fetchStatus } from '../api/client';

export function DaemonStatusBadge() {
    const { data: status, isLoading, isError } = useQuery({
        queryKey: ['daemonStatus'],
        queryFn: fetchStatus,
        refetchInterval: 5000,
        retry: false
    });

    const isOnline = status?.status === 'running';

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg animate-pulse">
                <div className="w-2 h-2 rounded-full bg-zinc-600" />
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Checking...</span>
            </div>
        );
    }

    if (isError || !isOnline) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg group hover:bg-red-500/20 transition-colors cursor-help" title="Check if 'npm run dev' is fully running">
                <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
                </div>
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Daemon Offline</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
            <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            </div>
            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Daemon Online</span>
            {status?.uptime && (
                <span className="text-[10px] text-zinc-600 font-mono ml-1 hidden sm:inline-block">
                    {Math.floor(status.uptime)}s
                </span>
            )}
        </div>
    );
}
