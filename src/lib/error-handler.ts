/**
 * Standardized Error Handling
 * 
 * Provides consistent error handling patterns across the application.
 * Integrates with API client errors and provides user-friendly messages.
 */

import { ApiError } from './api-client';

// ============================================
// ERROR TYPES
// ============================================

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AppError {
  message: string;
  code?: string;
  severity: ErrorSeverity;
  details?: string[];
  originalError?: unknown;
  timestamp: string;
}

export interface FieldError {
  field: string;
  message: string;
}

// ============================================
// ERROR MESSAGES
// ============================================

const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  TIMEOUT: 'The request timed out. Please try again.',
  
  // Auth errors
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  
  // Validation errors
  VALIDATION_ERROR: 'Please check your input and try again.',
  REQUIRED_FIELD: 'This field is required.',
  
  // Resource errors
  NOT_FOUND: 'The requested resource was not found.',
  ALREADY_EXISTS: 'This resource already exists.',
  CONFLICT: 'This action conflicts with existing data.',
  
  // Server errors
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable.',
  
  // Default
  UNKNOWN: 'Something went wrong. Please try again.',
};

// HTTP status code to error code mapping
const HTTP_STATUS_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  502: 'SERVICE_UNAVAILABLE',
  503: 'SERVICE_UNAVAILABLE',
  504: 'TIMEOUT',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get user-friendly error message from error code
 */
export function getErrorMessage(code?: string): string {
  if (!code) return ERROR_MESSAGES.UNKNOWN;
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN;
}

/**
 * Get error code from HTTP status
 */
export function getErrorCodeFromStatus(status: number): string {
  return HTTP_STATUS_CODES[status] || 'UNKNOWN';
}

/**
 * Determine error severity based on status code
 */
export function getSeverityFromStatus(status: number): ErrorSeverity {
  if (status >= 500) return 'critical';
  if (status >= 400) return 'error';
  if (status >= 300) return 'warning';
  return 'info';
}

// ============================================
// MAIN ERROR HANDLER
// ============================================

/**
 * Parse any error into a standardized AppError
 */
export function parseError(error: unknown): AppError {
  const timestamp = new Date().toISOString();

  // API Error from our client
  if (error instanceof ApiError) {
    const code = error.code || getErrorCodeFromStatus(error.statusCode);
    const details = error.details?.map(d => `${d.field}: ${d.message}`);
    
    return {
      message: error.message || getErrorMessage(code),
      code,
      severity: getSeverityFromStatus(error.statusCode),
      details,
      originalError: error,
      timestamp,
    };
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        message: getErrorMessage('NETWORK_ERROR'),
        code: 'NETWORK_ERROR',
        severity: 'error',
        originalError: error,
        timestamp,
      };
    }

    // Check for timeout errors
    if (error.message.includes('timeout')) {
      return {
        message: getErrorMessage('TIMEOUT'),
        code: 'TIMEOUT',
        severity: 'warning',
        originalError: error,
        timestamp,
      };
    }

    return {
      message: error.message || getErrorMessage('UNKNOWN'),
      code: 'UNKNOWN',
      severity: 'error',
      originalError: error,
      timestamp,
    };
  }

  // String error
  if (typeof error === 'string') {
    return {
      message: error,
      code: 'UNKNOWN',
      severity: 'error',
      timestamp,
    };
  }

  // Object with message
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      message: String((error as { message: unknown }).message),
      code: (error as { code?: string }).code,
      severity: 'error',
      originalError: error,
      timestamp,
    };
  }

  // Unknown error
  return {
    message: getErrorMessage('UNKNOWN'),
    code: 'UNKNOWN',
    severity: 'error',
    originalError: error,
    timestamp,
  };
}

/**
 * Extract field validation errors from an API error
 */
export function extractFieldErrors(error: unknown): FieldError[] {
  if (error instanceof ApiError && error.details) {
    return error.details.map(d => ({
      field: d.field,
      message: d.message,
    }));
  }
  return [];
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.statusCode === 401 || error.code === 'UNAUTHORIZED';
  }
  return false;
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.statusCode === 403 || error.code === 'FORBIDDEN';
  }
  return false;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.code === 'NETWORK_ERROR';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    // Network errors and server errors are retryable
    return error.statusCode === 0 || error.statusCode >= 500;
  }
  if (error instanceof Error) {
    return error.message.includes('network') || error.message.includes('timeout');
  }
  return false;
}

// ============================================
// LOGGING
// ============================================

/**
 * Log error to console with structured format
 */
export function logError(error: unknown, context?: string): AppError {
  const parsed = parseError(error);
  
  const logData = {
    ...parsed,
    context,
  };

  if (parsed.severity === 'critical') {
    console.error('[CRITICAL ERROR]', logData);
  } else if (parsed.severity === 'error') {
    console.error('[ERROR]', logData);
  } else if (parsed.severity === 'warning') {
    console.warn('[WARNING]', logData);
  } else {
    console.info('[INFO]', logData);
  }

  return parsed;
}

// ============================================
// REACT HOOKS HELPERS
// ============================================

/**
 * Format error for toast notifications
 */
export function formatErrorForToast(error: unknown): {
  title: string;
  description: string;
  variant: 'destructive' | 'default';
} {
  const parsed = parseError(error);
  
  return {
    title: parsed.severity === 'critical' ? 'Critical Error' : 'Error',
    description: parsed.message,
    variant: 'destructive',
  };
}

/**
 * Get retry config based on error
 */
export function getRetryConfig(error: unknown): {
  shouldRetry: boolean;
  delay: number;
  maxRetries: number;
} {
  const isRetryable = isRetryableError(error);
  
  return {
    shouldRetry: isRetryable,
    delay: 1000, // 1 second
    maxRetries: 3,
  };
}

export default {
  parseError,
  extractFieldErrors,
  isAuthError,
  isPermissionError,
  isNetworkError,
  isRetryableError,
  logError,
  formatErrorForToast,
  getRetryConfig,
  getErrorMessage,
};
