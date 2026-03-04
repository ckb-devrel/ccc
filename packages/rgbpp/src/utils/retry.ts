/**
 * Retry utility with exponential backoff and jitter
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 10) */
  maxRetries?: number;
  /** Initial delay in seconds (default: 5) */
  initialDelay?: number;
  /** Backoff multiplier (default: 1.5) */
  backoffMultiplier?: number;
  /** Jitter factor as percentage (default: 0.1 for ±10%) */
  jitterFactor?: number;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
  /** Custom logger function (default: console.log) */
  logger?: (message: string) => void;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 10,
    initialDelay = 5,
    backoffMultiplier = 1.5,
    jitterFactor = 0.1,
    verbose = false,
    logger = console.log,
  } = options;

  // Parameter validation
  if (maxRetries < 0 || !Number.isInteger(maxRetries)) {
    throw new Error(
      `maxRetries must be a non-negative integer, got: ${maxRetries}`,
    );
  }
  if (initialDelay < 0 || !Number.isFinite(initialDelay)) {
    throw new Error(
      `initialDelay must be a non-negative number, got: ${initialDelay}`,
    );
  }
  if (backoffMultiplier <= 0 || !Number.isFinite(backoffMultiplier)) {
    throw new Error(
      `backoffMultiplier must be a positive number, got: ${backoffMultiplier}`,
    );
  }
  if (jitterFactor < 0 || jitterFactor > 1 || !Number.isFinite(jitterFactor)) {
    throw new Error(
      `jitterFactor must be between 0 and 1, got: ${jitterFactor}`,
    );
  }

  let lastError: unknown;
  const totalAttempts = maxRetries + 1; // Include the initial attempt

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    if (attempt > 0) {
      // Calculate delay with exponential backoff and bidirectional jitter
      const baseDelay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
      const jitterRange = jitterFactor * baseDelay;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange; // ±jitterRange
      const delay = Math.max(0, baseDelay + jitter); // Ensure non-negative

      if (verbose) {
        logger(
          `Retrying in ${delay.toFixed(1)} seconds (attempt ${attempt + 1}/${totalAttempts})...`,
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.floor(delay * 1000)),
      );
    }

    try {
      const result = await operation();
      if (verbose && attempt > 0) {
        logger(`Operation succeeded after ${attempt + 1} attempts`);
      }
      return result;
    } catch (error) {
      lastError = error;

      if (verbose && attempt < totalAttempts - 1) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger(`Attempt ${attempt + 1} failed: ${errorMessage}`);
      }

      // Don't throw on the last attempt, let the loop complete
      if (attempt === totalAttempts - 1) {
        if (verbose) {
          logger(`All ${totalAttempts} attempts failed`);
        }
        throw error;
      }
    }
  }

  // This should never be reached due to the logic above, but TypeScript needs it
  throw lastError;
}
