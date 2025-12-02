/**
 * Error Handling Utilities
 */

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Array<{ field: string; message: string }>;
}

/**
 * Format error for display
 */
export function formatError(error: unknown): AppError {
  // API Error
  if (error.response?.data) {
    return {
      message: error.response.data.error || error.response.data.message || 'An error occurred',
      code: error.response.data.code,
      statusCode: error.response.status,
      details: error.response.data.details
    };
  }

  // Network Error
  if (error.request) {
    return {
      message: 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
      statusCode: 0
    };
  }

  // Generic Error
  return {
    message: error.message || 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR'
  };
}

/**
 * Get user-friendly error message
 */
export function getUserMessage(error: unknown): string {
  const formattedError = formatError(error);
  
  // Map common error codes to user-friendly messages
  const messageMap: Record<string, string> = {
    'NETWORK_ERROR': 'Unable to connect. Please check your internet connection.',
    'UNAUTHORIZED': 'Please log in to continue.',
    'FORBIDDEN': 'You do not have permission to perform this action.',
    'NOT_FOUND': 'The requested resource was not found.',
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'SERVER_ERROR': 'Something went wrong on our end. Please try again later.'
  };

  // Check for mapped message
  if (formattedError.code && messageMap[formattedError.code]) {
    return messageMap[formattedError.code];
  }

  // Check for status code
  if (formattedError.statusCode) {
    if (formattedError.statusCode === 401) return messageMap.UNAUTHORIZED;
    if (formattedError.statusCode === 403) return messageMap.FORBIDDEN;
    if (formattedError.statusCode === 404) return messageMap.NOT_FOUND;
    if (formattedError.statusCode >= 500) return messageMap.SERVER_ERROR;
  }

  return formattedError.message;
}

/**
 * Log error to console with context
 */
export function logError(error: unknown, context?: string) {
  const formattedError = formatError(error);
  console.error(
    `[Error${context ? ` - ${context}` : ''}]:`,
    formattedError.message,
    formattedError
  );
}

/**
 * Check if error is authentication related
 */
export function isAuthError(error: unknown): boolean {
  const formattedError = formatError(error);
  return (
    formattedError.statusCode === 401 ||
    formattedError.code === 'UNAUTHORIZED' ||
    formattedError.code === 'TOKEN_EXPIRED'
  );
}

/**
 * Check if error is validation related
 */
export function isValidationError(error: unknown): boolean {
  const formattedError = formatError(error);
  return (
    formattedError.statusCode === 400 ||
    formattedError.code === 'VALIDATION_ERROR' ||
    !!formattedError.details
  );
}

/**
 * Extract validation errors
 */
export function getValidationErrors(error: unknown): Record<string, string> {
  const formattedError = formatError(error);
  
  if (!formattedError.details || !Array.isArray(formattedError.details)) {
    return {};
  }

  const errors: Record<string, string> = {};
  (formattedError.details as Array<{ field: string; message: string }> | undefined)?.forEach((detail) => {
    if (detail.field && detail.message) {
      errors[detail.field] = detail.message;
    }
  });

  return errors;
}
