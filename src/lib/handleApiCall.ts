import { AppError } from '@/lib/error-utils';
import { logError } from '@/lib/error-utils';

/**
 * Helper to handle API calls with global error handling.
 * Returns a tuple: [result, error]
 */
export async function handleApiCall<T>(fn: () => Promise<T>): Promise<[T | null, AppError | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    const appError = logError(error);
    // Optionally, show a toast or notification here
    // toast.error(getUserMessage(error));
    return [null, appError ?? null];
  }
}
