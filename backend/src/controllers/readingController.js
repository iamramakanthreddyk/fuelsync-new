/**
 * Reading Controller
 * Core business logic for nozzle readings and sales calculation
 * 
 * AUDIT LOGGING:
 * - CREATE: Reading submission is logged with category 'data', severity 'info'
 * - UPDATE: Reading updates are logged with before/after values
 * 
 * All CREATE/UPDATE operations are tracked via logAudit() from utils/auditLog
 * 
 * ARCHITECTURE (Dec 2025):
 * 1. Nozzle Reading = What was SOLD (meter reading + calculated liters/value)
 *    - Only contains: readingValue, previousReading, litresSold, totalAmount, notes
 *    - NO payment breakdown (cash/online/credit) - these are ALWAYS 0
 * 
 * 2. Daily Transaction = How it was PAID (payment breakdown allocation)
 *    - Created AFTER readings are submitted
 *    - Contains: paymentBreakdown (cash/online/credit) + creditAllocations
 *    - Groups all readings from a day with one payment summary
 *    - Example: 5 readings totaling ₹5000 → 1 transaction with cash:₹3000 + credit:₹2000
 * 
 * 3. Settlement = RECONCILIATION (what owner confirms as correct)
 *    - Owner reviews expected (from readings) vs actual (from cash entry)
 *    - Settles discrepancies and approves transactions
 */

// ===== SERVICES & REPOSITORIES =====
const readingValidation = require('../services/readingValidationService');
const readingCalculation = require('../services/readingCalculationService');
const readingCache = require('../services/readingCacheService');
const readingRepository = require('../repositories/readingRepository');
const readingCreationService = require('../services/readingCreationService');

// ===== MODELS & DATABASE =====
const { NozzleReading, Nozzle, Pump, Station, User, Shift, FuelPrice, sequelize } = require('../models');
const { Op } = require('sequelize');

// ===== ERROR & RESPONSE HANDLING =====
const { NotFoundError, AuthorizationError, AuthenticationError, asyncHandler } = require('../utils/errors');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/apiResponse');

// ===== MIDDLEWARE =====
const { canAccessStation } = require('../middleware/accessControl');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');

/**
 * Create a nozzle reading
 * POST /api/v1/readings
 */
exports.createReading = asyncHandler(async (req, res, next) => {
  const user = req.user;
  if (!user) throw new NotFoundError('User not found');

  // Load nozzle with relations
  const nozzle = await Nozzle.findByPk(req.body.nozzleId, {
    include: [{
      model: Pump,
      as: 'pump',
      include: [{ model: Station, as: 'station' }]
    }]
  });

  if (!nozzle) {
    throw new NotFoundError('Nozzle', req.body.nozzleId);
  }

  const stationId = nozzle.pump.stationId;

  // Authorization check
  if (!(await canAccessStation(user, stationId))) {
    throw new AuthorizationError('Not authorized to enter readings for this station');
  }

  // Load station
  const station = await Station.findByPk(stationId);
  if (!station) throw new NotFoundError('Station', stationId);

  // Delegate all business logic to service
  const result = await readingCreationService.createReading(
    { user, nozzle, station },
    req.body
  );

  return sendCreated(res, result.reading, {
    message: result.metadata.message,
    note: result.metadata.note
  });
});

/**
 * Get previous reading for a nozzle (for UI display)
 * GET /api/v1/readings/previous/:nozzleId
 */
exports.getPreviousReading = asyncHandler(async (req, res, next) => {
  const { nozzleId } = req.params;
  const { date } = req.query;

  const nozzle = await Nozzle.findByPk(nozzleId, {
    include: [{ model: Pump, as: 'pump' }]
  });

  if (!nozzle) throw new NotFoundError('Nozzle', nozzleId);

  const previousReading = date
    ? await NozzleReading.getPreviousReading(nozzleId, date)
    : await NozzleReading.getLatestReading(nozzleId);

  const stationId = nozzle.pump.stationId;
  const priceDate = date || new Date().toISOString().split('T')[0];
  const currentPrice = await FuelPrice.getPriceForDate(stationId, nozzle.fuelType, priceDate);

  return sendSuccess(res, {
    nozzle: {
      id: nozzle.id,
      number: nozzle.nozzleNumber,
      fuelType: nozzle.fuelType,
      status: nozzle.status,
      initialReading: nozzle.initialReading
    },
    pump: {
      id: nozzle.pump.id,
      name: nozzle.pump.name,
      status: nozzle.pump.status
    },
    previousReading: previousReading?.readingValue || nozzle.initialReading || 0,
    previousDate: previousReading?.readingDate || null,
    currentPrice: currentPrice || null,
    hasReadings: !!previousReading
  });
});

/**
 * Get readings list with filters
 * GET /api/v1/readings
 */
