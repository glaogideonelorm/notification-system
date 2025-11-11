export class RetryHelper {
  static async exponentialBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelay: number,
  ): Promise<T> {
    let lastError: unknown = undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error;

        if (attempt < maxRetries - 1) {
          const delay = this.calculateBackoff(attempt, baseDelay);
          console.log(
            `Retry attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`,
          );
          await this.sleep(delay);
        }
      }
    }

    // Narrow and rethrow properly
    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error(
      `Operation failed after ${maxRetries} retries: ${String(lastError)}`,
    );
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static calculateBackoff(attempt: number, baseDelay: number): number {
    const delay = Math.pow(2, attempt) * baseDelay;
    const jitter = Math.random() * 1000;
    return delay + jitter;
  }
}
