/**
 * Presets Manager - FEAT-PREPOPULATE
 * Pre-configured agent, model, and MCP server configurations
 * Inspired by Oh My OpenCode (code-yeongyu/oh-my-opencode)
 * 
 * These presets enable rapid onboarding by providing curated, working configurations.
 */

export interface StarterPack {
    id: string;
    name: string;
    description: string;
    icon: string;
    tags: string[];
    opencode: OpencodePreset;
    omo: OmoPreset;
}

export interface OpencodePreset {
    provider: Record<string, ProviderConfig>;
    models: Record<string, ModelConfig>;
    mcp: Record<string, McpServerConfig>;
    agent?: Record<string, AgentConfig>;
}

export interface OmoPreset {
    agents?: Record<string, OmoAgentConfig>;
    categories?: Record<string, CategoryConfig>;
    skills?: Record<string, boolean | SkillConfig>;
    disabled_agents?: string[];
    disabled_hooks?: string[];
    disabled_mcps?: string[];
    experimental?: ExperimentalConfig;
    background_task?: BackgroundTaskConfig;
}

// Config types
interface ProviderConfig {
    name: string;
    // sdk: removed as not in schema
    options: {
        apiKey?: string;
        baseURL?: string;
    };
    enabled: boolean;
}

interface ModelConfig {
    name: string;
    provider: string;
    model: string;
    options?: {
        temperature?: number;
        maxTokens?: number;
        thinking?: {
            type: 'enabled' | 'disabled';
            budgetTokens?: number;
        };
        reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
    };
    enabled: boolean;
}

interface McpServerConfig {
    type?: 'local' | 'remote';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    enabled: boolean;
    timeout?: number;
}

