import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface DiscoveredSkill {
    name: string;
    description: string;
    path: string;
    source: string;
    license?: string;
    compatibility?: string;
    content: string;
}

export class SkillsManager {
    private static SKILL_PATHS = {
        'opencode-global': path.join(os.homedir(), '.config', 'opencode', 'skills'),
        'claude-global': path.join(os.homedir(), '.claude', 'skills')
    };

    private static getProjectPaths() {
        const cwd = process.cwd();
        return {
            'opencode-project': path.join(cwd, '.opencode', 'skills'),
            'claude-project': path.join(cwd, '.claude', 'skills')
        };
    }

    async discoverAll(): Promise<DiscoveredSkill[]> {
        const skills: DiscoveredSkill[] = [];
        const seenNames = new Set<string>();
        const allPaths = { ...SkillsManager.SKILL_PATHS, ...SkillsManager.getProjectPaths() };

        for (const [source, basePath] of Object.entries(allPaths)) {
            try {
                await fs.access(basePath);
                const dirs = await fs.readdir(basePath, { withFileTypes: true });

                for (const dir of dirs) {
                    if (!dir.isDirectory()) continue;

                    const skillDir = path.join(basePath, dir.name);
                    let skillFile: string | null = null;

                    for (const filename of ['SKILL.md', 'SKILL.txt']) {
                        const potentialFile = path.join(skillDir, filename);
                        try {
                            await fs.access(potentialFile);
                            skillFile = potentialFile;
                            break;
                        } catch { /* ignore */ }
                    }

                    if (!skillFile) continue;

                    const skill = await this.parseSkillFile(skillFile, source);
                    if (skill && !seenNames.has(skill.name)) {
                        skills.push(skill);
                        seenNames.add(skill.name);
                    }
                }
            } catch { /* skip missing paths */ }
        }

        return skills;
    }

    private async parseSkillFile(filePath: string, source: string): Promise<DiscoveredSkill | null> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            let frontmatter: any = {};
            let body = content;

            if (content.startsWith('---')) {
                const parts = content.split('---');
                if (parts.length >= 3) {
                    const yamlLines = (parts[1] || '').trim().split('\n');
                    for (const line of yamlLines) {
                        const colonIndex = line.indexOf(':');
                        if (colonIndex !== -1) {
                            const key = line.slice(0, colonIndex).trim();
                            const value = line.slice(colonIndex + 1).trim().replace(/^['"]|['"]$/g, '');
                            if (key) frontmatter[key] = value;
                        }
                    }
                    body = parts.slice(2).join('---').trim();
                }
            }

            if (!frontmatter.name || !frontmatter.description) return null;

            return {
                name: frontmatter.name,
                description: frontmatter.description,
                path: filePath,
                source,
                license: frontmatter.license,
                compatibility: frontmatter.compatibility,
                content: body
            };
        } catch {
            return null;
        }
    }

    async saveSkill(skill: Omit<DiscoveredSkill, 'path'>, location: string): Promise<string> {
        const allPaths = { ...SkillsManager.SKILL_PATHS, ...SkillsManager.getProjectPaths() };
        const basePath = (allPaths as any)[location];
        if (!basePath) throw new Error('Invalid location');

        const skillDir = path.join(basePath, skill.name);
        const skillFile = path.join(skillDir, 'SKILL.md');

        let fm = `---\nname: ${skill.name}\ndescription: ${skill.description}\n`;
        if (skill.license) fm += `license: ${skill.license}\n`;
        if (skill.compatibility) fm += `compatibility: ${skill.compatibility}\n`;
        fm += '---\n\n';

        const fullContent = fm + skill.content;

        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(skillFile, fullContent, 'utf-8');

        return skillFile;
    }

    async deleteSkill(name: string): Promise<boolean> {
        const skills = await this.discoverAll();
        const skill = skills.find(s => s.name === name);
        if (!skill) return false;

        const skillDir = path.dirname(skill.path);
        await fs.rm(skillDir, { recursive: true, force: true });
        return true;
    }

