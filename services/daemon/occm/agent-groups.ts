import { promises as fs } from 'fs';
import * as path from 'path';


export interface AgentConfig {
    agent_id: string;
    enabled: boolean;
    config?: Record<string, any>; // For OpenCode agents
    provider?: string;            // For OMO agents
    model?: string;               // For OMO agents
    [key: string]: any;
}

export interface GroupAgents {
    opencode: AgentConfig[];
    oh_my_opencode: AgentConfig[];
}

export interface AgentGroup {
    id: string;
    name: string;
    name_en?: string;
    description: string;
    description_en?: string;
    type: 'preset' | 'custom';
    icon: string;
    agents: GroupAgents;
    created_at?: string;
    updated_at?: string;
    statistics?: {
        usage_count: number;
        last_used: string | null;
    };
}

export const PRESETS: AgentGroup[] = [
    {
        id: "preset-minimal",
        name: "Minimal",
        description: "Core agents only, for simple tasks",
        type: "preset",
        icon: "⚡",
        agents: {
            opencode: [{ agent_id: "build", enabled: true, config: {} }],
            oh_my_opencode: [{ agent_id: "sisyphus-junior", enabled: true }],
        },
    },
    {
        id: "preset-standard",
        name: "Standard",
        description: "Balanced agent combination for most tasks",
        type: "preset",
        icon: "⚙️",
        agents: {
            opencode: [
                { agent_id: "build", enabled: true, config: {} },
                { agent_id: "plan", enabled: true, config: {} },
            ],
            oh_my_opencode: [
                { agent_id: "prometheus", enabled: true },
                { agent_id: "sisyphus-junior", enabled: true },
                { agent_id: "oracle", enabled: true },
            ],
        },
    },
    {
        id: "preset-full",
        name: "Common",
        description: "Common agent combination for most complex projects",
        type: "preset",
        icon: "🚀",
        agents: {
            opencode: [
                { agent_id: "build", enabled: true, config: {} },
                { agent_id: "plan", enabled: true, config: {} },
                { agent_id: "explore", enabled: true, config: {} },
                { agent_id: "code-reviewer", enabled: true, config: {} },
            ],
            oh_my_opencode: [
                { agent_id: "prometheus", enabled: true },
                { agent_id: "sisyphus-junior", enabled: true },
                { agent_id: "oracle", enabled: true },
                { agent_id: "librarian", enabled: true },
                { agent_id: "explore", enabled: true },
            ],
        },
    },
    {
        id: "preset-frontend",
        name: "Frontend",
        description: "Optimized for frontend UI/UX development",
        type: "preset",
        icon: "🎨",
        agents: {
            opencode: [
                { agent_id: "build", enabled: true, config: {} },
                { agent_id: "plan", enabled: true, config: {} },
            ],
            oh_my_opencode: [
                { agent_id: "prometheus", enabled: true },
                { agent_id: "sisyphus-junior", enabled: true },
            ],
        },
    },
    {
        id: "preset-backend",
        name: "Backend",
        description: "Optimized for backend API/database development",
        type: "preset",
        icon: "🔧",
        agents: {
            opencode: [
                { agent_id: "build", enabled: true, config: {} },
                { agent_id: "plan", enabled: true, config: {} },
                { agent_id: "explore", enabled: true, config: {} },
            ],
            oh_my_opencode: [
                { agent_id: "prometheus", enabled: true },
                { agent_id: "sisyphus-junior", enabled: true },
                { agent_id: "oracle", enabled: true },
            ],
        },
    }
];

export class AgentGroupManager {
    private groupsFile: string;
    private groupsData: { groups: AgentGroup[] } = { groups: [] };

    constructor(baseDir: string = '.agent-config') {
        this.groupsFile = path.join(baseDir, 'agent-groups.json');
    }

    async loadGroups(): Promise<void> {
        try {
            const content = await fs.readFile(this.groupsFile, 'utf-8');
            this.groupsData = JSON.parse(content);
            if (!this.groupsData.groups) this.groupsData.groups = [];
        } catch (err) {
            // If file doesn't exist, init with empty
            this.groupsData = { groups: [] };
        }
    }

