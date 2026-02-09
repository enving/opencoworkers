import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { occmApi } from '../api/occm';
import { Rocket, Sparkles, Check, ChevronRight, AlertCircle, Zap, Home, Layers, Package } from 'lucide-react';
import clsx from 'clsx';

interface StarterPacksTabProps {
    onConfigUpdate?: () => void;
}

export function StarterPacksTab({ onConfigUpdate }: StarterPacksTabProps) {
    const queryClient = useQueryClient();
    const [selectedPack, setSelectedPack] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    const { data: packs, isPending, error } = useQuery({
        queryKey: ['occm', 'presets'],
        queryFn: occmApi.listStarterPacks,
        retry: 1
    });

    const { data: recommended } = useQuery({
        queryKey: ['occm', 'presets', 'recommended'],
        queryFn: occmApi.getRecommendedStarterPack,
        enabled: !!packs && packs.length > 0
    });

    const { data: previewData } = useQuery({
        queryKey: ['occm', 'presets', 'preview', selectedPack],
        queryFn: () => selectedPack ? occmApi.previewStarterPack(selectedPack) : null,
        enabled: !!selectedPack && showPreview
    });

    const applyMutation = useMutation({
        mutationFn: occmApi.applyStarterPack,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occm'] });
            onConfigUpdate?.();
            setSelectedPack(null);
            setShowPreview(false);
        }
    });

    const getPackIcon = (icon: string) => {
        // Map emoji icons to Lucide icons for consistency
        const iconMap: Record<string, React.ReactNode> = {
            '🚀': <Rocket size={20} className="text-indigo-400" />,
            '🧠': <Zap size={20} className="text-emerald-400" />,
            '⚡': <Sparkles size={20} className="text-amber-400" />,
            '🏛️': <Package size={20} className="text-purple-400" />,
            '🏠': <Home size={20} className="text-blue-400" />,
            '✨': <Layers size={20} className="text-zinc-400" />,
        };
        return iconMap[icon] || <Package size={20} className="text-zinc-400" />;
    };

    const getTagColor = (tag: string) => {
        const colors: Record<string, string> = {
            'recommended': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            'beginner': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            'advanced': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            'claude': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
            'openai': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            'multi-provider': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            'oh-my-opencode': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
            'privacy': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
            'local': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
            'autonomous': 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
            'minimal': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
        };
        return colors[tag] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    };

    if (isPending) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-400 animate-pulse">
                    <Rocket size={16} className="animate-bounce" />
                    Loading starter packs...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                    <AlertCircle size={16} />
                    <div>
                        <div className="font-medium">Failed to load starter packs</div>
                        <div className="text-xs text-red-400/70 mt-1">{error.message}</div>
                    </div>
                </div>
            </div>
        );
    }

    if (!packs || packs.length === 0) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                    <AlertCircle size={16} />
                    <div>
                        <div className="font-medium">No starter packs available</div>
                        <div className="text-xs text-amber-400/70 mt-1">The API returned an empty list. Check if daemon is running.</div>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                        <Rocket size={20} className="text-indigo-400" />
                        Starter Packs
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">
                        Pre-configured setups to get you started quickly. Configurations merge with existing settings.
                    </p>
                </div>
            </div>

            {/* Recommended Badge */}
            {recommended && (
                <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                            <Sparkles size={24} className="text-indigo-400" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-zinc-100">{recommended.name}</h4>
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">
                                    Recommended
                                </span>
                            </div>
                            <p className="text-sm text-zinc-400 mt-1">{recommended.description}</p>
                        </div>
                        <button
                            onClick={() => applyMutation.mutate(recommended.id)}
                            disabled={applyMutation.isPending}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                        >
                            {applyMutation.isPending ? 'Applying...' : 'Quick Apply'}
                        </button>
                    </div>
                </div>
            )}

            {/* Pack Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packs?.map((pack) => (
                    <div
                        key={pack.id}
                        className={clsx(
                            "p-4 bg-zinc-950 border rounded-xl transition-all cursor-pointer group",
                            selectedPack === pack.id
                                ? "border-indigo-500/50 ring-1 ring-indigo-500/30"
                                : "border-zinc-800 hover:border-zinc-700"
                        )}
                        onClick={() => {
                            setSelectedPack(pack.id === selectedPack ? null : pack.id);
                            setShowPreview(false);
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0">
                                {getPackIcon(pack.icon)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-zinc-100 truncate">{pack.name}</h4>
                                    {pack.id === recommended?.id && (
                                        <Sparkles size={12} className="text-indigo-400 shrink-0" />
                                    )}
                                </div>
                                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{pack.description}</p>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {pack.tags.slice(0, 3).map((tag) => (
                                        <span
                                            key={tag}
                                            className={clsx(
                                                "px-1.5 py-0.5 text-[9px] font-medium rounded border",
                                                getTagColor(tag)
                                            )}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <ChevronRight
                                size={18}
                                className={clsx(
                                    "text-zinc-600 transition-transform shrink-0",
                                    selectedPack === pack.id && "rotate-90 text-indigo-400"
                                )}
                            />
                        </div>

                        {/* Expanded View */}
                        {selectedPack === pack.id && (
                            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4" onClick={(e) => e.stopPropagation()}>
                                {/* Pack Contents Preview */}
                                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                                    <div className="p-2 bg-zinc-900 rounded-lg">
                                        <div className="text-lg font-bold text-indigo-400">
                                            {Object.keys(pack.opencode.providers || {}).length}
                                        </div>
                                        <div className="text-zinc-500">Providers</div>
                                    </div>
                                    <div className="p-2 bg-zinc-900 rounded-lg">
                                        <div className="text-lg font-bold text-emerald-400">
                                            {Object.keys(pack.opencode.models || {}).length}
                                        </div>
                                        <div className="text-zinc-500">Models</div>
                                    </div>
                                    <div className="p-2 bg-zinc-900 rounded-lg">
                                        <div className="text-lg font-bold text-amber-400">
                                            {Object.keys(pack.opencode.mcpServers || {}).length}
                                        </div>
                                        <div className="text-zinc-500">MCP Servers</div>
                                    </div>
                                </div>

                                {/* OMO Agents */}
                                {pack.omo.agents && Object.keys(pack.omo.agents).length > 0 && (
                                    <div className="text-xs text-zinc-500">
                                        <span className="text-zinc-400 font-medium">OMO Agents:</span>{' '}
                                        {Object.keys(pack.omo.agents).slice(0, 4).join(', ')}
                                        {Object.keys(pack.omo.agents).length > 4 && ` +${Object.keys(pack.omo.agents).length - 4} more`}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowPreview(!showPreview)}
                                        className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        {showPreview ? 'Hide Preview' : 'Preview Changes'}
                                    </button>
                                    <button
                                        onClick={() => applyMutation.mutate(pack.id)}
                                        disabled={applyMutation.isPending}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                                    >
                                        {applyMutation.isPending ? (
                                            <>Applying...</>
                                        ) : (
                                            <>
                                                <Check size={14} />
                                                Apply Pack
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Preview Panel */}
                                {showPreview && previewData && (
                                    <div className="p-3 bg-zinc-900/50 rounded-lg text-xs">
                                        <div className="flex items-center gap-2 mb-2 text-zinc-400 font-medium">
                                            <AlertCircle size={12} />
                                            Changes Preview
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <div className="text-zinc-500 mb-1">New Providers:</div>
                                                <div className="text-zinc-300 font-mono">
                                                    {Object.keys(pack.opencode.providers || {}).join(', ') || 'None'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-500 mb-1">New Models:</div>
                                                <div className="text-zinc-300 font-mono">
                                                    {Object.keys(pack.opencode.models || {}).join(', ') || 'None'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-500 mb-1">New MCP Servers:</div>
                                                <div className="text-zinc-300 font-mono">
                                                    {Object.keys(pack.opencode.mcpServers || {}).join(', ') || 'None'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Success Message */}
            {applyMutation.isSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm">
                    <Check size={16} />
                    Starter pack applied successfully! Your configuration has been updated.
                </div>
            )}

            {/* Error Message */}
            {applyMutation.isError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    <AlertCircle size={16} />
                    Failed to apply starter pack. Please try again.
                </div>
            )}
        </div>
    );
}
