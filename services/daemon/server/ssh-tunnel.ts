import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface TunnelConfig {
  host: string;
  user: string;
  remotePort: number;
  localPort: number;
  privateKeyPath?: string;
}

export class SSHTunnelManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: TunnelConfig;

  constructor(config: TunnelConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-N',
        '-L', `${this.config.localPort}:localhost:${this.config.remotePort}`,
        `${this.config.user}@${this.config.host}`,
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ExitOnForwardFailure=yes'
      ];

      if (this.config.privateKeyPath) {
        args.push('-i', this.config.privateKeyPath);
      }

      console.log(`[SSH] Establishing tunnel: ssh ${args.join(' ')}`);
      this.process = spawn('ssh', args);

      this.process.on('error', (err) => {
        console.error('[SSH] Tunnel process error:', err);
        this.emit('error', err);
        reject(err);
      });

      this.process.stderr?.on('data', (data) => {
        const msg = data.toString();
        console.error(`[SSH] ${msg}`);
        if (msg.includes('Permission denied') || msg.includes('Connection refused')) {
            reject(new Error(msg));
        }
      });

      setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.log(`[SSH] Tunnel established on port ${this.config.localPort}`);
          this.emit('connected');
          resolve();
        }
      }, 2000);

      this.process.on('exit', (code) => {
        console.log(`[SSH] Tunnel process exited with code ${code}`);
        this.process = null;
        this.emit('disconnected', code);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  isConnected(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
