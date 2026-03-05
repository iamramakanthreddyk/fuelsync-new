/**
 * Request ID Tracking Middleware (Issue #15 fix)
 * Adds unique request ID for tracing through logs
 */

const { v4: uuid } = require('uuid');
const crypto = require('crypto');

/**
 * Generate or retrieve request ID
 */
const generateRequestId = (req) => {
  // Check if client provided a request ID
  const clientId = req.headers['x-request-id'] || 
                  req.headers['X-Request-ID'] || 
                  req.headers['request-id'];

  if (clientId) {
    return clientId;
  }

  // Generate new ID
  // Format: timestamp-random-sequence for readability
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  
  return `${timestamp}-${random}`;
};

/**
 * Request ID tracking middleware
 */
const requestTracking = (req, res, next) => {
  // Generate or retrieve request ID
  req.requestId = generateRequestId(req);

  // Attach to response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Store for logging
  req.correlationId = req.requestId;

  // Log request
  const logData = {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    userId: req.userId || 'anonymous',
    timestamp: new Date().toISOString()
  };

  // Attach to res.locals for downstream use
  res.locals.requestId = req.requestId;
  res.locals.logData = logData;

  // Log start of request
  console.log('[Request Start]', JSON.stringify(logData));

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const responseData = {
      requestId: req.requestId,
      statusCode: res.statusCode,
      method: req.method,
      path: req.path,
      respondedAt: new Date().toISOString(),
      duration: `${Date.now() - (req.timestamp || 0)}ms`
    };

    console.log('[Request End]', JSON.stringify(responseData));

    return originalJson(data);
  };

  // Capture request start time for duration calculation
  req.timestamp = Date.now();

  next();
};

/**
 * Middleware to track async operations
 */
const trackAsyncOperation = (operationName) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    const requestId = req.requestId;

    console.log(`[Async Operation Start] ${operationName}`, {
      requestId,
      timestamp: new Date().toISOString()
    });

    try {
      next();
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`[Async Operation Error] ${operationName}`, {
        requestId,
        error: err.message,
        stack: err.stack,
        duration: `${duration}ms`
      });
      throw err;
    }
  };
};

/**
 * Helper to log with request ID
 */
const createLogger = (requestId) => {
  return {
    info: (message, data = {}) => {
      console.log(message, JSON.stringify({ requestId, ...data }));
    },
    error: (message, error, data = {}) => {
      console.error(message, JSON.stringify({
        requestId,
        error: error?.message || error,
        stack: error?.stack,
        ...data
      }));
    },
    warn: (message, data = {}) => {
      console.warn(message, JSON.stringify({ requestId, ...data }));
    },
    debug: (message, data = {}) => {
      if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] ${message}`, JSON.stringify({ requestId, ...data }));
      }
    }
  };
};

module.exports = {
  requestTracking,
  trackAsyncOperation,
  createLogger,
  generateRequestId
};
