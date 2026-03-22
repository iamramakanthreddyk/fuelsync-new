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

// ===== MODELS & DATABASE =====
const { Tank, TankRefill, Station, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// ===== ERROR & RESPONSE HANDLING =====
const { asyncHandler, NotFoundError, AuthorizationError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/apiResponse');

// ===== MIDDLEWARE & CONFIG =====
const { canAccessStation } = require('../middleware/accessControl');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');
const costOfGoodsService = require('../services/costOfGoodsService');

/**
 * Get all tanks for a station
 * GET /api/v1/stations/:stationId/tanks
 * 
 * Response includes full status with "since last refill" tracking
 */
exports.getTanks = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const user = await User.findByPk(req.userId);
  
  if (!(await canAccessStation(user, stationId))) {
    throw new AuthorizationError('Not authorized to access this station');
  }
  
  const tanks = await Tank.findAll({
    where: { stationId, isActive: true },
    order: [['fuelType', 'ASC'], ['name', 'ASC']]
  });
  
  const tanksWithStatus = tanks.map(tank => tank.getFullStatus());
  
  return sendSuccess(res, tanksWithStatus);
});

/**
 * Get tank warnings for dashboard
 * GET /api/v1/tanks/warnings
 * 
 * Returns tanks with low, critical, empty, or NEGATIVE status
 * Negative status indicates owner may have forgotten to record a refill
 */
exports.getTankWarnings = asyncHandler(async (req, res, next) => {
  const user = await User.findByPk(req.userId);
  let stationId = null;
  
  if (user.role === 'owner') {
    const stations = await Station.findAll({ where: { ownerId: user.id } });
    const warnings = [];
    for (const station of stations) {
      const stationTanks = await Tank.findAll({
        where: { stationId: station.id, isActive: true }
      });
      
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
    return sendSuccess(res, warnings);
  } else if (user.stationId) {
    stationId = user.stationId;
  }
  
  const tanks = await Tank.findAll({
    where: { stationId, isActive: true }
  });
  
  const warnings = tanks
    .map(tank => tank.getFullStatus())
    .filter(status => ['low', 'critical', 'empty', 'negative'].includes(status.status));
  
  return sendSuccess(res, warnings);
});

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
exports.getTank = asyncHandler(async (req, res, next) => {
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
    throw new NotFoundError('Tank', id);
  }
  
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, tank.stationId))) {
    throw new AuthorizationError('Not authorized to access this tank');
  }
  
  const fullStatus = tank.getFullStatus();
  
  return sendSuccess(res, {
    ...fullStatus,
    station: tank.station,
    refills: tank.refills,
    notes: tank.notes
  });
});

/**
 * Create a new tank
 * POST /api/v1/stations/:stationId/tanks
 * 
 * Supports custom fuel display names (MSD, HSM, XP 95) via displayFuelName
 * Initial level sets the starting point for "since last refill" tracking
 */
exports.createTank = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { 
    fuelType, 
    name, 
    displayFuelName,
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
  
  if (!(await canAccessStation(user, stationId))) {
    throw new AuthorizationError('Not authorized to access this station');
  }
  
  const existingTank = await Tank.findOne({
    where: { stationId, fuelType, isActive: true }
  });
  
  if (existingTank) {
    return sendError(res, 'CONFLICT', `Tank for ${fuelType} already exists at this station`, 400);
  }
  
  const initialLevel = parseFloat(currentLevel) || 0;
  
  const tank = await Tank.create({
    stationId,
    fuelType,
    name,
    displayFuelName: displayFuelName || null,
    capacity,
    currentLevel: initialLevel,
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
  
  const fullStatus = tank.getFullStatus();
  
  return sendCreated(res, fullStatus, {
    message: `Tank created for ${fullStatus.displayFuelName}. Current level: ${tank.currentLevel}L`
  });
});

/**
 * Update tank settings
 * PUT /api/v1/tanks/:id
 * 
 * Allows updating:
 * - displayFuelName: Custom fuel name (MSD, HSM, XP 95)
 * - capacity, thresholds, tracking mode
 * - Does NOT allow direct currentLevel changes (use refill/calibrate instead)
 */
exports.updateTank = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;
  
  const tank = await Tank.findByPk(id);
  
  if (!tank) {
    throw new NotFoundError('Tank', id);
  }
  
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, tank.stationId))) {
    throw new AuthorizationError('Not authorized to update this tank');
  }
  
  const allowedUpdates = [
    'name', 
    'fuelType',
    'displayFuelName',
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
  
  return sendSuccess(res, tank.getFullStatus());
});

