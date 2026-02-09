import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ServerProfile, ServersConfig, ServersConfigSchema } from '../types/servers.js';

export class ServerProfileManager {
  private filePath: string;

  constructor(baseDir: string = '.agent-config/mcp') {
    this.filePath = path.join(baseDir, 'servers.json');
  }

  async load(): Promise<ServersConfig> {
    if (!existsSync(this.filePath)) {
      // Default Profile for new installs (Policy: Local Container first)
      return {
        profiles: [{
          id: 'server-local-01',
          name: 'Local Runtime',
          host: process.env.OPENCODE_SERVER_HOST || 'runtime',
          port: 4096,
          apiKey: process.env.OPENCODE_SERVER_PASSWORD || 'opencode-sandbox',
          type: 'remote-api',
          status: 'unknown',
          isDefault: true,
          addedAt: new Date().toISOString()
        } as ServerProfile]
      };
    }

    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content);
      return ServersConfigSchema.parse(data);
    } catch (err) {
      console.error('[ServerProfileManager] Failed to load servers, returning empty list:', err);
      return { profiles: [] };
    }
  }

  async save(config: ServersConfig): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }
      await fs.writeFile(this.filePath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ServerProfileManager] Failed to save servers:', err);
    }
  }

  async getAllProfiles(): Promise<ServerProfile[]> {
    const config = await this.load();
    return config.profiles;
  }

  async addProfile(profile: Omit<ServerProfile, 'id' | 'status'>): Promise<ServerProfile> {
    const config = await this.load();
    const newId = `server-${Date.now()}`;
    const newProfile: ServerProfile = {
      ...profile,
      id: newId,
      status: 'unknown'
    } as ServerProfile;

    if (newProfile.isDefault || config.profiles.length === 0) {
      newProfile.isDefault = true;
      config.profiles.forEach(p => p.isDefault = false);
    }

    config.profiles.push(newProfile);
    await this.save(config);
    return newProfile;
  }

  async updateProfile(id: string, updates: Partial<ServerProfile>): Promise<ServerProfile | null> {
    const config = await this.load();
    const index = config.profiles.findIndex(p => p.id === id);
    if (index === -1) return null;

    if (updates.isDefault) {
      config.profiles.forEach(p => p.isDefault = false);
    }

    config.profiles[index] = {
      ...config.profiles[index],
      ...updates,
      id
    } as ServerProfile;

    await this.save(config);
    return config.profiles[index];
  }

  async deleteProfile(id: string): Promise<boolean> {
    const config = await this.load();
    const initialLength = config.profiles.length;
    config.profiles = config.profiles.filter(p => p.id !== id);

    if (config.profiles.length !== initialLength) {
      if (!config.profiles.some(p => p.isDefault) && config.profiles.length > 0) {
        const first = config.profiles[0];
        if (first) {
          first.isDefault = true;
        }
      }
      await this.save(config);
      return true;
    }
    return false;
  }

  async setDefault(id: string): Promise<boolean> {
    const config = await this.load();
    const exists = config.profiles.some(p => p.id === id);
    if (!exists) return false;

    config.profiles.forEach(p => {
      p.isDefault = p.id === id;
    });

    await this.save(config);
    return true;
  }

  async pingServer(id: string): Promise<ServerProfile | null> {
    const config = await this.load();
    const profile = config.profiles.find(p => p.id === id);
    if (!profile) return null;

    const url = `http://${profile.host}:${profile.port}/global/health`;
    try {
      const headers: any = {};
      if (profile.apiKey) {
        const auth = Buffer.from(`opencode:${profile.apiKey}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const response = await axios.get(url, { headers, timeout: 3000 });

      profile.status = response.status === 200 ? 'online' : 'offline';
      profile.lastHealthCheck = new Date().toISOString();
    } catch (err: any) {
      console.error('[ServerProfileManager] Ping failed for', id, url, err.message);
      if (err.response) {
        console.error('Status:', err.response.status);
        console.error('Data:', JSON.stringify(err.response.data));
      }
      profile.status = 'offline';
      profile.lastHealthCheck = new Date().toISOString();
    }

    await this.save(config);
    return profile;
  }

  async checkAllHealth(): Promise<void> {
    const config = await this.load();
    for (const profile of config.profiles) {
      try {
        const url = `http://${profile.host}:${profile.port}/global/health`;
        const headers: any = {};
        if (profile.apiKey) {
          const auth = Buffer.from(`opencode:${profile.apiKey}`).toString('base64');
          headers['Authorization'] = `Basic ${auth}`;
        }

        const response = await axios.get(url, { headers, timeout: 2000 });
        profile.status = response.status === 200 ? 'online' : 'offline';
      } catch {
        profile.status = 'offline';
      }
      profile.lastHealthCheck = new Date().toISOString();
    }
    await this.save(config);
  }
}
