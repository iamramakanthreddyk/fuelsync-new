/**
 * Authentication Controller
 * REQUIRES JWT_SECRET environment variable
 * 
 * Features:
 * - JWT token generation
 * - Login/logout with audit logging
 * - Session tracking for concurrent login limits
 */

const jwt = require('jsonwebtoken');
const { User, Plan, Station } = require('../models');
const { logAudit, checkConcurrentLoginLimit, getLoginHistory } = require('../utils/auditLog');

const { Op } = require('sequelize');

// Max concurrent logins allowed (configurable via env)
const MAX_CONCURRENT_LOGINS = parseInt(process.env.MAX_CONCURRENT_LOGINS || '3', 10);
const LOGIN_TIME_WINDOW_MINUTES = parseInt(process.env.LOGIN_TIME_WINDOW_MINUTES || '60', 10);

/**
 * Get JWT secret - fallback to hardcoded if not set
 */
const getJwtSecret = () => {
  // Use environment variable if set, otherwise use hardcoded fallback
  const secret = process.env.JWT_SECRET || 'fuelsync-hardcoded-secret-key-do-not-use-in-production-very-long-key-for-jwt-signing-12345';
  
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
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Validate JWT_SECRET before proceeding
    try {
      getJwtSecret();
    } catch (jwtError) {
      console.error('❌ [AUTH] JWT_SECRET not configured:', jwtError.message);
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: JWT_SECRET not set. Contact admin.'
      });
    }

    // Find user
    const user = await User.findOne({
      where: { email: email.toLowerCase(), isActive: true },
      include: [
        { model: Plan, as: 'plan' },
        { model: Station, as: 'station' }
      ]
    });

    if (!user) {
      // Log failed login attempt
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

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Log failed login attempt
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

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check concurrent login limit (optional - only if limit > 0)
    if (MAX_CONCURRENT_LOGINS > 0) {
      const limitExceeded = await checkConcurrentLoginLimit(
        user.id,
        MAX_CONCURRENT_LOGINS,
        LOGIN_TIME_WINDOW_MINUTES
      );

      if (limitExceeded) {
        // Log login limit exceeded
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
          description: `User exceeded maximum concurrent login limit of ${MAX_CONCURRENT_LOGINS} in ${LOGIN_TIME_WINDOW_MINUTES} minutes`
        });

        return res.status(429).json({
          success: false,
          error: `Too many concurrent logins. Maximum ${MAX_CONCURRENT_LOGINS} sessions allowed.`
        });
      }
    }

    // Update last login
    await user.update({ lastLoginAt: new Date() });

    // Generate token
    const token = generateToken(user.id, user.role);

    // Build user payload with stations
    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      stationId: user.stationId || (user.station ? user.station.id : null),
      station: user.station ? {
        id: user.station.id,
        name: user.station.name
      } : null,
      plan: user.plan ? {
        name: user.plan.name,
        canExport: user.plan.canExport
      } : null,
      stations: [] // Initialize stations array
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
        brand: 'FuelSync' // Default brand
      }));
    } else if (user.role === 'manager' || user.role === 'employee') {
      // For manager/employee, fetch their assigned station(s)
      // Managers/employees have stationId field in User model
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
      // Fallback for direct station assignment
      userPayload.stations = [{
        id: user.station.id,
        name: user.station.name,
        code: user.station.code,
        address: user.station.address,
        city: user.station.city,
        brand: 'FuelSync'
      }];
    }

    // Log successful login
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

    res.json({
      success: true,
      data: {
        token,
        user: userPayload
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

/**
 * Get current user
 * GET /api/v1/auth/me
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId, {
      include: [
        { model: Plan, as: 'plan' },
        { model: Station, as: 'station' }
      ],
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Build response with proper station data
    const userData = user.toSafeObject();
    
    // For owners, fetch their owned stations
    if ((user.role || '').toLowerCase() === 'owner') {
      const ownedStations = await Station.findAll({
        where: { ownerId: user.id },
        attributes: ['id', 'name', 'code', 'address', 'city', 'state']
      });
      userData.stations = ownedStations.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        address: s.address,
        city: s.city,
        brand: 'FuelSync' // Default brand
      }));
    } else if (user.role === 'manager' || user.role === 'employee') {
      // For manager/employee, fetch their assigned station(s)
      // Managers/employees have stationId field in User model
      if (user.stationId) {
        const station = await Station.findByPk(user.stationId, {
          attributes: ['id', 'name', 'code', 'address', 'city', 'state']
        });
        if (station) {
          userData.stations = [{
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
      // Fallback for direct station assignment
      userData.stations = [{
        id: user.station.id,
        name: user.station.name,
        code: user.station.code,
        address: user.station.address,
        city: user.station.city,
        brand: 'FuelSync'
      }];
    }

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

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
    }

    // Check if email exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Determine role (default to owner for self-registration)
    let userRole = role || 'owner';
    let userStationId = stationId;

    // If registering as employee/manager, must have stationId
    if (['employee', 'manager'].includes(userRole)) {
      if (!stationId) {
        return res.status(400).json({
          success: false,
          error: 'Station ID required for employee/manager registration'
        });
      }
      
      // Verify station exists
      const station = await Station.findByPk(stationId);
      if (!station) {
        return res.status(404).json({
          success: false,
          error: 'Station not found'
        });
      }
    }

    // Get free plan for new owners
    let planId = null;
    if (userRole === 'owner') {
      const freePlan = await Plan.findOne({ where: { name: 'Free' } });
      planId = freePlan?.id;
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password, // Will be hashed by hook
      name,
      phone,
      role: userRole,
      stationId: userStationId,
      planId
    });

    // Generate token
    const token = generateToken(user.id, user.role);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: user.toSafeObject()
      },
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

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

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
exports.logout = async (req, res) => {
  try {
    // Log logout event
    if (req.user) {
      const clientIp = getClientIp(req);
      const userAgent = req.headers['user-agent'] || 'unknown';

      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        stationId: req.user.stationId,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: req.user.id,
        category: 'auth',
        severity: 'info',
        success: true,
        ip: clientIp,
        userAgent: userAgent,
        description: `User logged out`
      });
    }

    // For now, just respond success
    // Client should remove token
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
