/**
 * Response Handler Utility
 * Standardizes all API responses across the application
 * Ensures consistent response structure: {success: boolean, data?: T, message?: string, error?: string}
 */

/**
 * Send successful response
 * @param {Response} res - Express response object
 * @param {any} data - Response data payload
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default 200)
 */
function sendSuccess(res, data, message = null, statusCode = 200) {
  const response = {
    success: true,
    data: data || null
  };

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send error response
 * @param {Response} res - Express response object
 * @param {string|object} error - Error message or error object
 * @param {number} statusCode - HTTP status code (default 400)
 * @param {array} details - Optional error details array
 */
function sendError(res, error, statusCode = 400, details = null) {
  const response = {
    success: false
  };

  if (typeof error === 'string') {
    response.error = error;
  } else if (error && typeof error === 'object') {
    response.error = error.message || 'An error occurred';
    if (!statusCode && error.statusCode) {
      statusCode = error.statusCode;
    }
  } else {
    response.error = 'An unexpected error occurred';
  }

  if (details && Array.isArray(details)) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send validation error response
 * @param {Response} res - Express response object
 * @param {array} errors - Array of validation errors
 */
function sendValidationError(res, errors) {
  return sendError(res, 'Validation error', 400, errors);
}

/**
 * Send unauthorized response
 * @param {Response} res - Express response object
 * @param {string} message - Optional error message
 */
function sendUnauthorized(res, message = 'Unauthorized') {
  return sendError(res, message, 401);
}

/**
 * Send forbidden response
 * @param {Response} res - Express response object
 * @param {string} message - Optional error message
 */
function sendForbidden(res, message = 'Access denied') {
  return sendError(res, message, 403);
}

/**
 * Send not found response
 * @param {Response} res - Express response object
 * @param {string} resource - Resource name (e.g., 'Station')
 */
function sendNotFound(res, resource = 'Resource') {
  return sendError(res, `${resource} not found`, 404);
}

/**
 * Send conflict response
 * @param {Response} res - Express response object
 * @param {string} message - Conflict message
 */
function sendConflict(res, message) {
  return sendError(res, message, 409);
}

module.exports = {
  sendSuccess,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict
};
