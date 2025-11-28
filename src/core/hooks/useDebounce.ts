/**
 * useDebounce Hook
 * 
 * Custom hook for debouncing values and callbacks.
 * Useful for search inputs, form validation, and API calls.
 * 
 * @module core/hooks/useDebounce
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { UI } from '../constants/app.constants';

// ============================================
// DEBOUNCED VALUE HOOK
// ============================================

/**
 * Returns a debounced version of the provided value.
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 * 
 * useEffect(() => {
 *   // This effect runs 500ms after the user stops typing
 *   searchApi(debouncedSearchTerm);
 * }, [debouncedSearchTerm]);
 */
export function useDebounce<T>(value: T, delay = UI.SEARCH_DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================
// DEBOUNCED CALLBACK HOOK
// ============================================

/**
 * Returns a debounced version of the provided callback function.
 * 
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced function and control methods
 * 
 * @example
 * const { debouncedCallback, cancel, flush } = useDebouncedCallback(
 *   (value: string) => searchApi(value),
 *   500
 * );
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay = UI.INPUT_DEBOUNCE_MS
): {
  debouncedCallback: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
  isPending: boolean;
} {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cancel pending timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      argsRef.current = null;
      setIsPending(false);
    }
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current && argsRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      callbackRef.current(...argsRef.current);
      argsRef.current = null;
      setIsPending(false);
    }
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      argsRef.current = args;
      setIsPending(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (argsRef.current) {
          callbackRef.current(...argsRef.current);
          argsRef.current = null;
        }
        timeoutRef.current = null;
        setIsPending(false);
      }, delay);
    },
    [delay]
  );

  return {
    debouncedCallback,
    cancel,
    flush,
    isPending,
  };
}

// ============================================
// THROTTLED CALLBACK HOOK
// ============================================

/**
 * Returns a throttled version of the provided callback function.
 * Unlike debounce, throttle ensures the function is called at most once
 * per specified time period.
 * 
 * @param callback - The function to throttle
 * @param delay - Minimum delay between calls in milliseconds
 * @returns Throttled function
 * 
 * @example
 * const throttledScroll = useThrottledCallback(
 *   () => handleScroll(),
 *   100
 * );
 */
export function useThrottledCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now;
        callbackRef.current(...args);
      }
    },
    [delay]
  );
}

// ============================================
// DEBOUNCED STATE HOOK
// ============================================

/**
 * A combination of useState and useDebounce for convenient debounced state management.
 * Returns both the immediate value and the debounced value.
 * 
 * @param initialValue - Initial state value
 * @param delay - Debounce delay in milliseconds
 * @returns [value, debouncedValue, setValue]
 * 
 * @example
 * const [value, debouncedValue, setValue] = useDebouncedState('', 500);
 * 
 * return (
 *   <input value={value} onChange={(e) => setValue(e.target.value)} />
 * );
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay = UI.SEARCH_DEBOUNCE_MS
): [T, T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initialValue);
  const debouncedValue = useDebounce(value, delay);

  return useMemo(
    () => [value, debouncedValue, setValue],
    [value, debouncedValue]
  );
}

// ============================================
// ASYNC DEBOUNCE HOOK
// ============================================

/**
 * Debounced hook for async operations with built-in loading state.
 * 
 * @param asyncFn - Async function to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Object with execute function and loading state
 */
export function useAsyncDebounce<TArgs extends unknown[], TResult>(
  asyncFn: (...args: TArgs) => Promise<TResult>,
  delay = UI.SEARCH_DEBOUNCE_MS
): {
  execute: (...args: TArgs) => void;
  isLoading: boolean;
  result: TResult | null;
  error: Error | null;
  cancel: () => void;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  const execute = useCallback(
    (...args: TArgs) => {
      cancel();
      setIsLoading(true);
      setError(null);

      timeoutRef.current = setTimeout(async () => {
        abortControllerRef.current = new AbortController();
        
        try {
          const res = await asyncFn(...args);
          if (!abortControllerRef.current?.signal.aborted) {
            setResult(res);
            setError(null);
          }
        } catch (err) {
          if (!abortControllerRef.current?.signal.aborted) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setResult(null);
          }
        } finally {
          if (!abortControllerRef.current?.signal.aborted) {
            setIsLoading(false);
          }
        }
      }, delay);
    },
    [asyncFn, delay, cancel]
  );

  return {
    execute,
    isLoading,
    result,
    error,
    cancel,
  };
}
