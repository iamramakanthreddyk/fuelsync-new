/**
 * Authentication Controller
 * REQUIRES JWT_SECRET environment variable
 */

const jwt = require('jsonwebtoken');
const { User, Plan, Station } = require('../models');

/**
 * Get JWT secret - throws if not configured
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set');
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
 * User login
 * POST /api/v1/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
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
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    await user.update({ lastLoginAt: new Date() });

    // Generate token
    const token = generateToken(user.id, user.role);

    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      station: user.station ? {
        id: user.station.id,
        name: user.station.name
      } : null,
      plan: user.plan ? {
        name: user.plan.name,
        canExport: user.plan.canExport
      } : null
    };

    // Backwards-compatible response: include top-level token/user and nested data object
    res.json({
      success: true,
      token,
      user: userPayload,
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
    } else if (user.station) {
      // For manager/employee, include their assigned station in stations array
      userData.stations = [{
        id: user.station.id,
        name: user.station.name,
        code: user.station.code,
        address: user.station.address,
        brand: 'FuelSync'
      }];
    } else {
      userData.stations = [];
    }

    res.json({
      success: true,
      user: userData,
      data: {
        user: userData
      }
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
      token,
      user: user.toSafeObject(),
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
 * Logout (client-side token removal, optionally blacklist)
 * POST /api/v1/auth/logout
 */
exports.logout = async (req, res) => {
  // For now, just respond success
  // Client should remove token
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};
