/**
 * Station Access Middleware
 * Verifies user can access the requested station
 * 
 * ACCESS RULES:
 * - super_admin: All stations
 * - owner: Only their owned stations (Station.ownerId = user.id)
 * - manager/employee: Only their assigned station (User.stationId = station.id)
 */

const { Station, User } = require('../models');

/**
 * Verify user can access a station
 * Works with :stationId or :id params
 */
const verifyStationAccess = async (req, res, next) => {
  try {
    const stationId = req.params.stationId || req.params.id;
    
    if (!stationId) {
      return next(); // No station in params, skip
    }

    const user = req.user;

    // Super admin has access to all
    if ((user.role || '').toLowerCase() === 'super_admin' || (user.role || '').toLowerCase() === 'superadmin') {
      req.stationId = stationId;
      return next();
    }

    const station = await Station.findByPk(stationId);
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    // Owner can access their own stations
    if ((user.role || '').toLowerCase() === 'owner') {
      if (station.ownerId !== user.id) {
        return res.status(403).json({
          success: false,
          error: 'You do not own this station'
        });
      }
      req.stationId = stationId;
      req.station = station;
      return next();
    }

    // Manager/Employee can only access their assigned station
    if (['manager', 'employee'].includes((user.role || '').toLowerCase())) {
      if (String(user.stationId) !== String(stationId)) {
        return res.status(403).json({
          success: false,
          error: 'You are not assigned to this station'
        });
      }
      req.stationId = stationId;
      req.station = station;
      return next();
    }

    return res.status(403).json({ success: false, error: 'Access denied' });
  } catch (error) {
    console.error('Station access check error:', error);
    return res.status(500).json({ success: false, error: 'Access check failed' });
  }
};

/**
 * Get all station IDs user can access
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

  // Manager/Employee - just their station
  return user.stationId ? [user.stationId] : [];
};

/**
 * Attach accessible station IDs to request
 */
const attachAccessibleStations = async (req, res, next) => {
  try {
    const stationIds = await getAccessibleStationIds(req.user);
    req.accessibleStationIds = stationIds;
    next();
  } catch (error) {
    console.error('Attach accessible stations error:', error);
    next(error);
  }
};

module.exports = {
  verifyStationAccess,
  getAccessibleStationIds,
  attachAccessibleStations
};
