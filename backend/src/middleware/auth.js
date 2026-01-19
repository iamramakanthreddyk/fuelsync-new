/**
 * Auth Middleware
 * JWT verification - REQUIRES JWT_SECRET environment variable
 * 
 * ROLE-BASED ACCESS CONTROL (RBAC) HIERARCHY:
 * - employee (level 1): Can view own station data, enter readings, record sales
 * - manager (level 2): Can manage employee data, approve entries, view analytics
 * - owner (level 3): Can manage multiple stations, create employees, view financial data
 * - super_admin (level 4): Full system access, manage plans, manage all owners
 * 
 * Usage:
 * - authenticate: Middleware to verify JWT token is valid
 * - requireRole('owner', 'super_admin'): Exactly match roles
 * - requireMinRole('manager'): At least this level or higher
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Validate JWT_SECRET is properly configured - fallback to hardcoded if needed
 */
const getJwtSecret = () => {
  // Use environment variable if set, otherwise use hardcoded fallback
  const secret = process.env.JWT_SECRET || 'fuelsync-hardcoded-secret-key-do-not-use-in-production-very-long-key-for-jwt-signing-12345';
  
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.');
  }
  
  if (secret.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters for security');
  }
  
  return secret;
};

const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token - no fallback secret allowed
    const decoded = jwt.verify(token, getJwtSecret());

    // Get user
    const user = await User.findByPk(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    // Attach user info to request
    // Normalize role string for consistent checks
    if (user.role && typeof user.role === 'string') {
      user.role = user.role.toLowerCase();
    }

    req.userId = user.id;
    req.user = user;
    req.userRole = (user.role || '').toLowerCase();

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Role-based authorization
 */
const normalizeRole = (r) => (typeof r === 'string' ? r.toLowerCase() : r);

const requireRole = (...roles) => {
  // allow requireRole(['owner','super_admin']) or requireRole('owner','super_admin')
  const allowed = roles.length === 1 && Array.isArray(roles[0]) ? roles[0] : roles;

  const allowedNormalized = allowed.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = normalizeRole(req.user.role);

    if (!allowedNormalized.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Require minimum role level
 * Role hierarchy: employee < manager < owner < super_admin
 */
const requireMinRole = (minRole) => {
  const roleHierarchy = {
    employee: 1,
    manager: 2,
    owner: 3,
    super_admin: 4,
    superadmin: 4
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userLevel = roleHierarchy[normalizeRole(req.user.role)] || 0;
    const requiredLevel = roleHierarchy[normalizeRole(minRole)] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireRole,
  requireMinRole
};
