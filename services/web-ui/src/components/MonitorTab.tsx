import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { occmApi } from '../api/occm';
import { Wifi, ShieldAlert, CheckCircle, RefreshCw, Activity, Clock } from 'lucide-react';

export function MonitorTab({ config }: { config: any }) {
    const [results, setResults] = useState<Record<string, any>>({});
    const [isChecking, setIsChecking] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const pingMutation = useMutation({
        mutationFn: async (provider: any) => {
            if (!provider.baseUrl) return { success: false, error: 'No URL' };
            return await occmApi.ping(provider.baseUrl);
        }
    });

    const checkAll = async () => {
        setIsChecking(true);
        const providers = config?.opencode?.provider || {};
        const newResults: Record<string, any> = {};

        for (const [id, data] of Object.entries(providers)) {
            const res = await pingMutation.mutateAsync(data);
            newResults[id] = res;
        }

        setResults(newResults);
        setLastChecked(new Date());
        setIsChecking(false);
    };

    const providers = Object.entries(config?.opencode?.provider || {});

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="w-3.5 h-3.5" />
                        Last Checked: {lastChecked ? lastChecked.toLocaleTimeString() : 'Never'}
                    </div>
                </div>
            </div>

            {/* Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Availability"
                    value={`${results && providers.length > 0 ? Math.round((Object.values(results).filter((r: any) => r.success).length / providers.length) * 100) : 0}%`}
                    icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                />
                <StatCard
                    label="Avg. Latency"
                    value={`${Object.values(results).length > 0 ? Math.round(Object.values(results).reduce((acc: number, r: any) => acc + (r.latency || 0), 0) / Object.values(results).length) : 0}ms`}
                    icon={<Activity className="w-4 h-4 text-indigo-400" />}
                />
                <StatCard
                    label="Endpoints"
                    value={providers.length.toString()}
                    icon={<Wifi className="w-4 h-4 text-zinc-400" />}
                />
                <div className="flex items-center justify-end">
                    <button
                        onClick={checkAll}
                        disabled={isChecking}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/10"
                    >
                        <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                        {isChecking ? 'Checking...' : 'Check All Endpoints'}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/20">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-zinc-900 border-b border-zinc-800">
                            <th className="px-6 py-4 font-semibold text-zinc-300">Provider / Host</th>
                            <th className="px-6 py-4 font-semibold text-zinc-300">Status</th>
                            <th className="px-6 py-4 font-semibold text-zinc-300 text-right">Latency</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {providers.map(([id, data]: [string, any]) => {
                            const result = results[id];
                            return (
                                <tr key={id} className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white">{data.name || id}</div>
                                        <div className="text-xs text-zinc-500 font-mono truncate max-w-xs">{data.baseUrl || 'No Base URL'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {!result ? (
                                            <span className="inline-flex items-center gap-1.5 text-zinc-500">
                                                <div className="w-2 h-2 rounded-full bg-zinc-700" />
                                                Idle
                                            </span>
                                        ) : result.success ? (
                                            <span className="inline-flex items-center gap-1.5 text-green-400">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                Healthy ({result.status})
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-red-500">
                                                <ShieldAlert className="w-3.5 h-3.5" />
                                                Error
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {result && (
                                            <span className={`font-mono text-xs ${result.latency < 200 ? 'text-green-500' :
                                                result.latency < 500 ? 'text-yellow-500' : 'text-red-400'
                                                }`}>
                                                {result.latency}ms
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 transition-all hover:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</span>
                {icon}
            </div>
            <div className="text-xl font-bold font-mono">{value}</div>
        </div>
    );
}
