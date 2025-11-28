/**
 * Audit Logging Middleware
 * Automatically logs significant API actions
 */

const { AuditLog } = require('../models');

/**
 * Actions that should be logged
 */
const LOGGABLE_ACTIONS = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE'
};

/**
 * Routes/entities to log
 */
const ENTITY_MAPPING = {
  '/api/v1/stations': 'station',
  '/api/v1/pumps': 'pump',
  '/api/v1/nozzles': 'nozzle',
  '/api/v1/users': 'user',
  '/api/v1/prices': 'fuel_price',
  '/api/v1/inventory/tanks': 'fuel_tank',
  '/api/v1/inventory/deliveries': 'fuel_delivery',
  '/api/v1/closures': 'daily_closure',
  '/api/v1/sales': 'sale',
  '/api/v1/uploads': 'upload'
};

/**
 * Determine entity type from URL
 */
const getEntityType = (url) => {
  for (const [pattern, entity] of Object.entries(ENTITY_MAPPING)) {
    if (url.startsWith(pattern)) {
      return entity;
    }
  }
  return 'unknown';
};

/**
 * Extract entity ID from URL or response
 */
const getEntityId = (req, responseData) => {
  // Try to get from URL params
  const idMatch = req.originalUrl.match(/\/([a-f0-9-]{36})/i);
  if (idMatch) return idMatch[1];
  
  // Try to get from response data
  if (responseData?.data?.id) return responseData.data.id;
  
  return null;
};

/**
 * Middleware to log audit trail
 */
const auditLogger = (options = {}) => {
  const { 
    excludePaths = ['/api/v1/auth/login', '/api/v1/health', '/api/v1/docs'],
    logReads = false 
  } = options;

  return async (req, res, next) => {
    // Skip if not a loggable action
    const action = LOGGABLE_ACTIONS[req.method];
    if (!action && !logReads) {
      return next();
    }

    // Skip excluded paths
    if (excludePaths.some(path => req.originalUrl.startsWith(path))) {
      return next();
    }

    // Store original send
    const originalSend = res.send;
    let responseData;

    // Intercept response
    res.send = function(body) {
      try {
        responseData = typeof body === 'string' ? JSON.parse(body) : body;
      } catch (e) {
        responseData = body;
      }
      return originalSend.call(this, body);
    };

    // Continue with request
    res.on('finish', async () => {
      // Only log successful mutations
      if (!action || res.statusCode >= 400) return;
      if (!req.userId) return; // No authenticated user

      try {
        const entityType = getEntityType(req.originalUrl);
        const entityId = getEntityId(req, responseData);

        await AuditLog.logAction({
          userId: req.userId,
          stationId: req.user?.stationId || req.body?.stationId,
          action,
          entityType,
          entityId,
          previousValues: null, // Would need to fetch before update for this
          newValues: action === 'DELETE' ? null : req.body,
          metadata: {
            url: req.originalUrl,
            method: req.method,
            statusCode: res.statusCode
          },
          req
        });
      } catch (error) {
        console.error('Audit logging error:', error);
        // Don't fail the request for audit logging errors
      }
    });

    next();
  };
};

/**
 * Manual audit logging helper for controllers
 */
const logAudit = async (req, options) => {
  const {
    action,
    entityType,
    entityId,
    previousValues,
    newValues,
    metadata
  } = options;

  try {
    await AuditLog.logAction({
      userId: req.userId,
      stationId: req.user?.stationId,
      action,
      entityType,
      entityId,
      previousValues,
      newValues,
      metadata,
      req
    });
  } catch (error) {
    console.error('Manual audit logging error:', error);
  }
};

module.exports = {
  auditLogger,
  logAudit
};
