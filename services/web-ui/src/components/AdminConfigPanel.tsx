/**
 * AdminConfigPanel.tsx - Visual Admin Config (FR-509)
 * Manages OpenCode providers, models, MCP servers, and agent configuration
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Trash2,
    Edit2,
    Check,
    Eye,
    EyeOff,
    RefreshCw,
    ChevronDown,
    Sparkles,
    Activity,
    AlertCircle,
    Users,
    Shield,
    ScrollText,
    Plug
} from 'lucide-react';
import { clsx } from 'clsx';
import { occmApi } from '../api/occm';
import { AgentGroupsTab } from './AgentGroupsTab';
import type {
    OpenCodeConfig,
    Provider,
    AgentConfig,
    ProviderSDK,
} from '../types/opencode-config';
import { PRESET_MODELS as presetModels, PRESET_MCP_SERVERS as presetMcpServers } from '../types/opencode-config';
import { MonitorTab } from './MonitorTab';
import { SkillsTab } from './SkillsTab';
import { RulesTab } from './RulesTab';
import { PermissionsTab } from './PermissionsTab';
import { PluginsTab } from './PluginsTab';
import { BackupTab } from './BackupTab';
import { StarterPacksTab } from './StarterPacksTab';
import { Settings2, Cpu, Layers, Bot, Package, Archive, Rocket } from 'lucide-react';

type TabId = 'starter' | 'groups' | 'providers' | 'models' | 'mcp' | 'agents' | 'skills' | 'rules' | 'permissions' | 'monitor' | 'plugins' | 'backup';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'groups', label: 'Groups', icon: <Users size={18} /> },
    { id: 'starter', label: 'Quick Start', icon: <Rocket size={18} /> },
    { id: 'providers', label: 'Providers', icon: <Cpu size={18} /> },
    { id: 'models', label: 'Models', icon: <Layers size={18} /> },
    { id: 'mcp', label: 'MCP', icon: <Plug size={18} /> },
    { id: 'agents', label: 'Agents', icon: <Bot size={18} /> },
    { id: 'skills', label: 'Skills', icon: <ScrollText size={18} /> },
    { id: 'rules', label: 'Rules', icon: <ScrollText size={18} /> },
    { id: 'permissions', label: 'Security', icon: <Shield size={18} /> },
    { id: 'monitor', label: 'Monitor', icon: <Activity size={18} /> },
    { id: 'plugins', label: 'Plugins', icon: <Package size={18} /> },
    { id: 'backup', label: 'Backup', icon: <Archive size={18} /> },
];

const SDK_OPTIONS: { value: ProviderSDK; label: string }[] = [
    { value: '@ai-sdk/anthropic', label: 'Anthropic' },
    { value: '@ai-sdk/openai', label: 'OpenAI' },
    { value: '@ai-sdk/google', label: 'Google' },
    { value: '@ai-sdk/azure', label: 'Azure' },
    { value: '@ai-sdk/mistral', label: 'Mistral' },
    { value: 'custom', label: 'Custom' },
];

export function AdminConfigPanel() {
    const [activeTab, setActiveTab] = useState<TabId>('groups');
    const queryClient = useQueryClient();

    const { data: config, isLoading, error, refetch } = useQuery({
        queryKey: ['occmConfig'],
        queryFn: occmApi.getConfig,
        retry: 1,
        staleTime: 30000
    });

    const mutation = useMutation({
        mutationFn: (data: { opencode: any, omo: any }) => occmApi.saveConfig(data.opencode, data.omo),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occmConfig'] });
        }
    });

    const handleOpencodeUpdate = (updates: Partial<OpenCodeConfig>) => {
        if (!config) return;
        mutation.mutate({
            opencode: { ...config.opencode, ...updates },
            omo: config.omo
        });
    };

    if (isLoading) {
        return (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-zinc-500 text-sm">Loading OpenCode configuration...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-zinc-900/50 border border-red-900/50 rounded-2xl p-8">
                <div className="flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-zinc-100 mb-1">Connection Failed</h4>
                        <p className="text-zinc-500 text-sm mb-4">
                            Unable to fetch OpenCode configuration. Make sure the Runtime container is running.
                        </p>
                        <button
                            onClick={() => refetch()}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition-colors"
                        >
                            <RefreshCw size={16} />
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Settings2 size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-100">OpenCode Configuration</h3>
                        <p className="text-xs text-zinc-500">Manage providers, models, and agent settings</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {mutation.isPending && (
                        <span className="flex items-center gap-2 text-xs text-amber-400">
                            <Activity size={14} className="animate-spin" />
                            Saving...
                        </span>
                    )}
                    <button
                        onClick={() => refetch()}
                        className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all relative",
                            activeTab === tab.id
                                ? "text-indigo-400"
                                : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
                {activeTab === 'starter' && (
                    <StarterPacksTab onConfigUpdate={() => refetch()} />
                )}
                {activeTab === 'groups' && (
                    <AgentGroupsTab onConfigUpdate={() => refetch()} />
                )}
                {activeTab === 'providers' && (
                    <ProvidersTab
                        config={config?.opencode}
                        onUpdate={handleOpencodeUpdate}
                        isPending={mutation.isPending}
                    />
                )}
                {activeTab === 'models' && (
                    <ModelsTab
                        config={config?.opencode}
                        onUpdate={handleOpencodeUpdate}
                        isPending={mutation.isPending}
                    />
                )}
                {activeTab === 'mcp' && (
                    <McpServersTab
                        config={config?.opencode}
                        onUpdate={handleOpencodeUpdate}
                        isPending={mutation.isPending}
                    />
                )}
                {activeTab === 'agents' && (
                    <AgentsTab
                        config={config?.opencode}
                        onUpdate={handleOpencodeUpdate}
                        isPending={mutation.isPending}
                    />
                )}
                {activeTab === 'skills' && <SkillsTab />}
                {activeTab === 'rules' && <RulesTab />}
                {activeTab === 'permissions' && (
                    <PermissionsTab
                        config={config}
                        onSave={(oc: any, omo: any) => mutation.mutate({ opencode: oc, omo })}
                    />
                )}
                {activeTab === 'monitor' && <MonitorTab config={config} />}
                {activeTab === 'plugins' && <PluginsTab />}
                {activeTab === 'backup' && <BackupTab />}
            </div>
        </div>
    );
}

// =====================================
// Providers Tab
// =====================================
interface ProvidersTabProps {
    config: OpenCodeConfig;
    onUpdate: (config: Partial<OpenCodeConfig>) => void;
    isPending: boolean;
}

function ProvidersTab({ config, onUpdate, isPending }: ProvidersTabProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

    const providers = config?.provider || {};

    const handleDelete = (id: string) => {
        const newProviders = { ...providers };
        delete newProviders[id];
        onUpdate({ provider: newProviders });
    };

    const handleSave = (id: string, providerData: Omit<Provider, 'id'>) => {
        // Transform to correct OpenCode schema: options.apiKey
        onUpdate({
            provider: {
                ...providers,
                [id]: {
                    options: {
                        apiKey: providerData.apiKey,
                        baseURL: providerData.baseUrl
                    }
                }
            }
        });
        setIsAdding(false);
        setEditingId(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                    Configure API providers for LLM access. API keys are stored securely in the runtime config.
                </p>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                >
                    <Plus size={16} />
                    Add Provider
                </button>
            </div>

            {Object.keys(providers).length === 0 && !isAdding ? (
                <div className="py-12 text-center text-zinc-600">
                    <Cpu size={40} className="mx-auto mb-3 opacity-50" />
                    <p>No providers configured</p>
                    <p className="text-xs mt-1">Add a provider to connect to AI models</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {Object.entries(providers).map(([id, provider]) => (
                        editingId === id ? (
                            <ProviderForm
                                key={id}
                                initialId={id}
                                initialData={{
                                    // Convert from OpenCode format back to UI format for editing
                                    enabled: true,
                                    name: id,
                                    sdk: 'custom',
                                    apiKey: provider.options?.apiKey || '',
                                    baseUrl: provider.options?.baseURL || ''
                                }}
                                onSave={handleSave}
                                onCancel={() => setEditingId(null)}
                            />
                        ) : (
                            <div
                                key={id}
                                className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl group hover:border-zinc-700 transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold bg-indigo-500/10 text-indigo-400">
                                        {id.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-zinc-200">{id}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-zinc-500">Provider</span>
                                            {provider.options?.baseURL && (
                                                <span className="text-xs text-zinc-600">• {provider.options.baseURL}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-zinc-600 font-mono">
                                            {showApiKeys[id] ? (provider.options?.apiKey || '-') : '••••••••••••'}
                                        </span>
                                        <button
                                            onClick={() => setShowApiKeys(prev => ({ ...prev, [id]: !prev[id] }))}
                                            className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors"
                                        >
                                            {showApiKeys[id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setEditingId(id)}
                                        className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(id)}
                                        disabled={isPending}
                                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        )
                    ))}

                    {isAdding && (
                        <ProviderForm
                            onSave={handleSave}
                            onCancel={() => setIsAdding(false)}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

interface ProviderFormProps {
    initialId?: string;
    initialData?: Omit<Provider, 'id'>;
    onSave: (id: string, provider: Omit<Provider, 'id'>) => void;
    onCancel: () => void;
}

function ProviderForm({ initialId, initialData, onSave, onCancel }: ProviderFormProps) {
    const [id, setId] = useState(initialId || '');
    const [sdk, setSdk] = useState<ProviderSDK>(initialData?.sdk || '@ai-sdk/anthropic');
    const [apiKey, setApiKey] = useState(initialData?.apiKey || '');
    const [baseUrl, setBaseUrl] = useState(initialData?.baseUrl || '');
    const [showKey, setShowKey] = useState(false);

    // Auto-fill Base URL for specific SDKs
    useEffect(() => {
        if (sdk === '@ai-sdk/mistral' && !baseUrl) {
            setBaseUrl('https://api.mistral.ai/v1');
        }
    }, [sdk]);

    const handleSubmit = () => {
        if (!id.trim() || !apiKey.trim()) return;
        onSave(id.trim(), {
            name: id.trim(),
            sdk,
            apiKey,
            baseUrl: baseUrl || undefined,
            enabled: true
        });
    };

    return (
        <div className="p-4 bg-zinc-950 border border-indigo-500/30 rounded-xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Provider ID</label>
                    <input
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        placeholder="e.g., anthropic, openai"
                        disabled={!!initialId}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">SDK</label>
                    <select
                        value={sdk}
                        onChange={(e) => setSdk(e.target.value as ProviderSDK)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                        {SDK_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div>
                <label className="block text-xs text-zinc-500 mb-1.5">API Key</label>
                <div className="relative">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 pr-10 text-sm text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-400"
                    >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>
            {(sdk === 'custom' || sdk === '@ai-sdk/azure' || sdk === '@ai-sdk/mistral') && (
                <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Base URL (optional)</label>
                    <input
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://api.example.com/v1"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!id.trim() || !apiKey.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
                >
                    <Check size={16} />
                    Save
                </button>
            </div>
        </div>
    );
}

// =====================================
// Models Tab
// =====================================
interface ModelsTabProps {
    config: OpenCodeConfig;
    onUpdate: (config: Partial<OpenCodeConfig>) => void;
    isPending: boolean;
}

function ModelsTab({ config, onUpdate, isPending }: ModelsTabProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showPresets, setShowPresets] = useState(false);

    const models = config?.models || {};
    const providers = config?.provider || {};

    const handleAddPreset = (preset: typeof presetModels[0]) => {
        // Find first available provider (OpenCode format doesn't track SDK type)
        const providerIds = Object.keys(providers);
        const matchingProvider = providerIds[0];

        if (!matchingProvider) {
            alert('Please add a provider first');
            return;
        }

        onUpdate({
            models: {
                ...models,
                [preset.id]: {
                    name: preset.name,
                    provider: matchingProvider,
                    model: preset.model,
                    options: preset.options,
                    enabled: true
                }
            }
        });
        setShowPresets(false);
    };

    const handleDelete = (id: string) => {
        const newModels = { ...models };
        delete newModels[id];
        onUpdate({ models: newModels });
    };

    const handleSave = (id: string, model: any) => {
        onUpdate({
            models: {
                ...models,
                [id]: model
            }
        });
        setIsAdding(false);
        setEditingId(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                    Configure AI models and their parameters. Link models to providers.
                </p>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowPresets(!showPresets)}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition-all"
                        >
                            <Sparkles size={16} className="text-amber-400" />
                            Quick Add
                            <ChevronDown size={14} className={clsx("transition-transform", showPresets && "rotate-180")} />
                        </button>
                        {showPresets && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                <div className="p-2 border-b border-zinc-800">
                                    <p className="text-xs text-zinc-500 px-2">Popular Models</p>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {presetModels.map((preset) => (
                                        <button
                                            key={preset.id}
                                            onClick={() => handleAddPreset(preset)}
                                            className="w-full px-3 py-2.5 text-left hover:bg-zinc-800 transition-colors"
                                        >
                                            <div className="font-medium text-sm text-zinc-200">{preset.name}</div>
                                            <div className="text-xs text-zinc-500">{preset.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Plus size={16} />
                        Add Model
                    </button>
                </div>
            </div>

            {Object.keys(models).length === 0 && !isAdding ? (
                <div className="py-12 text-center text-zinc-600">
                    <Layers size={40} className="mx-auto mb-3 opacity-50" />
                    <p>No models configured</p>
                    <p className="text-xs mt-1">Use Quick Add for popular models or add custom ones</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {Object.entries(models).map(([id, model]) => (
                        editingId === id ? (
                            <ModelForm
                                key={id}
                                initialId={id}
                                initialData={model}
                                providers={Object.keys(providers)}
                                onSave={handleSave}
                                onCancel={() => setEditingId(null)}
                            />
                        ) : (
                            <div
                                key={id}
                                className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all group"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-semibold text-zinc-200">{model.name || id}</h4>
                                        <p className="text-xs text-zinc-500 font-mono mt-0.5">{model.model}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-medium rounded">
                                                {model.provider}
                                            </span>
                                            {model.options?.temperature !== undefined && (
                                                <span className="text-[10px] text-zinc-600">
                                                    temp: {model.options.temperature}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setEditingId(id)}
                                            className="p-1.5 text-zinc-600 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(id)}
                                            disabled={isPending}
                                            className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    ))}

                    {isAdding && (
                        <ModelForm
                            providers={Object.keys(providers)}
                            onSave={handleSave}
                            onCancel={() => setIsAdding(false)}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

// =====================================
// Model Form
// =====================================
interface ModelFormProps {
    initialId?: string;
    initialData?: any;
    providers: string[];
    onSave: (id: string, model: any) => void;
    onCancel: () => void;
}

function ModelForm({ initialId, initialData, providers, onSave, onCancel }: ModelFormProps) {
    const [id, setId] = useState(initialId || '');
    const [name, setName] = useState(initialData?.name || '');
    const [provider, setProvider] = useState(initialData?.provider || providers[0] || '');
    const [model, setModel] = useState(initialData?.model || '');
    const [temperature, setTemperature] = useState(initialData?.options?.temperature ?? 0.7);

    const handleSubmit = () => {
        if (!id.trim() || !model.trim() || !provider) return;
        onSave(id.trim(), {
            name: name || id.trim(),
            provider,
            model: model.trim(),
            options: { temperature },
            enabled: true
        });
    };

    return (
        <div className="p-4 bg-zinc-950 border border-indigo-500/30 rounded-xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Model ID</label>
                    <input
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        placeholder="e.g., claude-3-5"
                        disabled={!!initialId}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Model Name (Display)</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Claude 3.5 Sonnet"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Provider</label>
                    <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                        {providers.map((p) => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Model String (API Name)</label>
                <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="claude-3-5-sonnet-20240620"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
            </div>
            <div>
                <label className="flex justify-between text-xs text-zinc-500 mb-1.5">
                    Temperature
                    <span className="text-zinc-400 font-mono">{temperature}</span>
                </label>
                <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500"
                />
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!id.trim() || !model.trim() || !provider}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
                >
                    <Check size={16} />
                    Save
                </button>
            </div>
        </div>
    );
}

// =====================================
// MCP Servers Tab
// =====================================
interface McpServersTabProps {
    config: OpenCodeConfig;
    onUpdate: (config: Partial<OpenCodeConfig>) => void;
    isPending: boolean;
}

function McpServersTab({ config, onUpdate, isPending }: McpServersTabProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingName, setEditingName] = useState<string | null>(null);
    const [showPresets, setShowPresets] = useState(false);

    const mcpServers = config?.mcp || {};

    const handleAddPreset = (preset: typeof presetMcpServers[0]) => {
        onUpdate({
            mcp: {
                ...mcpServers,
                [preset.name]: {
                    ...preset.config,
                    enabled: true
                }
            }
        });
        setShowPresets(false);
    };

    const handleSave = (name: string, server: any) => {
        onUpdate({
            mcp: {
                ...mcpServers,
                [name]: server
            }
        });
        setIsAdding(false);
        setEditingName(null);
    };

    const handleDelete = (name: string) => {
        const newServers = { ...mcpServers };
        delete newServers[name];
        onUpdate({ mcp: newServers });
    };

    const handleToggle = (name: string) => {
        const server = mcpServers[name];
        onUpdate({
            mcp: {
                ...mcpServers,
                [name]: {
                    ...server,
                    enabled: !server.enabled
                }
            }
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                    MCP servers extend agent capabilities with external tools and data sources.
                </p>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowPresets(!showPresets)}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition-all"
                        >
                            <Sparkles size={16} className="text-amber-400" />
                            Quick Add
                            <ChevronDown size={14} className={clsx("transition-transform", showPresets && "rotate-180")} />
                        </button>
                        {showPresets && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                <div className="p-2 border-b border-zinc-800">
                                    <p className="text-xs text-zinc-500 px-2">Popular MCP Servers</p>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {presetMcpServers.map((preset) => (
                                        <button
                                            key={preset.name}
                                            onClick={() => handleAddPreset(preset)}
                                            disabled={!!mcpServers[preset.name]}
                                            className="w-full px-3 py-2.5 text-left hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                        >
                                            <div className="font-medium text-sm text-zinc-200">{preset.name}</div>
                                            <div className="text-xs text-zinc-500">{preset.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Plus size={16} />
                        Add Custom
                    </button>
                </div>
            </div>

            {Object.keys(mcpServers).length === 0 && !isAdding ? (
                <div className="py-12 text-center text-zinc-600">
                    <Plug size={40} className="mx-auto mb-3 opacity-50" />
                    <p>No MCP servers configured</p>
                    <p className="text-xs mt-1">Add servers like Context7, Filesystem, or GitHub</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {Object.entries(mcpServers).map(([name, server]) => (
                        editingName === name ? (
                            <McpServerForm
                                key={name}
                                initialName={name}
                                initialData={server}
                                onSave={handleSave}
                                onCancel={() => setEditingName(null)}
                            />
                        ) : (
                            <div
                                key={name}
                                className={clsx(
                                    "flex items-center justify-between p-4 bg-zinc-950 border rounded-xl transition-all group",
                                    server.enabled ? "border-zinc-800 hover:border-zinc-700" : "border-zinc-900 opacity-60"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        "w-10 h-10 rounded-lg flex items-center justify-center",
                                        server.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-600"
                                    )}>
                                        <Plug size={18} />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-zinc-200">{name}</h4>
                                        <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate max-w-[300px]">
                                            {(server as any).command || (server as any).url || 'configured'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggle(name)}
                                        className={clsx(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                            server.enabled ? "bg-emerald-600" : "bg-zinc-700"
                                        )}
                                    >
                                        <span
                                            className={clsx(
                                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                server.enabled ? "translate-x-6" : "translate-x-1"
                                            )}
                                        />
                                    </button>
                                    <button
                                        onClick={() => setEditingName(name)}
                                        className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(name)}
                                        disabled={isPending}
                                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        )
                    ))}

                    {isAdding && (
                        <McpServerForm
                            onSave={handleSave}
                            onCancel={() => setIsAdding(false)}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

// =====================================
// MCP Server Form
// =====================================
interface McpServerFormProps {
    initialName?: string;
    initialData?: any;
    onSave: (name: string, server: any) => void;
    onCancel: () => void;
}

function McpServerForm({ initialName, initialData, onSave, onCancel }: McpServerFormProps) {
    const [name, setName] = useState(initialName || '');
    const [command, setCommand] = useState(initialData?.command || '');
    const [args, setArgs] = useState(initialData?.args?.join(' ') || '');
    const [url, setUrl] = useState(initialData?.url || '');
    const [mode, setMode] = useState<'command' | 'sse'>(initialData?.url ? 'sse' : 'command');

    const handleSubmit = () => {
        if (!name.trim()) return;
        const server: any = { enabled: true };
        if (mode === 'command') {
            server.command = command.trim();
            server.args = args.split(' ').filter((a: string) => a.trim());
        } else {
            server.url = url.trim();
        }
        onSave(name.trim(), server);
    };

    return (
        <div className="p-4 bg-zinc-950 border border-indigo-500/30 rounded-xl space-y-4">
            <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Server Name</label>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., github, postgres"
                    disabled={!!initialName}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
                />
            </div>

            <div className="flex gap-4 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                <button
                    onClick={() => setMode('command')}
                    className={clsx(
                        "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                        mode === 'command' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    Standard (Command)
                </button>
                <button
                    onClick={() => setMode('sse')}
                    className={clsx(
                        "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                        mode === 'sse' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    Remote (SSE)
                </button>
            </div>

            {mode === 'command' ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1.5">Command</label>
                        <input
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            placeholder="npx, python3, etc."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1.5">Arguments (Space separated)</label>
                        <input
                            value={args}
                            onChange={(e) => setArgs(e.target.value)}
                            placeholder="-y @modelcontextprotocol/server-github"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                    </div>
                </div>
            ) : (
                <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">SSE URL</label>
                    <input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="http://localhost:3001/sse"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!name.trim() || (mode === 'command' ? !command.trim() : !url.trim())}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
                >
                    <Check size={16} />
                    Save
                </button>
            </div>
        </div>
    );
}

// =====================================
// Agents Tab
// =====================================
interface AgentsTabProps {
    config: OpenCodeConfig;
    onUpdate: (config: Partial<OpenCodeConfig>) => void;
    isPending: boolean;
}

function AgentsTab({ config, onUpdate }: AgentsTabProps) {
    const agents = config?.agent || {};

    const handleUpdateAgent = (name: string, updates: Partial<AgentConfig>) => {
        onUpdate({
            agent: {
                ...agents,
                [name]: {
                    ...agents[name],
                    ...updates
                }
            }
        });
    };

    // Ensure default 'general' agent exists
    const defaultAgent: Omit<AgentConfig, 'name'> = { mode: 'primary', temperature: 0.7, maxSteps: 50, permission: {} };
    const agentList: [string, Omit<AgentConfig, 'name'>][] = Object.keys(agents).length > 0
        ? Object.entries(agents)
        : [['general', defaultAgent]];

    return (
        <div className="space-y-4">
            <p className="text-sm text-zinc-500">
                Configure agent behavior, permissions, and default parameters.
            </p>

            <div className="space-y-4">
                {agentList.map(([name, agent]) => (
                    <div key={name} className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                                    <Bot size={20} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-zinc-200">{name}</h4>
                                    <p className="text-xs text-zinc-500">Agent configuration</p>
                                </div>
                            </div>
                            <span className={clsx(
                                "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full",
                                agent.mode === 'primary'
                                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                    : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                            )}>
                                {agent.mode || 'primary'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1.5">Temperature</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={agent.temperature ?? 0.7}
                                    onChange={(e) => handleUpdateAgent(name, { temperature: parseFloat(e.target.value) })}
                                    className="w-full accent-indigo-500"
                                />
                                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                    <span>Precise (0)</span>
                                    <span className="font-medium text-zinc-400">{agent.temperature ?? 0.7}</span>
                                    <span>Creative (2)</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1.5">Max Steps</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={agent.maxSteps ?? 50}
                                    onChange={(e) => handleUpdateAgent(name, { maxSteps: parseInt(e.target.value) || 50 })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                />
                            </div>
                        </div>

                        <div className="pt-3 border-t border-zinc-800">
                            <label className="block text-xs text-zinc-500 mb-2">Permissions</label>
                            <div className="flex gap-4">
                                {(['edit', 'bash', 'webfetch'] as const).map((perm) => {
                                    const isAllowed = agent.permission?.[perm] === 'allow';
                                    return (
                                        <label key={perm} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isAllowed}
                                                onChange={(e) => handleUpdateAgent(name, {
                                                    permission: {
                                                        ...agent.permission,
                                                        [perm]: e.target.checked ? 'allow' : 'ask'
                                                    }
                                                })}
                                                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-zinc-900"
                                            />
                                            <span className="text-sm text-zinc-400 capitalize">{perm}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-2">
                                Checked = auto-approve, Unchecked = ask for confirmation
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