/**
 * Calibrate tank with physical dip reading
 * POST /api/v1/tanks/:id/calibrate
 * 
 * IMPORTANT: Calibration is a LEVEL ADJUSTMENT, NOT a sale or refill
 * 
 * Workflow:
 * 1. Tank created with capacity and initial level
 * 2. Refill recorded (increases levelAfterLastRefill and currentLevel)
 * 3. Sales tracked (decreases currentLevel)
 * 4. Calibrate (physical measurement): Corrects currentLevel to actual amount
 * 
 * Discrepancy Analysis (for auditing ONLY):
 * - actual_sales = levelAfterLastRefill - dipReading (what really happened)
 * - recorded_sales = levelAfterLastRefill - oldLevel (what system recorded)
 * - discrepancy = actual - recorded (shows tracking accuracy)
 * 
 * This analysis helps identify:
 * - Unrecorded sales (actual > recorded)
 * - Unrecorded refills (recorded > actual)
 * - But does NOT create new sale/refill entries
 */
exports.calibrateTank = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { dipReading, date, notes } = req.body;
  
  if (dipReading === undefined) {
    return sendError(res, 'VALIDATION_ERROR', 'dipReading is required', 400);
  }
  
  const tank = await Tank.findByPk(id);
  
  if (!tank) {
    throw new NotFoundError('Tank', id);
  }
  
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, tank.stationId))) {
    throw new AuthorizationError('Not authorized to calibrate this tank');
  }

  const dipReadingValue = parseFloat(dipReading);
  const oldLevel = parseFloat(tank.currentLevel);
  const levelAfterLastRefill = tank.levelAfterLastRefill ? parseFloat(tank.levelAfterLastRefill) : null;
  
  // Calibration adjustment (what we're correcting the level by)
  const levelAdjustment = dipReadingValue - oldLevel;
  
  // Discrepancy analysis (for auditing only, not for financial records)
  let actualSales = null;
  let recordedSales = null;
  let discrepancy = null;
  let discrepancyMessage = '';

  if (levelAfterLastRefill !== null && !isNaN(levelAfterLastRefill)) {
    // actual_sales = what was in tank after last refill - what's physically there now
    actualSales = levelAfterLastRefill - dipReadingValue;
    
    // recorded_sales = what system calculated should be sold
    recordedSales = levelAfterLastRefill - oldLevel;
    
    // discrepancy shows if our sales tracking is accurate
    discrepancy = actualSales - recordedSales;
    
    if (Math.abs(discrepancy) > 0.5) {
      if (discrepancy > 0) {
        discrepancyMessage = `Actual sales (${actualSales.toFixed(1)}L) exceed recorded (${recordedSales.toFixed(1)}L) by ${discrepancy.toFixed(1)}L - unaccounted losses`;
      } else {
        discrepancyMessage = `Recorded sales (${recordedSales.toFixed(1)}L) exceed actual (${actualSales.toFixed(1)}L) by ${Math.abs(discrepancy).toFixed(1)}L - unaccounted increase`;
      }
    } else {
      discrepancyMessage = `Sales tracking is accurate (variance: ${discrepancy.toFixed(1)}L)`;
    }
  } else {
    discrepancyMessage = `No refill record available - cannot calculate sales discrepancy`;
  }

  // Update tank with the dip reading (physical truth becomes the new baseline and level)
  // Both currentLevel and levelAfterLastRefill are set to the dip reading to avoid negative sales
  const calibrationDate = date || new Date().toISOString().split('T')[0];
  const updatedTank = await tank.update({
    currentLevel: dipReadingValue,
    levelAfterLastRefill: dipReadingValue,  // Update baseline to match physical reality
    lastDipReading: dipReadingValue,
    lastDipDate: calibrationDate
  });

  // Log calibration audit entry (optional: if significant adjustment)
  if (notes || Math.abs(levelAdjustment) > 0.5) {
    await logAudit({
      userId: req.userId,
      stationId: tank.stationId,
      category: 'inventory',
      action: 'tank_calibrate',
      resourceId: tank.id,
      resourceType: 'Tank',
      changes: {
        before: { currentLevel: oldLevel, lastDipReading: tank.lastDipReading },
        after: { currentLevel: dipReadingValue, lastDipReading: dipReadingValue }
      },
      severity: 'info',
      notes: notes || `Calibration: Level adjusted from ${oldLevel.toFixed(1)}L to ${dipReadingValue.toFixed(1)}L (${levelAdjustment > 0 ? '+' : ''}${levelAdjustment.toFixed(1)}L)`
    });
  }

  return sendSuccess(res, {
    tank: updatedTank.toJSON(),
    status: updatedTank.getStatus(),
    calibration: {
      dipReading: dipReadingValue,
      previousLevel: oldLevel,
      levelAdjustment: levelAdjustment,
      calibrationDate: calibrationDate,
      baselineAdjusted: true,  // Indicates that levelAfterLastRefill was also adjusted
      message: `Tank calibrated to physical measurement. Level and sales baseline both adjusted to ${dipReadingValue.toFixed(1)}L`,
      discrepancy: {
        actualSales: actualSales,
        recordedSales: recordedSales,
        variance: discrepancy,
        message: discrepancyMessage,
        explanation: discrepancy > 0 
          ? `There was a ${discrepancy.toFixed(1)}L loss between last refill and calibration (unrecorded sales or leakage)`
          : discrepancy < 0
          ? `System recorded ${Math.abs(discrepancy).toFixed(1)}L more sales than actually happened`
          : 'Sales tracking matches the physical measurement'
      }
    }
  });
});

