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

const { NozzleReading, Nozzle, Pump, Station, User, Shift, sequelize } = require('../models');
const { Op } = require('sequelize');
const { canAccessStation } = require('../middleware/accessControl');
const { logAudit } = require('../utils/auditLog');
const readingValidation = require('../services/readingValidationService');
const readingValidationEnhancedService = require('../services/readingValidationEnhancedService');
const readingCalculation = require('../services/readingCalculationService');
const readingCache = require('../services/readingCacheService');
const readingRepository = require('../repositories/readingRepository');

/**
 * Enter a new nozzle reading (SIMPLIFIED - payment tracking moved to transactions)
 * POST /api/v1/readings
 * 
 * Now only accepts reading data:
 * - nozzleId, readingDate, readingValue
 * - Optional: pricePerLitre, totalAmount, litresSold, notes
 * 
 * Payment breakdown is now handled via DailyTransaction model
 */
exports.createReading = async (req, res, next) => {
  try {
    const userId = req.userId;

    // Normalize input (handle camelCase and snake_case)
    const normalizedInput = readingValidation.normalizeReadingInput(req.body);

    console.log('[DEBUG] createReading received params:', normalizedInput);

    // Validate required fields
    const requiredValidation = readingValidation.validateRequiredFields(normalizedInput);
    if (!requiredValidation.isValid) {
      return res.status(400).json({ success: false, error: requiredValidation.error });
    }

    // Fetch nozzle with relations
    const nozzle = await Nozzle.findByPk(normalizedInput.nozzleId, {
      include: [{
        model: Pump,
        as: 'pump',
        include: [{ model: Station, as: 'station' }]
      }]
    });

    // Validate nozzle exists and is active
    const nozzleValidation = readingValidation.validateNozzleActive(nozzle);
    if (!nozzleValidation.isValid) {
      return res.status(404).json({ success: false, error: nozzleValidation.error });
    }

    const stationId = nozzle.pump.stationId;
    
    // Authorization check
    const user = await User.findByPk(userId);
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Not authorized to enter readings for this station' });
    }

    // --- Req #1: Employee Attribution Validation ---
    // Only manager/owner can enter readings attributed to another employee
    let resolvedAssignedEmployeeId = null;
    if (normalizedInput.assignedEmployeeId) {
      if (!['manager', 'owner', 'super_admin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Only managers and owners can assign readings to other employees'
        });
      }
      // Verify the assigned employee exists and belongs to the same station
      const assignedEmployee = await User.findOne({
        where: {
          id: normalizedInput.assignedEmployeeId,
          stationId,
          role: 'employee',
          isActive: true
        }
      });
      if (!assignedEmployee) {
        return res.status(404).json({
          success: false,
          error: 'Assigned employee not found at this station or is not an active employee'
        });
      }
      resolvedAssignedEmployeeId = assignedEmployee.id;
    }

    // Get station settings
    const station = await Station.findByPk(stationId);

    // Check if shift is required
    let activeShift = null;
    if (station.requireShiftForReadings) {
      activeShift = await Shift.getActiveShift(userId);
      if (!activeShift) {
        return res.status(400).json({
          success: false,
          error: 'You must have an active shift to enter readings. Please start your shift first.',
          requiresShift: true
        });
      }
    } else {
      activeShift = await Shift.getActiveShift(userId);
    }

    // Resolve previous reading and determine if initial
    const { previousReading, previousReadingRecord } = await readingCalculation.resolvePreviousReading(
      normalizedInput.nozzleId,
      normalizedInput.readingDate,
      nozzle.initialReading,
      normalizedInput.previousReading
    );

    const isInitialReading = readingValidation.determineIsInitial(previousReadingRecord, normalizedInput.previousReading);

    // Validate reading value
    const readingValidationResult = readingValidation.validateReadingValue(
      normalizedInput.readingValue,
      previousReading,
      isInitialReading
    );
    if (!readingValidationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: readingValidationResult.error,
        previousReading: readingValidationResult.previousReading
      });
    }

    // Enhanced validation: Check for duplicates
    const duplicateCheck = await readingValidationEnhancedService.checkDuplicateReading({
      nozzleId: normalizedInput.nozzleId,
      readingDate: normalizedInput.readingDate,
      readingValue: normalizedInput.readingValue,
      tolerance: 0.01
    });

    if (duplicateCheck.isDuplicate) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate reading detected',
        details: {
          message: `A reading for nozzle ${normalizedInput.nozzleId} on ${normalizedInput.readingDate} with value ${duplicateCheck.existingReading.readingValue} already exists`,
          existingReadingId: duplicateCheck.existingReading.id,
          existingReadingDate: duplicateCheck.existingReading.createdAt
        }
      });
    }

    // Enhanced validation: Check sequence and unusual increases
    const sequenceValidation = await readingValidationEnhancedService.validateReadingSequence({
      nozzleId: normalizedInput.nozzleId,
      currentValue: normalizedInput.readingValue,
      readingDate: normalizedInput.readingDate,
      previousValue: previousReading
    });

    if (!sequenceValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: sequenceValidation.error,
        details: sequenceValidation.details,
        warnings: sequenceValidation.warnings
      });
    }

    // Enhanced validation: Check for meter specifications compliance
    const meterValidation = await readingValidationEnhancedService.validateMeterSpecifications({
      nozzleId: normalizedInput.nozzleId,
      readingValue: normalizedInput.readingValue,
      fuelType: nozzle.fuelType
    });

    if (!meterValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: meterValidation.error,
        details: meterValidation.details
      });
    }

    // Validate backdated reading
    try {
      const stationWithOwner = await Station.findByPk(stationId, {
        include: [{ model: User, as: 'owner', include: ['plan'] }]
      });
      const allowedBackdatedDays = stationWithOwner?.owner?.plan?.backdatedDays ?? 3;
      const backdateValidation = readingValidation.validateBackdatedReading(normalizedInput.readingDate, allowedBackdatedDays);
      if (!backdateValidation.isValid) {
        return res.status(403).json({ success: false, error: backdateValidation.error });
      }
    } catch (err) {
      console.warn('Backdate validation failed, proceeding with default:', err?.message || err);
    }

    // Populate all calculated fields
    const calculations = await readingCalculation.populateReadingCalculations({
      nozzle,
      readingDate: normalizedInput.readingDate,
      normalizedInput,
      stationId
    });

    // Validate litres sold match
    const litresValidation = readingValidation.validateLitresSoldMatch(
      normalizedInput.litresSold,
      calculations.calculatedLitresSold
    );
    if (!litresValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: litresValidation.error,
        details: litresValidation.details
      });
    }

    // Create reading
    const t = await sequelize.transaction();
    let reading;
    try {
      reading = await NozzleReading.create({
        nozzleId: normalizedInput.nozzleId,
        stationId,
        pumpId: nozzle.pumpId || (nozzle.pump ? nozzle.pump.id : null),
        fuelType: nozzle.fuelType,
        enteredBy: userId,
        // Req #1: attribution - null if self-entry, employee ID if entered by manager/owner on behalf
        assignedEmployeeId: resolvedAssignedEmployeeId,
        readingDate: normalizedInput.readingDate,
        readingValue: calculations.currentValue,
        previousReading: calculations.previousReading,
        litresSold: calculations.calculatedLitresSold,
        pricePerLitre: calculations.calculatedPricePerLitre,
        totalAmount: calculations.calculatedTotalAmount,
        isInitialReading: calculations.isInitialReading,
        isSample: normalizedInput.isSample,
        notes: normalizedInput.notes,
        shiftId: activeShift?.id || null,
        // Legacy fields (no longer used in workflow)
        cashAmount: 0,
        onlineAmount: 0,
        creditAmount: 0,
        creditorId: null,
        paymentBreakdown: {}
      }, { transaction: t });

      // Update nozzle cache
      await readingCache.updateNozzleCacheDirect(
        normalizedInput.nozzleId,
        calculations.currentValue,
        normalizedInput.readingDate
      );

      // Audit log
      await logAudit({
        userId,
        userEmail: user.email,
        userRole: user.role,
        stationId,
        action: 'CREATE',
        entityType: 'NozzleReading',
        entityId: reading.id,
        newValues: {
          id: reading.id,
          nozzleId: normalizedInput.nozzleId,
          litresSold: calculations.calculatedLitresSold,
          totalAmount: calculations.calculatedTotalAmount,
          fuelType: nozzle.fuelType,
          assignedEmployeeId: resolvedAssignedEmployeeId,
          enteredBy: userId
        },
        category: 'data',
        severity: 'info',
        description: resolvedAssignedEmployeeId
          ? `Recorded reading on behalf of employee ${resolvedAssignedEmployeeId}: ${calculations.calculatedLitresSold}L of ${nozzle.fuelType} for ₹${calculations.calculatedTotalAmount.toFixed(2)}`
          : `Recorded reading: ${calculations.calculatedLitresSold}L of ${nozzle.fuelType} for ₹${calculations.calculatedTotalAmount.toFixed(2)}`
      });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // Return with calculated values
    const readingJson = {
      ...reading.toJSON(),
      nozzle: {
        id: nozzle.id,
        number: nozzle.nozzleNumber,
        fuelType: nozzle.fuelType
      },
      pump: {
        id: nozzle.pump.id,
        name: nozzle.pump.name
      }
    };

    res.status(201).json({
      success: true,
      data: readingJson,
      reading: readingJson,
      message: calculations.isInitialReading 
        ? 'Initial reading recorded. This nozzle is now ready for daily entries.'
        : `Sale recorded: ${calculations.calculatedLitresSold.toFixed(3)}L = ₹${calculations.calculatedTotalAmount.toFixed(2)}. Payment breakdown recorded separately via DailyTransaction.`,
      note: 'Payment breakdown (cash/online/credit) is NOT stored in readings. Use DailyTransaction API to record payment allocation.'
    });
  } catch (error) {
    console.error('Create reading error:', error);
    next(error);
  }
};

