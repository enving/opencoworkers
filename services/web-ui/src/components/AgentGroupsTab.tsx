import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, AlertCircle, RefreshCw, Plus, Trash2, Edit2, Bot, X } from 'lucide-react';
import { clsx } from 'clsx';
import { occmApi, AgentGroup, OccmConfig } from '../api/occm';

interface AgentGroupsTabProps {
    onConfigUpdate: () => void;
}

export function AgentGroupsTab({ onConfigUpdate }: AgentGroupsTabProps) {
    const queryClient = useQueryClient();
    const [applyingId, setApplyingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [editingGroup, setEditingGroup] = useState<AgentGroup | null>(null);

    const { data: groups, isLoading, error, refetch: refetchGroups } = useQuery({
        queryKey: ['occmGroups'],
        queryFn: occmApi.listGroups,
        staleTime: 60000
    });

    const { data: config } = useQuery({
        queryKey: ['occmConfig'],
        queryFn: occmApi.getConfig
    });

    const applyMutation = useMutation({
        mutationFn: occmApi.applyGroup,
        onMutate: (id) => setApplyingId(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occmConfig'] });
            onConfigUpdate();
            setApplyingId(null);
        },
        onError: () => {
            setApplyingId(null);
            alert('Failed to apply group');
        }
    });

    const saveMutation = useMutation({
        mutationFn: occmApi.saveGroup,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occmGroups'] });
            setIsAdding(false);
            setEditingGroup(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: occmApi.deleteGroup,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occmGroups'] });
        }
    });

    if (isLoading) {
        return <div className="p-8 text-center text-zinc-500">Loading agent groups...</div>;
    }

    if (error) {
        return (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
                <AlertCircle size={20} />
                <span>Failed to load agent groups.</span>
                <button onClick={() => refetchGroups()} className="ml-auto p-1 hover:bg-red-500/20 rounded">
                    <RefreshCw size={16} />
                </button>
            </div>
        );
    }

    const presets = groups?.filter(g => g.type === 'preset') || [];
    const custom = groups?.filter(g => g.type === 'custom') || [];

    if (isAdding || editingGroup) {
        return (
            <AgentGroupForm
                initialData={editingGroup || undefined}
                availableConfig={config}
                onSave={(g) => saveMutation.mutate(g)}
                onCancel={() => { setIsAdding(false); setEditingGroup(null); }}
                isPending={saveMutation.isPending}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-zinc-200 mb-1">Agent Groups</h3>
                    <p className="text-sm text-zinc-500">
                        Select a predefined team of agents optimized for specific tasks.
                    </p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                >
                    <Plus size={16} />
                    Create Custom Group
                </button>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Presets</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {presets.map(group => (
                        <GroupCard
                            key={group.id}
                            group={group}
                            isApplying={applyingId === group.id}
                            onApply={() => applyMutation.mutate(group.id)}
                        />
                    ))}
                </div>
            </div>

            {custom.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-zinc-800">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Custom Groups</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {custom.map(group => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                isApplying={applyingId === group.id}
                                onApply={() => applyMutation.mutate(group.id)}
                                onEdit={() => setEditingGroup(group)}
                                onDelete={() => deleteMutation.mutate(group.id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function GroupCard({
    group,
    isApplying,
    onApply,
    onEdit,
    onDelete
}: {
    group: AgentGroup,
    isApplying: boolean,
    onApply: () => void,
    onEdit?: () => void,
    onDelete?: () => void
}) {
    return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all group flex flex-col">
            <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-xl">
                    {group.icon || '📁'}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEdit && (
                        <button onClick={onEdit} className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg">
                            <Edit2 size={14} />
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={onDelete} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            <h4 className="font-semibold text-zinc-200 mb-1">{group.name}</h4>
            <p className="text-xs text-zinc-500 mb-4 flex-grow">{group.description}</p>

            <div className="flex items-center gap-2 mb-4">
                <div className="flex -space-x-2">
                    {group.agents.opencode.slice(0, 3).map((a, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-indigo-500/20 border border-zinc-900 flex items-center justify-center text-[10px] text-indigo-400 font-bold" title={a.agent_id}>
                            {a.agent_id[0].toUpperCase()}
                        </div>
                    ))}
                    {(group.agents.opencode.length > 3) && (
                        <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-900 flex items-center justify-center text-[10px] text-zinc-400">
                            +{group.agents.opencode.length - 3}
                        </div>
                    )}
                </div>
                <span className="text-xs text-zinc-600">
                    {group.agents.opencode.length + group.agents.oh_my_opencode.length} Agents
                </span>
            </div>

            <button
                onClick={onApply}
                disabled={isApplying}
                className={clsx(
                    "w-full py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                    isApplying
                        ? "bg-zinc-800 text-zinc-400 cursor-wait"
                        : "bg-zinc-900 hover:bg-indigo-600/10 hover:text-indigo-400 text-zinc-400 border border-zinc-800 hover:border-indigo-500/30"
                )}
            >
                {isApplying ? (
                    <>Processing...</>
                ) : (
                    <>
                        <Check size={16} />
                        Apply Group
                    </>
                )}
            </button>
        </div>
    );
}

interface AgentGroupFormProps {
    initialData?: AgentGroup;
    availableConfig?: OccmConfig;
    onSave: (group: AgentGroup) => void;
    onCancel: () => void;
    isPending: boolean;
}

function AgentGroupForm({ initialData, availableConfig, onSave, onCancel, isPending }: AgentGroupFormProps) {
    const [name, setName] = useState(initialData?.name || '');
    const [desc, setDesc] = useState(initialData?.description || '');
    const [icon, setIcon] = useState(initialData?.icon || '📁');
    const [selectedAgents, setSelectedAgents] = useState<string[]>(
        initialData?.agents.opencode.map(a => a.agent_id) || []
    );

    const availableAgents = Object.keys(availableConfig?.opencode?.agent || {});

    const handleToggleAgent = (id: string) => {
        setSelectedAgents(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleSave = () => {
        if (!name.trim()) return;
        const group: AgentGroup = {
            id: initialData?.id || `group-${Date.now()}`,
            name: name.trim(),
            description: desc.trim(),
            type: 'custom',
            icon,
            agents: {
                opencode: selectedAgents.map(id => ({ agent_id: id, enabled: true, mode: 'primary' })),
                oh_my_opencode: [] // Simplified for now
            }
        };
        onSave(group);
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                        <Plus size={20} className="text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-100">{initialData ? 'Edit Group' : 'New Agent Group'}</h3>
                        <p className="text-xs text-zinc-500">Design a custom team of agents</p>
                    </div>
                </div>
                <button onClick={onCancel} className="p-2 text-zinc-500 hover:text-zinc-200">
                    <X size={20} />
                </button>
            </div>

            <div className="p-6 space-y-6">
                <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Group Name</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Frontend Development Team"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Description</label>
                            <textarea
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                placeholder="Purpose of this agent group..."
                                rows={3}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Icon</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['📁', '💻', '🎨', '🚀', '🛠️', '🧠', '🛡️', '📊', '🔍'].map(i => (
                                <button
                                    key={i}
                                    onClick={() => setIcon(i)}
                                    className={clsx(
                                        "w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all",
                                        icon === i ? "bg-indigo-600 text-white" : "bg-zinc-950 border border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                                    )}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Select Agents</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {availableAgents.map(id => (
                            <button
                                key={id}
                                onClick={() => handleToggleAgent(id)}
                                className={clsx(
                                    "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                                    selectedAgents.includes(id)
                                        ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400"
                                        : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                )}
                            >
                                <div className={clsx(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    selectedAgents.includes(id) ? "bg-indigo-500/20" : "bg-zinc-900"
                                )}>
                                    <Bot size={16} />
                                </div>
                                <span className="text-sm font-medium truncate">{id}</span>
                                {selectedAgents.includes(id) && <Check size={14} className="ml-auto" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    className="px-6 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isPending || !name.trim() || selectedAgents.length === 0}
                    className="px-8 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                    {isPending ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                    {initialData ? 'Update Group' : 'Create Group'}
                </button>
            </div>
        </div>
    );
}