exports.getReadings = asyncHandler(async (req, res, next) => {
  const { stationId, pumpId, nozzleId, startDate, endDate, page = 1, limit = 50, employeeId } = req.query;
  const user = req.user;

  if (!user) throw new AuthenticationError('User not authenticated');

  // Build accessible station IDs based on user role
  let accessibleStationIds = null;
  if (user.role === 'super_admin') {
    accessibleStationIds = null;
  } else if (user.role === 'owner') {
    const ownerStations = await Station.findAll({ where: { ownerId: user.id } });
    accessibleStationIds = ownerStations.map(s => s.id);
    
    if (stationId && !accessibleStationIds.includes(stationId)) {
      throw new AuthorizationError('Not authorized to view readings for this station');
    }
  } else {
    accessibleStationIds = [user.stationId];
  }

  const offset = (page - 1) * limit;
  const { count, rows } = await readingRepository.getReadingsWithFilters({
    stationId,
    pumpId,
    nozzleId,
    startDate,
    endDate,
    offset,
    limit,
    accessibleStationIds,
    employeeId: employeeId || null,
  });

  const readingsWithSaleValue = rows.map(r => {
    const obj = r.toJSON();
    obj.saleValue = readingRepository.calculateSaleValue(obj);
    if (obj.transaction) {
      obj.transaction.paymentBreakdown = obj.transaction.paymentBreakdown || obj.transaction.payment_breakdown || {};
      obj.transaction.paymentSubBreakdown = obj.transaction.paymentSubBreakdown || obj.transaction.payment_sub_breakdown || null;
    }
    obj.effectiveEmployee = obj.assignedEmployee || obj.enteredByUser || null;
    obj.wasEnteredOnBehalf = !!obj.assignedEmployeeId;
    return obj;
  });

  const linkedReadings = readingsWithSaleValue.filter(r => r.settlementId);
  const { unlinkedReadings, totals } = readingRepository.getUnlinkedReadingsWithTotals(readingsWithSaleValue);

  return sendSuccess(res, {
    linked: {
      count: linkedReadings.length,
      readings: linkedReadings
    },
    unlinked: {
      count: unlinkedReadings.length,
      readings: unlinkedReadings,
      totals
    },
    allReadingsCount: readingsWithSaleValue.length,
    readings: readingsWithSaleValue,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / limit)
    }
  });
});

/**
 * Get a single reading by ID
 * GET /api/v1/readings/:id
 */
exports.getReadingById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = req.user;

  const reading = await readingRepository.getReadingWithRelations(id);
  if (!reading) throw new NotFoundError('Reading', id);

  if (!(await canAccessStation(user, reading.stationId))) {
    throw new AuthorizationError('Not authorized to view this reading');
  }

  return sendSuccess(res, reading);
});

/**
 * Update a reading (same day only, manager+ role)
 * PUT /api/v1/readings/:id
 */
exports.updateReading = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { readingValue, notes } = req.body;

  // Get reading with relations
  const reading = await readingRepository.getReadingWithRelations(id);
  if (!reading) {
    throw new NotFoundError('Reading', id);
  }

  // Authorization check
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, reading.stationId))) {
    throw new AuthorizationError('Not authorized to update this reading');
  }
  if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
    throw new AuthorizationError('Only managers and above can edit readings');
  }

  // Save old value for audit
  const oldReadingValue = parseFloat(reading.readingValue);
  const newReadingValue = readingValue !== undefined ? parseFloat(readingValue) : oldReadingValue;

  // Validate new reading value if provided
  if (readingValue !== undefined) {
    const prevReading = await NozzleReading.getPreviousReading(reading.nozzleId, reading.readingDate);
    const prevValue = prevReading ? parseFloat(prevReading.readingValue) : (reading.previousReading || 0);
    
    const validation = readingValidation.validateReadingValue(newReadingValue, prevValue, false);
    if (!validation.isValid) {
      return sendError(res, 'VALIDATION_ERROR', validation.error, 422);
    }
  }

  // Create transaction for atomic cascading updates
  const t = await sequelize.transaction();

  try {
    // Prepare updates for current reading
    const updates = {};
    if (readingValue !== undefined) updates.readingValue = newReadingValue;
    if (notes !== undefined) updates.notes = notes;

    // Update this reading within transaction
    await reading.update(updates, { transaction: t });

    // Recalculate cascading readings (all readings on/after this date)
    const allReadingsAfter = await NozzleReading.findAll({
      where: {
        nozzleId: reading.nozzleId,
        readingDate: { [Op.gte]: reading.readingDate }
      },
      order: [['readingDate', 'ASC'], ['createdAt', 'ASC']],
      transaction: t
    });
    
    // Get starting previous value
    const prevReading = await NozzleReading.getPreviousReading(reading.nozzleId, reading.readingDate);
    const startingPrevValue = prevReading ? parseFloat(prevReading.readingValue) : 0;

    // Batch recalculate
    const recalculated = await readingCalculation.recalculateReadingsBatch(
      allReadingsAfter,
      startingPrevValue,
      reading.stationId
    );

    // Apply all cascading updates atomically
    for (const update of recalculated) {
      await NozzleReading.update(
        {
          previousReading: update.previousReading,
          litresSold: update.litresSold,
          pricePerLitre: update.pricePerLitre,
          totalAmount: update.totalAmount
        },
        { where: { id: update.id }, transaction: t }
      );
    }

    // Commit transaction - all cascading updates succeed or none
    await t.commit();

    // Refresh nozzle cache after successful commit
    await readingCache.refreshNozzleCache(reading.nozzleId);

    // Audit log
    const currentUser = await User.findByPk(user.id);
    await logAudit({
      userId: user.id,
      userEmail: currentUser?.email,
      userRole: currentUser?.role,
      stationId: reading.stationId,
      action: 'UPDATE',
      entityType: 'NozzleReading',
      entityId: id,
      oldValues: { readingValue: oldReadingValue },
      newValues: { readingValue: newReadingValue },
      category: 'data',
      severity: 'info',
      description: `Updated reading ${id}: ${oldReadingValue} → ${newReadingValue} (cascaded to ${recalculated.length} subsequent readings)`
    });

    const updatedReading = await readingRepository.getReadingWithRelations(id);
    return sendSuccess(res, updatedReading, 200, {
      message: `Reading updated. Cascaded recalculation to ${recalculated.length} subsequent readings`
    });
  } catch (err) {
    await t.rollback();
    throw err;
  }
});

