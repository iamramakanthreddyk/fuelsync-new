/**
 * API Model
 * 
 * Types and interfaces for API requests, responses, and error handling.
 * 
 * @module core/models/api
 */

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  code?: string;
  details?: Record<string, string[]>;
  stack?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ============================================
// API REQUEST TYPES
// ============================================

/**
 * Pagination query parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Sort query parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Date range query parameters
 */
export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Search query parameters
 */
export interface SearchParams {
  search?: string;
  searchFields?: string[];
}

/**
 * Common list query parameters
 */
export interface ListQueryParams extends PaginationParams, SortParams, SearchParams {
  includeInactive?: boolean;
}

// ============================================
// HTTP & REQUEST TYPES
// ============================================

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * API request configuration
 */
export interface ApiRequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * API client configuration
 */
export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  onRequest?: (config: ApiRequestConfig) => ApiRequestConfig;
  onResponse?: <T>(response: ApiResponse<T>) => ApiResponse<T>;
  onError?: (error: ApiError) => void;
}

// ============================================
// ERROR TYPES
// ============================================

/**
 * API error class
 */
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  statusText?: string;
  details?: Record<string, string[]>;
  originalError?: Error;
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Form validation errors
 */
export type FormErrors<T> = Partial<Record<keyof T, string>>;

// ============================================
// AUTH TYPES
// ============================================

/**
 * Login request
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Login response
 */
export interface LoginResponse {
  token: string;
  refreshToken?: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    stationId?: string;
  };
}

/**
 * Register request
 */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  stationName?: string;
}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Token refresh response
 */
export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Password change request
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Password reset request
 */
export interface ResetPasswordRequest {
  email: string;
}

/**
 * Password reset confirmation
 */
export interface ConfirmResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

// ============================================
// QUERY HOOKS TYPES
// ============================================

/**
 * Query options for list hooks
 */
export interface QueryListOptions<TFilter = Record<string, unknown>> {
  filter?: TFilter;
  pagination?: PaginationParams;
  sort?: SortParams;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

/**
 * Query result for single item
 */
export interface QueryItemResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | null;
  refetch: () => void;
}

/**
 * Query result for list
 */
export interface QueryListResult<T> extends QueryItemResult<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Mutation result
 */
export interface MutationResult<TData, TVariables = void> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: ApiError | null;
  data: TData | undefined;
  reset: () => void;
}

// ============================================
// UPLOAD TYPES
// ============================================

/**
 * File upload request
 */
export interface FileUploadRequest {
  file: File;
  purpose: string;
  metadata?: Record<string, string>;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

/**
 * Upload progress
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}
