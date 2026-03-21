/**
 * Response Formatting Middleware
 * 
 * Ensures all responses are formatted consistently
 * Applied after route handlers but before sending to client
 */

const { sendSuccess, formatSuccess, formatError } = require('../utils/apiResponse');

/**
 * Middleware to add response helpers to res object
 * Provides: res.sendSuccess(), res.sendError(), res.sendCreated()
 * 
 * Usage in controllers:
 *   return res.sendSuccess(data);
 *   return res.sendError('NOT_FOUND', 'Resource not found', 404);
 */
const responseFormatterMiddleware = (req, res, next) => {
  // Add helper methods to response object
  
  /**
   * Send success response
   * @param {*} data - Response data
   * @param {number} [statusCode=200] - HTTP status
   * @param {Object} [options] - Additional options (message, metadata)
   */
  res.sendSuccess = (data, statusCode = 200, options = {}) => {
    return res.status(statusCode).json(formatSuccess(data, options));
  };

  /**
   * Send paginated response
   * @param {Array} items - Array of items
   * @param {Object} pagination - Pagination details {page, limit, total}
   * @param {number} [statusCode=200] - HTTP status
   * @param {Object} [options] - Additional options
   */
  res.sendPaginated = (items, pagination, statusCode = 200, options = {}) => {
    const pages = Math.ceil(pagination.total / pagination.limit);
    return res.status(statusCode).json(
      formatSuccess(items, {
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
      })
    );
  };

  /**
   * Send created (201) response
   * @param {Object} data - Created resource
   * @param {Object} [options] - Additional options
   */
  res.sendCreated = (data, options = {}) => {
    return res.status(201).json(
      formatSuccess(data, {
        message: 'Resource created successfully',
        ...options,
      })
    );
  };

  /**
   * Send error response
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {number} [statusCode=400] - HTTP status
   * @param {Object} [options] - Additional options (field, details)
   */
  res.sendError = (code, message, statusCode = 400, options = {}) => {
    const error = {
      code,
      message,
      timestamp: new Date().toISOString(),
    };

    if (options.field) {
      error.field = options.field;
    }

    if (options.details && Array.isArray(options.details) && options.details.length > 0) {
      error.details = options.details;
    }

    return res.status(statusCode).json({
      success: false,
      error,
    });
  };

  /**
   * Send no content (204) response
   */
  res.sendNoContent = () => {
    return res.status(204).send();
  };

  next();
};

module.exports = responseFormatterMiddleware;
