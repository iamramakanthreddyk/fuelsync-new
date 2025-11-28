/**
 * Role-based Authorization Middleware
 * Provides fine-grained access control based on user roles
 */

/**
 * Require specific roles to access a route
 * @param {string[]} allowedRoles - Array of allowed role names
 * @returns {Function} Express middleware
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Normalize role names (handle both snake_case and spaces)
    const userRole = req.user.role.toLowerCase().replace(/\s+/g, '_');
    const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase().replace(/\s+/g, '_'));

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Require station access - user must belong to the station or be super admin
 * @returns {Function} Express middleware
 */
const requireStationAccess = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const stationId = req.params.stationId || req.body.stationId || req.query.stationId;
    
    // Super admin has access to all stations
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user belongs to the requested station
    if (stationId && req.user.stationId !== stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this station'
      });
    }

    next();
  };
};

/**
 * Require ownership - user must own the resource or be super admin
 * @param {Function} getOwnerId - Function to extract owner ID from request
 * @returns {Function} Express middleware
 */
const requireOwnership = (getOwnerId) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Super admin can access anything
    if (req.user.role === 'super_admin') {
      return next();
    }

    try {
      const ownerId = await getOwnerId(req);
      
      if (ownerId !== req.userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this resource'
        });
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({
        success: false,
        error: 'Authorization check failed'
      });
    }
  };
};

/**
 * Role hierarchy for permission checks
 */
const ROLE_HIERARCHY = {
  'super_admin': 4,
  'owner': 3,
  'manager': 2,
  'employee': 1
};

/**
 * Check if user role is at least the minimum required level
 * @param {string} minRole - Minimum required role
 * @returns {Function} Express middleware
 */
const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role.toLowerCase().replace(/\s+/g, '_');
    const minRoleNormalized = minRole.toLowerCase().replace(/\s+/g, '_');

    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const minLevel = ROLE_HIERARCHY[minRoleNormalized] || 0;

    if (userLevel < minLevel) {
      return res.status(403).json({
        success: false,
        error: `Minimum role required: ${minRole}`,
        current: req.user.role
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
  requireStationAccess,
  requireOwnership,
  requireMinRole,
  ROLE_HIERARCHY
};
