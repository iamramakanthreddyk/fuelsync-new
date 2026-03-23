/**
 * Reading Creation Service
 * Encapsulates ALL business logic for creating nozzle readings
 * 
 * This service is responsible for:
 * - Normalizing and validating input
 * - Validating entities (nozzle, station, user)
 * - Performing shift validation
 * - Resolving previous readings
 * - Validating reading values
 * - Duplicate and sequence validation
 * - Meter specification checks
 * - All calculation logic
 * - Database transaction handling
 * - Audit logging
 */

const { NozzleReading, Shift, Station, User, sequelize } = require('../models');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  BusinessLogicError,
  AuthorizationError
} = require('../utils/errors');
const { logAudit } = require('../utils/auditLog');
const { createContextLogger } = require('./loggerService');
const logger = createContextLogger('ReadingCreation');
const readingValidation = require('./readingValidationService');
const readingCalculation = require('./readingCalculationService');
const readingCache = require('./readingCacheService');

/**
 * Create a nozzle reading with full business logic validation
 * 
 * @param {Object} entities - Pre-loaded entities
 *   - user: User object (must exist)
 *   - nozzle: Nozzle object with pump and station relations
 *   - station: Station object
 * @param {Object} input - Raw request input (body)
 * @returns {Object} - { reading, validation, metadata }
 * @throws {ValidationError|NotFoundError|ConflictError|BusinessLogicError}
 */
