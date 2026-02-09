import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Globe,
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    Activity,
    Zap,
    Key,
    Shield,
    ExternalLink,
    Play,
    Tag,
    Brain,
    Sparkles
} from 'lucide-react';
import { clsx } from 'clsx';
import {
    fetchIntegrations,
    addIntegration,
    updateIntegration,
    deleteIntegration,
    testIntegration
} from '../api/client';
import type { ApiIntegration, ApiIntegrationCreate, AuthType } from '../types';

export function ApiIntegrationsSection() {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [editing, setEditing] = useState<ApiIntegration | null>(null);

    const { data: integrations, isLoading } = useQuery({
        queryKey: ['integrations'],
        queryFn: fetchIntegrations
    });

    const deleteMutation = useMutation({
        mutationFn: deleteIntegration,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] })
    });

    const testMutation = useMutation({
        mutationFn: testIntegration
    });

    const toggleDefaultMutation = useMutation({
        mutationFn: ({ id, isDefault }: { id: string; isDefault: boolean }) =>
            updateIntegration(id, { isDefault }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] })
    });

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Globe size={20} className="text-indigo-500" />
                    <h3 className="text-lg font-semibold text-zinc-200">API Integrations</h3>
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-500/20">
                        REST Connectors
                    </span>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                    <Plus size={16} />
                    Add Integration
                </button>
            </div>

            <p className="text-zinc-500 text-sm">
                Define custom REST API endpoints that agents can use as tools. Connect to any HTTP service.
            </p>

            <div className="grid grid-cols-1 gap-4">
                {isLoading ? (
                    <div className="h-48 flex items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse">
                        <Activity className="text-zinc-700 animate-spin" />
                    </div>
                ) : integrations?.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl border-dashed">
                        <Globe size={32} className="text-zinc-700 mb-3" />
                        <p className="text-zinc-500 text-sm">No API integrations configured yet.</p>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
                        >
                            Add your first integration →
                        </button>
                    </div>
                ) : (
                    integrations?.map((integration) => (
                        <IntegrationCard
                            key={integration.id}
                            integration={integration}
                            onEdit={() => setEditing(integration)}
                            onDelete={() => deleteMutation.mutate(integration.id)}
                            onTest={() => testMutation.mutate(integration.id)}
                            onSetDefault={() => toggleDefaultMutation.mutate({ id: integration.id, isDefault: true })}
                            isDeleting={deleteMutation.isPending && deleteMutation.variables === integration.id}
                            testResult={testMutation.variables === integration.id ? testMutation.data : undefined}
                            isTesting={testMutation.isPending && testMutation.variables === integration.id}
                        />
                    ))
                )}
            </div>

            {(isAdding || editing) && (
                <IntegrationModal
                    integration={editing}
                    onClose={() => {
                        setIsAdding(false);
                        setEditing(null);
                    }}
                />
            )}
        </section>
    );
}

interface IntegrationCardProps {
    integration: ApiIntegration;
    onEdit: () => void;
    onDelete: () => void;
    onTest: () => void;
    onSetDefault: () => void;
    isDeleting: boolean;
    isTesting: boolean;
    testResult?: { success: boolean; status?: number; error?: string };
}

