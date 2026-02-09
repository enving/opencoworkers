import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { occmApi } from '../api/occm';
import {
    Archive,
    RotateCcw,
    Trash2,
    Plus,
    AlertTriangle,
    CheckCircle,
    Download,
    Upload,
    Clock,
    Wrench,
    ExternalLink,
    RefreshCw
} from 'lucide-react';

type TabView = 'backups' | 'validation' | 'import';

export function BackupTab() {
    const [tabView, setTabView] = React.useState<TabView>('backups');

    return (
        <div className="space-y-6">
            {/* Tab Selector */}
            <div className="flex gap-2 border-b border-zinc-800 pb-4">
                <button
                    onClick={() => setTabView('backups')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tabView === 'backups'
                            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    <Archive className="w-4 h-4" />
                    Backups
                </button>
                <button
                    onClick={() => setTabView('validation')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tabView === 'validation'
                            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    <Wrench className="w-4 h-4" />
                    Validation
                </button>
                <button
                    onClick={() => setTabView('import')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tabView === 'import'
                            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    <Upload className="w-4 h-4" />
                    External Import
                </button>
            </div>

            {tabView === 'backups' && <BackupsSection />}
            {tabView === 'validation' && <ValidationSection />}
            {tabView === 'import' && <ExternalImportSection />}
        </div>
    );
}

// ==================== BACKUPS SECTION ====================
function BackupsSection() {
    const queryClient = useQueryClient();
    const [description, setDescription] = React.useState('');

    const { data: backups, isLoading } = useQuery({
        queryKey: ['occm-backups'],
        queryFn: () => occmApi.listBackups()
    });

    const createMutation = useMutation({
        mutationFn: () => occmApi.createBackup(description || undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occm-backups'] });
            setDescription('');
        }
    });

    const restoreMutation = useMutation({
        mutationFn: (id: string) => occmApi.restoreBackup(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occm-config'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => occmApi.deleteBackup(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occm-backups'] });
        }
    });

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Config Backups</h3>
                    <p className="text-sm text-zinc-500">Create and restore configuration backups</p>
                </div>
            </div>

            {/* Create Backup */}
            <div className="flex gap-3">
                <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Backup description (optional)"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
                <button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
                >
                    {createMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4" />
                    )}
                    Create Backup
                </button>
            </div>

            {/* Backup List */}
            <div className="space-y-2">
                {isLoading ? (
                    <div className="animate-pulse space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 bg-zinc-900 rounded-xl" />
                        ))}
                    </div>
                ) : backups?.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                        <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No backups yet. Create one to get started.</p>
                    </div>
                ) : (
                    backups?.map((backup: any) => (
                        <div
                            key={backup.id}
                            className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                    <Archive className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <div className="font-medium text-zinc-200">{backup.description}</div>
                                    <div className="text-xs text-zinc-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(backup.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        if (confirm('Restore this backup? Current config will be replaced.')) {
                                            restoreMutation.mutate(backup.id);
                                        }
                                    }}
                                    disabled={restoreMutation.isPending}
                                    className="p-2 hover:bg-indigo-500/10 rounded-lg text-zinc-400 hover:text-indigo-400 transition-colors"
                                    title="Restore"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('Delete this backup?')) {
                                            deleteMutation.mutate(backup.id);
                                        }
                                    }}
                                    disabled={deleteMutation.isPending}
                                    className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ==================== VALIDATION SECTION ====================
function ValidationSection() {
    const queryClient = useQueryClient();

    const { data: validation, isLoading, refetch } = useQuery({
        queryKey: ['occm-validation'],
        queryFn: () => occmApi.validateConfig()
    });

    const autoFixMutation = useMutation({
        mutationFn: () => occmApi.autoFixConfig(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['occm-validation'] });
            queryClient.invalidateQueries({ queryKey: ['occm-config'] });
        }
    });

    const fixableErrors = validation?.errors?.filter((e: any) => e.fixable) || [];
    const hasFixableErrors = fixableErrors.length > 0;

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Config Validation</h3>
                    <p className="text-sm text-zinc-500">Check and auto-fix configuration issues</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Re-validate
                    </button>
                    {hasFixableErrors && (
                        <button
                            onClick={() => autoFixMutation.mutate()}
                            disabled={autoFixMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
                        >
                            {autoFixMutation.isPending ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Wrench className="w-4 h-4" />
                            )}
                            Auto-Fix ({fixableErrors.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Validation Status */}
            {isLoading ? (
                <div className="h-32 bg-zinc-900 rounded-xl animate-pulse" />
            ) : validation?.valid ? (
                <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <h4 className="text-lg font-semibold text-green-300">All Good!</h4>
                    <p className="text-sm text-green-400/70">Your configuration is valid and properly formatted.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <span className="text-sm text-amber-300">
                            Found {validation?.errors?.length} issue(s) in your configuration
                        </span>
                    </div>

                    {validation?.errors?.map((error: any, idx: number) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${error.fixable ? 'bg-amber-400' : 'bg-red-400'}`} />
                                <div>
                                    <div className="font-mono text-sm text-zinc-300">{error.field}</div>
                                    <div className="text-xs text-zinc-500">{error.message}</div>
                                </div>
                            </div>
                            {error.fixable && (
                                <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                                    Fixable
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==================== EXTERNAL IMPORT SECTION ====================
function ExternalImportSection() {
    const queryClient = useQueryClient();

    const { data: externalConfigs, isLoading, refetch } = useQuery({
        queryKey: ['occm-external-configs'],
        queryFn: () => occmApi.detectExternalConfigs()
    });

    const importMutation = useMutation({
        mutationFn: (source: string) => occmApi.importExternalConfig(source),
        onSuccess: (data) => {
            if (data.success) {
                queryClient.invalidateQueries({ queryKey: ['occm-config'] });
                alert('Successfully imported configuration!');
            } else {
                alert(`Import failed: ${data.error}`);
            }
        }
    });

    const detected = externalConfigs?.filter((c: any) => c.detected) || [];

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">External Config Import</h3>
                    <p className="text-sm text-zinc-500">Import settings from other AI coding tools</p>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-all"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Re-scan
                </button>
            </div>

            {detected.length > 0 && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-green-300">
                        Found {detected.length} external configuration(s) that can be imported
                    </span>
                </div>
            )}

            {isLoading ? (
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {externalConfigs?.map((config: any) => (
                        <div
                            key={config.source}
                            className={`p-4 rounded-xl border transition-all ${config.detected
                                    ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                                    : 'bg-zinc-900/20 border-zinc-800/50 opacity-50'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-zinc-200">{config.name}</h4>
                                {config.detected ? (
                                    <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        Detected
                                    </span>
                                ) : (
                                    <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded">
                                        Not Found
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-500 font-mono truncate mb-3">{config.path}</p>
                            {config.detected && (
                                <button
                                    onClick={() => importMutation.mutate(config.source)}
                                    disabled={importMutation.isPending}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm transition-all"
                                >
                                    {importMutation.isPending ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                    Import
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                <h4 className="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-indigo-400" />
                    Supported External Tools
                </h4>
                <p className="text-xs text-zinc-500">
                    Claude Desktop, Cursor, Windsurf, Codex, Gemini Code Assist, CC-Switch.
                    When importing, MCP server configurations and provider settings will be merged.
                </p>
            </div>
        </div>
    );
}
