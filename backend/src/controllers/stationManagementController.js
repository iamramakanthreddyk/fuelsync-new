/**
 * Station Management Controller
 * 
 * Handles station CRUD operations and configuration.
 * Responsibilities:
 * - Station creation, retrieval, update
 * - Station settings management (shifts, alerts, thresholds)
 * - Station readings compatibility endpoint
 * 
 * MULTI-STATION SUPPORT:
 * - Owner can have multiple stations
 * - Station.ownerId links to owner User
 * - Staff have User.stationId for their assigned station
 * 
 * ACCESS CONTROL:
 * - super_admin: All stations
 * - owner: Their owned stations
 * - manager/employee: Their assigned station only
 */

// ===== SERVICE LAYER =====
const services = require('../services');
const stationManagementService = require('../services/stationManagementService');

// ===== MODEL & DATABASE ACCESS =====
const { Station, Pump, Nozzle, User, FuelPrice, Plan, NozzleReading, sequelize } = require('../services/modelAccess');

// ===== SEQUELIZE UTILITIES =====
const { Op, fn, col } = require('sequelize');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');
const { canAccessStation } = require('../utils/stationAccessControl');
const { createContextLogger } = require('../services/loggerService');

// ===== LOGGER =====
const logger = createContextLogger('StationManagementController');

// ===== CONSTANTS =====
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };

/**
 * Get readings for a station (test compatibility)
 * GET /stations/:stationId/readings
 * 
 * Returns readings categorized by link status (linked to settlement vs unlinked).
 * Maintains backward compatibility with existing test suite.
 */