    // Import skill from GitHub (user/repo or full URL)
    async importFromGithub(source: string, location: string): Promise<{ success: boolean; skill?: DiscoveredSkill; error?: string }> {
        try {
            // Parse source: user/repo or https://github.com/user/repo
            let owner = '';
            let repo = '';
            if (source.includes('github.com')) {
                const match = source.match(/github\.com\/([^\/]+)\/([^\/]+)/);
                if (!match || !match[1] || !match[2]) return { success: false, error: 'Invalid GitHub URL' };
                owner = match[1];
                repo = match[2].replace(/\.git$/, '');
            } else if (source.includes('/')) {
                const parts = source.split('/');
                if (parts.length < 2 || !parts[0] || !parts[1]) return { success: false, error: 'Invalid source format' };
                owner = parts[0];
                repo = parts[1];
            } else {
                return { success: false, error: 'Invalid source format. Use user/repo or GitHub URL' };
            }

            // Download from GitHub API
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
            const response = await fetch(apiUrl, {
                headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'OCCM-Daemon' }
            });

            if (!response.ok) {
                return { success: false, error: `GitHub API error: ${response.status}` };
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Create temp directory and extract
            const tempDir = path.join(os.tmpdir(), `skill-import-${Date.now()}`);
            await fs.mkdir(tempDir, { recursive: true });
            const zipPath = path.join(tempDir, 'repo.zip');
            await fs.writeFile(zipPath, buffer);

            // Use unzip command (cross-platform fallback needed for production)
            const { exec } = await import('child_process').then(m => ({ exec: m.exec }));
            await new Promise<void>((resolve, reject) => {
                exec(`unzip -o "${zipPath}" -d "${tempDir}"`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Find extracted directory
            const entries = await fs.readdir(tempDir, { withFileTypes: true });
            const extractedDir = entries.find(e => e.isDirectory() && e.name.startsWith(`${owner}-${repo}`));
            if (!extractedDir) {
                return { success: false, error: 'Could not find extracted content' };
            }

            const extractedPath = path.join(tempDir, extractedDir.name);

            // Check for SKILL.md
            let skillContent: string | null = null;
            for (const filename of ['SKILL.md', 'SKILL.txt']) {
                try {
                    skillContent = await fs.readFile(path.join(extractedPath, filename), 'utf-8');
                    break;
                } catch { /* continue */ }
            }

            if (!skillContent) {
                await fs.rm(tempDir, { recursive: true, force: true });
                return { success: false, error: 'No SKILL.md found in repository' };
            }

            // Parse skill
            const skill = await this.parseSkillFile(path.join(extractedPath, 'SKILL.md'), 'github');
            if (!skill) {
                await fs.rm(tempDir, { recursive: true, force: true });
                return { success: false, error: 'Invalid SKILL.md format (missing name or description)' };
            }

            // Copy to target location
            const allPaths = { ...SkillsManager.SKILL_PATHS, ...SkillsManager.getProjectPaths() };
            const basePath = (allPaths as any)[location];
            if (!basePath) {
                await fs.rm(tempDir, { recursive: true, force: true });
                return { success: false, error: 'Invalid location' };
            }

            const targetDir = path.join(basePath, repo);
            await fs.mkdir(targetDir, { recursive: true });

            // Copy all files
            const copyRecursive = async (src: string, dest: string) => {
                const srcEntries = await fs.readdir(src, { withFileTypes: true });
                for (const entry of srcEntries) {
                    const srcPath = path.join(src, entry.name);
                    const destPath = path.join(dest, entry.name);
                    if (entry.isDirectory()) {
                        await fs.mkdir(destPath, { recursive: true });
                        await copyRecursive(srcPath, destPath);
                    } else {
                        await fs.copyFile(srcPath, destPath);
                    }
                }
            };
            await copyRecursive(extractedPath, targetDir);

            // Create metadata file
            const meta = {
                source: `github:${owner}/${repo}`,
                installedAt: new Date().toISOString(),
                version: 'latest'
            };
            await fs.writeFile(path.join(targetDir, '.skill-meta.json'), JSON.stringify(meta, null, 2));

            // Cleanup
            await fs.rm(tempDir, { recursive: true, force: true });

            return { success: true, skill: { ...skill, path: path.join(targetDir, 'SKILL.md'), source: location } };
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    }

    // Import skill from local path
    async importFromLocal(sourcePath: string, location: string): Promise<{ success: boolean; skill?: DiscoveredSkill; error?: string }> {
        try {
            // Resolve path
            const resolvedPath = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(process.cwd(), sourcePath);

            // Check if source exists
            const stat = await fs.stat(resolvedPath);
            if (!stat.isDirectory()) {
                return { success: false, error: 'Source path is not a directory' };
            }

            // Check for SKILL.md
            let skillFile: string | null = null;
            for (const filename of ['SKILL.md', 'SKILL.txt']) {
                try {
                    await fs.access(path.join(resolvedPath, filename));
                    skillFile = path.join(resolvedPath, filename);
                    break;
                } catch { /* continue */ }
            }

            if (!skillFile) {
                return { success: false, error: 'No SKILL.md found in source directory' };
            }

            // Parse skill
            const skill = await this.parseSkillFile(skillFile, 'local');
            if (!skill) {
                return { success: false, error: 'Invalid SKILL.md format' };
            }

            // Get target path
            const allPaths = { ...SkillsManager.SKILL_PATHS, ...SkillsManager.getProjectPaths() };
            const basePath = (allPaths as any)[location];
            if (!basePath) return { success: false, error: 'Invalid location' };

            const skillName = path.basename(resolvedPath);
            const targetDir = path.join(basePath, skillName);

            // Copy directory
            await fs.cp(resolvedPath, targetDir, { recursive: true });

            // Create metadata
            const meta = {
                source: `local:${resolvedPath}`,
                installedAt: new Date().toISOString(),
                version: 'local'
            };
            await fs.writeFile(path.join(targetDir, '.skill-meta.json'), JSON.stringify(meta, null, 2));

            return { success: true, skill: { ...skill, path: path.join(targetDir, 'SKILL.md'), source: location } };
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    }

    // Skill Marketplace - curated skills
    getMarketplace(): MarketplaceSkill[] {
        return MARKETPLACE_SKILLS;
    }

    async installMarketplaceSkill(skillId: string, location: string): Promise<{ success: boolean; error?: string }> {
        const skill = MARKETPLACE_SKILLS.find(s => s.id === skillId);
        if (!skill) return { success: false, error: 'Skill not found in marketplace' };

        return this.importFromGithub(skill.github, location);
    }

    // Check for updates
    async checkUpdates(): Promise<Array<{ name: string; hasUpdate: boolean; currentVersion?: string; latestVersion?: string }>> {
        const skills = await this.discoverAll();
        const results: Array<{ name: string; hasUpdate: boolean; currentVersion?: string; latestVersion?: string }> = [];

        for (const skill of skills) {
            try {
                const metaPath = path.join(path.dirname(skill.path), '.skill-meta.json');
                const metaContent = await fs.readFile(metaPath, 'utf-8');
                const meta = JSON.parse(metaContent);

                if (meta.source?.startsWith('github:')) {
                    const [owner, repo] = meta.source.replace('github:', '').split('/');
                    // Check GitHub for latest commit
                    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, {
                        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'OCCM-Daemon' }
                    });
                    if (response.ok) {
                        const commits = await response.json() as Array<{ sha?: string }>;
                        const latestSha = commits[0]?.sha?.substring(0, 7) || 'unknown';
                        const hasUpdate = meta.version !== latestSha && meta.version !== 'latest';
                        results.push({
                            name: skill.name,
                            hasUpdate,
                            currentVersion: meta.version,
                            latestVersion: latestSha
                        });
                        continue;
                    }
                }
                results.push({ name: skill.name, hasUpdate: false, currentVersion: 'local' });
            } catch {
                results.push({ name: skill.name, hasUpdate: false, currentVersion: 'unknown' });
            }
        }

        return results;
    }

    async updateSkill(name: string): Promise<{ success: boolean; error?: string }> {
        const skills = await this.discoverAll();
        const skill = skills.find(s => s.name === name);
        if (!skill) return { success: false, error: 'Skill not found' };

        try {
            const metaPath = path.join(path.dirname(skill.path), '.skill-meta.json');
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            const meta = JSON.parse(metaContent);

            if (!meta.source?.startsWith('github:')) {
                return { success: false, error: 'Skill is not from GitHub' };
            }

            const githubSource = meta.source.replace('github:', '');

            // Delete old and reimport
            await this.deleteSkill(name);
            return this.importFromGithub(githubSource, skill.source);
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    }
}

// Marketplace skills catalog
interface MarketplaceSkill {
    id: string;
    name: string;
    description: string;
    category: string;
    github: string;
    author: string;
    tags: string[];
}

const MARKETPLACE_SKILLS: MarketplaceSkill[] = [
    {
        id: 'git-release',
        name: 'Git Release',
        description: 'Automate git release workflows with semantic versioning',
        category: 'Dev Tools',
        github: 'vercel-labs/git-release',
        author: 'Vercel',
        tags: ['git', 'release', 'automation']
    },
    {
        id: 'code-review',
        name: 'Code Review',
        description: 'AI-powered code review assistance',
        category: 'Code Quality',
        github: 'opencode-skills/code-review',
        author: 'OpenCode',
        tags: ['review', 'quality', 'linting']
    },
    {
        id: 'test-generator',
        name: 'Test Generator',
        description: 'Generate unit tests for your code',
        category: 'Testing',
        github: 'opencode-skills/test-generator',
        author: 'OpenCode',
        tags: ['testing', 'unit', 'automation']
    },
    {
        id: 'api-docs',
        name: 'API Documentation',
        description: 'Generate OpenAPI documentation from code',
        category: 'Documentation',
        github: 'opencode-skills/api-docs',
        author: 'OpenCode',
        tags: ['api', 'docs', 'openapi']
    },
    {
        id: 'security-scan',
        name: 'Security Scanner',
        description: 'Detect security vulnerabilities in code',
        category: 'Security',
        github: 'opencode-skills/security-scan',
        author: 'OpenCode',
        tags: ['security', 'vulnerabilities', 'audit']
    },
    {
        id: 'db-schema',
        name: 'Database Schema',
        description: 'Generate and manage database schemas',
        category: 'Database',
        github: 'opencode-skills/db-schema',
        author: 'OpenCode',
        tags: ['database', 'schema', 'sql']
    },
    {
        id: 'dockerfile-gen',
        name: 'Dockerfile Generator',
        description: 'Generate optimized Dockerfiles for your projects',
        category: 'DevOps',
        github: 'opencode-skills/dockerfile-gen',
        author: 'OpenCode',
        tags: ['docker', 'devops', 'containers']
    },
    {
        id: 'react-components',
        name: 'React Components',
        description: 'Generate React components with best practices',
        category: 'Frontend',
        github: 'opencode-skills/react-components',
        author: 'OpenCode',
        tags: ['react', 'components', 'frontend']
    },
    {
        id: 'typescript-types',
        name: 'TypeScript Types',
        description: 'Generate TypeScript types from JSON/API responses',
        category: 'Dev Tools',
        github: 'opencode-skills/typescript-types',
        author: 'OpenCode',
        tags: ['typescript', 'types', 'generation']
    },
    {
        id: 'readme-gen',
        name: 'README Generator',
        description: 'Generate professional README files',
        category: 'Documentation',
        github: 'opencode-skills/readme-gen',
        author: 'OpenCode',
        tags: ['readme', 'docs', 'markdown']
    },
    {
        id: 'git-commit',
        name: 'Git Commit Helper',
        description: 'Generate conventional commit messages',
        category: 'Dev Tools',
        github: 'opencode-skills/git-commit',
        author: 'OpenCode',
        tags: ['git', 'commits', 'conventional']
    },
    {
        id: 'error-handler',
        name: 'Error Handler',
        description: 'Generate error handling code and patterns',
        category: 'Code Quality',
        github: 'opencode-skills/error-handler',
        author: 'OpenCode',
        tags: ['errors', 'handling', 'patterns']
    }
];