/**
 * Get today's readings for current user
 * GET /api/v1/readings/today
 */
exports.getTodayReadings = asyncHandler(async (req, res, next) => {
  const user = await User.findByPk(req.userId);
  const today = new Date().toISOString().split('T')[0];

  // Build accessible station IDs based on role
  let accessibleStationIds = null;
  if (user.role === 'super_admin') {
    accessibleStationIds = null;
  } else if (user.role === 'owner') {
    const ownerStations = await Station.findAll({ where: { ownerId: user.id } });
    accessibleStationIds = ownerStations.map(s => s.id);
  } else {
    accessibleStationIds = [user.stationId];
  }

  const readings = await readingRepository.getReadingsForDate(null, today, accessibleStationIds);

  return sendSuccess(res, readings, 200, {
    count: readings.length,
    message: `Loaded ${readings.length} readings for today`
  });
});

exports.getLatestReadingsForNozzles = asyncHandler(async (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : [];
  if (!ids.length) {
    return sendError(res, 'VALIDATION_ERROR', 'No nozzle IDs provided', 400);
  }
  const results = await readingRepository.getLatestReadingsForNozzles(ids);
  return sendSuccess(res, results);
});

/**
 * Daily summary for a station
 * GET /api/v1/readings/summary
 */
exports.getDailySummary = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const user = await User.findByPk(req.userId);

  if (!(await canAccessStation(user, stationId))) {
    throw new AuthorizationError('Not authorized to access this station');
  }

  const summary = await readingRepository.getDailySummary(stationId, date);
  return sendSuccess(res, summary);
});

/**
 * Get last reading for a nozzle
 * GET /api/v1/readings/last?nozzleId=...
 */
exports.getLastReading = asyncHandler(async (req, res, next) => {
  const { nozzleId } = req.query;
  if (!nozzleId) {
    return sendError(res, 'VALIDATION_ERROR', 'nozzleId is required', 400);
  }

  const nozzle = await Nozzle.findByPk(nozzleId, { include: [{ model: Pump, as: 'pump' }] });
  if (!nozzle) {
    throw new NotFoundError('Nozzle', nozzleId);
  }

  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, nozzle.pump.stationId))) {
    throw new AuthorizationError('Not authorized');
  }

  const latest = await readingRepository.getLatestReadingForNozzle(nozzleId);
  return sendSuccess(res, latest || null);
});

/**
 * Delete a reading
 * DELETE /api/v1/readings/:id
 */
exports.deleteReading = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const reading = await NozzleReading.findByPk(id);
  if (!reading) {
    throw new NotFoundError('Reading', id);
  }

  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, reading.stationId))) {
    throw new AuthorizationError('Not authorized to delete this reading');
  }

  // Authorization: manager+ or the one who entered
  if (!['super_admin', 'owner', 'manager'].includes(user.role) && String(reading.enteredBy) !== String(user.id)) {
    throw new AuthorizationError('Only managers or the original employee can delete this reading');
  }

  // Delete reading
  await reading.destroy();

  // Refresh nozzle cache
  await readingCache.refreshNozzleCache(reading.nozzleId);

  return sendSuccess(res, reading, 200, { message: 'Reading deleted' });
});