/**
 * Get previous reading for a nozzle (for UI display)
 * GET /api/v1/readings/previous/:nozzleId
 */
exports.getPreviousReading = async (req, res, next) => {
  try {
    const { nozzleId } = req.params;
    const { date } = req.query;

    const nozzle = await Nozzle.findByPk(nozzleId, {
      include: [{ model: Pump, as: 'pump' }]
    });

    if (!nozzle) {
      return res.status(404).json({ success: false, error: 'Nozzle not found' });
    }

    let previousReading;
    if (date) {
      previousReading = await NozzleReading.getPreviousReading(nozzleId, date);
    } else {
      previousReading = await NozzleReading.getLatestReading(nozzleId);
    }

    const stationId = nozzle.pump.stationId;
    const priceDate = date || new Date().toISOString().split('T')[0];
    const currentPrice = await require('../models').FuelPrice.getPriceForDate(stationId, nozzle.fuelType, priceDate);

    res.json({
      success: true,
      data: {
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
      }
    });
  } catch (error) {
    console.error('Get previous reading error:', error);
    next(error);
  }
};

/**
 * Get readings list with filters
 * GET /api/v1/readings
 */
exports.getReadings = async (req, res, next) => {
  try {
    const { stationId, pumpId, nozzleId, startDate, endDate, page = 1, limit = 50, employeeId } = req.query;
    const user = await User.findByPk(req.userId);

    // Build accessible station IDs based on user role
    let accessibleStationIds = null;
    if (user.role === 'super_admin') {
      // No filter
      accessibleStationIds = null;
    } else if (user.role === 'owner') {
      const ownerStations = await Station.findAll({ where: { ownerId: user.id } });
      accessibleStationIds = ownerStations.map(s => s.id);
      
      // Validate user owns the requested station
      if (stationId && !accessibleStationIds.includes(stationId)) {
        return res.status(403).json({ success: false, error: 'Not authorized to view readings for this station' });
      }
    } else {
      // Manager/Employee - only own station
      accessibleStationIds = [user.stationId];
    }

    // Get readings with filters
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
      // Req #1: support filtering by employee (handles both self-entry and attributed readings)
      employeeId: employeeId || null,
    });

    // Add saleValue to each reading and enrich with attribution info
    const readingsWithSaleValue = rows.map(r => {
      const obj = r.toJSON();
      obj.saleValue = readingRepository.calculateSaleValue(obj);
      if (obj.transaction) {
        obj.transaction.paymentBreakdown = obj.transaction.paymentBreakdown || obj.transaction.payment_breakdown || {};
        obj.transaction.paymentSubBreakdown = obj.transaction.paymentSubBreakdown || obj.transaction.payment_sub_breakdown || null;
      }
      // Req #1: Compute effective employee (who this reading "belongs to" for reports)
      obj.effectiveEmployee = obj.assignedEmployee || obj.enteredByUser || null;
      obj.wasEnteredOnBehalf = !!obj.assignedEmployeeId;
      return obj;
    });

    // Separate linked/unlinked
    const linkedReadings = readingsWithSaleValue.filter(r => r.settlementId);
    const { unlinkedReadings, totals } = readingRepository.getUnlinkedReadingsWithTotals(readingsWithSaleValue);

    res.json({
      success: true,
      data: {
        linked: {
          count: linkedReadings.length,
          readings: linkedReadings
        },
        unlinked: {
          count: unlinkedReadings.length,
          readings: unlinkedReadings,
          totals
        },
        allReadingsCount: readingsWithSaleValue.length
      },
      readings: readingsWithSaleValue,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get readings error:', error);
    next(error);
  }
};

