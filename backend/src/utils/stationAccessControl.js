/**
 * Station Access Control Utility
 * 
 * Centralized authorization logic for station operations.
 * Used across all station-related controllers to ensure consistent
 * access control and reduce code duplication.
 * 
 * MULTI-STATION SUPPORT:
 * - super_admin: Can access all stations
 * - owner: Can access their owned stations
 * - manager/employee: Can access only their assigned station
 */

const { Station } = require('../models');

/**
 * Check if user can access (read/write) a specific station
 * 
 * @param {Object} user - Authenticated user object (req.user)
 * @param {string} stationId - Station ID to check access for
 * @returns {Promise<boolean>} true if user can access, false otherwise
 * 
 * @example
 * if (!(await canAccessStation(req.user, stationId))) {
 *   return res.status(403).json({ success: false, error: 'Access denied' });
 * }
 */
const canAccessStation = async (user, stationId) => {
  // Validate inputs
  if (!user || !stationId) {
    return false;
  }

  // Super admin can access all stations
  if (user.role === 'super_admin' || user.role === 'superadmin') {
    return true;
  }
  
  // Owner can access stations they own
  if (user.role === 'owner') {
    const station = await Station.findByPk(stationId);
    
    if (!station) {
      return false;
    }
    
    return station.ownerId === user.id;
  }
  
  // Manager/Employee can only access their assigned station
  return user.stationId === stationId;
};

/**
 * Validate station access and throw error if denied
 * Middleware/helper version that throws instead of returning false
 * 
 * @param {Object} user - Authenticated user object
 * @param {string} stationId - Station ID to check
 * @throws {AuthorizationError} if access is denied
 */
const validateStationAccess = async (user, stationId) => {
  const hasAccess = await canAccessStation(user, stationId);
  
  if (!hasAccess) {
    const { AuthorizationError } = require('./errors');
    throw new AuthorizationError('You do not have access to this station');
  }
};

module.exports = {
  canAccessStation,
  validateStationAccess
};