exports.createReading = async (entities, input) => {
  const { user, nozzle, station } = entities;

  console.log('[DEBUG] readingCreationService.createReading received:', { 
    user: { id: user.id }, 
    nozzle: { id: nozzle.id }, 
    station: station ? { id: station.id, name: station.name } : null 
  });

  // Normalize input
  const normalizedInput = readingValidation.normalizeReadingInput(input);

  // --- Step 1: Validate Required Fields ---
  const requiredValidation = readingValidation.validateRequiredFields(normalizedInput);
  if (!requiredValidation.isValid) {
    throw new ValidationError('Missing required fields', {
      fields: ['nozzleId', 'readingDate', 'readingValue']
    });
  }

  // --- Step 2: Validate Nozzle ---
  const nozzleValidation = readingValidation.validateNozzleActive(nozzle);
  if (!nozzleValidation.isValid) {
    throw new NotFoundError('Nozzle', normalizedInput.nozzleId);
  }

  // --- Step 3: Employee Attribution Validation (REQUIRED) ---
  // RULE: Every reading MUST have an employee responsible for it
  // - Employee: Must assign to themselves (self-entry)
  // - Manager/Owner: Must explicitly assign to an employee
  
  let resolvedAssignedEmployeeId = null;

  if (user.role === 'employee') {
    // Employee must assign to themselves (or leave null = implicit self-assignment)
    if (normalizedInput.assignedEmployeeId && normalizedInput.assignedEmployeeId !== user.id) {
      throw new AuthorizationError(
        'Employees can only enter readings for themselves'
      );
    }
    // For employee: either explicit self-assignment or implicit (null)
    resolvedAssignedEmployeeId = normalizedInput.assignedEmployeeId || null;
  } else if (['manager', 'owner', 'super_admin'].includes(user.role)) {
    // Manager/Owner MUST explicitly assign to an employee
    if (!normalizedInput.assignedEmployeeId) {
      throw new ValidationError(
        'Managers and owners must assign readings to an employee',
        {
          field: 'assignedEmployeeId',
          message: 'Select which employee this reading belongs to'
        }
      );
    }

    // Verify assigned employee exists and belongs to same station
    const assignedEmployee = await User.findOne({
      where: {
        id: normalizedInput.assignedEmployeeId,
        stationId: station.id,
        role: 'employee',
        isActive: true
      }
    });

    if (!assignedEmployee) {
      throw new NotFoundError(
        'Assigned employee not found at this station or is not active',
        { employeeId: normalizedInput.assignedEmployeeId }
      );
    }

    resolvedAssignedEmployeeId = assignedEmployee.id;
  }

  // --- Step 4: Shift Requirement Check ---
  let activeShift = null;
  if (station.requireShiftForReadings) {
    activeShift = await Shift.getActiveShift(user.id);
    if (!activeShift) {
      throw new BusinessLogicError(
        'You must have an active shift to enter readings. Please start your shift first.',
        { requiresShift: true }
      );
    }
  } else {
    activeShift = await Shift.getActiveShift(user.id);
  }

  // --- Step 5: Resolve Previous Reading ---
  console.log('[DEBUG] About to call resolvePreviousReading with:', {
    nozzleId: normalizedInput.nozzleId,
    readingDate: normalizedInput.readingDate,
    stationId: station?.id,
    stationFull: station
  });
  
  // ASSERTION: Verify station.id exists before passing
  if (!station || !station.id) {
    console.error('[ERROR] Station missing or has no ID:', { station });
    throw new Error(`Station object invalid: ${JSON.stringify(station)}`);
  }
  console.log(`[DEBUG] Verified station.id = ${station.id} before passing to resolvePreviousReading`);
  
  const { previousReading, previousReadingRecord } = await readingCalculation.resolvePreviousReading(
    normalizedInput.nozzleId,
    normalizedInput.readingDate,
    nozzle.initialReading,
    normalizedInput.previousReading,
    station.id
  );

  const isInitialReading = readingValidation.determineIsInitial(
    previousReadingRecord,
    normalizedInput.previousReading
  );

  // --- Step 6: Validate Reading Value ---
  const readingValidationResult = readingValidation.validateReadingValue(
    normalizedInput.readingValue,
    previousReading,
    isInitialReading
  );

  if (!readingValidationResult.isValid) {
    throw new ValidationError(readingValidationResult.error, {
      previousReading: readingValidationResult.previousReading
    });
  }

  // --- Step 7: Check for Duplicate Readings ---
  const duplicateCheck = await readingValidation.checkDuplicateReading({
    nozzleId: normalizedInput.nozzleId,
    readingDate: normalizedInput.readingDate,
    readingValue: normalizedInput.readingValue,
    tolerance: 0.01
  });

  if (duplicateCheck.isDuplicate) {
    throw new ConflictError('Duplicate reading detected', {
      message: `A reading for nozzle ${normalizedInput.nozzleId} on ${normalizedInput.readingDate} with value ${duplicateCheck.existingReading.readingValue} already exists`,
      existingReadingId: duplicateCheck.existingReading.id,
      existingReadingDate: duplicateCheck.existingReading.createdAt
    });
  }

  // --- Step 8: Validate Reading Sequence ---
  const sequenceValidation = await readingValidation.validateReadingSequence({
    nozzleId: normalizedInput.nozzleId,
    currentValue: normalizedInput.readingValue,
    readingDate: normalizedInput.readingDate,
    previousValue: previousReading
  });

  if (!sequenceValidation.isValid) {
    throw new BusinessLogicError(sequenceValidation.error, {
      details: sequenceValidation.details,
      warnings: sequenceValidation.warnings
    });
  }

  // --- Step 9: Check Meter Specifications ---
  const meterValidation = await readingValidation.validateMeterSpecifications({
    nozzleId: normalizedInput.nozzleId,
    readingValue: normalizedInput.readingValue,
    fuelType: nozzle.fuelType
  });

  if (!meterValidation.isValid) {
    throw new BusinessLogicError(meterValidation.error, {
      details: meterValidation.details
    });
  }

  // --- Step 10: Validate Backdated Reading ---
  try {
    const stationWithOwner = await Station.findByPk(station.id, {
      include: [{ model: User, as: 'owner', include: ['plan'] }]
    });
    const allowedBackdatedDays = stationWithOwner?.owner?.plan?.backdatedDays ?? 3;
    const backdateValidation = readingValidation.validateBackdatedReading(
      normalizedInput.readingDate,
      allowedBackdatedDays
    );
    if (!backdateValidation.isValid) {
      throw new ValidationError(backdateValidation.error);
    }
  } catch (err) {
    // Log but don't fail - proceed with default
    logger.warn('Backdate validation warning', err?.message || err);
  }

  // --- Step 11: Populate Calculations ---
  const calculations = await readingCalculation.populateReadingCalculations({
    nozzle,
    readingDate: normalizedInput.readingDate,
    normalizedInput,
    stationId: station.id
  });

  // --- Step 12: Validate Litres Sold Match ---
  const litresValidation = readingValidation.validateLitresSoldMatch(
    normalizedInput.litresSold,
    calculations.calculatedLitresSold
  );

  if (!litresValidation.isValid) {
    throw new ValidationError(litresValidation.error, litresValidation.details);
  }

  // --- Step 13: Create Reading in Transaction ---
  const t = await sequelize.transaction();
  let reading;

  try {
    reading = await NozzleReading.create({
      nozzleId: normalizedInput.nozzleId,
      stationId: station.id,
      pumpId: nozzle.pumpId || (nozzle.pump ? nozzle.pump.id : null),
      fuelType: nozzle.fuelType,
      enteredBy: user.id,
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
      // Legacy fields (no longer used)
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
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      stationId: station.id,
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
        enteredBy: user.id
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

  return {
    reading: {
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
    },
    validation: {
      isInitialReading: calculations.isInitialReading
    },
    metadata: {
      message: calculations.isInitialReading
        ? 'Initial reading recorded. This nozzle is now ready for daily entries.'
        : `Sale recorded: ${calculations.calculatedLitresSold.toFixed(3)}L = ₹${calculations.calculatedTotalAmount.toFixed(2)}. Payment breakdown recorded separately via DailyTransaction.`,
      note: 'Payment breakdown (cash/online/credit) is NOT stored in readings. Use DailyTransaction API to record payment allocation.'
    }
  };
};
