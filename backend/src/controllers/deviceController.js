/**
 * Device Controller
 * 
 * Handles pump and nozzle management for fuel stations.
 * Responsibilities:
 * - Pump CRUD operations with auto-numbering
 * - Nozzle CRUD operations with fuel type and status tracking
 * - Device status management
 * 
 * ACCESS CONTROL:
 * - All device operations require station access verification
 * - Only managers/owners/super_admin can delete devices
 * - Updates check pump/nozzle ownership via station relationship
 */

// ===== SERVICE LAYER =====
const deviceManagementService = require('../services/deviceManagementService');

// ===== MODEL & DATABASE ACCESS =====
const { Pump, Nozzle, Station, User, NozzleReading, sequelize } = require('../services/modelAccess');

// ===== SEQUELIZE UTILITIES =====
const { Op } = require('sequelize');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');
const { canAccessStation } = require('../utils/stationAccessControl');
const { createContextLogger } = require('../services/loggerService');

// ===== LOGGER =====
const logger = createContextLogger('DeviceController');

// ============================================
// PUMP CRUD
// ============================================

/**
 * Get all pumps for a station with their nozzles and latest readings
 * GET /api/v1/stations/:stationId/pumps
 * 
 * Business logic delegated to DeviceManagementService.getPumps().
 * Returns pumps with nozzles and reading hierarchy.
 */
exports.getPumps = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Delegate to service
    const pumps = await deviceManagementService.getPumps(stationId);
    res.json({ success: true, data: pumps });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Create a new pump for a station
 * POST /api/v1/stations/:stationId/pumps
 * 
 * Supports:
 * - Auto-generated pump numbers (if not provided)
 * - Custom pump numbers (if unique for station)
 * - Optional pump name and notes
 * - Auto-status set to 'active'
 */
exports.createPump = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;

    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const pump = await deviceManagementService.createPump(stationId, req.body, user.id);
    res.status(201).json({ success: true, data: pump });

  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('must be') || error.message.includes('required')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Update pump details
 * PUT /api/v1/pumps/:id
 * 
 * Updates: name, status, notes
 * If pump status → inactive/repair, all nozzles automatically set to inactive
 */
exports.updatePump = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Get pump to check access
    const pump = await Pump.findByPk(id);
    if (!pump) {
      return res.status(404).json({ success: false, error: 'Pump not found' });
    }

    if (!(await canAccessStation(user, pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Delegate to service
    const updated = await deviceManagementService.updatePump(id, req.body, user.id);
    res.json({ success: true, data: updated });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Delete a pump and all its nozzles
 * DELETE /api/v1/pumps/:id
 * 
 * Only managers, owners, and super_admin can delete.
 * Cascades to delete all associated nozzles.
 */
exports.deletePump = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pump = await Pump.findByPk(id);
    if (!pump) {
      return res.status(404).json({ success: false, error: 'Pump not found' });
    }

    const user = req.user;
    if (!(await canAccessStation(user, pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Delegate to service
    await deviceManagementService.deletePump(id, user.id);
    res.json({ success: true, message: 'Pump deleted' });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

// ============================================
// NOZZLE CRUD
// ============================================

/**
 * Get all nozzles for a pump or station
 * GET /api/v1/pumps/:pumpId/nozzles
 * GET /api/v1/stations/:stationId/nozzles (compatibility)
 * 
 * Returns nozzles ordered by nozzle number.
 * Requires either pumpId or stationId parameter.
 * 
 * Business logic delegated to DeviceManagementService.getNozzles().
 */
exports.getNozzles = async (req, res, next) => {
  try {
    const { pumpId, stationId } = req.params;
    const user = req.user;

    // Verify access (check pump's station or station directly)
    if (pumpId) {
      const pump = await Pump.findByPk(pumpId);
      if (!pump) {
        return res.status(404).json({ success: false, error: 'Pump not found' });
      }
      if (!(await canAccessStation(user, pump.stationId))) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else if (stationId) {
      if (!(await canAccessStation(user, stationId))) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    // Delegate to service
    const nozzles = await deviceManagementService.getNozzles(pumpId, stationId);
    res.json({ success: true, data: nozzles });

  } catch (error) {
    if (error.message.includes('required')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Get single nozzle by ID
 * GET /api/v1/nozzles/:id
 */
exports.getNozzle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const nozzle = await Nozzle.findByPk(id, { include: [{ model: Pump, as: 'pump' }] });
    if (!nozzle) return res.status(404).json({ success: false, error: 'Nozzle not found' });

    if (!(await canAccessStation(user, nozzle.pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: nozzle, nozzle });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new nozzle for a pump
 * POST /api/v1/pumps/:pumpId/nozzles
 * 
 * Supports:
 * - Auto-generated nozzle numbers per pump
 * - Custom nozzle numbers (must be unique per pump)
 * - Fuel type assignment
 * - Initial reading value (meter starting point)
 * - Optional notes
 * 
 * Business logic delegated to DeviceManagementService.createNozzle().
 */
exports.createNozzle = async (req, res, next) => {
  try {
    const { pumpId } = req.params;
    const user = req.user;

    // Get pump to check access
    const pump = await Pump.findByPk(pumpId);
    if (!pump) {
      return res.status(404).json({ success: false, error: 'Pump not found' });
    }

    // Check station access
    if (!(await canAccessStation(user, pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Delegate to service (auto-numbering and creation logic)
    const nozzle = await deviceManagementService.createNozzle(pumpId, req.body, user.id);
    res.status(201).json({ success: true, data: nozzle });

  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError' || error.message.includes('already exists')) {
      return res.status(409).json({ success: false, error: 'Nozzle with this number already exists for this pump' });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('must be') || error.message.includes('required')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Update nozzle details
 * PUT /api/v1/nozzles/:id
 * 
 * Updates: fuelType, status, notes
 * 
 * Business logic delegated to DeviceManagementService.updateNozzle().
 */
exports.updateNozzle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Get nozzle to check access
    const nozzle = await Nozzle.findByPk(id, {
      include: [{ model: Pump, as: 'pump' }]
    });

    if (!nozzle) {
      return res.status(404).json({ success: false, error: 'Nozzle not found' });
    }

    // Check station access
    if (!(await canAccessStation(user, nozzle.pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Delegate to service
    const updated = await deviceManagementService.updateNozzle(id, req.body, user.id);
    res.json({ success: true, data: updated });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Delete a nozzle
 * DELETE /api/v1/nozzles/:id
 * 
 * Only managers, owners, and super_admin can delete.
 */
exports.deleteNozzle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const nozzle = await Nozzle.findByPk(id, { include: [{ model: Pump, as: 'pump' }] });
    if (!nozzle) {
      return res.status(404).json({ success: false, error: 'Nozzle not found' });
    }

    const user = req.user;
    if (!(await canAccessStation(user, nozzle.stationId || nozzle.pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to delete nozzle' });
    }

    await nozzle.destroy();
    res.json({ success: true, message: 'Nozzle deleted' });
  } catch (error) {
    next(error);
  }
};