/**
 * Get a single reading by ID
 * GET /api/v1/readings/:id
 */
exports.getReadingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const reading = await readingRepository.getReadingWithRelations(id);
    if (!reading) {
      return res.status(404).json({ success: false, error: 'Reading not found' });
    }

    // Authorization check
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, reading.stationId))) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this reading' });
    }

    res.json({ success: true, data: reading });
  } catch (error) {
    console.error('Get reading by ID error:', error);
    next(error);
  }
};

/**
 * Update a reading (same day only, manager+ role)
 * PUT /api/v1/readings/:id
 */

exports.updateReading = async (req, res, next) => {
  let t;
  try {
    const { id } = req.params;
    const { readingValue, notes } = req.body;

    // Get reading with relations
    const reading = await readingRepository.getReadingWithRelations(id);
    if (!reading) {
      return res.status(404).json({ success: false, error: 'Reading not found' });
    }

    // Authorization check
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, reading.stationId))) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this reading' });
    }
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Only managers and above can edit readings' });
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
        return res.status(400).json({ success: false, error: validation.error });
      }
    }

    // Create transaction for atomic cascading updates
    t = await sequelize.transaction();

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
          readingDate: { [require('sequelize').Op.gte]: reading.readingDate }
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

      res.json({
        success: true,
        data: await readingRepository.getReadingWithRelations(id),
        message: `Reading updated. Cascaded recalculation to ${recalculated.length} subsequent readings`
      });
    } catch (err) {
      await t.rollback();
      console.error('[ERROR] updateReading cascade failed:', err);
      throw err;
    }
  } catch (error) {
    console.error('Update reading error:', error);
    next(error);
  }
};

