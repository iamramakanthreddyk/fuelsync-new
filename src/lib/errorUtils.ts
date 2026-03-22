export function getErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  
  try {
    const anyErr = err as any;
    
    // Handle axios error responses
    if (anyErr?.response?.data) {
      const data = anyErr.response.data;
      // Try multiple paths to get error message
      if (typeof data === 'object') {
        if (typeof data.error === 'string') return data.error;
        if (data.error && typeof data.error.message === 'string') return data.error.message;
        if (typeof data.message === 'string') return data.message;
        if (data.details && typeof data.details === 'string') return data.details;
      }
    }
    
    // Fallback to other common error shapes
    if (typeof anyErr.message === 'string') return anyErr.message;
    if (typeof anyErr.error === 'string') return anyErr.error;
    if (anyErr?.toString) return anyErr.toString();
  } catch (_) {
    // fallthrough
  }
  return 'Unknown error';
}

/**
 * Get detailed error message with status code context
 * Provides better error context for HTTP errors
 */
export function getDetailedErrorMessage(err: unknown): { message: string; statusCode?: number } {
  if (!err) return { message: 'Unknown error' };
  
  const anyErr = err as any;
  
  // Try to extract status code and message
  let statusCode: number | undefined;
  let message: string = 'Unknown error';
  
  // Check for statusCode property (ApiError)
  if (typeof anyErr.statusCode === 'number') {
    statusCode = anyErr.statusCode;
  }
  
  // Check for response status (axios error)
  if (typeof anyErr?.response?.status === 'number') {
    statusCode = anyErr.response.status;
  }
  
  // Get the message
  message = getErrorMessage(err);
  
  // Add context for common HTTP errors if message is generic
  if (statusCode && message === 'Unknown error') {
    const errorContext: Record<number, string> = {
      400: 'Bad request. Please check your input and try again.',
      401: 'Your session has expired. Please log in again.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested resource was not found.',
      409: 'This resource already exists. Please use a different value.',
      422: 'Invalid data provided. Please check and try again.',
      429: 'Too many requests. Please wait a moment and try again.',
      500: 'Server error occurred. Please try again later or contact support.',
      502: 'Bad gateway. The server is temporarily unavailable.',
      503: 'Service unavailable. Please try again later.',
    };
    message = errorContext[statusCode] || `Error ${statusCode}: Request failed`;
  }
  
  return { message, statusCode };
}

export default {
  getErrorMessage,
  getDetailedErrorMessage,
};
