/**
 * Authentication Controller
 * REQUIRES JWT_SECRET environment variable
 * Features: JWT tokens, login/logout with audit, session tracking, concurrent login limits
 */

// ===== MODELS & DATABASE =====
const jwt = require('jsonwebtoken');
const { User, Plan, Station } = require('../models');
const { Op } = require('sequelize');

// ===== SERVICES =====
const authService = require('../services/authService');

// ===== ERROR & RESPONSE HANDLING =====
const { asyncHandler, NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');

// ===== MIDDLEWARE & CONFIG =====
const { logAudit, checkConcurrentLoginLimit, getLoginHistory } = require('../utils/auditLog');

// ===== UTILITIES =====
const MAX_CONCURRENT_LOGINS = parseInt(process.env.MAX_CONCURRENT_LOGINS || '3', 10);
const LOGIN_TIME_WINDOW_MINUTES = parseInt(process.env.LOGIN_TIME_WINDOW_MINUTES || '60', 10);

/**
 * Get JWT_SECRET — fails hard if not configured.
 * A hardcoded fallback is intentionally NOT provided to prevent accidental
 * use of a known secret in production.
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set');
  }

  if (secret.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters for security');
  }

  return secret;
};

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role }, 
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRATION || '24h' }
  );
};

/**
 * Get client IP address from request
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown';
};

/**
 * User login
 * POST /api/v1/auth/login
 */
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (!email || !password) {
    return sendError(res, 'MISSING_FIELDS', 'Email and password are required', 400);
  }

  try {
    getJwtSecret();
  } catch (jwtError) {
    console.error('❌ [AUTH] JWT_SECRET not configured:', jwtError.message);
    return sendError(res, 'CONFIG_ERROR', 'Server configuration error: JWT_SECRET not set', 500);
  }

  const user = await User.findOne({
    where: { email: email.toLowerCase(), isActive: true },
    include: [
      { model: Plan, as: 'plan' },
      { model: Station, as: 'station' }
    ]
  });

  if (!user) {
    await logAudit({
      userEmail: email.toLowerCase(),
      action: 'LOGIN',
      entityType: 'User',
      category: 'auth',
      severity: 'warning',
      success: false,
      errorMessage: 'Invalid email or password',
      ip: clientIp,
      userAgent: userAgent,
      description: `Failed login attempt for non-existent or inactive user`
    });
    return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      stationId: user.stationId,
      action: 'LOGIN',
      entityType: 'User',
      category: 'auth',
      severity: 'warning',
      success: false,
      errorMessage: 'Invalid password',
      ip: clientIp,
      userAgent: userAgent,
      description: `Failed login - incorrect password`
    });
    return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  if (MAX_CONCURRENT_LOGINS > 0) {
    const limitExceeded = await checkConcurrentLoginLimit(
      user.id,
      MAX_CONCURRENT_LOGINS,
      LOGIN_TIME_WINDOW_MINUTES
    );

    if (limitExceeded) {
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        stationId: user.stationId,
        action: 'LOGIN',
        entityType: 'User',
        category: 'auth',
        severity: 'critical',
        success: false,
        errorMessage: `Concurrent login limit (${MAX_CONCURRENT_LOGINS}) exceeded`,
        ip: clientIp,
        userAgent: userAgent,
        description: `User exceeded maximum concurrent login limit of ${MAX_CONCURRENT_LOGINS}`
      });
      return sendError(res, 'LOGIN_LIMIT_EXCEEDED', `Maximum ${MAX_CONCURRENT_LOGINS} sessions allowed`, 429);
    }
  }

  await user.update({ lastLoginAt: new Date() });
  const token = generateToken(user.id, user.role);

  // Build user payload with stations
  const userPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    stationId: user.stationId || (user.station ? user.station.id : null),
    station: user.station ? { id: user.station.id, name: user.station.name } : null,
    plan: user.plan ? { name: user.plan.name, canExport: user.plan.canExport } : null,
    stations: []
  };

  // For owners, fetch their owned stations
  if ((user.role || '').toLowerCase() === 'owner') {
    const ownedStations = await Station.findAll({
      where: { ownerId: user.id },
      attributes: ['id', 'name', 'code', 'address', 'city', 'state']
    });
    userPayload.stations = ownedStations.map(s => ({
      id: s.id,
      name: s.name,
      code: s.code,
      address: s.address,
      city: s.city,
      brand: 'FuelSync'
    }));
  } else if (user.role === 'manager' || user.role === 'employee') {
    if (user.stationId) {
      const station = await Station.findByPk(user.stationId, {
        attributes: ['id', 'name', 'code', 'address', 'city', 'state']
      });
      if (station) {
        userPayload.stations = [{
          id: station.id,
          name: station.name,
          code: station.code,
          address: station.address,
          city: station.city,
          brand: 'FuelSync'
        }];
      }
    }
  } else if (user.station) {
    userPayload.stations = [{
      id: user.station.id,
      name: user.station.name,
      code: user.station.code,
      address: user.station.address,
      city: user.station.city,
      brand: 'FuelSync'
    }];
  }

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    stationId: user.stationId,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
    category: 'auth',
    severity: 'info',
    success: true,
    ip: clientIp,
    userAgent: userAgent,
    description: `${user.role} user logged in successfully`
  });

  return sendSuccess(res, { token, user: userPayload }, 200, { message: 'Login successful' });
});

/**
 * Get current user
 * GET /api/v1/auth/me
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.userId;
    const workspaceId = req.user?.workspaceId;

    const userData = await authService.getCurrentUser(userId, workspaceId);

    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Get current user error:', error);
    next(error);
  }
};

/**
 * Register new user (owner signup or employee invite)
 * POST /api/v1/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, name, phone, role, stationId } = req.body;

    const result = await authService.register({
      email,
      password,
      name,
      phone,
      role,
      stationId
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Registration successful'
    });
  } catch (error) {
    console.error('Register error:', error);
    next(error);
  }
};

/**
 * Change password for current user
 * POST /api/v1/auth/change-password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(userId, currentPassword, newPassword);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    next(error);
  }
};

/**
 * Logout (client-side token removal, optionally blacklist)
 * POST /api/v1/auth/logout
 */
exports.logout = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    await authService.logout(userId, clientIp, userAgent);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still return success - logout should not fail
    res.json({
      success: true,
      message: 'Logged out'
    });
  }
};