interface AgentConfig {
    disabled?: boolean;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

interface OmoAgentConfig {
    model?: string;
    variant?: string;
    category?: string;
    temperature?: number;
    skills?: string[];
    disable?: boolean;
    thinking?: {
        type: 'enabled' | 'disabled';
        budgetTokens?: number;
    };
    reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
    description?: string;
}

interface CategoryConfig {
    description?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    thinking?: {
        type: 'enabled' | 'disabled';
        budgetTokens?: number;
    };
    reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
}

interface SkillConfig {
    description?: string;
    template?: string;
    disable?: boolean;
}

interface ExperimentalConfig {
    aggressive_truncation?: boolean;
    auto_resume?: boolean;
    preemptive_compaction?: boolean;
    truncate_all_tool_outputs?: boolean;
}

interface BackgroundTaskConfig {
    defaultConcurrency?: number;
    providerConcurrency?: Record<string, number>;
    modelConcurrency?: Record<string, number>;
    staleTimeoutMs?: number;
}

// ============================================================================
// STARTER PACKS
// ============================================================================

export const STARTER_PACKS: StarterPack[] = [
    {
        id: 'quick-start-anthropic',
        name: 'Quick Start (Anthropic)',
        description: 'Get started fast with Claude models. Ideal for most coding tasks.',
        icon: '🚀',
        tags: ['beginner', 'claude', 'recommended'],
        opencode: {
            provider: {
                anthropic: {
                    name: 'Anthropic',
                    options: { apiKey: '${ANTHROPIC_API_KEY}' },
                    enabled: true
                }
            },
            models: {
                'claude-4-opus': {
                    name: 'Claude 4 Opus',
                    provider: 'anthropic',
                    model: 'claude-sonnet-4-20250514',
                    options: { temperature: 0.7 },
                    enabled: true
                },
                'claude-3.5-sonnet': {
                    name: 'Claude 3.5 Sonnet',
                    provider: 'anthropic',
                    model: 'claude-3-5-sonnet-20241022',
                    options: { temperature: 0.7 },
                    enabled: true
                }
            },
            mcp: {
                context7: {
                    type: 'local',
                    command: 'npx',
                    args: ['-y', '@upstash/context7-mcp@latest'],
                    enabled: true
                }
            }
        },
        omo: {
            agents: {
                'sisyphus-junior': { category: 'quick' },
                prometheus: { category: 'deep' }
            },
            categories: {
                quick: { model: 'claude-3.5-sonnet', temperature: 0.5 },
                deep: { model: 'claude-4-opus', temperature: 0.3 }
            }
        }
    },
    {
        id: 'quick-start-openai',
        name: 'Quick Start (OpenAI)',
        description: 'Get started with OpenAI GPT models. Great for coding and reasoning.',
        icon: '🧠',
        tags: ['beginner', 'openai'],
        opencode: {
            provider: {
                openai: {
                    name: 'OpenAI',
                    options: { apiKey: '${OPENAI_API_KEY}' },
                    enabled: true
                }
            },
            models: {
                'gpt-4.1': {
                    name: 'GPT 4.1',
                    provider: 'openai',
                    model: 'gpt-4.1',
                    options: { temperature: 0.7 },
                    enabled: true
                },
                'o3-mini': {
                    name: 'o3-mini (Reasoning)',
                    provider: 'openai',
                    model: 'o3-mini',
                    options: { reasoningEffort: 'medium' },
                    enabled: true
                }
            },
            mcp: {
                context7: {
                    command: 'npx',
                    args: ['-y', '@upstash/context7-mcp@latest'],
                    enabled: true
                }
            }
        },
        omo: {
            agents: {
                'sisyphus-junior': { category: 'quick' },
                oracle: { category: 'deep' }
            },
            categories: {
                quick: { model: 'gpt-4.1', temperature: 0.5 },
                deep: { model: 'o3-mini', reasoningEffort: 'medium' }
            }
        }
    },
    {
        id: 'multi-provider',
        name: 'Multi-Provider Pro',
        description: 'Full power setup with Anthropic, OpenAI, and Google. Choose the best model for each task.',
        icon: '⚡',
        tags: ['advanced', 'multi-provider', 'recommended'],
        opencode: {
            provider: {
                anthropic: {
                    name: 'Anthropic',
                    options: { apiKey: '${ANTHROPIC_API_KEY}' },
                    enabled: true
                },
                openai: {
                    name: 'OpenAI',
                    options: { apiKey: '${OPENAI_API_KEY}' },
                    enabled: true
                },
                google: {
                    name: 'Google',
                    options: { apiKey: '${GOOGLE_API_KEY}' },
                    enabled: true
                }
            },
            models: {
                'claude-4-opus': {
                    name: 'Claude 4 Opus',
                    provider: 'anthropic',
                    model: 'claude-sonnet-4-20250514',
                    options: { temperature: 0.7 },
                    enabled: true
                },
                'gpt-4.1': {
                    name: 'GPT 4.1',
                    provider: 'openai',
                    model: 'gpt-4.1',
                    options: { temperature: 0.7 },
                    enabled: true
                },
                'gemini-2.5-pro': {
                    name: 'Gemini 2.5 Pro',
                    provider: 'google',
                    model: 'gemini-2.5-pro-preview-05-06',
                    options: { temperature: 0.7 },
                    enabled: true
                },
                'o3': {
                    name: 'o3 (Reasoning)',
                    provider: 'openai',
                    model: 'o3',
                    options: { reasoningEffort: 'high' },
                    enabled: true
                }
            },
            mcp: {
                context7: {
                    type: 'local',
                    command: 'npx',
                    args: ['-y', '@upstash/context7-mcp@latest'],
                    enabled: true
                },
                filesystem: {
                    type: 'local',
                    command: 'npx',
                    args: ['-y', '@anthropics/mcp-server-filesystem'],
                    enabled: true
                }
            }
        },
        omo: {
            agents: {
                sisyphus: { category: 'ultrabrain' },
                'sisyphus-junior': { category: 'quick' },
                prometheus: { category: 'deep' },
                oracle: { category: 'deep' },
                librarian: { category: 'quick' },
                explore: { category: 'quick' }
            },
            categories: {
                quick: {
                    description: 'Fast tasks like search and simple edits',
                    model: 'gemini-2.5-pro',
                    temperature: 0.5
                },
                deep: {
                    description: 'Complex reasoning and architecture',
                    model: 'o3',
                    reasoningEffort: 'high'
                },
                ultrabrain: {
                    description: 'Full power for critical tasks',
                    model: 'claude-4-opus',
                    temperature: 0.3,
                    thinking: { type: 'enabled', budgetTokens: 16000 }
                },
                visual: {
                    description: 'Frontend and UI/UX tasks',
                    model: 'claude-4-opus',
                    temperature: 0.7
                }
            },
            skills: {
                'playwright': true,
                'git-master': true
            },
            background_task: {
                defaultConcurrency: 2,
                providerConcurrency: {
                    anthropic: 3,
                    openai: 3,
                    google: 2
                }
            }
        }
    },
    {
        id: 'sisyphus-workflow',
        name: 'Sisyphus Workflow',
        description: 'Oh My OpenCode enhanced workflow with Sisyphus agents. Autonomous task orchestration.',
        icon: '🏛️',
        tags: ['advanced', 'autonomous', 'oh-my-opencode'],
        opencode: {
            provider: {
                anthropic: {
                    name: 'Anthropic',
                    options: { apiKey: '${ANTHROPIC_API_KEY}' },
                    enabled: true
                }
            },
            models: {
                'claude-4-opus': {
                    name: 'Claude 4 Opus',
                    provider: 'anthropic',
                    model: 'claude-sonnet-4-20250514',
                    options: {
                        temperature: 0.3,
                        thinking: { type: 'enabled', budgetTokens: 16000 }
                    },
                    enabled: true
                },
                'claude-3.5-sonnet': {
                    name: 'Claude 3.5 Sonnet',
                    provider: 'anthropic',
                    model: 'claude-3-5-sonnet-20241022',
                    options: { temperature: 0.5 },
                    enabled: true
                },
                'claude-3.5-haiku': {
                    name: 'Claude 3.5 Haiku',
                    provider: 'anthropic',
                    model: 'claude-3-5-haiku-20241022',
                    options: { temperature: 0.7 },
                    enabled: true
                }
            },
            mcp: {
                context7: {
                    command: 'npx',
                    args: ['-y', '@upstash/context7-mcp@latest'],
                    enabled: true
                },
                filesystem: {
                    command: 'npx',
                    args: ['-y', '@anthropics/mcp-server-filesystem'],
                    enabled: true
                }
            },
            agent: {
                build: { disabled: false },
                plan: { disabled: false }
            }
        },
        omo: {
            agents: {
                sisyphus: {
                    category: 'ultrabrain',
                    skills: ['playwright', 'git-master']
                },
                'sisyphus-junior': {
                    category: 'quick',
                    skills: ['git-master']
                },
                prometheus: {
                    category: 'deep',
                    description: 'Planner agent for task breakdown'
                },
                metis: {
                    category: 'deep',
                    description: 'Plan consultant for refining task plans'
                },
                oracle: {
                    category: 'deep',
                    description: 'Architecture and debugging specialist'
                },
                librarian: {
                    category: 'quick',
                    description: 'Documentation and code search'
                },
                explore: {
                    category: 'quick',
                    description: 'Fast codebase grep'
                },
                'multimodal-looker': {
                    category: 'visual',
                    description: 'Visual inspection agent'
                }
            },
            categories: {
                quick: {
                    description: 'Fast, simple tasks',
                    model: 'claude-3.5-haiku',
                    temperature: 0.7
                },
                deep: {
                    description: 'Complex reasoning',
                    model: 'claude-3.5-sonnet',
                    temperature: 0.3,
                    thinking: { type: 'enabled', budgetTokens: 8000 }
                },
                ultrabrain: {
                    description: 'Critical orchestration',
                    model: 'claude-4-opus',
                    temperature: 0.2,
                    thinking: { type: 'enabled', budgetTokens: 16000 }
                },
                visual: {
                    description: 'UI/UX and frontend',
                    model: 'claude-3.5-sonnet',
                    temperature: 0.7
                }
            },
            skills: {
                'playwright': true,
                'git-master': true,
                'frontend-ui-ux': true
            },
            background_task: {
                defaultConcurrency: 3,
                staleTimeoutMs: 180000
            },
            experimental: {
                aggressive_truncation: true,
                preemptive_compaction: true
            }
        }
    },
    {
        id: 'local-llm',
        name: 'Local LLM (Ollama)',
        description: 'Use locally-hosted models with Ollama. Private and offline-capable.',
        icon: '🏠',
        tags: ['privacy', 'local', 'ollama'],
        opencode: {
            provider: {
                ollama: {
                    name: 'Ollama (Local)',
                    options: {
                        apiKey: 'ollama',
                        baseURL: 'http://localhost:11434'
                    },
                    enabled: true
                }
            },
            models: {
                'llama3.3-70b': {
                    name: 'Llama 3.3 70B',
                    provider: 'ollama',
                    model: 'llama3.3:70b',
                    options: { temperature: 0.7 },
                    enabled: true
                },
                'codestral': {
                    name: 'Codestral',
                    provider: 'ollama',
                    model: 'codestral:latest',
                    options: { temperature: 0.5 },
                    enabled: true
                },
                'deepseek-r1': {
                    name: 'DeepSeek R1',
                    provider: 'ollama',
                    model: 'deepseek-r1:70b',
                    options: { temperature: 0.3 },
                    enabled: true
                }
            },
            mcp: {
                filesystem: {
                    type: 'local',
                    command: 'npx',
                    args: ['-y', '@anthropics/mcp-server-filesystem'],
                    enabled: true
                }
            }
        },
        omo: {
            agents: {
                'sisyphus-junior': { model: 'llama3.3-70b' },
                explore: { model: 'codestral' }
            },
            disabled_mcps: ['websearch'],
            background_task: {
                defaultConcurrency: 1
            }
        }
    },
    {
        id: 'minimal',
        name: 'Minimal Setup',
        description: 'Bare minimum configuration. Add only what you need.',
        icon: '✨',
        tags: ['beginner', 'minimal'],
        opencode: {
            provider: {},
            models: {},
            mcp: {}
        },
        omo: {}
    }
];

// ============================================================================
// PRESETS MANAGER CLASS
// ============================================================================

export class PresetsManager {
    /**
     * Get all available starter packs
     */
    getStarterPacks(): StarterPack[] {
        return STARTER_PACKS;
    }

