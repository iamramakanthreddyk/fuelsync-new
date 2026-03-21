/**
 * Authentication Service
 * Business logic for user authentication and authorization
 * Handles JWT token generation, password management, and user account operations
 */

const jwt = require('jsonwebtoken');
const { User, Plan, Station } = require('../models');
const { Op } = require('sequelize');
const { logAudit } = require('../utils/auditLog');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');

const MAX_CONCURRENT_LOGINS = parseInt(process.env.MAX_CONCURRENT_LOGINS || '3', 10);
const LOGIN_TIME_WINDOW_MINUTES = parseInt(process.env.LOGIN_TIME_WINDOW_MINUTES || '60', 10);

/**
 * Get JWT secret from environment
 * @throws {Error} if JWT_SECRET is not configured
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

/**
 * Generate JWT token for user
 * @param {number} userId - User ID
 * @param {string} userRole - User role
 * @returns {string} JWT token
 */
function generateToken(userId, userRole) {
  const secret = getJwtSecret();
  return jwt.sign(
    { id: userId, role: userRole },
    secret,
    { expiresIn: '7d' }
  );
}

/**
 * Get IP address from request
 * @param {object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIp(req) {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

/**
 * Register a new user
 * @param {object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {string} userData.password - User password (will be hashed)
 * @param {string} userData.name - User full name
 * @param {string} userData.phone - User phone number (optional)
 * @param {string} userData.role - User role (owner, manager, employee)
 * @param {number} userData.stationId - Station ID for manager/employee
 * @returns {object} Token and user data
 * @throws {ValidationError} if email exists or validation fails
 * @throws {NotFoundError} if station not found
 */
async function register(userData) {
  const { email, password, name, phone, role, stationId } = userData;

  // Validation
  if (!email || !password || !name) {
    throw new ValidationError('Email, password, and name are required');
  }

  // Check if email exists
  const existingUser = await User.findOne({ 
    where: { email: email.toLowerCase() } 
  });
  if (existingUser) {
    throw new ValidationError('Email already registered');
  }

  // Determine role (default to owner for self-registration)
  let userRole = role || 'owner';
  let userStationId = stationId;

  // If registering as employee/manager, must have stationId
  if (['employee', 'manager'].includes(userRole)) {
    if (!stationId) {
      throw new ValidationError('Station ID required for employee/manager registration');
    }
    
    // Verify station exists
    const station = await Station.findByPk(stationId);
    if (!station) {
      throw new NotFoundError('Station not found');
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

  return {
    token,
    user: user.toSafeObject()
  };
}

/**
 * Get current user information
 * @param {number} userId - User ID
 * @param {number} workspaceId - Workspace/Organization ID
 * @returns {object} User data with stations
 * @throws {NotFoundError} if user not found
 */
async function getCurrentUser(userId, workspaceId) {
  const user = await User.findByPk(userId, {
    include: [
      { model: Plan, as: 'plan' },
      { model: Station, as: 'station' }
    ],
    attributes: { exclude: ['password'] }
  });

  if (!user) {
    throw new NotFoundError('User not found');
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

  return userData;
}

/**
 * Change user password
 * @param {number} userId - User ID
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password
 * @throws {ValidationError} if passwords are missing
 * @throws {NotFoundError} if user not found
 * @throws {AuthorizationError} if current password is incorrect
 */
async function changePassword(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new ValidationError('currentPassword and newPassword are required');
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AuthorizationError('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();
}

/**
 * Logout user (log audit event)
 * @param {number} userId - User ID
 * @param {string} clientIp - Client IP address
 * @param {string} userAgent - User agent string
 */
async function logout(userId, clientIp, userAgent) {
  if (userId) {
    const user = await User.findByPk(userId);
    if (user) {
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        stationId: user.stationId,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: user.id,
        category: 'auth',
        severity: 'info',
        success: true,
        ip: clientIp,
        userAgent: userAgent,
        description: `User logged out`
      });
    }
  }
}

/**
 * Export all service functions
 */
module.exports = {
  generateToken,
  getClientIp,
  getJwtSecret,
  register,
  getCurrentUser,
  changePassword,
  logout
};
