// src/lib/apiErrorHandler.ts
// Centralized API error handler for React Query and API hooks

/**
 * Extracts a user-friendly error message from API or network errors.
 * Supports Axios, Fetch, and generic JS errors.
 */
export function getApiErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';

  // Axios error shape
  if (typeof error === 'object' && error !== null) {
    // Axios v0.27+ error shape
    if ('response' in error && error.response && typeof error.response === 'object') {
      const data = (error as any).response.data;
      if (data && typeof data === 'object' && 'message' in data) {
        return data.message as string;
      }
      if (typeof data === 'string') {
        return data;
      }
    }
    // Fetch error shape
    if ('message' in error) {
      return (error as any).message;
    }
  }

  // Fallback
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}
