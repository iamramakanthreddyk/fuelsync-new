/**
 * Tank Controller
 * Flexible inventory management for fuel tanks
 * 
 * AUDIT LOGGING:
 * - CREATE: Tank creation is logged with category 'data', severity 'info'
 * - UPDATE: Tank updates are logged with before/after values
 * - REFILL: Tank refills are logged with category 'finance', severity 'info'
 * 
 * All CREATE/UPDATE/REFILL operations are tracked via logAudit() from utils/auditLog
 */

const { Tank, TankRefill, Station, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { canAccessStation } = require('../middleware/accessControl');
const { logAudit } = require('../utils/auditLog');

/**
 * Get all tanks for a station
 * GET /api/v1/stations/:stationId/tanks
 * 
 * Response includes full status with "since last refill" tracking
 */
exports.getTanks = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = await User.findByPk(req.userId);
    
    // Authorization
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this station'
      });
    }
    
    // Get tanks with full status (includes "since last refill" data)
    const tanks = await Tank.findAll({
      where: { stationId, isActive: true },
      order: [['fuelType', 'ASC'], ['name', 'ASC']]
    });
    
    // Map to include full status with tracking info
    const tanksWithStatus = tanks.map(tank => tank.getFullStatus());
    
    res.json({
      success: true,
      data: tanksWithStatus
    });
  } catch (error) {
    console.error('Get tanks error:', error);
    next(error);
  }
};

/**
 * Get tank warnings for dashboard
 * GET /api/v1/tanks/warnings
 * 
 * Returns tanks with low, critical, empty, or NEGATIVE status
 * Negative status indicates owner may have forgotten to record a refill
 */
exports.getTankWarnings = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    let stationId = null;
    
    // Get station context based on role
    if (user.role === 'owner') {
      const stations = await Station.findAll({ where: { ownerId: user.id } });
      const warnings = [];
      for (const station of stations) {
        const stationTanks = await Tank.findAll({
          where: { stationId: station.id, isActive: true }
        });
        
        // Filter to tanks with warning-level status (including negative)
        for (const tank of stationTanks) {
          const fullStatus = tank.getFullStatus();
          if (['low', 'critical', 'empty', 'negative'].includes(fullStatus.status)) {
            warnings.push({
              ...fullStatus,
              stationName: station.name
            });
          }
        }
      }
      return res.json({ success: true, data: warnings });
    } else if (user.stationId) {
      stationId = user.stationId;
    }
    
    const tanks = await Tank.findAll({
      where: { stationId, isActive: true }
    });
    
    const warnings = tanks
      .map(tank => tank.getFullStatus())
      .filter(status => ['low', 'critical', 'empty', 'negative'].includes(status.status));
    
    res.json({
      success: true,
      data: warnings
    });
  } catch (error) {
    console.error('Get tank warnings error:', error);
    next(error);
  }
};

/**
 * Get single tank with details
 * GET /api/v1/tanks/:id
 * 
 * Returns full status including:
 * - Current level and percent
 * - "Since last refill" tracking (date, amount, sales since)
 * - Alert if level is negative
 * - Recent refill history
 */
exports.getTank = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const tank = await Tank.findByPk(id, {
      include: [
        { model: Station, as: 'station', attributes: ['id', 'name'] },
        { 
          model: TankRefill, 
          as: 'refills', 
          limit: 10,
          order: [['refillDate', 'DESC']],
          include: [{ model: User, as: 'enteredByUser', attributes: ['id', 'name'] }]
        }
      ]
    });
    
    if (!tank) {
      return res.status(404).json({
        success: false,
        error: 'Tank not found'
      });
    }
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, tank.stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this tank'
      });
    }
    
    // Get full status with "since last refill" tracking
    const fullStatus = tank.getFullStatus();
    
    res.json({
      success: true,
      data: {
        ...fullStatus,
        station: tank.station,
        refills: tank.refills,
        notes: tank.notes
      }
    });
  } catch (error) {
    console.error('Get tank error:', error);
    next(error);
  }
};

