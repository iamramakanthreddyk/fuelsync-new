/**
 * Error Handler Middleware
 * Centralizes error handling and response formatting
 */

const { convertError } = require('../utils/errors');
const { createContextLogger } = require('../services/loggerService');
const logger = createContextLogger('ErrorHandler');

/**
 * Error handler middleware
 * Must be the last middleware in the app to catch all errors
 *
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function errorHandler(err, req, res, next) {
  // Convert error to AppError
  const appError = convertError(err);

  // Extract request context for logging
  const requestId = req.id || req.requestId || 'unknown';
  const { method, path } = req;
  const userId = req.user?.id || 'anonymous';
  const userEmail = req.user?.email || null;

  // Log error with context
  const logContext = {
    requestId,
    method,
    path,
    userId,
    userEmail,
    statusCode: appError.statusCode,
    errorName: appError.name,
    errorMessage: appError.message,
  };

  // Log at different levels based on status code
  if (appError.statusCode >= 500) {
    logger.error('Server error', { ...logContext, stack: appError.stack });
  } else if (appError.statusCode >= 400) {
    logger.warn('Client error', logContext);
  } else {
    logger.debug('Response', logContext);
  }

  // Build response object
  const isProduction = process.env.NODE_ENV === 'production';

  const response = {
    success: false,
    error: appError.message,
    statusCode: appError.statusCode,
    timestamp: appError.timestamp,
  };

  // Include details based on environment
  if (isProduction) {
    // In production, only include safe details
    response.details =
      appError.details && appError.statusCode < 500
        ? appError.details
        : null;
  } else {
    // In development, include all details and stack trace
    response.details = appError.details;
    response.stack = appError.stack;
  }

  // Send error response
  res.status(appError.statusCode).json(response);
}

module.exports = errorHandler;
