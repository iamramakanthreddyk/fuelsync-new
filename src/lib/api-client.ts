/**
 * FuelSync API Client
 * Centralized API configuration and request handling
 * Works with the Express backend at localhost:3001
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Token storage keys
const TOKEN_KEY = 'fuelsync_token';
const USER_KEY = 'fuelsync_user';

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
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Set auth token
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove auth token
 */
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Get stored user
 */
export function getStoredUser<T>(): T | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as T;
  } catch {
    return null;
  }
}

/**
 * Set stored user
 */
export function setStoredUser<T>(user: T): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
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
      const error = errorData.error || {};
      
      // Handle auth expiry
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('auth-expired'));
      }

      throw new ApiError(
        error.message || 'Request failed',
        response.status,
        error.code,
        error.details
      );
    }

    throw new ApiError(
      `HTTP Error: ${response.status}`,
      response.status
    );
  }

  if (isJson) {
    const jsonData = await response.json();
    // If response has the {success, data} structure, unwrap it
    if (jsonData && typeof jsonData === 'object' && 'data' in jsonData) {
      return jsonData.data as T;
    }
    return jsonData as T;
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
    config.body = JSON.stringify(data);
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