exports.getStationReadings = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const user = req.user;

    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const where = { stationId };
    const include = [
      { model: Nozzle, as: 'nozzle', attributes: ['id', 'nozzleNumber', 'fuelType'] },
      { model: User, as: 'enteredByUser', attributes: ['id', 'name'] }
    ];
    const { count, rows } = await NozzleReading.findAndCountAll({
      where,
      include,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
    });
    res.json({
      success: true,
      data: {
        linked: {
          count: rows.filter(r => r.settlementId).length,
          readings: rows.filter(r => r.settlementId)
        },
        unlinked: {
          count: rows.filter(r => !r.settlementId).length,
          readings: rows.filter(r => !r.settlementId)
        },
        allReadingsCount: rows.length
      },
      readings: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get stations based on user role
 * GET /api/v1/stations
 * 
 * - super_admin: All stations
 * - owner: Their owned stations
 * - manager/employee: Their assigned station only
 * 
 * Returns enhanced response with pump counts and today's sales.
 */
exports.getStations = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId, { include: [{ model: Plan, as: 'plan' }] });
    
    let where = { isActive: true };
    
    const role = (user.role || '').toLowerCase();
    if (role === 'super_admin' || role === 'superadmin') {
      // Super admin sees all
    } else if (role === 'owner') {
      // Owner sees stations they own
      where.ownerId = user.id;
    } else {
      // Manager/Employee sees only their assigned station
      if (user.stationId) {
        where.id = user.stationId;
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    const stations = await Station.findAll({
      where,
      include: [
        {
          model: Pump,
          as: 'pumps',
          attributes: ['id', 'name', 'status']
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email'],
          include: [{
            model: Plan,
            as: 'plan',
            attributes: ['id', 'name', 'maxStations', 'maxPumpsPerStation', 'priceMonthly']
          }]
        }
      ],
      order: [['name', 'ASC']]
    });

    // Calculate today's sales for each station
    const today = new Date().toISOString().split('T')[0];
    
    const stationIds = stations.map(s => s.id);
    const todaySalesData = await NozzleReading.findAll({
      attributes: [
        'stationId',
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'todaySales']
      ],
      where: {
        ...EXCLUDE_SAMPLE_READINGS,
        stationId: { [Op.in]: stationIds },
        readingDate: today,
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      group: ['stationId'],
      raw: true
    });

    // Create a map of stationId to todaySales
    const todaySalesMap = new Map();
    todaySalesData.forEach(item => {
      todaySalesMap.set(item.stationId, parseFloat(item.todaySales || 0));
    });

    res.json({
      success: true,
      data: stations.map(s => ({
        ...s.toJSON(),
        pumpCount: s.pumps?.length || 0,
        activePumps: s.pumps?.filter(p => p.status === 'active').length || 0,
        todaySales: todaySalesMap.get(s.id) || 0
      }))
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Create station (owner/super_admin only)
 * POST /api/v1/stations
 * 
 * Business logic delegated to StationManagementService.createStation():
 * - Generates unique station codes via transaction-safe auto-increment
 * - Validates plan limits before creation
 * - Records audit log
 */
exports.createStation = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId, { include: [{ model: Plan, as: 'plan' }] });
    
    // Delegate to service
    const station = await stationManagementService.createStation(req.body, req.userId, user);
    
    res.status(201).json({ success: true, data: station, message: 'Station created successfully' });
  } catch (error) {
    // Handle specific errors
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('Owner not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('required') || error.message.includes('must')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message.includes('denied') || error.message.includes('Only')) {
      return res.status(403).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Get single station by ID with full details
 * GET /api/v1/stations/:id
 * 
 * Returns station details via service, includes relationships.
 * Authorization and access control handled in service layer.
 */
exports.getStation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Check access before delegating to service
    if (!(await canAccessStation(user, id))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Delegate to service
    const station = await stationManagementService.getStation(id);
    res.json({ success: true, data: station });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Update station
 * PUT /api/v1/stations/:id
 * 
 * Updates basic station information (name, address, contact, etc).
 * Logs all changes to audit trail.
 */
exports.updateStation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;

    // Check station access using helper
    if (!(await canAccessStation(user, id))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const station = await Station.findByPk(id);
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    const oldValues = station.toJSON();
    await station.update(updates);

    // Log station update
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      stationId: id,
      action: 'UPDATE',
      entityType: 'Station',
      entityId: id,
      oldValues: oldValues,
      newValues: updates,
      category: 'data',
      severity: 'info',
      description: `Updated station: ${station.name}`
    });

    res.json({ success: true, data: station, message: 'Station updated' });

  } catch (error) {
    next(error);
  }
};

/**
 * Update station operational settings
 * PUT /api/v1/stations/:id/settings
 * 
 * Updates configuration for:
 * - requireShiftForReadings: Enforce shift entry before readings
 * - alertOnMissedReadings: Enable alerts for overdue readings
 * - missedReadingThresholdDays: Hours without reading before alert
 * 
 * Only owner/super_admin can modify settings.
 */
exports.updateStationSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { requireShiftForReadings, alertOnMissedReadings, missedReadingThresholdDays } = req.body;
    const user = req.user;

    // Only owner/super_admin can update settings
    if (!['owner', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only owners can update station settings' 
      });
    }

    // Check station access
    if (!(await canAccessStation(user, id))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const station = await Station.findByPk(id);
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    // Build settings update object (only include provided fields)
    const settingsUpdate = {};
    if (requireShiftForReadings !== undefined) {
      settingsUpdate.requireShiftForReadings = Boolean(requireShiftForReadings);
    }
    if (alertOnMissedReadings !== undefined) {
      settingsUpdate.alertOnMissedReadings = Boolean(alertOnMissedReadings);
    }
    if (missedReadingThresholdDays !== undefined) {
      const threshold = parseInt(missedReadingThresholdDays, 10);
      if (isNaN(threshold) || threshold < 1 || threshold > 30) {
        return res.status(400).json({
          success: false,
          error: 'missedReadingThresholdDays must be between 1 and 30'
        });
      }
      settingsUpdate.missedReadingThresholdDays = threshold;
    }

    if (Object.keys(settingsUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid settings provided to update'
      });
    }

    await station.update(settingsUpdate);

    res.json({
      success: true,
      data: {
        id: station.id,
        name: station.name,
        settings: {
          requireShiftForReadings: station.requireShiftForReadings,
          alertOnMissedReadings: station.alertOnMissedReadings,
          missedReadingThresholdDays: station.missedReadingThresholdDays
        }
      },
      message: 'Station settings updated'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get station operational settings
 * GET /api/v1/stations/:id/settings
 * 
 * Returns current configuration for alerts, thresholds, and requirements.
 */
exports.getStationSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!(await canAccessStation(user, id))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const station = await Station.findByPk(id, {
      attributes: ['id', 'name', 'requireShiftForReadings', 'alertOnMissedReadings', 'missedReadingThresholdDays']
    });

    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    res.json({
      success: true,
      data: {
        id: station.id,
        name: station.name,
        settings: {
          requireShiftForReadings: station.requireShiftForReadings,
          alertOnMissedReadings: station.alertOnMissedReadings,
          missedReadingThresholdDays: station.missedReadingThresholdDays
        }
      }
    });

  } catch (error) {
    next(error);
  }
};