/**
 * Create a new tank
 * POST /api/v1/stations/:stationId/tanks
 * 
 * Supports custom fuel display names (MSD, HSM, XP 95) via displayFuelName
 * Initial level sets the starting point for "since last refill" tracking
 */
exports.createTank = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { 
      fuelType, 
      name, 
      displayFuelName,  // Custom fuel name (e.g., "MSD", "HSM", "XP 95")
      capacity, 
      currentLevel, 
      lowLevelWarning, 
      criticalLevelWarning, 
      lowLevelPercent, 
      criticalLevelPercent, 
      trackingMode, 
      notes 
    } = req.body;
    
    const user = await User.findByPk(req.userId);
    
    // Authorization
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this station'
      });
    }
    
    // Check if tank for this fuel type already exists
    const existingTank = await Tank.findOne({
      where: { stationId, fuelType, isActive: true }
    });
    
    if (existingTank) {
      return res.status(400).json({
        success: false,
        error: `Tank for ${fuelType} already exists at this station`
      });
    }
    
    // Calculate initial level for tracking
    const initialLevel = parseFloat(currentLevel) || 0;
    
    const tank = await Tank.create({
      stationId,
      fuelType,
      name,
      displayFuelName: displayFuelName || null, // Custom fuel name (MSD, HSM, etc.)
      capacity,
      currentLevel: initialLevel,
      // Initialize "since last refill" tracking with initial level
      levelAfterLastRefill: initialLevel > 0 ? initialLevel : null,
      lastRefillDate: initialLevel > 0 ? new Date().toISOString().split('T')[0] : null,
      lastRefillAmount: initialLevel > 0 ? initialLevel : null,
      lowLevelWarning,
      criticalLevelWarning,
      lowLevelPercent,
      criticalLevelPercent,
      trackingMode: trackingMode || 'warning',
      notes
    });

    // If initial level is set, create an "initial" entry in tank_refills for audit
    if (initialLevel > 0) {
      await TankRefill.create({
        tankId: tank.id,
        stationId,
        litres: initialLevel,
        refillDate: new Date().toISOString().split('T')[0],
        entryType: 'initial',
        enteredBy: req.userId,
        notes: `Initial tank setup with ${initialLevel}L`
      });
    }

    // Log tank creation
    await logAudit({
      userId: req.userId,
      userEmail: user.email,
      userRole: user.role,
      stationId,
      action: 'CREATE',
      entityType: 'Tank',
      entityId: tank.id,
      newValues: {
        id: tank.id,
        fuelType,
        displayFuelName: tank.displayFuelName,
        name,
        capacity,
        currentLevel: tank.currentLevel
      },
      category: 'data',
      severity: 'info',
      description: `Created tank for ${tank.displayFuelName || fuelType} with capacity ${capacity}L`
    });
    
    // Return full status with "since last refill" tracking
    const fullStatus = tank.getFullStatus();
    
    res.status(201).json({
      success: true,
      data: fullStatus,
      message: `Tank created for ${fullStatus.displayFuelName}. Current level: ${tank.currentLevel}L`
    });
  } catch (error) {
    console.error('Create tank error:', error);
    next(error);
  }
};

/**
 * Update tank settings
 * PUT /api/v1/tanks/:id
 * 
 * Allows updating:
 * - displayFuelName: Custom fuel name (MSD, HSM, XP 95)
 * - capacity, thresholds, tracking mode
 * - Does NOT allow direct currentLevel changes (use refill/calibrate instead)
 */
