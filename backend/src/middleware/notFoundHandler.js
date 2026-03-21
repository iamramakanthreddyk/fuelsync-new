/**
 * 404 Not Found Handler Middleware
 * Handles requests to undefined routes
 */

/**
 * 404 handler middleware
 * Should be placed after all other route definitions
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function notFoundHandler(req, res, next) {
  const response = {
    success: false,
    error: 'Endpoint not found',
    statusCode: 404,
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(response);
}

module.exports = notFoundHandler;
