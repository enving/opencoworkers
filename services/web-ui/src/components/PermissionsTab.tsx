import React from 'react';
import { Shield, Lock, Unlock, HelpCircle, HardDrive, Info, Eye } from 'lucide-react';

export function PermissionsTab({ config, onSave }: { config: any, onSave: (oc: any, omo: any) => void }) {
    const [showHelp, setShowHelp] = React.useState(false);
    const permissions = config?.opencode?.permission || {};
    const compaction = config?.opencode?.compaction || { auto: true, prune: true };

    const tools = ['Bash', 'Read', 'Write', 'Edit', 'WebFetch', 'RAG'];

    const updatePermission = (tool: string, level: string) => {
        const newConfig = { ...config };
        if (!newConfig.opencode.permission) newConfig.opencode.permission = {};
        newConfig.opencode.permission[tool] = level;
        onSave(newConfig.opencode, newConfig.omo);
    };

    const updateCompaction = (field: string, value: boolean) => {
        const newConfig = { ...config };
        if (!newConfig.opencode.compaction) newConfig.opencode.compaction = {};
        newConfig.opencode.compaction[field] = value;
        onSave(newConfig.opencode, newConfig.omo);
    };

    return (
        <div className="space-y-8">
            {/* Tool Permissions */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-xl font-bold">Tool Permissions</h2>
                    </div>
                    <button
                        onClick={() => setShowHelp(!showHelp)}
                        className={`transition-colors p-1 rounded ${showHelp ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="View Permission Guide"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                </div>

                {showHelp && (
                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 text-xs text-zinc-400 space-y-2 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 text-indigo-300 font-semibold mb-1">
                            <Info className="w-3 h-3" /> Permission Levels
                        </div>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong className="text-green-400">Allow:</strong> Agent can use the tool without confirmation.</li>
                            <li><strong className="text-yellow-400">Ask:</strong> Agent must request permission for each use.</li>
                            <li><strong className="text-red-400">Deny:</strong> Tool is completely disabled for the agent.</li>
                        </ul>
                    </div>
                )}
                <p className="text-sm text-zinc-500">
                    Control how agents are allowed to use specific tools.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tools.map(tool => (
                        <div key={tool} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                            <span className="font-medium text-sm">{tool}</span>
                            <div className="flex bg-zinc-800 p-0.5 rounded-md">
                                <PermissionButton
                                    active={permissions[tool] === 'allow'}
                                    onClick={() => updatePermission(tool, 'allow')}
                                    icon={<Unlock className="w-3.5 h-3.5" />}
                                    label="Allow"
                                    color="green"
                                />
                                <PermissionButton
                                    active={permissions[tool] === 'ask'}
                                    onClick={() => updatePermission(tool, 'ask')}
                                    icon={<HelpCircle className="w-3.5 h-3.5" />}
                                    label="Ask"
                                    color="yellow"
                                />
                                <PermissionButton
                                    active={permissions[tool] === 'deny'}
                                    onClick={() => updatePermission(tool, 'deny')}
                                    icon={<Lock className="w-3.5 h-3.5" />}
                                    label="Deny"
                                    color="red"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Context Compaction */}
            <div className="space-y-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-xl font-bold">Context Management</h2>
                </div>

                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6 flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 font-semibold">
                            Adaptive Compaction
                            <span className="bg-indigo-500/20 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded uppercase">Optimized</span>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed max-w-lg">
                            When enabled, the daemon will automatically compress conversation context when it reaches model limits.
                            This preserves token space while maintaining essential task information.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 min-w-[200px]">
                        <label className="flex items-center justify-between gap-3 cursor-pointer group">
                            <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">Auto Compress</span>
                            <div
                                onClick={() => updateCompaction('auto', !compaction.auto)}
                                className={`w-10 h-5 rounded-full relative transition-all ${compaction.auto ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${compaction.auto ? 'right-1' : 'left-1'}`} />
                            </div>
                        </label>
                        <label className="flex items-center justify-between gap-3 cursor-pointer group">
                            <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">Prune Old Outputs</span>
                            <div
                                onClick={() => updateCompaction('prune', !compaction.prune)}
                                className={`w-10 h-5 rounded-full relative transition-all ${compaction.prune ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${compaction.prune ? 'right-1' : 'left-1'}`} />
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Hint */}
            <div className="flex items-start gap-3 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                <Info className="w-4 h-4 text-zinc-500 mt-0.5" />
                <p className="text-xs text-zinc-500 leading-relaxed">
                    Tool permissions can also be overridden at the project level specifically within the <code>.opencode/config.json</code> file.
                </p>
            </div>
        </div>
    );
}

function PermissionButton({ active, onClick, icon, label, color }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string }) {
    const colors: Record<string, string> = {
        green: active ? 'bg-green-500/10 text-green-500' : 'text-zinc-600 hover:text-zinc-400',
        yellow: active ? 'bg-yellow-500/10 text-yellow-500' : 'text-zinc-600 hover:text-zinc-400',
        red: active ? 'bg-red-500/10 text-red-500' : 'text-zinc-600 hover:text-zinc-400',
    };

    return (
        <button
            onClick={onClick}
            title={label}
            className={`p-1.5 rounded-md transition-all ${colors[color]}`}
        >
            {icon}
        </button>
    );
}
