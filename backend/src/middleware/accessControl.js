/**
 * Shared Access Control Middleware
 * Centralized station access verification for all controllers
 */

const { Station, User, Pump, Nozzle } = require('../models');
const { USER_ROLES, ROLE_HIERARCHY, hasHigherOrEqualRole } = require('../config/constants');

/**
 * Get role level from hierarchy
 */
const getRoleLevel = (role) => ROLE_HIERARCHY[role] || 0;

/**
 * Check if user can access a specific station
 * @param {Object} user - User object with id, role, stationId
 * @param {string|number} stationId - Station ID to check access for (UUID or integer)
 * @returns {Promise<boolean>}
 */
const canAccessStation = async (user, stationId) => {
  if (!stationId) return false;
  
  // Super admin can access all stations
  if (user.role === 'super_admin') return true;
  
  // Owner accesses stations they own
  if (user.role === 'owner') {
    const station = await Station.findOne({
      where: { id: stationId, ownerId: user.id }
    });
    return !!station;
  }
  
  // Manager/Employee access their assigned station only
  // Compare as strings to handle both UUID and numeric IDs
  return String(user.stationId) === String(stationId);
};

/**
 * Get all station IDs accessible by user
 * @param {Object} user - User object
 * @returns {Promise<number[]>} Array of station IDs
 */
const getAccessibleStationIds = async (user) => {
  if (user.role === 'super_admin') {
    const stations = await Station.findAll({ attributes: ['id'] });
    return stations.map(s => s.id);
  }
  
  if (user.role === 'owner') {
    const stations = await Station.findAll({
      where: { ownerId: user.id },
      attributes: ['id']
    });
    return stations.map(s => s.id);
  }
  
  // Manager/Employee
  return user.stationId ? [user.stationId] : [];
};

/**
 * Verify pump belongs to accessible station
 * @param {Object} user - User object
 * @param {number} pumpId - Pump ID
 * @returns {Promise<{valid: boolean, pump?: Object, error?: string}>}
 */
const verifyPumpAccess = async (user, pumpId) => {
  const pump = await Pump.findByPk(pumpId, {
    include: [{ model: Station, as: 'station', attributes: ['id', 'name'] }]
  });
  
  if (!pump) {
    return { valid: false, error: 'Pump not found' };
  }
  
  const hasAccess = await canAccessStation(user, pump.stationId);
  if (!hasAccess) {
    return { valid: false, error: 'Access denied to this pump' };
  }
  
  return { valid: true, pump };
};

/**
 * Verify nozzle belongs to accessible station
 * @param {Object} user - User object
 * @param {number} nozzleId - Nozzle ID
 * @returns {Promise<{valid: boolean, nozzle?: Object, error?: string}>}
 */
const verifyNozzleAccess = async (user, nozzleId) => {
  const nozzle = await Nozzle.findByPk(nozzleId, {
    include: [{
      model: Pump,
      as: 'pump',
      include: [{ model: Station, as: 'station', attributes: ['id', 'name'] }]
    }]
  });
  
  if (!nozzle) {
    return { valid: false, error: 'Nozzle not found' };
  }
  
  const hasAccess = await canAccessStation(user, nozzle.pump.stationId);
  if (!hasAccess) {
    return { valid: false, error: 'Access denied to this nozzle' };
  }
  
  return { valid: true, nozzle };
};

/**
 * Middleware factory: Require station access from request body/params/query
 * @param {string} source - 'body', 'params', or 'query'
 * @param {string} field - Field name containing stationId
 */
const requireStationAccess = (source = 'params', field = 'stationId') => {
  return async (req, res, next) => {
    try {
      const stationId = req[source][field];
      
      if (!stationId) {
        return res.status(400).json({
          success: false,
          error: `${field} is required`
        });
      }
      
      const user = await User.findByPk(req.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }
      
      const hasAccess = await canAccessStation(user, stationId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this station'
        });
      }
      
      req.user = user;
      req.stationId = stationId;  // Keep as-is (supports both UUID and numeric IDs)
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware: Load user and accessible stations into request
 */
const loadUserAccess = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    req.user = user;
    req.accessibleStationIds = await getAccessibleStationIds(user);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user can manage another user (role hierarchy)
 * @param {Object} manager - User attempting to manage
 * @param {Object} target - User being managed
 * @returns {boolean}
 */
const canManageUser = (manager, target) => {
  const managerLevel = getRoleLevel(manager.role);
  const targetLevel = getRoleLevel(target.role);
  
  // Super admin can manage anyone
  if (manager.role === 'super_admin') return true;
  
  // Owners can manage their station staff (not other owners)
  if (manager.role === 'owner' && targetLevel < managerLevel) {
    return true; // Actual station ownership check done separately
  }
  
  // Managers can manage employees at their station
  if (manager.role === 'manager' && target.role === 'employee') {
    return manager.stationId === target.stationId;
  }
  
  return false;
};

module.exports = {
  canAccessStation,
  getAccessibleStationIds,
  verifyPumpAccess,
  verifyNozzleAccess,
  requireStationAccess,
  loadUserAccess,
  canManageUser
};