exports.updateTank = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const tank = await Tank.findByPk(id);
    
    if (!tank) {
      return res.status(404).json({
        success: false,
        error: 'Tank not found'
      });
    }
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, tank.stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this tank'
      });
    }
    
    // Allowed updates (displayFuelName added for custom fuel naming)
    const allowedUpdates = [
      'name', 
      'displayFuelName',  // Custom fuel name (MSD, HSM, XP 95)
      'capacity', 
      'lowLevelWarning', 
      'criticalLevelWarning', 
      'lowLevelPercent', 
      'criticalLevelPercent', 
      'trackingMode', 
      'allowNegative', 
      'notes', 
      'isActive'
    ];
    
    const oldValues = tank.toJSON();
    const newValues = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        tank[field] = updates[field];
        newValues[field] = updates[field];
      }
    });
    
    await tank.save();

    // Log tank update
    await logAudit({
      userId: req.userId,
      userEmail: user.email,
      userRole: user.role,
      stationId: tank.stationId,
      action: 'UPDATE',
      entityType: 'Tank',
      entityId: tank.id,
      oldValues: oldValues,
      newValues: newValues,
      category: 'data',
      severity: 'info',
      description: `Updated tank: ${tank.displayFuelName || tank.name} (${tank.fuelType})`
    });
    
    // Return full status
    res.json({
      success: true,
      data: tank.getFullStatus()
    });
  } catch (error) {
    console.error('Update tank error:', error);
    next(error);
  }
};

/**
 * Calibrate tank with physical dip reading
 * POST /api/v1/tanks/:id/calibrate
 */
exports.calibrateTank = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dipReading, date, notes } = req.body;
    
    if (dipReading === undefined) {
      return res.status(400).json({
        success: false,
        error: 'dipReading is required'
      });
    }
    
    const tank = await Tank.findByPk(id);
    
    if (!tank) {
      return res.status(404).json({
        success: false,
        error: 'Tank not found'
      });
    }
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, tank.stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to calibrate this tank'
      });
    }
    
    const oldLevel = tank.currentLevel;
    const status = await tank.calibrate(dipReading, date);
    
    // Create adjustment entry if there's a difference
    const difference = parseFloat(dipReading) - parseFloat(oldLevel);
    if (Math.abs(difference) > 0.5) {
      await TankRefill.create({
        tankId: tank.id,
        stationId: tank.stationId,
        litres: difference,
        refillDate: date || new Date().toISOString().split('T')[0],
        entryType: 'adjustment',
        enteredBy: req.userId,
        notes: notes || `Dip calibration adjustment: ${oldLevel}L → ${dipReading}L`
      });
    }
    
    res.json({
      success: true,
      data: {
        tank: tank.toJSON(),
        status,
        adjustment: difference
      },
      message: `Tank calibrated. Level adjusted by ${difference.toFixed(1)}L`
    });
  } catch (error) {
    console.error('Calibrate tank error:', error);
    next(error);
  }
};

/**
 * Record a tank refill (with backdating support)
 * POST /api/v1/tanks/:id/refill
 */
exports.recordRefill = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { 
      litres, refillDate, refillTime,
      costPerLitre, totalCost,
      supplierName, invoiceNumber,
      vehicleNumber, driverName, driverPhone,
      notes
    } = req.body;
    
    if (!litres || litres <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: 'litres must be a positive number'
      });
    }
    
    const tank = await Tank.findByPk(id, { transaction: t });
    
    if (!tank) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: 'Tank not found'
      });
    }
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, tank.stationId))) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        error: 'Not authorized to record refill for this tank'
      });
    }
    
    const tankLevelBefore = parseFloat(tank.currentLevel);

    // Validate capacity: if tank does not allow overflow, reject refill that exceeds capacity
    if (typeof tank.capacity === 'number' && !tank.allowNegative) {
      const projectedLevel = tankLevelBefore + parseFloat(litres);
      if (projectedLevel > tank.capacity) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          error: 'Refill would exceed tank capacity'
        });
      }
    }

    // Calculate level after refill
    const tankLevelAfter = tankLevelBefore + parseFloat(litres);

    const refill = await TankRefill.create({
      tankId: tank.id,
      stationId: tank.stationId,
      litres: parseFloat(litres),
      refillDate: refillDate || new Date().toISOString().split('T')[0],
      refillTime,
      costPerLitre,
      totalCost: totalCost || (costPerLitre ? parseFloat(litres) * parseFloat(costPerLitre) : null),
      supplierName,
      invoiceNumber,
      vehicleNumber,
      levelBefore: tankLevelBefore,
      levelAfter: tankLevelAfter,
      entryType: 'refill',
      enteredBy: req.userId,
      notes
    }, { transaction: t });
    
    // Tank level is updated by afterCreate hook
    await tank.reload({ transaction: t });

    // Log tank refill
    await logAudit({
      userId: req.userId,
      userEmail: user.email,
      userRole: user.role,
      stationId: tank.stationId,
      action: 'CREATE',
      entityType: 'TankRefill',
      entityId: refill.id,
      newValues: {
        id: refill.id,
        tankId: tank.id,
        litres: parseFloat(litres),
        totalCost: refill.totalCost,
        supplierName
      },
      category: 'finance',
      severity: 'info',
      description: `Recorded refill: +${litres}L of ${tank.fuelType} for ${tank.name}`
    });
    
    await t.commit();
    
    res.status(201).json({
      success: true,
      data: {
        refill,
        tank: {
          ...tank.toJSON(),
          status: tank.getStatus()
        }
      },
      message: `Refill recorded: +${litres}L. New level: ${tank.currentLevel}L`
    });
  } catch (error) {
    await t.rollback();
    console.error('Record refill error:', error);
    next(error);
  }
};

