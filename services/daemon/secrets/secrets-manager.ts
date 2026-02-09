import * as dotenv from 'dotenv';
import * as path from 'path';

export class SecretsManager {
    private secrets: Record<string, string> = {};

    constructor(envPath?: string) {
        // Load from project root .env by default
        const targetPath = envPath || path.resolve(process.cwd(), '.env');
        dotenv.config({ path: targetPath });
        this.secrets = process.env as Record<string, string>;
    }

    /**
     * returns a list of Available Secret Keys (masking values)
     * e.g. ['GH_TOKEN', 'OPENAI_API_KEY']
     */
    getAvailableSecrets(): string[] {
        const sensitiveKeys = ['TOKEN', 'KEY', 'PASSWORD', 'SECRET', 'AUTH'];
        return Object.keys(this.secrets).filter(key =>
            sensitiveKeys.some(s => key.toUpperCase().includes(s))
        );
    }

    getSecret(key: string): string | undefined {
        return this.secrets[key];
    }
}