/**
 * Record a tank refill (with backdating support)
 * POST /api/v1/tanks/:id/refill
 */
exports.recordRefill = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { 
    litres, refillDate, refillTime,
    costPerLitre, totalCost,
    supplierName, invoiceNumber,
    vehicleNumber, driverName, driverPhone,
    notes
  } = req.body;
  
  if (!litres || litres <= 0) {
    return sendError(res, 'VALIDATION_ERROR', 'litres must be a positive number', 400);
  }
  
  const tank = await Tank.findByPk(id);
  
  if (!tank) {
    throw new NotFoundError('Tank', id);
  }
  
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, tank.stationId))) {
    throw new AuthorizationError('Not authorized to record refill for this tank');
  }
  
  const tankLevelBefore = parseFloat(tank.currentLevel);

  if (typeof tank.capacity === 'number' && !tank.allowNegative) {
    const projectedLevel = tankLevelBefore + parseFloat(litres);
    if (projectedLevel > tank.capacity) {
      return sendError(res, 'VALIDATION_ERROR', 'Refill would exceed tank capacity', 400);
    }
  }

  const refill = await sequelize.transaction(async (transaction) => {
    const tankToRefill = await Tank.findByPk(id, { transaction });
    const tankLevelAfter = tankLevelBefore + parseFloat(litres);

    const newRefill = await TankRefill.create({
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
    }, { transaction });
    
    await tankToRefill.reload({ transaction });

    try {
      await costOfGoodsService.updateCOGSOnRefill({
        stationId: tank.stationId,
        refillId: newRefill.id,
        refillAmount: parseFloat(litres),
        refillDate: newRefill.refillDate,
        unitPrice: parseFloat(costPerLitre || 0),
        totalPrice: newRefill.totalCost,
        fuelType: tank.fuelType,
        transaction
      });
    } catch (cogsError) {
      console.warn('[WARN] COGS update failed on refill:', cogsError.message);
    }

    return newRefill;
  });
  
  await tank.reload();

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
  
  return sendCreated(res, {
    refill,
    tank: {
      ...tank.toJSON(),
      status: tank.getStatus()
    },
    message: `Refill recorded: +${litres}L. New level: ${tank.currentLevel}L`
  });
});

