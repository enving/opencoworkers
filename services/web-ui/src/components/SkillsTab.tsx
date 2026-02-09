import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { occmApi } from '../api/occm';
import { Plus, Trash2, Edit2, FileText, Search, Shield, ExternalLink, X, Download, RefreshCw, Store, FolderOpen, Github } from 'lucide-react';

type TabView = 'list' | 'marketplace' | 'import';

export function SkillsTab() {
    const queryClient = useQueryClient();
    const [tabView, setTabView] = React.useState<TabView>('list');
    const { data: skills, isLoading } = useQuery({
        queryKey: ['occm-skills'],
        queryFn: () => occmApi.listSkills()
    });

    const [selectedSkill, setSelectedSkill] = React.useState<any>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isAdding, setIsAdding] = React.useState(false);
    const [isEditing, setIsEditing] = React.useState(false);

    const deleteMutation = useMutation({
        mutationFn: (name: string) => occmApi.deleteSkill(name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occm-skills'] });
            setSelectedSkill(null);
        }
    });

    const saveMutation = useMutation({
        mutationFn: (data: { skill: any, location: string }) => occmApi.saveSkill(data.skill, data.location),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occm-skills'] });
            setIsAdding(false);
            setIsEditing(false);
            setSelectedSkill(null);
        }
    });

    const filteredSkills = React.useMemo(() => skills?.filter((s: any) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase())
    ), [skills, searchTerm]);

    if (isAdding || isEditing) {
        return (
            <SkillForm
                initialData={isEditing ? selectedSkill : undefined}
                onSave={(skill, loc) => saveMutation.mutate({ skill, location: loc })}
                onCancel={() => { setIsAdding(false); setIsEditing(false); }}
                isPending={saveMutation.isPending}
            />
        );
    }

    if (tabView === 'marketplace') {
        return <SkillMarketplace onBack={() => setTabView('list')} />;
    }

    if (tabView === 'import') {
        return <SkillImport onBack={() => setTabView('list')} />;
    }

    return (
        <div className="flex h-full gap-4">
            {/* Left Sidebar: Skill List */}
            <div className="w-1/3 flex flex-col gap-4 border-r border-zinc-800 pr-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search skills..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {isLoading ? (
                        <div className="animate-pulse space-y-2">
                            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-900 rounded-lg" />)}
                        </div>
                    ) : filteredSkills?.map((skill: any) => (
                        <button
                            key={skill.name}
                            onClick={() => setSelectedSkill(skill)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${selectedSkill?.name === skill.name
                                ? 'bg-indigo-500/10 border-indigo-500 text-white'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                }`}
                        >
                            <div className="font-medium truncate">{skill.name}</div>
                            <div className="text-xs text-zinc-500 truncate">{skill.description}</div>
                            <div className="mt-2 text-[10px] text-zinc-600 flex items-center gap-1">
                                <span className="px-1.5 py-0.5 rounded bg-zinc-800 uppercase">{skill.source}</span>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <button
                        onClick={() => setIsAdding(true)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Create New Skill
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTabView('import')}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm"
                        >
                            <Download className="w-4 h-4" />
                            Import
                        </button>
                        <button
                            onClick={() => setTabView('marketplace')}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm"
                        >
                            <Store className="w-4 h-4" />
                            Marketplace
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Side: Skill Detail */}
            <div className="flex-1 overflow-y-auto pr-2">
                {selectedSkill ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold">{selectedSkill.name}</h2>
                                <p className="text-zinc-400 mt-1">{selectedSkill.description}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm(`Delete skill ${selectedSkill.name}?`)) {
                                            deleteMutation.mutate(selectedSkill.name);
                                        }
                                    }}
                                    className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="text-xs text-zinc-500">Source Path</div>
                                    <button
                                        onClick={() => window.open(`file://${selectedSkill.path}`, '_blank')}
                                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                                    >
                                        Open <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                                <div className="text-sm font-mono truncate text-zinc-300">{selectedSkill.path}</div>
                            </div>
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex justify-between items-center">
                                <div>
                                    <div className="text-xs text-zinc-500 mb-1">License</div>
                                    <div className="text-sm text-zinc-300 font-medium">{selectedSkill.license || 'N/A'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-zinc-500 mb-1 text-right">Compatibility</div>
                                    <div className="text-sm text-zinc-300 font-medium text-right">{selectedSkill.compatibility || 'N/A'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-400" />
                                Content Preview
                            </h3>
                            <pre className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-300 overflow-x-auto">
                                {selectedSkill.content}
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                            <Shield className="w-8 h-8 text-zinc-700" />
                        </div>
                        <p>Select a skill from the list to view and edit details</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ==================== SKILL FORM ====================
function SkillForm({ initialData, onSave, onCancel, isPending }: {
    initialData?: any,
    onSave: (skill: any, loc: string) => void,
    onCancel: () => void,
    isPending: boolean
}) {
    const [name, setName] = React.useState(initialData?.name || '');
    const [description, setDescription] = React.useState(initialData?.description || '');
    const [content, setContent] = React.useState(initialData?.content || '');
    const [license, setLicense] = React.useState(initialData?.license || 'MIT');
    const [location, setLocation] = React.useState(initialData?.source || 'opencode-project');

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">{initialData ? 'Edit Skill' : 'Create New Skill'}</h3>
                <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="space-y-4">
                    <div>
                        <label className="block text-zinc-500 mb-1.5">Skill Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. data-analyzer"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-700"
                        />
                    </div>
                    <div>
                        <label className="block text-zinc-500 mb-1.5">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Briefly describe what this skill does..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-700 resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-zinc-500 mb-1.5">Location</label>
                        <select
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                        >
                            <option value="opencode-project">Project (.opencode/skills)</option>
                            <option value="opencode-global">Global (~/.config/opencode/skills)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-zinc-500 mb-1.5">License</label>
                        <input
                            value={license}
                            onChange={(e) => setLicense(e.target.value)}
                            placeholder="MIT"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-700 font-mono"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-zinc-500">Skill Content (Instructions)</label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="# Skill: How to use it..."
                        className="w-full h-[300px] bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-100 placeholder:text-zinc-700 focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                    onClick={onCancel}
                    className="px-6 py-2 text-zinc-400 hover:text-zinc-200"
                >
                    Cancel
                </button>
                <button
                    disabled={isPending || !name || !description || !content}
                    onClick={() => onSave({ name, description, content, license }, location)}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20"
                >
                    {isPending ? 'Saving...' : 'Save Skill'}
                </button>
            </div>
        </div>
    );
}

// ==================== SKILL IMPORT ====================
function SkillImport({ onBack }: { onBack: () => void }) {
    const queryClient = useQueryClient();
    const [importType, setImportType] = React.useState<'github' | 'local'>('github');
    const [source, setSource] = React.useState('');
    const [location, setLocation] = React.useState('opencode-project');
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState('');

    const githubMutation = useMutation({
        mutationFn: () => occmApi.importSkillFromGithub(source, location),
        onSuccess: (data) => {
            if (data.success) {
                setSuccess(`Successfully imported skill: ${data.skill?.name}`);
                setSource('');
                queryClient.invalidateQueries({ queryKey: ['occm-skills'] });
            } else {
                setError(data.error || 'Import failed');
            }
        },
        onError: (err) => setError((err as Error).message)
    });

    const localMutation = useMutation({
        mutationFn: () => occmApi.importSkillFromLocal(source, location),
        onSuccess: (data) => {
            if (data.success) {
                setSuccess(`Successfully imported skill: ${data.skill?.name}`);
                setSource('');
                queryClient.invalidateQueries({ queryKey: ['occm-skills'] });
            } else {
                setError(data.error || 'Import failed');
            }
        },
        onError: (err) => setError((err as Error).message)
    });

    const handleImport = () => {
        setError('');
        setSuccess('');
        if (importType === 'github') {
            githubMutation.mutate();
        } else {
            localMutation.mutate();
        }
    };

    const isPending = githubMutation.isPending || localMutation.isPending;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Import Skill</h3>
                <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => setImportType('github')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-all ${importType === 'github'
                            ? 'bg-indigo-500/10 border-indigo-500 text-white'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                >
                    <Github className="w-5 h-5" />
                    From GitHub
                </button>
                <button
                    onClick={() => setImportType('local')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-all ${importType === 'local'
                            ? 'bg-indigo-500/10 border-indigo-500 text-white'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                >
                    <FolderOpen className="w-5 h-5" />
                    From Local Path
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-zinc-500 mb-1.5">
                        {importType === 'github' ? 'GitHub Repository' : 'Local Path'}
                    </label>
                    <input
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        placeholder={importType === 'github'
                            ? 'user/repo or https://github.com/user/repo'
                            : '/path/to/skill or ./my-skill'
                        }
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm"
                    />
                    {importType === 'github' && (
                        <p className="text-xs text-zinc-600 mt-1">
                            Supports: <code className="text-zinc-500">owner/repo</code> or full GitHub URL
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-zinc-500 mb-1.5">Install Location</label>
                    <select
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                    >
                        <option value="opencode-project">Project (.opencode/skills)</option>
                        <option value="opencode-global">Global (~/.config/opencode/skills)</option>
                        <option value="claude-project">Claude Project (.claude/skills)</option>
                        <option value="claude-global">Claude Global (~/.claude/skills)</option>
                    </select>
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                        {success}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        onClick={onBack}
                        className="px-6 py-2 text-zinc-400 hover:text-zinc-200"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={isPending || !source}
                        onClick={handleImport}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                    >
                        {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {isPending ? 'Importing...' : 'Import Skill'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ==================== SKILL MARKETPLACE ====================
function SkillMarketplace({ onBack }: { onBack: () => void }) {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
    const [location, setLocation] = React.useState('opencode-project');

    const { data: marketplace, isLoading } = useQuery({
        queryKey: ['occm-marketplace'],
        queryFn: () => occmApi.getSkillMarketplace()
    });

    const installMutation = useMutation({
        mutationFn: (skillId: string) => occmApi.installMarketplaceSkill(skillId, location),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occm-skills'] });
        }
    });

    const categories = React.useMemo(() => {
        if (!marketplace) return [];
        return [...new Set(marketplace.map((s: any) => s.category))];
    }, [marketplace]);

    const filteredSkills = React.useMemo(() => {
        if (!marketplace) return [];
        return marketplace.filter((s: any) => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.description.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategory || s.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [marketplace, searchTerm, selectedCategory]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold">Skill Marketplace</h3>
                    <p className="text-sm text-zinc-500 mt-1">Browse and install curated skills</p>
                </div>
                <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search marketplace..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100"
                >
                    <option value="opencode-project">Project</option>
                    <option value="opencode-global">Global</option>
                </select>
            </div>

            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${!selectedCategory
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                        }`}
                >
                    All
                </button>
                {categories.map((cat: string) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedCategory === cat
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-zinc-900 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {filteredSkills.map((skill: any) => (
                        <div
                            key={skill.id}
                            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-semibold text-zinc-100">{skill.name}</h4>
                                    <p className="text-xs text-zinc-500 mt-0.5">by {skill.author}</p>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">
                                    {skill.category}
                                </span>
                            </div>
                            <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{skill.description}</p>
                            <div className="flex items-center justify-between">
                                <div className="flex gap-1 flex-wrap">
                                    {skill.tags?.slice(0, 3).map((tag: string) => (
                                        <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <button
                                    onClick={() => installMutation.mutate(skill.id)}
                                    disabled={installMutation.isPending}
                                    className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-all flex items-center gap-1"
                                >
                                    <Download className="w-3 h-3" />
                                    Install
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

