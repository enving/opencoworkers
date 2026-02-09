import { useEffect, useState } from 'react';
import { Server, Cpu, Database, Clock } from 'lucide-react';

interface MetricsData {
    tasks: {
        total: number;
        byStatus: Record<string, number>;
    };
    system: {
        uptime: number;
        memory: {
            rss: number;
            heapTotal: number;
            heapUsed: number;
            external: number;
        };
    };
    timestamp: string;
}

export function SystemMetricsPanel() {
    const [metrics, setMetrics] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const res = await fetch('/api/metrics');
                if (res.ok) {
                    const data = await res.json();
                    setMetrics(data);
                }
            } catch (err) {
                console.error('Failed to fetch metrics', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 5000);
        return () => clearInterval(interval);
    }, []);

    const formatUptime = (seconds: number) => {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (d > 0) return `${d}d ${h}h`;
        return `${h}h ${m}m ${s}s`;
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const size = bytes / (k * k);
        return `${size.toFixed(1)} MB`;
    };

    if (loading) return null;
    if (!metrics) return null;

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <Server size={18} />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                        System Telemetry
                    </h3>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Uptime */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex items-center gap-2 mb-1.5 text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase">
                        <Clock size={12} />
                        <span>Uptime</span>
                    </div>
                    <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {formatUptime(metrics.system.uptime)}
                    </div>
                </div>

                {/* Memory */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex items-center gap-2 mb-1.5 text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase">
                        <Cpu size={12} />
                        <span>Memory (RSS)</span>
                    </div>
                    <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {formatBytes(metrics.system.memory.rss)}
                    </div>
                </div>
            </div>

            {/* Database/Tickets Stats */}
            <div className="bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                <div className="flex items-center gap-2 mb-3 text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase">
                    <Database size={12} />
                    <span>Ticket Statistics</span>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Total Tickets</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{metrics.tasks.total}</span>
                    </div>

                    <div className="h-2 flex w-full rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                        <div
                            className="bg-emerald-500"
                            style={{ width: `${((metrics.tasks.byStatus['completed'] || 0) / (metrics.tasks.total || 1)) * 100}%` }}
                        />
                        <div
                            className="bg-amber-500"
                            style={{ width: `${((metrics.tasks.byStatus['in_progress'] || 0) / (metrics.tasks.total || 1)) * 100}%` }}
                        />
                        <div
                            className="bg-zinc-400"
                            style={{ width: `${((metrics.tasks.byStatus['pending'] || 0) / (metrics.tasks.total || 1)) * 100}%` }}
                        />
                    </div>

                    <div className="flex items-center gap-4 text-xs mt-1">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-zinc-600 dark:text-zinc-300">{metrics.tasks.byStatus['completed'] || 0} Done</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-zinc-600 dark:text-zinc-300">{metrics.tasks.byStatus['in_progress'] || 0} Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