/**
 * Get refill history for a tank
 * GET /api/v1/tanks/:id/refills
 */
exports.getRefills = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const tank = await Tank.findByPk(id);
    
    if (!tank) {
      return res.status(404).json({
        success: false,
        error: 'Tank not found'
      });
    }
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, tank.stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this tank'
      });
    }
    
    const { count, rows } = await TankRefill.getHistory(id, {
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get refills error:', error);
    next(error);
  }
};

/**
 * Get refill summary for station
 * GET /api/v1/stations/:stationId/refills/summary
 */
exports.getRefillSummary = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this station'
      });
    }
    
    const summary = await TankRefill.getSummary(stationId, startDate, endDate);
    const byFuelType = await TankRefill.getByFuelType(stationId, startDate, endDate);
    
    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        summary,
        byFuelType
      }
    });
  } catch (error) {
    console.error('Get refill summary error:', error);
    next(error);
  }
};

/**
 * Update a refill entry
 * PUT /api/v1/refills/:id
 */
exports.updateRefill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const refill = await TankRefill.findByPk(id, {
      include: [{ model: Tank, as: 'tank' }]
    });
    
    if (!refill) {
      return res.status(404).json({
        success: false,
        error: 'Refill not found'
      });
    }
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, refill.stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this refill'
      });
    }
    
    // Only allow certain field updates (not litres to preserve tank level accuracy)
    const allowedUpdates = ['refillDate', 'refillTime', 'costPerLitre', 'totalCost', 
                           'supplierName', 'invoiceNumber',
                           'vehicleNumber', 'driverName', 'driverPhone', 'notes'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        refill[field] = updates[field];
      }
    });
    
    await refill.save();
    
    res.json({
      success: true,
      data: refill
    });
  } catch (error) {
    console.error('Update refill error:', error);
    next(error);
  }
};

/**
 * Delete a refill entry (will adjust tank level)
 * DELETE /api/v1/refills/:id
 */
exports.deleteRefill = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    const refill = await TankRefill.findByPk(id, { transaction: t });
    
    if (!refill) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: 'Refill not found'
      });
    }
    
    // Authorization - only owner/manager can delete
    const user = await User.findByPk(req.userId);
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        error: 'Only managers and above can delete refill entries'
      });
    }
    
    if (!(await canAccessStation(user, refill.stationId))) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this refill'
      });
    }
    
    // afterDestroy hook will adjust tank level
    await refill.destroy({ transaction: t });
    
    await t.commit();
    
    res.json({
      success: true,
      message: 'Refill deleted and tank level adjusted'
    });
  } catch (error) {
    await t.rollback();
    console.error('Delete refill error:', error);
    next(error);
  }
};