/**
 * Get today's readings for current user
 * GET /api/v1/readings/today
 */
exports.getTodayReadings = async (req, res, next) => {
  try {
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

    res.json({
      success: true,
      data: readings,
      count: readings.length
    });
  } catch (error) {
    console.error('Get today readings error:', error);
    next(error);
  }
};

exports.getLatestReadingsForNozzles = async (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : [];
  if (!ids.length) {
    return res.status(400).json({ success: false, error: 'No nozzle IDs provided' });
  }
  try {
    const results = await readingRepository.getLatestReadingsForNozzles(ids);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error('[ERROR] getLatestReadingsForNozzles:', err.message);
    res.json({ success: true, data: {} });
  }
};

/**
 * Daily summary for a station
 * GET /api/v1/readings/summary
 */
exports.getDailySummary = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const user = await User.findByPk(req.userId);

    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Not authorized to access this station' });
    }

    const summary = await readingRepository.getDailySummary(stationId, date);
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Get daily summary error:', err);
    next(err);
  }
};

/**
 * Get last reading for a nozzle
 * GET /api/v1/readings/last?nozzleId=...
 */
exports.getLastReading = async (req, res, next) => {
  try {
    const { nozzleId } = req.query;
    if (!nozzleId) return res.status(400).json({ success: false, error: 'nozzleId is required' });

    const nozzle = await Nozzle.findByPk(nozzleId, { include: [{ model: Pump, as: 'pump' }] });
    if (!nozzle) return res.status(404).json({ success: false, error: 'Nozzle not found' });

    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, nozzle.pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const latest = await readingRepository.getLatestReadingForNozzle(nozzleId);
    res.json({ success: true, data: latest || null });
  } catch (err) {
    console.error('Get last reading error:', err);
    next(err);
  }
};

/**
 * Delete a reading
 * DELETE /api/v1/readings/:id
 */
exports.deleteReading = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reading = await NozzleReading.findByPk(id);
    if (!reading) {
      return res.status(404).json({ success: false, error: 'Reading not found' });
    }

    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, reading.stationId))) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this reading' });
    }

    // Authorization: manager+ or the one who entered
    if (!['super_admin', 'owner', 'manager'].includes(user.role) && String(reading.enteredBy) !== String(user.id)) {
      return res.status(403).json({ success: false, error: 'Only managers or the original employee can delete this reading' });
    }

    // Delete reading
    await reading.destroy();

    // Refresh nozzle cache
    await readingCache.refreshNozzleCache(reading.nozzleId);

    res.json({ success: true, data: reading, reading: reading, message: 'Reading deleted' });
  } catch (error) {
    console.error('Delete reading error:', error);
    next(error);
  }
};