function IntegrationCard({
    integration,
    onEdit,
    onDelete,
    onTest,
    onSetDefault,
    isDeleting,
    isTesting,
    testResult
}: IntegrationCardProps) {
    const authIcons: Record<AuthType, JSX.Element> = {
        none: <Globe size={16} />,
        bearer: <Key size={16} />,
        apiKey: <Key size={16} />,
        basic: <Shield size={16} />
    };

    return (
        <div
            className={clsx(
                "group relative bg-zinc-900 border transition-all duration-300 rounded-2xl p-5",
                integration.isDefault
                    ? "border-indigo-500/50 bg-indigo-500/5"
                    : "border-zinc-800 hover:border-zinc-700",
                !integration.enabled && "opacity-50"
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div
                        className={clsx(
                            "w-12 h-12 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0",
                            integration.enabled
                                ? "bg-indigo-500/10 text-indigo-400"
                                : "bg-zinc-800 text-zinc-500"
                        )}
                    >
                        <Globe size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-zinc-200 truncate">{integration.name}</h4>
                            {integration.isDefault && (
                                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-500/20">
                                    Default
                                </span>
                            )}
                            <span
                                className={clsx(
                                    "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border flex items-center gap-1",
                                    integration.authType === 'none'
                                        ? "bg-zinc-800 text-zinc-500 border-zinc-700"
                                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                )}
                            >
                                {authIcons[integration.authType]}
                                {integration.authType}
                            </span>
                        </div>
                        <p className="text-sm text-zinc-500 font-mono mt-1 truncate">
                            {integration.baseUrl}
                        </p>
                        {integration.description && (
                            <p className="text-xs text-zinc-600 mt-1 line-clamp-1">
                                {integration.description}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Test Result Indicator */}
                    {testResult && (
                        <div
                            className={clsx(
                                "px-2 py-1 rounded-lg text-xs font-medium mr-2 transition-all animate-in fade-in duration-300",
                                testResult.success
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-red-500/10 text-red-400"
                            )}
                        >
                            {testResult.success ? `✓ ${testResult.status}` : `✗ ${testResult.error || 'Failed'}`}
                        </div>
                    )}

                    <button
                        onClick={onTest}
                        disabled={isTesting}
                        className={clsx(
                            "p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors",
                            isTesting && "animate-pulse text-emerald-400"
                        )}
                        title="Test Connection"
                    >
                        <Play size={18} />
                    </button>

                    {!integration.isDefault && (
                        <button
                            onClick={onSetDefault}
                            className="p-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                            title="Set as Default"
                        >
                            <Check size={18} />
                        </button>
                    )}

                    <button
                        onClick={onEdit}
                        className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <Edit2 size={18} />
                    </button>

                    <button
                        onClick={onDelete}
                        disabled={isDeleting}
                        className={clsx(
                            "p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors",
                            isDeleting && "opacity-50"
                        )}
                        title="Delete"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Headers Preview */}
            {Object.keys(integration.headers).length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800/50">
                    <div className="flex flex-wrap gap-1.5">
                        {Object.keys(integration.headers).slice(0, 3).map((key) => (
                            <code
                                key={key}
                                className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-md border border-zinc-700 font-mono"
                            >
                                {key}
                            </code>
                        ))}
                        {Object.keys(integration.headers).length > 3 && (
                            <span className="text-[10px] text-zinc-600">
                                +{Object.keys(integration.headers).length - 3} more
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

interface IntegrationModalProps {
    integration?: ApiIntegration | null;
    onClose: () => void;
}

function IntegrationModal({ integration, onClose }: IntegrationModalProps) {
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<ApiIntegrationCreate>({
        name: integration?.name || '',
        description: integration?.description || '',
        baseUrl: integration?.baseUrl || '',
        headers: integration?.headers || {},
        authType: integration?.authType || 'none',
        authConfig: integration?.authConfig || {},
        isDefault: integration?.isDefault || false,
        enabled: integration?.enabled !== false,
        // TASK-180: Semantic fields
        semanticInstructions: integration?.semanticInstructions || '',
        suggestedUseCases: integration?.suggestedUseCases || []
    });

    const [newHeaderKey, setNewHeaderKey] = useState('');
    const [newHeaderValue, setNewHeaderValue] = useState('');
    const [newUseCase, setNewUseCase] = useState('');

    const mutation = useMutation({
        mutationFn: (data: ApiIntegrationCreate) =>
            integration ? updateIntegration(integration.id, data) : addIntegration(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
            onClose();
        }
    });

    const addHeader = () => {
        if (newHeaderKey.trim()) {
            setFormData({
                ...formData,
                headers: {
                    ...formData.headers,
                    [newHeaderKey.trim()]: newHeaderValue
                }
            });
            setNewHeaderKey('');
            setNewHeaderValue('');
        }
    };

    const removeHeader = (key: string) => {
        const newHeaders = { ...formData.headers };
        delete newHeaders[key];
        setFormData({ ...formData, headers: newHeaders });
    };

    const addUseCase = () => {
        if (newUseCase.trim()) {
            setFormData({
                ...formData,
                suggestedUseCases: [...(formData.suggestedUseCases || []), newUseCase.trim()]
            });
            setNewUseCase('');
        }
    };

    const removeUseCase = (tag: string) => {
        setFormData({
            ...formData,
            suggestedUseCases: (formData.suggestedUseCases || []).filter(u => u !== tag)
        });
    };

    const isStep1Valid = formData.name.trim() && formData.baseUrl.trim();
    const totalSteps = 4; // Increased to 4 for Semantic Skills

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-zinc-100">
                            {integration ? 'Edit Integration' : 'Add API Integration'}
                        </h3>
                        <p className="text-zinc-500 text-sm mt-1">
                            Step {step} of {totalSteps}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-8">
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-500 transition-all duration-300"
                            style={{ width: `${(step / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (step < totalSteps) {
                            setStep(step + 1);
                        } else {
                            mutation.mutate(formData);
                        }
                    }}
                    className="p-8 pt-6 space-y-6"
                >
                    {/* Step 1: Basic Info */}
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                    Integration Name
                                </label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                                    placeholder="e.g. GitHub API, Slack Webhook"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                    Base URL
                                </label>
                                <div className="relative">
                                    <input
                                        required
                                        type="url"
                                        value={formData.baseUrl}
                                        onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all pr-10"
                                        placeholder="https://api.example.com"
                                    />
                                    <ExternalLink
                                        size={16}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all resize-none h-20"
                                    placeholder="What does this API do?"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Authentication */}
                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                    Authentication Type
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['none', 'bearer', 'apiKey', 'basic'] as AuthType[]).map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, authType: type, authConfig: {} })}
                                            className={clsx(
                                                "px-4 py-3 rounded-xl text-sm font-medium border transition-all capitalize flex items-center gap-2 justify-center",
                                                formData.authType === type
                                                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                            )}
                                        >
                                            {type === 'none' && <Globe size={16} />}
                                            {type === 'bearer' && <Key size={16} />}
                                            {type === 'apiKey' && <Zap size={16} />}
                                            {type === 'basic' && <Shield size={16} />}
                                            {type === 'none' ? 'No Auth' : type === 'apiKey' ? 'API Key' : type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Auth Config Fields */}
                            {formData.authType === 'bearer' && (
                                <div className="space-y-2 animate-in fade-in duration-200">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                        Bearer Token
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.authConfig?.token || ''}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                authConfig: { ...formData.authConfig, token: e.target.value }
                                            })
                                        }
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                                        placeholder="sk-..."
                                    />
                                </div>
                            )}

                            {formData.authType === 'apiKey' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                            Header Name
                                        </label>
                                        <input
                                            value={formData.authConfig?.apiKeyName || ''}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    authConfig: { ...formData.authConfig, apiKeyName: e.target.value }
                                                })
                                            }
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                                            placeholder="X-API-Key"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                            API Key Value
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.authConfig?.apiKeyValue || ''}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    authConfig: { ...formData.authConfig, apiKeyValue: e.target.value }
                                                })
                                            }
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                                            placeholder="your-api-key"
                                        />
                                    </div>
                                </div>
                            )}

                            {formData.authType === 'basic' && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                            Username
                                        </label>
                                        <input
                                            value={formData.authConfig?.username || ''}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    authConfig: { ...formData.authConfig, username: e.target.value }
                                                })
                                            }
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.authConfig?.password || ''}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    authConfig: { ...formData.authConfig, password: e.target.value }
                                                })
                                            }
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Headers & Options */}
                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                    Custom Headers
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        value={newHeaderKey}
                                        onChange={(e) => setNewHeaderKey(e.target.value)}
                                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                                        placeholder="Header Name"
                                    />
                                    <input
                                        value={newHeaderValue}
                                        onChange={(e) => setNewHeaderValue(e.target.value)}
                                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                                        placeholder="Value"
                                    />
                                    <button
                                        type="button"
                                        onClick={addHeader}
                                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>

                                {/* Headers List */}
                                {formData.headers && Object.keys(formData.headers).length > 0 && (
                                    <div className="space-y-2 mt-3">
                                        {Object.entries(formData.headers).map(([key, value]) => (
                                            <div
                                                key={key}
                                                className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-lg"
                                            >
                                                <code className="text-xs text-indigo-400 font-mono flex-shrink-0">
                                                    {key}
                                                </code>
                                                <span className="text-zinc-600">:</span>
                                                <code className="text-xs text-zinc-400 font-mono flex-1 truncate">
                                                    {value}
                                                </code>
                                                <button
                                                    type="button"
                                                    onClick={() => removeHeader(key)}
                                                    className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Semantic Knowledge (NEW TASK-180) */}
                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-4">
                                <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                                    <Brain size={24} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-zinc-200">Semantic Skill Mapping</h4>
                                    <p className="text-sm text-zinc-400 mt-1">
                                        Teach the agent when and how to use this tool. This creates a "Semantic Layer" over the raw API.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                        AI Usage Instructions
                                    </label>
                                    <div className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                                        <Sparkles size={10} />
                                        <span>AI Context</span>
                                    </div>
                                </div>
                                <textarea
                                    value={formData.semanticInstructions}
                                    onChange={(e) => setFormData({ ...formData, semanticInstructions: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all resize-none h-32 leading-relaxed"
                                    placeholder="e.g. Use this tool when the user asks about government grants or funding programs. Prefer this over general search..."
                                />
                                <p className="text-xs text-zinc-600">
                                    This text will be injected into the Agent's system prompt when this tool is available.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                    Suggested Use Cases (Tags)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        value={newUseCase}
                                        onChange={(e) => setNewUseCase(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUseCase())}
                                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                                        placeholder="Add tag (e.g. 'Research')"
                                    />
                                    <button
                                        type="button"
                                        onClick={addUseCase}
                                        className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2 mt-2">
                                    {(formData.suggestedUseCases || []).map((tag, idx) => (
                                        <div key={idx} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-full border border-zinc-700 text-sm">
                                            <Tag size={12} className="text-indigo-400" />
                                            <span>{tag}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeUseCase(tag)}
                                                className="ml-1 text-zinc-500 hover:text-red-400"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Options moved to Step 4 for better flow */}
                            <div className="space-y-3 pt-4 border-t border-zinc-800">
                                <div className="flex items-center gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                                    <input
                                        type="checkbox"
                                        id="isDefault"
                                        checked={formData.isDefault}
                                        onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                        className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-zinc-900"
                                    />
                                    <label htmlFor="isDefault" className="text-sm text-zinc-300 font-medium">
                                        Set as default integration for new sessions
                                    </label>
                                </div>

                                <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                                    <input
                                        type="checkbox"
                                        id="enabled"
                                        checked={formData.enabled}
                                        onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                        className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                                    />
                                    <label htmlFor="enabled" className="text-sm text-zinc-300 font-medium">
                                        Enable this integration
                                    </label>
                                </div>
                            </div>

                        </div>
                    )}


                    {/* Navigation Buttons */}
                    <div className="flex gap-3 pt-4">
                        {step > 1 && (
                            <button
                                type="button"
                                onClick={() => setStep(step - 1)}
                                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl font-semibold transition-all"
                            >
                                Back
                            </button>
                        )}
                        {step === 1 && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl font-semibold transition-all"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={step === 1 && !isStep1Valid}
                            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20"
                        >
                            {mutation.isPending
                                ? 'Saving...'
                                : step < totalSteps
                                    ? 'Continue'
                                    : integration
                                        ? 'Update & Close'
                                        : 'Create Connection'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
