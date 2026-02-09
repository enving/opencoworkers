const API_BASE = '/api';

// Types
export interface AgentGroup {
    id: string;
    name: string;
    description: string;
    type: 'preset' | 'custom';
    agents: {
        opencode: any[];
        oh_my_opencode: any[];
    };
    icon: string;
}

export interface OccmConfig {
    opencode: any;
    omo: any;
}

// API
export const occmApi = {
    async getConfig(): Promise<OccmConfig> {
        const res = await fetch(`${API_BASE}/occm/config`);
        if (!res.ok) throw new Error('Failed to fetch OCCM config');
        return res.json();
    },

    async saveConfig(opencode: any, omo: any): Promise<void> {
        const res = await fetch(`${API_BASE}/occm/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opencode, omo }),
        });
        if (!res.ok) throw new Error('Failed to save OCCM config');
    },

    async listGroups(): Promise<AgentGroup[]> {
        const res = await fetch(`${API_BASE}/occm/groups`);
        if (!res.ok) throw new Error('Failed to list agent groups');
        const data = await res.json();
        return data.groups;
    },

    async applyGroup(groupId: string): Promise<OccmConfig> {
        const res = await fetch(`${API_BASE}/occm/groups/${groupId}/apply`, {
            method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to apply agent group');
        const data = await res.json();
        return data.configs;
    },

    async saveGroup(group: AgentGroup): Promise<void> {
        const res = await fetch(`${API_BASE}/occm/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(group),
        });
        if (!res.ok) throw new Error('Failed to save agent group');
    },

    async deleteGroup(groupId: string): Promise<void> {
        const res = await fetch(`${API_BASE}/occm/groups/${groupId}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete agent group');
    },

    // Skills
    async listSkills(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/occm/skills`);
        if (!res.ok) throw new Error('Failed to list skills');
        return res.json();
    },

    async saveSkill(skill: any, location: string): Promise<void> {
        const res = await fetch(`${API_BASE}/occm/skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skill, location }),
        });
        if (!res.ok) throw new Error('Failed to save skill');
    },

    async deleteSkill(name: string): Promise<void> {
        const res = await fetch(`${API_BASE}/occm/skills/${name}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete skill');
    },

    // Rules
    async getAgentsMd(isGlobal: boolean = false): Promise<any> {
        const res = await fetch(`${API_BASE}/occm/rules/agents-md?isGlobal=${isGlobal}`);
        if (!res.ok) throw new Error('Failed to get AGENTS.md');
        return res.json();
    },

    async saveAgentsMd(content: string, isGlobal: boolean = false): Promise<void> {
        const res = await fetch(`${API_BASE}/occm/rules/agents-md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, isGlobal }),
        });
        if (!res.ok) throw new Error('Failed to save AGENTS.md');
    },

    async getRuleTemplate(): Promise<string> {
        const res = await fetch(`${API_BASE}/occm/rules/template`);
        if (!res.ok) throw new Error('Failed to get rule template');
        const data = await res.json();
        return data.template;
    },

    // Monitoring
    async ping(url: string): Promise<any> {
        const res = await fetch(`${API_BASE}/occm/monitor/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });
        if (!res.ok) throw new Error('Failed to ping');
        return res.json();
    },

    async listPlugins(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/occm/plugins`);
        if (!res.ok) throw new Error('Failed to list plugins');
        return res.json();
    },

    // Skill Import from GitHub
    async importSkillFromGithub(source: string, location: string): Promise<{ success: boolean; skill?: any; error?: string }> {
        const res = await fetch(`${API_BASE}/occm/skills/import/github`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, location }),
        });
        return res.json();
    },

    // Skill Import from Local Path
    async importSkillFromLocal(path: string, location: string): Promise<{ success: boolean; skill?: any; error?: string }> {
        const res = await fetch(`${API_BASE}/occm/skills/import/local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, location }),
        });
        return res.json();
    },

    // Skill Marketplace
    async getSkillMarketplace(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/occm/skills/marketplace`);
        if (!res.ok) throw new Error('Failed to fetch skill marketplace');
        return res.json();
    },

    async installMarketplaceSkill(skillId: string, location: string): Promise<{ success: boolean; error?: string }> {
        const res = await fetch(`${API_BASE}/occm/skills/marketplace/install`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillId, location }),
        });
        return res.json();
    },

    // Skill Update Check
    async checkSkillUpdates(): Promise<{ skills: Array<{ name: string; hasUpdate: boolean; currentVersion?: string; latestVersion?: string }> }> {
        const res = await fetch(`${API_BASE}/occm/skills/updates`);
        if (!res.ok) throw new Error('Failed to check skill updates');
        return res.json();
    },

    async updateSkill(name: string): Promise<{ success: boolean; error?: string }> {
        const res = await fetch(`${API_BASE}/occm/skills/${name}/update`, {
            method: 'POST',
        });
        return res.json();
    },

    // Config Backup & Restore
    async listBackups(): Promise<Array<{ id: string; timestamp: string; description: string }>> {
        const res = await fetch(`${API_BASE}/occm/backups`);
        if (!res.ok) throw new Error('Failed to list backups');
        return res.json();
    },

    async createBackup(description?: string): Promise<{ success: boolean; backupId: string }> {
        const res = await fetch(`${API_BASE}/occm/backups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description }),
        });
        if (!res.ok) throw new Error('Failed to create backup');
        return res.json();
    },

    async restoreBackup(backupId: string): Promise<{ success: boolean }> {
        const res = await fetch(`${API_BASE}/occm/backups/${backupId}/restore`, {
            method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to restore backup');
        return res.json();
    },

    async deleteBackup(backupId: string): Promise<{ success: boolean }> {
        const res = await fetch(`${API_BASE}/occm/backups/${backupId}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete backup');
        return res.json();
    },

    // Config Validation & Auto-Fix
    async validateConfig(): Promise<{ valid: boolean; errors: Array<{ field: string; message: string; fixable: boolean }> }> {
        const res = await fetch(`${API_BASE}/occm/config/validate`);
        if (!res.ok) throw new Error('Failed to validate config');
        return res.json();
    },

    async autoFixConfig(): Promise<{ success: boolean; fixedIssues: string[] }> {
        const res = await fetch(`${API_BASE}/occm/config/auto-fix`, {
            method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to auto-fix config');
        return res.json();
    },

    // External Config Import (Claude Code, Codex, Gemini, cc-switch)
    async detectExternalConfigs(): Promise<Array<{ source: string; name: string; path: string; detected: boolean }>> {
        const res = await fetch(`${API_BASE}/occm/config/external/detect`);
        if (!res.ok) throw new Error('Failed to detect external configs');
        return res.json();
    },

    async importExternalConfig(source: string): Promise<{ success: boolean; imported: any; error?: string }> {
        const res = await fetch(`${API_BASE}/occm/config/external/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source }),
        });
        return res.json();
    },

    // Config View (Raw JSON)
    async getRawConfig(): Promise<{ opencode: string; omo: string }> {
        const res = await fetch(`${API_BASE}/occm/config/raw`);
        if (!res.ok) throw new Error('Failed to get raw config');
        return res.json();
    },

    // ========== STARTER PACKS (FEAT-PREPOPULATE) ==========

    // List all available starter packs
    async listStarterPacks(): Promise<StarterPack[]> {
        const res = await fetch(`${API_BASE}/occm/presets`);
        if (!res.ok) throw new Error('Failed to list starter packs');
        return res.json();
    },

    // Get a specific starter pack
    async getStarterPack(id: string): Promise<StarterPack> {
        const res = await fetch(`${API_BASE}/occm/presets/${id}`);
        if (!res.ok) throw new Error('Starter pack not found');
        return res.json();
    },

    // Get recommended starter pack
    async getRecommendedStarterPack(): Promise<StarterPack> {
        const res = await fetch(`${API_BASE}/occm/presets/recommended`);
        if (!res.ok) throw new Error('Failed to get recommended starter pack');
        return res.json();
    },

    // Apply a starter pack (merges with existing config)
    async applyStarterPack(id: string): Promise<{ success: boolean; configs: OccmConfig }> {
        const res = await fetch(`${API_BASE}/occm/presets/${id}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error('Failed to apply starter pack');
        return res.json();
    },

    // Preview what applying a starter pack would do
    async previewStarterPack(id: string): Promise<{
        preview: boolean;
        currentConfig: OccmConfig;
        resultConfig: OccmConfig
    }> {
        const res = await fetch(`${API_BASE}/occm/presets/${id}/preview`);
        if (!res.ok) throw new Error('Failed to preview starter pack');
        return res.json();
    }
};

// Starter Pack type
export interface StarterPack {
    id: string;
    name: string;
    description: string;
    icon: string;
    tags: string[];
    opencode: {
        provider: Record<string, any>;
        models: Record<string, any>;
        mcp: Record<string, any>;
        agent?: Record<string, any>;
    };
    omo: {
        agents?: Record<string, any>;
        categories?: Record<string, any>;
        skills?: Record<string, any>;
        disabled_agents?: string[];
        disabled_hooks?: string[];
        disabled_mcps?: string[];
        experimental?: any;
        background_task?: any;
    };
}

