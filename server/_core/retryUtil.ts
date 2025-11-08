/**
 * Retry utility with exponential backoff for API calls
 * Handles rate limiting and transient errors gracefully
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number; // Base delay in milliseconds
  maxDelay?: number; // Maximum delay in milliseconds
  retryableStatusCodes?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatusCodes: [429, 500, 502, 503, 504], // Rate limit + server errors
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error, opts.retryableStatusCodes);

      if (!isRetryable || attempt === opts.maxRetries) {
        // Not retryable or max retries reached
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt),
        opts.maxDelay
      );

      console.log(
        `[Retry] Attempt ${attempt + 1}/${opts.maxRetries} failed. Retrying in ${delay}ms...`,
        error.message
      );

      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, retryableStatusCodes: number[]): boolean {
  // Check for HTTP status codes
  if (error.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }

  // Check for fetch errors (network issues)
  if (error.name === 'FetchError' || error.code === 'ECONNRESET') {
    return true;
  }

  // Check for timeout errors
  if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
    return true;
  }

  return false;
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a fetch request with exponential backoff
 */
export async function retryFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return retryWithBackoff(async () => {
    const response = await fetch(url, options);

    // Throw error for non-OK responses
    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }

    return response;
  }, retryOptions);
}
