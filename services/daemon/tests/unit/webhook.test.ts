import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebhookServer } from '../../server/webhook-server.js';

describe('WebhookServer', () => {
  let server: WebhookServer;
  let mockSyncEngine: any;

  beforeEach(() => {
    mockSyncEngine = {
      pull: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      pullOne: jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined)
    };
    server = new WebhookServer(mockSyncEngine as any, { port: 3006 });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should trigger pullOne on Plane webhook with issue id', async () => {
    mockSyncEngine.pullOne = jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
    await server.start();

    const response = await fetch('http://localhost:3006/webhooks/plane', {
      method: 'POST',
      body: JSON.stringify({
        event: 'issue.updated',
        data: { id: 'plane-id-123' }
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
    expect(mockSyncEngine.pullOne).toHaveBeenCalledWith('plane-id-123');
  });

  it('should return unauthorized if secret is wrong', async () => {
    server = new WebhookServer(mockSyncEngine, { port: 3007, secret: 'correct-secret' });
    await server.start();

    const response = await fetch('http://localhost:3007/webhooks/plane', {
      method: 'POST',
      headers: { 'Authorization': 'wrong-secret' }
    });

    expect(response.status).toBe(401);
    expect(mockSyncEngine.pull).not.toHaveBeenCalled();
  });
});
