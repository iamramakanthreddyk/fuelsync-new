/**
 * useErrorHandler Hook
 * 
 * Provides standardized error handling for React components.
 * Integrates with toast notifications and error logging.
 */

import { useCallback } from 'react';
import { useToast } from './use-toast';
import { 
  parseError, 
  logError, 
  formatErrorForToast,
  isAuthError,
  isRetryableError,
  type AppError 
} from '@/lib/error-handler';

interface UseErrorHandlerOptions {
  /** Context string for logging */
  context?: string;
  /** Whether to show toast on error (default: true) */
  showToast?: boolean;
  /** Custom error message to override */
  customMessage?: string;
  /** Callback when auth error occurs */
  onAuthError?: () => void;
  /** Callback for any error */
  onError?: (error: AppError) => void;
}

/**
 * Hook for standardized error handling
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { toast } = useToast();
  const { 
    context, 
    showToast = true, 
    customMessage, 
    onAuthError, 
    onError 
  } = options;

  /**
   * Handle an error with logging and optional toast
   */
  const handleError = useCallback((error: unknown): AppError => {
    // Parse and log the error
    const parsed = logError(error, context);

    // Call custom error handler
    if (onError) {
      onError(parsed);
    }

    // Handle auth errors
    if (isAuthError(error) && onAuthError) {
      onAuthError();
    }

    // Show toast notification
    if (showToast) {
      const toastData = formatErrorForToast(error);
      toast({
        title: toastData.title,
        description: customMessage || toastData.description,
        variant: toastData.variant,
      });
    }

    return parsed;
  }, [context, showToast, customMessage, onAuthError, onError, toast]);

  /**
   * Handle error silently (logging only, no toast)
   */
  const handleErrorSilent = useCallback((error: unknown): AppError => {
    const parsed = logError(error, context);
    if (onError) {
      onError(parsed);
    }
    return parsed;
  }, [context, onError]);

  /**
   * Wrap an async function with error handling
   */
  const withErrorHandling = useCallback(<T,>(
    fn: () => Promise<T>,
    errorOptions?: Partial<UseErrorHandlerOptions>
  ): Promise<T | undefined> => {
    return fn().catch((error) => {
      handleError(error);
      return undefined;
    });
  }, [handleError]);

  /**
   * Check if an error should trigger a retry
   */
  const shouldRetry = useCallback((error: unknown): boolean => {
    return isRetryableError(error);
  }, []);

  return {
    handleError,
    handleErrorSilent,
    withErrorHandling,
    shouldRetry,
    parseError,
    isAuthError,
  };
}

/**
 * Simple error handler for use outside of React components
 */
export function handleApiError(error: unknown, context?: string): AppError {
  return logError(error, context);
}

export default useErrorHandler;