/**
 * Get refill history for a tank
 * GET /api/v1/tanks/:id/refills
 */
exports.getRefills = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { startDate, endDate, page = 1, limit = 20 } = req.query;
  
  const tank = await Tank.findByPk(id);
  
  if (!tank) {
    throw new NotFoundError('Tank', id);
  }
  
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, tank.stationId))) {
    throw new AuthorizationError('Not authorized to view this tank');
  }
  
  const { count, rows } = await TankRefill.getHistory(id, {
    startDate,
    endDate,
    page: parseInt(page),
    limit: parseInt(limit)
  });
  
  return sendPaginated(res, rows, {
    page: parseInt(page),
    limit: parseInt(limit),
    total: count,
    pages: Math.ceil(count / limit)
  });
});

/**
 * Get refill summary for station
 * GET /api/v1/stations/:stationId/refills/summary
 */
exports.getRefillSummary = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    return sendError(res, 'VALIDATION_ERROR', 'startDate and endDate are required', 400);
  }
  
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, stationId))) {
    throw new AuthorizationError('Not authorized to access this station');
  }
  
  const summary = await TankRefill.getSummary(stationId, startDate, endDate);
  const byFuelType = await TankRefill.getByFuelType(stationId, startDate, endDate);
  
  return sendSuccess(res, {
    period: { startDate, endDate },
    summary,
    byFuelType
  });
});

/**
 * Update a refill entry
 * PUT /api/v1/refills/:id
 */
exports.updateRefill = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;
  
  const refill = await TankRefill.findByPk(id, {
    include: [{ model: Tank, as: 'tank' }]
  });
  
  if (!refill) {
    throw new NotFoundError('Refill', id);
  }
  
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, refill.stationId))) {
    throw new AuthorizationError('Not authorized to update this refill');
  }
  
  const allowedUpdates = ['refillDate', 'refillTime', 'costPerLitre', 'totalCost', 
                         'supplierName', 'invoiceNumber',
                         'vehicleNumber', 'driverName', 'driverPhone', 'notes'];
  
  allowedUpdates.forEach(field => {
    if (updates[field] !== undefined) {
      refill[field] = updates[field];
    }
  });
  
  await refill.save();
  
  return sendSuccess(res, refill);
});

/**
 * Delete a tank (owner/manager only)
 * DELETE /api/v1/tanks/:id
 */
exports.deleteTank = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const tank = await Tank.findByPk(id);
  if (!tank) {
    throw new NotFoundError('Tank', id);
  }

  const user = await User.findByPk(req.userId);
  if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
    throw new AuthorizationError('Only managers and above can delete tanks');
  }

  if (!(await canAccessStation(user, tank.stationId))) {
    throw new AuthorizationError('Not authorized to delete this tank');
  }

  await logAudit({
    userId: req.userId,
    userEmail: user.email,
    userRole: user.role,
    stationId: tank.stationId,
    action: 'DELETE',
    entityType: 'Tank',
    entityId: tank.id,
    oldValues: tank.toJSON(),
    newValues: null,
    category: 'data',
    severity: 'warning',
    description: `Deleted tank: ${tank.displayFuelName || tank.name} (${tank.fuelType})`
  });

  await tank.destroy();

  return sendSuccess(res, null, 200, { message: 'Tank deleted successfully' });
});

/**
 * Delete a refill entry (will adjust tank level)
 * DELETE /api/v1/refills/:id
 */
exports.deleteRefill = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  
  const refill = await TankRefill.findByPk(id);
  
  if (!refill) {
    throw new NotFoundError('Refill', id);
  }
  
  const user = await User.findByPk(req.userId);
  if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
    throw new AuthorizationError('Only managers and above can delete refill entries');
  }
  
  if (!(await canAccessStation(user, refill.stationId))) {
    throw new AuthorizationError('Not authorized to delete this refill');
  }
  
  await sequelize.transaction(async (transaction) => {
    await refill.destroy({ transaction });
  });
  
  return sendSuccess(res, null, 200, { message: 'Refill deleted and tank level adjusted' });
});