    listGroups(includePresets: boolean = true): AgentGroup[] {
        let allGroups = [...this.groupsData.groups];
        if (includePresets) {
            allGroups = [...allGroups, ...PRESETS]; // Presets are static
        }
        return allGroups;
    }

    async applyGroup(groupId: string, opencodeConfig: any, omoConfig: any): Promise<{ opencode: any; omo: any }> {
        // Find group
        let group = this.groupsData.groups.find(g => g.id === groupId);
        if (!group) {
            group = PRESETS.find(p => p.id === groupId);
        }

        if (!group) {
            throw new Error(`Group ${groupId} not found`);
        }

        // 1. Update OpenCode Agents
        if (!opencodeConfig.agent) opencodeConfig.agent = {};

        const opencodeAgents = group.agents.opencode || [];
        for (const agentCfg of opencodeAgents) {
            const agentId = agentCfg.agent_id;
            if (agentCfg.enabled) {
                // Enable
                if (!opencodeConfig.agent[agentId]) opencodeConfig.agent[agentId] = {};
                opencodeConfig.agent[agentId].disable = false;

                // Merge config
                if (agentCfg.config) {
                    opencodeConfig.agent[agentId] = { ...opencodeConfig.agent[agentId], ...agentCfg.config };
                }
            } else {
                // Disable
                if (opencodeConfig.agent[agentId]) {
                    opencodeConfig.agent[agentId].disable = true;
                }
            }
        }

        // 2. Update OMO Agents
        if (!omoConfig.agents) omoConfig.agents = {};

        const omoAgents = group.agents.oh_my_opencode || [];
        for (const agentCfg of omoAgents) {
            const agentId = agentCfg.agent_id;
            if (agentCfg.enabled) {
                // Enable/Update
                if (!omoConfig.agents[agentId]) omoConfig.agents[agentId] = {};

                if (agentCfg.provider) omoConfig.agents[agentId].provider = agentCfg.provider;
                if (agentCfg.model) omoConfig.agents[agentId].model = agentCfg.model;
            } else {
                // Disable = Remove from OMO config (as per Python logic lines 776-778)
                delete omoConfig.agents[agentId];
            }
        }

        // 3. Update Stats (Custom Only)
        if (group.type === 'custom') {
            await this.updateUsageStats(groupId);
        }

        return { opencode: opencodeConfig, omo: omoConfig };
    }

    private async updateUsageStats(groupId: string): Promise<void> {
        const group = this.groupsData.groups.find(g => g.id === groupId);
        if (group) {
            if (!group.statistics) group.statistics = { usage_count: 0, last_used: null };
            group.statistics.usage_count++;
            group.statistics.last_used = new Date().toISOString();
            await this.saveGroups();
        }
    }

    async addOrUpdateGroup(group: AgentGroup): Promise<void> {
        await this.loadGroups();
        const existingIndex = this.groupsData.groups.findIndex(g => g.id === group.id);
        if (existingIndex !== -1) {
            this.groupsData.groups[existingIndex] = { ...this.groupsData.groups[existingIndex], ...group, updated_at: new Date().toISOString() };
        } else {
            this.groupsData.groups.push({ ...group, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        }
        await this.saveGroups();
    }

    async deleteGroup(id: string): Promise<boolean> {
        await this.loadGroups();
        const initialLen = this.groupsData.groups.length;
        this.groupsData.groups = this.groupsData.groups.filter(g => g.id !== id);
        if (this.groupsData.groups.length < initialLen) {
            await this.saveGroups();
            return true;
        }
        return false;
    }

    private async saveGroups(): Promise<void> {
        await fs.mkdir(path.dirname(this.groupsFile), { recursive: true });
        await fs.writeFile(this.groupsFile, JSON.stringify(this.groupsData, null, 2), 'utf-8');
    }
}