    /**
     * Get a specific starter pack by ID
     */
    getStarterPack(id: string): StarterPack | undefined {
        return STARTER_PACKS.find(sp => sp.id === id);
    }

    /**
     * Get starter packs by tag
     */
    getStarterPacksByTag(tag: string): StarterPack[] {
        return STARTER_PACKS.filter(sp => sp.tags.includes(tag));
    }

    /**
     * Apply a starter pack to existing configs (merge, don't replace)
     * Returns configs with required properties for OpenCodeConfig and OMOConfig types
     */
    applyStarterPack(
        packId: string,
        existingOpencode: Record<string, any> = {},
        existingOmo: Record<string, any> = {}
    ): { opencode: { agent: Record<string, any>;[key: string]: any }; omo: { agents: Record<string, any>;[key: string]: any } } | null {
        const pack = this.getStarterPack(packId);
        if (!pack) return null;

        // Deep merge helper
        const deepMerge = (target: any, source: any): any => {
            const output = { ...target };
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    output[key] = deepMerge(target[key] || {}, source[key]);
                } else {
                    output[key] = source[key];
                }
            }
            return output;
        };

        const mergedOpencode = deepMerge(existingOpencode, pack.opencode);
        const mergedOmo = deepMerge(existingOmo, pack.omo);

        // Ensure required properties exist
        return {
            opencode: {
                agent: {},
                ...mergedOpencode
            },
            omo: {
                agents: {},
                ...mergedOmo
            }
        };
    }


    /**
     * Get recommended starter pack based on environment
     */
    getRecommended(): StarterPack {
        // Check for API keys in environment to recommend appropriate pack
        const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
        const hasOpenAI = !!process.env.OPENAI_API_KEY;
        const hasGoogle = !!process.env.GOOGLE_API_KEY;

        if (hasAnthropic && hasOpenAI) {
            return this.getStarterPack('multi-provider') || STARTER_PACKS[0]!;
        } else if (hasAnthropic) {
            return this.getStarterPack('quick-start-anthropic') || STARTER_PACKS[0]!;
        } else if (hasOpenAI) {
            return this.getStarterPack('quick-start-openai') || STARTER_PACKS[0]!;
        }

        // Default to Anthropic quickstart
        return STARTER_PACKS[0]!;
    }
}

// Export singleton
export const presetsManager = new PresetsManager();
