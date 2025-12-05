/**
 * useApi Hook
 * 
 * Custom hook for making API calls with built-in loading, error handling,
 * and token management.
 * 
 * @module core/hooks/useApi
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ApiResponse, ApiError } from '../models/api.model';
import { API_BASE_URL } from '../constants/api.constants';
import { apiClient as libApiClient } from '@/lib/api-client';

// ============================================
// TYPES
// ============================================

interface UseApiState<T> {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: <T>(data: T) => void;
  onError?: (error: ApiError) => void;
}

interface UseApiReturn<T, TParams = void> extends UseApiState<T> {
  execute: TParams extends void ? () => Promise<T | null> : (params: TParams) => Promise<T | null>;
  reset: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================


const buildUrl = (endpoint: string, params?: Record<string, string | number | boolean | undefined>): string => {
  // If API_BASE_URL is already a full URL, use it directly; otherwise use window.location.origin
  const baseUrl = API_BASE_URL.startsWith('http') ? API_BASE_URL : window.location.origin + API_BASE_URL;
  const url = new URL(`${baseUrl}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
};

// parseError helper kept inline where needed via getErrorMessage

// Reuse centralized API client from `src/lib/api-client.ts`


export function useApi<T, TParams = void>(
  apiFunction: TParams extends void 
    ? () => Promise<ApiResponse<T>>
    : (params: TParams) => Promise<ApiResponse<T>>,
  options: UseApiOptions = {}
): UseApiReturn<T, TParams> {
  const { immediate = false, onSuccess, onError } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (params?: TParams): Promise<T | null> => {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        isError: false,
        isSuccess: false,
      }));

      try {
        const response = params !== undefined
          ? await (apiFunction as (params: TParams) => Promise<ApiResponse<T>>)(params)
          : await (apiFunction as () => Promise<ApiResponse<T>>)();

        if (!mountedRef.current) return null;

        const data = response.data;
        
        setState({
          data,
          error: null,
          isLoading: false,
          isSuccess: true,
          isError: false,
        });

        onSuccess?.(data);
        return data;
      } catch (error) {
        if (!mountedRef.current) return null;

        const apiError = error as ApiError;
        
        setState({
          data: null,
          error: apiError,
          isLoading: false,
          isSuccess: false,
          isError: true,
        });

        onError?.(apiError);
        return null;
      }
    },
    [apiFunction, onSuccess, onError]
  ) as UseApiReturn<T, TParams>['execute'];

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      (execute as () => Promise<T | null>)();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate]);

  return {
    ...state,
    execute,
    reset,
  };
}

// ============================================
// CONVENIENCE METHODS
// ============================================

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
    libApiClient.get<T>(buildUrl(endpoint, params)),

  post: <T>(endpoint: string, body?: unknown) =>
    libApiClient.post<T>(endpoint, body),

  put: <T>(endpoint: string, body?: unknown) =>
    libApiClient.put<T>(endpoint, body),

  patch: <T>(endpoint: string, body?: unknown) =>
    libApiClient.patch<T>(endpoint, body),

  delete: <T>(endpoint: string) =>
    libApiClient.delete<T>(endpoint),
};
