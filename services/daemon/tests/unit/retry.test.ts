import { jest, describe, it, expect } from '@jest/globals';
import { withRetry, RetryError } from '../../utils/retry.js';

describe('Retry Utility', () => {
  it('should succeed immediately if function does not fail', async () => {
    const fn = jest.fn<() => Promise<string>>().mockResolvedValue('success');
    const result = await withRetry(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { 
      initialDelayMs: 10, 
      maxDelayMs: 20 
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should fail after max retries', async () => {
    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('fail'));

    await expect(withRetry(fn, { 
      maxRetries: 2, 
      initialDelayMs: 10 
    })).rejects.toThrow(RetryError);

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should not retry on client errors (4xx) except 429', async () => {
    const error400: any = new Error('Bad Request');
    error400.response = { status: 400 };
    
    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(error400);

    await expect(withRetry(fn, { 
      initialDelayMs: 10 
    })).rejects.toThrow('Bad Request');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 errors', async () => {
    const error429: any = new Error('Too Many Requests');
    error429.response = { status: 429 };

    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('success');

    const result = await withRetry(fn, { 
      initialDelayMs: 10 
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry on 5xx errors', async () => {
    const error500: any = new Error('Server Error');
    error500.response = { status: 500 };

    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(error500)
      .mockResolvedValue('success');

    const result = await withRetry(fn, { 
      initialDelayMs: 10 
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
