/**
 * Standardized API Response Formatter
 * 
 * Ensures all API responses follow consistent structure:
 * - Success: { success: true, data: {...}, [metadata]: {...} }
 * - Error: { success: false, error: { code, message, ... } }
 */

/**
 * Format success response
 * @param {*} data - Response data
 * @param {Object} [options] - Options object
 * @param {string} [options.message] - Success message
 * @param {Object} [options.metadata] - Additional metadata (pagination, counts, etc)
 * @returns {Object} Formatted response
 */
const formatSuccess = (data, options = {}) => {
  const response = {
    success: true,
    data,
  };

  if (options.message) {
    response.message = options.message;
  }

  if (options.metadata) {
    response.metadata = options.metadata;
  }

  return response;
};

/**
 * Format paginated success response
 * @param {Array} items - Array of items
 * @param {Object} pagination - Pagination details
 * @param {number} pagination.page - Current page (1-indexed)
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.total - Total count
 * @param {Object} [options] - Additional options
 * @returns {Object} Formatted paginated response
 */
const formatPaginated = (items, pagination, options = {}) => {
  const pages = Math.ceil(pagination.total / pagination.limit);
  
  return formatSuccess(items, {
    ...options,
    metadata: {
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages,
        hasMore: pagination.page < pages,
      },
      ...options.metadata,
    },
  });
};

/**
 * Format error response
 * @param {string} code - Error code (e.g., NOT_FOUND, VALIDATION_ERROR)
 * @param {string} message - Human-readable error message
 * @param {Object} [options] - Options object
 * @param {string} [options.field] - Field name if field-specific error
 * @param {Array} [options.details] - Additional error details (validation errors, etc)
 * @returns {Object} Formatted error response
 */
const formatError = (code, message, options = {}) => {
  const error = {
    code,
    message,
  };

  if (options.field) {
    error.field = options.field;
  }

  if (options.details && Array.isArray(options.details) && options.details.length > 0) {
    error.details = options.details;
  }

  return {
    success: false,
    error,
  };
};

/**
 * Send success response
 * @param {Response} res - Express response object
 * @param {*} data - Response data
 * @param {number} [statusCode=200] - HTTP status code
 * @param {Object} [options] - Additional options
 */
const sendSuccess = (res, data, statusCode = 200, options = {}) => {
  return res.status(statusCode).json(formatSuccess(data, options));
};

/**
 * Send paginated success response
 * @param {Response} res - Express response object
 * @param {Array} items - Array of items
 * @param {Object} pagination - Pagination details
 * @param {number} [statusCode=200] - HTTP status code
 * @param {Object} [options] - Additional options
 */
const sendPaginated = (res, items, pagination, statusCode = 200, options = {}) => {
  return res.status(statusCode).json(formatPaginated(items, pagination, options));
};

/**
 * Send error response
 * @param {Response} res - Express response object
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {number} [statusCode=400] - HTTP status code
 * @param {Object} [options] - Additional options
 */
const sendError = (res, code, message, statusCode = 400, options = {}) => {
  return res.status(statusCode).json(formatError(code, message, options));
};

/**
 * Created (201) success response
 * @param {Response} res - Express response object
 * @param {Object} data - Created resource
 * @param {Object} [options] - Additional options
 */
const sendCreated = (res, data, options = {}) => {
  return sendSuccess(res, data, 201, options);
};

/**
 * No content (204) response
 * @param {Response} res - Express response object
 */
const sendNoContent = (res) => {
  return res.status(204).send();
};

/**
 * Map HTTP status to error code
 * @param {number} statusCode - HTTP status code
 * @returns {string} Error code
 */
const mapStatusToErrorCode = (statusCode) => {
  const codeMap = {
    400: 'INVALID_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    500: 'INTERNAL_ERROR',
    503: 'SERVICE_UNAVAILABLE',
  };
  return codeMap[statusCode] || 'OPERATION_FAILED';
};

module.exports = {
  // Format functions
  formatSuccess,
  formatPaginated,
  formatError,

  // Send functions
  sendSuccess,
  sendPaginated,
  sendError,
  sendCreated,
  sendNoContent,

  // Utility
  mapStatusToErrorCode,
};
