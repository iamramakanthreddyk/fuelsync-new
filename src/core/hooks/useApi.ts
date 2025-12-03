/**
 * useApi Hook
 * 
 * Custom hook for making API calls with built-in loading, error handling,
 * and token management.
 * 
 * @module core/hooks/useApi
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ApiResponse, ApiError, ApiRequestConfig } from '../models/api.model';
import { API_BASE_URL, API_TIMEOUT, HTTP_STATUS } from '../constants/api.constants';
import { STORAGE_KEYS } from '../constants/app.constants';
import { getToken, removeToken } from '@/lib/api-client';

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

const getAuthToken = (): string | null => {
  return getToken();
};

const buildUrl = (endpoint: string, params?: Record<string, string | number | boolean | undefined>): string => {
  const url = new URL(`${API_BASE_URL}${endpoint}`, window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
};

const parseError = (error: unknown): ApiError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      originalError: error,
    };
  }
  
  if (typeof error === 'string') {
    return { message: error };
  }
  
  return { message: 'An unknown error occurred' };
};

// ============================================
// API CLIENT
// ============================================

export async function apiClient<T>(
  endpoint: string,
  config: ApiRequestConfig = {}
): Promise<ApiResponse<T>> {
  const {
    method = 'GET',
    headers = {},
    params,
    body,
    timeout = API_TIMEOUT,
    signal,
  } = config;

  const url = buildUrl(endpoint, params);
  const token = getAuthToken();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: signal || controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      const apiError: ApiError = {
        message: errorData.error || errorData.message || response.statusText,
        code: errorData.code,
        status: response.status,
        statusText: response.statusText,
        details: errorData.details,
      };

      // Handle unauthorized - clear token and notify app
      if (response.status === HTTP_STATUS.UNAUTHORIZED) {
        removeToken();
        window.dispatchEvent(new CustomEvent('auth-expired'));
      }

      throw apiError;
    }

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw { message: 'Request timed out', code: 'TIMEOUT' } as ApiError;
    }

    if ((error as ApiError).status) {
      throw error;
    }

    throw parseError(error);
  }
}

// ============================================
// USE API HOOK
// ============================================

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
    apiClient<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'PATCH', body }),

  delete: <T>(endpoint: string) =>
    apiClient<T>(endpoint, { method: 'DELETE' }),
};
