/**
 * MemoriesView.tsx - FEAT-MEMORIES
 * 
 * Interface for browsing and searching agent memories (RAG).
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Search,
    Brain,
    Calendar,
    Tag,
    User,
    Plus,
    Database,
    Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import { memoriesApi, type MemoryEntry } from '../api/memories';

function MemoryCard({ memory }: { memory: MemoryEntry }) {
    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                    <span className={clsx(
                        'text-xs font-medium px-2 py-1 rounded-md border',
                        memory.category === 'task-outcome'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : memory.category === 'user-input'
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    )}>
                        {memory.category}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <Calendar size={12} />
                        {new Date(memory.timestamp).toLocaleString()}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <User size={12} />
                    {memory.agentId}
                </div>
            </div>

            <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
                {memory.content}
            </div>

            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-zinc-800/50">
                {memory.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                        <Tag size={10} />
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    );
}

function AddMemoryModal({
    isOpen,
    onClose,
    onAdd
}: {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (data: any) => Promise<void>;
}) {
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSubmitting(true);
        try {
            await onAdd({
                agentId: 'user-manual',
                content: content.trim(),
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                category: 'user-input'
            });
            onClose();
            setContent('');
            setTags('');
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
                <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-4">
                    <Plus size={20} className="text-indigo-400" />
                    Add Manual Memory
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Content</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:ring-2 focus:ring-indigo-500/50 outline-none h-32 resize-none"
                            placeholder="Type the memory content here..."
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Tags (comma separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                            placeholder="important, rule, preference"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !content.trim()}
                            className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                            Add Memory
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function MemoriesView() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<string>('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Fetch memories
    const { data: memories = [], isLoading } = useQuery<MemoryEntry[]>({
        queryKey: ['memories', search, category],
        queryFn: () => memoriesApi.search({
            search: search || undefined,
            category: category || undefined,
            limit: 50
        }),
    });

    // Add memory mutation
    const addMemory = useMutation({
        mutationFn: memoriesApi.add,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['memories'] });
        }
    });

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
                        <Brain className="text-pink-500" />
                        Agent Memory
                    </h1>
                    <p className="text-zinc-400 mt-1">
                        Browse and manage the agent's long-term knowledge base (RAG).
                    </p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-xl font-medium hover:bg-white transition-colors"
                >
                    <Plus size={18} />
                    Add Memory
                </button>
            </div>

            {/* Search and Filters */}
            <div className="flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search memories semantically..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all placeholder:text-zinc-600"
                    />
                </div>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-pink-500/50 cursor-pointer min-w-[150px]"
                >
                    <option value="">All Categories</option>
                    <option value="task-outcome">Task Outcomes</option>
                    <option value="user-input">User Input</option>
                    <option value="general">General</option>
                </select>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-zinc-500" />
                </div>
            ) : memories.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30">
                    <Database size={48} className="mb-4 opacity-50" />
                    <p className="text-lg font-medium">No memories found</p>
                    <p className="text-sm mt-1">Try adjusting your search or filters</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pb-4 custom-scrollbar">
                    {memories.map((memory: MemoryEntry, i: number) => (
                        <MemoryCard key={`${memory.agentId}-${memory.timestamp}-${i}`} memory={memory} />
                    ))}
                </div>
            )}

            <AddMemoryModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={addMemory.mutateAsync}
            />
        </div>
    );
}

export default MemoriesView;
