import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { occmApi } from '../api/occm';
import { FileText, Save, RotateCw, Globe, FileCode, CheckCircle2 } from 'lucide-react';

export function RulesTab() {
    const queryClient = useQueryClient();
    const [isGlobal, setIsGlobal] = useState(false);

    const { data: agentsMd, isLoading } = useQuery({
        queryKey: ['occm-agents-md', isGlobal],
        queryFn: () => occmApi.getAgentsMd(isGlobal)
    });

    const [content, setContent] = React.useState('');

    React.useEffect(() => {
        if (agentsMd) {
            setContent(agentsMd.content);
        }
    }, [agentsMd]);

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="flex justify-between items-end">
                    <div className="space-y-2">
                        <div className="h-6 w-48 bg-zinc-800 rounded" />
                        <div className="h-4 w-64 bg-zinc-800 rounded" />
                    </div>
                    <div className="h-10 w-32 bg-zinc-800 rounded" />
                </div>
                <div className="h-10 w-full bg-zinc-800 rounded" />
                <div className="h-[400px] w-full bg-zinc-800 rounded" />
            </div>
        );
    }

    const saveMutation = useMutation({
        mutationFn: (newContent: string) => occmApi.saveAgentsMd(newContent, isGlobal),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occm-agents-md', isGlobal] });
            alert('Saved successfully!');
        }
    });

    const templateMutation = useMutation({
        mutationFn: () => occmApi.getRuleTemplate(),
        onSuccess: (template: string) => {
            setContent(template);
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <FileCode className="w-5 h-5 text-indigo-400" />
                        AGENTS.md Editor
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        Define global or project-level instructions for your agents.
                    </p>
                </div>
                <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <button
                        onClick={() => setIsGlobal(false)}
                        className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-2 ${!isGlobal ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Project
                    </button>
                    <button
                        onClick={() => setIsGlobal(true)}
                        className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-2 ${isGlobal ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <Globe className="w-3.5 h-3.5" />
                        Global
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 bg-zinc-900/50 p-2 rounded border border-zinc-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                    Editing: <span className="text-zinc-300">{agentsMd?.path || '...'}</span>
                </div>

                <div className="relative group">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Write your agent instructions here (Markdown support)..."
                        className="w-full h-[400px] bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => templateMutation.mutate()}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors"
                        >
                            <RotateCw className="w-3.5 h-3.5" />
                            Use Template
                        </button>
                        <button
                            disabled={saveMutation.isPending}
                            onClick={() => saveMutation.mutate(content)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {saveMutation.isPending ? 'Saving...' : 'Save File'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-indigo-400 mb-2">Instruction Files</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        Agents will look for instructions in AGENTS.md and any custom paths defined in your <code>opencode.json</code>.
                    </p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Pro-tip</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        Use specific rules to handle coding style, commit message formats, or environment setup steps.
                    </p>
                </div>
            </div>
        </div>
    );
}
