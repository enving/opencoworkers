import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { occmApi } from '../api/occm';
import { Package, Smartphone, CheckCircle, AlertTriangle, ExternalLink, Download } from 'lucide-react';

export function PluginsTab() {
    const { data: plugins, isLoading } = useQuery({
        queryKey: ['occm-plugins'],
        queryFn: () => occmApi.listPlugins()
    });

    const isOmoInstalled = React.useMemo(() =>
        plugins?.some((p: any) => p.name.includes('oh-my-opencode')),
        [plugins]);

    return (
        <div className="space-y-8">
            {/* Header / Summary */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border border-indigo-500/20 rounded-2xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                        <Package className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Plugin Ecosystem</h2>
                        <p className="text-sm text-zinc-400">Expand your agent capabilities with community plugins.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Check for Updates
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                        Browse Market
                    </button>
                </div>
            </div>

            {/* Oh My OpenCode Special Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-semibold">Oh My OpenCode</h3>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start">
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white">oh-my-opencode</span>
                            {isOmoInstalled ? (
                                <span className="bg-green-500/10 text-green-500 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 uppercase font-bold">
                                    <CheckCircle className="w-3" /> Installed
                                </span>
                            ) : (
                                <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 uppercase font-bold">
                                    <AlertTriangle className="w-3" /> Not Installed
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-zinc-500 leading-relaxed">
                            A powerful plugin system that adds personality, specialized agents, and mobile interaction capabilities to OpenCode.
                        </p>
                        {!isOmoInstalled && (
                            <div className="mt-4 p-3 bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-xs text-indigo-400">
                                npm install -g oh-my-opencode
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 min-w-[150px]">
                        <button className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors border border-zinc-700">
                            Configure
                        </button>
                        <button className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors border border-zinc-700 flex items-center justify-center gap-2">
                            Website <ExternalLink className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>

            {/* All Installed Plugins Table */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Installed Packages</h3>
                <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/20">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-zinc-900 border-b border-zinc-800">
                                <th className="px-6 py-4 font-semibold text-zinc-300 text-xs uppercase tracking-wider">Package Name</th>
                                <th className="px-6 py-4 font-semibold text-zinc-300 text-xs uppercase tracking-wider">Version</th>
                                <th className="px-6 py-4 font-semibold text-zinc-300 text-xs uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {isLoading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={3} className="px-6 py-4"><div className="h-4 bg-zinc-800 rounded w-1/2" /></td>
                                    </tr>
                                ))
                            ) : plugins?.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">No global plugins detected</td>
                                </tr>
                            ) : plugins?.map((plugin: any) => (
                                <tr key={plugin.name} className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{plugin.name}</td>
                                    <td className="px-6 py-4 text-zinc-400 font-mono text-xs">{plugin.version}</td>
                                    <td className="px-6 py-4">
                                        <span className="text-green-500 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            Active
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
