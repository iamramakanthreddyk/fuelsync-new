/**
 * FuelSync API Client
 * Centralized API configuration and request handling
 * Works with the Express backend at localhost:3001
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

import { getStorageItem, setStorageItem, removeStorageItem } from './storage-utils';

// Token storage keys (without prefix — `storage-utils` will add prefix)
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

/**
 * API Error class for structured error handling
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Get stored auth token
 */
export function getToken(): string | null {
  return getStorageItem<string>(TOKEN_KEY);
}

/**
 * Set auth token
 */
export function setToken(token: string): void {
  setStorageItem<string>(TOKEN_KEY, token);
}

/**
 * Remove auth token
 */
export function removeToken(): void {
  removeStorageItem(TOKEN_KEY);
  removeStorageItem(USER_KEY);
}

/**
 * Get stored user
 */
export function getStoredUser<T>(): T | null {
  return getStorageItem<T>(USER_KEY);
}

/**
 * Set stored user
 */
export function setStoredUser<T>(user: T): void {
  setStorageItem<T>(USER_KEY, user);
}

/**
 * Build headers for API requests
 */
function buildHeaders(customHeaders?: Record<string, string>): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...customHeaders,
  });

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const errorData = await response.json();
      
      // Handle auth expiry
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('auth-expired'));
      }

      // Handle different error response formats
      let errorMessage = 'Request failed';
      let errorCode;
      let errorDetails;

      if (typeof errorData.error === 'string') {
        // Format: {success: false, error: "message"}
        errorMessage = errorData.error;
      } else if (typeof errorData.error === 'object' && errorData.error !== null) {
        // Format: {success: false, error: {message: "...", code: "..."}}
        errorMessage = errorData.error.message || 'Request failed';
        errorCode = errorData.error.code;
        errorDetails = errorData.error.details;
      } else if (errorData.message) {
        // Format: {success: false, message: "..."}
        errorMessage = errorData.message;
      }

      throw new ApiError(
        errorMessage,
        response.status,
        errorCode,
        errorDetails
      );
    }

    throw new ApiError(
      `HTTP Error: ${response.status}`,
      response.status
    );
  }

  if (isJson) {
    const jsonData = await response.json();

    // Helper: convert snake_case keys to camelCase recursively
    const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_m, p1) => p1.toUpperCase());

    function convertKeysToCamel(obj: any): any {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) return obj.map(convertKeysToCamel);
      if (typeof obj === 'object') {
        const out: Record<string, any> = {};
        for (const key of Object.keys(obj)) {
          const value = obj[key];
          const newKey = toCamel(key);
          out[newKey] = convertKeysToCamel(value);
        }
        return out;
      }
      return obj;
    }

    // If response has the {success, data} structure, unwrap and convert
    if (jsonData && typeof jsonData === 'object' && 'data' in jsonData) {
      try {
        return convertKeysToCamel(jsonData.data) as T;
      } catch (e) {
        return jsonData.data as T;
      }
    }

    try {
      return convertKeysToCamel(jsonData) as T;
    } catch (e) {
      return jsonData as T;
    }
  }

  return {} as T;
}

/**
 * API Request options
 */
interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Generic API request function
 */
async function request<T>(
  method: string,
  endpoint: string,
  data?: unknown,
  options?: RequestOptions
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    method,
    headers: buildHeaders(options?.headers),
    signal: options?.signal,
  };

  if (data && method !== 'GET') {
    const bodyString = JSON.stringify(data);
    config.body = bodyString;
    
    // Log the request for debugging
    if (method === 'POST' && endpoint.includes('/stations')) {
      console.log('🌐 API Client sending request:');
      console.log('   URL:', url);
      console.log('   Method:', method);
      console.log('   Body string:', bodyString);
      console.log('   Parsed body:', JSON.parse(bodyString));
    }
  }

  try {
    const response = await fetch(url, config);
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error - unable to connect to server', 0, 'NETWORK_ERROR');
    }
    
    throw new ApiError('An unexpected error occurred', 500);
  }
}

/**
 * API Client with typed methods
 */
export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) => 
    request<T>('GET', endpoint, undefined, options),

  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) => 
    request<T>('POST', endpoint, data, options),

  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) => 
    request<T>('PUT', endpoint, data, options),

  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) => 
    request<T>('PATCH', endpoint, data, options),

  delete: <T>(endpoint: string, options?: RequestOptions) => 
    request<T>('DELETE', endpoint, undefined, options),
};

/**
 * Standard API Response type
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Paginated Response type
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Error Response type
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export default apiClient;
