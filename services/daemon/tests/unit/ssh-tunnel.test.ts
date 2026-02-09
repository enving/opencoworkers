import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';

const mockSpawn = jest.fn();

jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn
}));

const { SSHTunnelManager } = await import('../../server/ssh-tunnel.js');

describe('SSHTunnelManager', () => {
  let tunnel: any;
  let mockProcess: any;

  beforeEach(() => {
    jest.useFakeTimers();
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    mockProcess.killed = false;
    mockSpawn.mockReturnValue(mockProcess);

    tunnel = new SSHTunnelManager({
      host: 'example.com',
      user: 'testuser',
      remotePort: 4096,
      localPort: 5000
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should call ssh command with correct arguments', async () => {
    const connectPromise = tunnel.connect();
    
    expect(mockSpawn).toHaveBeenCalledWith('ssh', [
      '-N',
      '-L', '5000:localhost:4096',
      'testuser@example.com',
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=accept-new',
      '-o', 'ExitOnForwardFailure=yes'
    ]);

    jest.advanceTimersByTime(2001);
    await connectPromise;
    expect(tunnel.isConnected()).toBe(true);
  });

  it('should handle process exit', async () => {
    const connectPromise = tunnel.connect();
    jest.advanceTimersByTime(2001);
    await connectPromise;

    mockProcess.killed = true;
    mockProcess.emit('exit', 0);
    
    expect(tunnel.isConnected()).toBe(false);
  });

  it('should handle process error', async () => {
    tunnel.on('error', () => {}); 
    const connectPromise = tunnel.connect();
    const error = new Error('Spawn failed');
    mockProcess.emit('error', error);

    await expect(connectPromise).rejects.toThrow('Spawn failed');
  });

  it('should handle permission denied in stderr', async () => {
    const connectPromise = tunnel.connect();
    mockProcess.stderr.emit('data', Buffer.from('Permission denied (publickey)'));

    await expect(connectPromise).rejects.toThrow('Permission denied');
  });
});
