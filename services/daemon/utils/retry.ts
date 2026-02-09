export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  shouldRetry?: (error: any) => boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

export class RetryError extends Error {
  constructor(
    public readonly originalError: any,
    public readonly attempts: number
  ) {
    super(`Operation failed after ${attempts} attempts: ${originalError.message || originalError}`);
    this.name = 'RetryError';
  }
}

/**
 * Executes a function with exponential backoff retry logic.
 * 
 * @param fn The async function to execute
 * @param config Optional configuration for retry behavior
 * @returns The result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;
  let delay = finalConfig.initialDelayMs;

  for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should stop retrying
      if (attempt > finalConfig.maxRetries) {
        break;
      }

      // Check specific retry condition if provided
      if (finalConfig.shouldRetry && !finalConfig.shouldRetry(error)) {
        throw error;
      }

      // Default logic: Don't retry client errors (4xx) except 429
      if (
        !finalConfig.shouldRetry &&
        error?.response?.status >= 400 && 
        error?.response?.status < 500 && 
        error?.response?.status !== 429
      ) {
        throw error;
      }

      // Respect Retry-After header if present
      const retryAfter = error?.response?.headers?.['retry-after'];
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          delay = seconds * 1000;
        }
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Calculate next delay (if not set by Retry-After)
      if (!retryAfter) {
        delay = Math.min(
          delay * finalConfig.backoffFactor,
          finalConfig.maxDelayMs
        );
      }
      
      console.warn(
        `[Retry] Attempt ${attempt} failed. Retrying in ${delay}ms... (Error: ${error.message})`
      );
    }
  }

  throw new RetryError(lastError, finalConfig.maxRetries + 1);
}
