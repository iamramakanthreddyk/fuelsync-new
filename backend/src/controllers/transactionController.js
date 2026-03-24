/**
 * Transaction Controller
 * Handles daily transaction creation and retrieval
 * Transactions record the payment breakdown for a day at station level
 * 
 * AUDIT LOGGING:
 * - CREATE: DailyTransaction creation is logged with category 'finance', severity 'info'
 * 
 * All transaction operations are tracked via logAudit() from utils/auditLog
 */

// ===== MODELS & DATABASE =====
const { DailyTransaction, NozzleReading, Station, User, Creditor, CreditTransaction, sequelize, FuelPrice, Nozzle, Pump } = require('../models');
const bulkOperations = require('../services/bulkOperations');
const transactionValidation = require('../services/transactionValidationService');
const creditAllocationService = require('../services/creditAllocationService');
const { VALIDATION_ERRORS, TRANSACTION_STATUS } = require('../config/transactionConstants');
const { Op } = require('sequelize');

// ===== ERROR & RESPONSE HANDLING =====
const { asyncHandler, NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');
// Minimal helper to compute litresSold and totalAmount similar to readingController
async function createComputedReading({ stationId, nozzleId, readingValue, readingDate, notes, userId, transaction, stationPricesMap, isSample = false, forceNotInitial = false, assignedEmployeeId = null }) {
  // Find previous (last) reading for nozzle before or on date
  const lastReading = await NozzleReading.findOne({
    where: {
      nozzleId,
      stationId,
      isInitialReading: false,
      readingDate: { [sequelize.Sequelize.Op.lte]: readingDate }
    },
    order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
    transaction
  });

  // If no non-initial previous reading exists, prefer nozzle.initialReading
  let previousReading = 0;
  let isInitial = false;
  if (lastReading) {
    previousReading = parseFloat(lastReading.readingValue);
  } else {
    const nozzle = await Nozzle.findByPk(nozzleId, { transaction });
    const init = nozzle && nozzle.initialReading !== undefined && nozzle.initialReading !== null ? parseFloat(String(nozzle.initialReading)) : null;
    if (init !== null) {
      previousReading = init;
      isInitial = !forceNotInitial; // respect forceNotInitial flag
    } else {
      previousReading = 0;
      isInitial = !forceNotInitial; // if forceNotInitial, mark as billable even if no previous reading
    }
  }

  const closingReading = parseFloat(readingValue || 0);
  const litresSold = Math.max(0, closingReading - previousReading);

  // Fetch nozzle to get fuelType and pumpId
  let fuelType = null;
  let pumpId = null;
  let pricePerLitre = 0;
  try {
    const nozzle = await Nozzle.findByPk(nozzleId, {
      include: [{ model: Pump, as: 'pump' }],
      transaction
    });
    fuelType = nozzle?.fuelType || null;
    pumpId = nozzle?.pumpId || (nozzle?.pump ? nozzle.pump.id : null);
    
    // Prefer client-provided station prices if available
    if (fuelType && stationPricesMap && stationPricesMap[fuelType]) {
      pricePerLitre = parseFloat(String(stationPricesMap[fuelType]));
    } else if (fuelType && FuelPrice && FuelPrice.getPriceForDate) {
      const p = await FuelPrice.getPriceForDate(stationId, fuelType, readingDate);
      if (p !== null && p !== undefined) pricePerLitre = parseFloat(String(p));
    }
  } catch (_) {}
  const totalAmount = litresSold * pricePerLitre;

  const payload = {
    stationId,
    nozzleId,
    pumpId,
    fuelType,
    readingValue: closingReading,
    previousReading: previousReading,
    litresSold,
    pricePerLitre,
    totalAmount,
    readingDate,
    notes: notes || '',
    enteredBy: userId,
    isSample: !!isSample,
    ...(assignedEmployeeId ? { assignedEmployeeId } : {})
  };

  // Preserve isInitialReading flag when creating
  payload.isInitialReading = !!isInitial;

  return await NozzleReading.create(payload, { transaction });
}

/**
 * Create a daily transaction
 * POST /api/v1/transactions
 */
exports.createTransaction = asyncHandler(async (req, res, next) => {
  const { stationId, transactionDate, readingIds = [], paymentBreakdown = {}, paymentSubBreakdown = null, creditAllocations = [], notes = '' } = req.body;
  const userId = req.user.id;

  // Input validation
  if (!stationId) return sendError(res, 'MISSING_FIELD', VALIDATION_ERRORS.STATION_REQUIRED, 400);
  if (!transactionDate) return sendError(res, 'MISSING_FIELD', VALIDATION_ERRORS.DATE_REQUIRED, 400);
  if (!Array.isArray(readingIds) || readingIds.length === 0) return sendError(res, 'INVALID_ARRAY', VALIDATION_ERRORS.READINGS_REQUIRED, 400);

  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) throw new NotFoundError('Station', stationId);

  // Fetch readings to validate and sum
  const readings = await NozzleReading.findAll({
    where: { id: readingIds, stationId, readingDate: transactionDate, isInitialReading: false }
  });

  if (readings.length === 0) return sendError(res, 'NO_READINGS', VALIDATION_ERRORS.NO_READINGS_FOUND, 400);

  // Filter out sample readings - samples should not be included in transaction calculations
  const nonSampleReadings = readings.filter(r => !r.isSample);
  
  if (nonSampleReadings.length === 0) {
    // All readings are samples - no transaction needed (silent success)
    // Sample readings are used for testing/verification only, not for transactions
    return res.json({
      success: true,
      data: null,
      message: 'Sample readings submitted (no transaction created - samples are for QC only)'
    });
  }

  // Calculate totals from NON-SAMPLE readings only
  const totalLiters = nonSampleReadings.reduce((sum, r) => sum + parseFloat(r.litresSold || 0), 0);
  const totalSaleValue = nonSampleReadings.reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);

  // Validate using enhanced service
  const enhancedValidation = await transactionValidation.validateTransactionComplete({
    stationId,
    transactionDate,
    readingIds: nonSampleReadings.map(r => r.id),
    readings: nonSampleReadings,
    paymentBreakdown,
    creditAllocations,
    totalSaleValue
  });

  if (!enhancedValidation.isValid) {
    return sendError(res, 'VALIDATION_FAILED', enhancedValidation.error, 400, {
      details: enhancedValidation.details,
      issues: enhancedValidation.issues
    });
  }

  const normalizedBreakdown = enhancedValidation.normalizedBreakdown;

  // Prefer the explicitly-provided paymentBreakdown over a value derived from paymentSubBreakdown.
  // paymentSubBreakdown may not include cash/credit (those are tracked separately), so collapsing it
  // would produce wrong totals. Only derive when no explicit breakdown was given.
  const { collapsePaymentBreakdown } = require('../config/constants');
  const hasExplicitBreakdown = paymentBreakdown && (paymentBreakdown.cash || paymentBreakdown.online || paymentBreakdown.credit);
  let effectiveBreakdown = normalizedBreakdown;
  if (!hasExplicitBreakdown && paymentSubBreakdown && typeof paymentSubBreakdown === 'object') {
    effectiveBreakdown = collapsePaymentBreakdown(paymentSubBreakdown);
  }

  // Enrich stored paymentSubBreakdown with cash/credit from the authoritative breakdown,
  // because the frontend only sends online sub-types in paymentSubBreakdown.
  const enrichedSubBreakdown = paymentSubBreakdown
    ? { ...paymentSubBreakdown, cash: effectiveBreakdown.cash, credit: effectiveBreakdown.credit }
    : null;

  const t = await sequelize.transaction();
  try {
    const dailyTxn = await DailyTransaction.create({
      stationId,
      transactionDate,
      totalLiters,
      totalSaleValue,
      paymentBreakdown: effectiveBreakdown,
      paymentSubBreakdown: enrichedSubBreakdown,
      creditAllocations: creditAllocationService.formatCreditAllocationsForStorage(creditAllocations),
      readingIds: nonSampleReadings.map(r => r.id),
      createdBy: userId,
      notes,
      status: TRANSACTION_STATUS.SUBMITTED
    }, { transaction: t });

    // Process credit allocations
    const createdCreditTxns = await creditAllocationService.processCreditAllocations({
      stationId,
      creditAllocations: creditAllocationService.formatCreditAllocationsForStorage(creditAllocations),
      transactionDate,
      readingIds,
      notes,
      userId,
      transaction: t
    });

    // Link non-sample readings to transaction
    await NozzleReading.update(
      { transactionId: dailyTxn.id },
      { where: { id: nonSampleReadings.map(r => r.id) }, transaction: t }
    );

    // Audit log
    const currentUser = await User.findByPk(userId);
    await logAudit({
      userId,
      userEmail: currentUser?.email,
      userRole: currentUser?.role,
      stationId,
      action: 'CREATE',
      entityType: 'DailyTransaction',
      entityId: dailyTxn.id,
      newValues: {
        id: dailyTxn.id,
        transactionDate,
        totalLiters,
        totalSaleValue,
        paymentBreakdown: normalizedBreakdown,
        creditAllocations: creditAllocations.length
      },
      category: 'finance',
      severity: 'info',
      description: `Created daily transaction: ₹${totalSaleValue.toFixed(2)} from ${totalLiters}L of fuel`
    });

    await t.commit();

    const result = await DailyTransaction.findByPk(dailyTxn.id, {
      include: [
        { model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] },
        { model: Station, as: 'station', attributes: ['id', 'name'] }
      ]
    });

    return sendCreated(res, { ...result.dataValues, creditTransactions: createdCreditTxns }, { message: `Transaction created for ${readings.length} readings` });
  } catch (err) {
    await t.rollback();
    
    // Map validation errors to appropriate HTTP status codes
    if (err.message && err.message.includes(VALIDATION_ERRORS.CREDIT_LIMIT_EXCEEDED)) {
      return sendError(res, 'CREDIT_LIMIT', err.message, 403);
    }
    if (err.message && (err.message.includes(VALIDATION_ERRORS.CREDITOR_NOT_FOUND) || err.message.includes(VALIDATION_ERRORS.CREDITOR_NOT_FOUND_FOR_ALLOCATION))) {
      throw new NotFoundError('Creditor', 'referenced');
    }
    if (err.message && err.message.includes('isActive')) {
      return sendError(res, 'CREDITOR_INACTIVE', err.message, 403);
    }
    
    throw err;
  }
});

/**
 * Create quick-entry: accepts readings (full objects) and a transaction payload
 * POST /api/v1/transactions/quick-entry
 */
exports.createQuickEntry = asyncHandler(async (req, res, next) => {
  const { stationId, transactionDate, readings = [], paymentBreakdown, paymentSubBreakdown = null, creditAllocations = [], notes = '' } = req.body;
  const assignedEmployeeId = req.body.assignedEmployeeId || req.body.associatedEmployeeId || null;
  const userId = req.user.id;
  const userRole = req.user?.role;

  if (!stationId) return sendError(res, 'MISSING_FIELD', VALIDATION_ERRORS.STATION_REQUIRED, 400);
  if (!transactionDate) return sendError(res, 'MISSING_FIELD', VALIDATION_ERRORS.DATE_REQUIRED, 400);
  if (!Array.isArray(readings) || readings.length === 0) return sendError(res, 'INVALID_ARRAY', VALIDATION_ERRORS.READINGS_REQUIRED, 400);

  const station = await Station.findByPk(stationId);
  if (!station) throw new NotFoundError('Station', stationId);

  // --- EMPLOYEE ASSIGNMENT VALIDATION (REQUIRED) ---
  // RULE: Every reading MUST have an employee responsible for it
  // - Employee: Can only assign to themselves
  // - Manager/Owner: MUST explicitly assign to an employee
  
  let resolvedAssignedEmployeeId = assignedEmployeeId;

  if (userRole === 'employee') {
    // Employee must assign to themselves (or leave null = implicit self-assignment)
    if (assignedEmployeeId && assignedEmployeeId !== userId) {
      return sendError(res, 'UNAUTHORIZED', 'Employees can only enter readings for themselves', 403);
    }
    // For employee: use explicit assignment or null (which will be treated as self)
    resolvedAssignedEmployeeId = assignedEmployeeId || null;
  } else if (['manager', 'owner', 'super_admin'].includes(userRole)) {
    // Manager/Owner MUST explicitly assign to an employee
    if (!assignedEmployeeId) {
      return sendError(
        res,
        'VALIDATION_ERROR',
        'Managers and owners must assign readings to an employee',
        400,
        { field: 'assignedEmployeeId', message: 'Select which employee this reading belongs to' }
      );
    }

    // Verify assigned employee exists and belongs to same station
    const assignedEmployee = await User.findOne({
      where: {
        id: assignedEmployeeId,
        stationId: station.id,
        role: 'employee',
        isActive: true
      }
    });

    if (!assignedEmployee) {
      return sendError(
        res,
        'NOT_FOUND',
        'Assigned employee not found at this station or is not active',
        404,
        { employeeId: assignedEmployeeId }
      );
    }

    resolvedAssignedEmployeeId = assignedEmployee.id;
  }

  const t = await sequelize.transaction();
  try {
    // Create readings and build billable list
    const createdReadings = [];
    const stationPricesMap = Array.isArray(req.body.stationPrices)
      ? req.body.stationPrices.reduce((acc, p) => {
          const key = (p.fuelType || p.fuel_type || '').toString().toLowerCase();
          const val = p.price !== undefined ? p.price : p.price_per_litre;
          if (key && val !== undefined && val !== null) acc[key] = parseFloat(String(val));
          return acc;
        }, {})
      : {};

    for (const r of readings) {
      const nozzleId = r.nozzleId || r.nozzle_id;
      const readingValue = r.readingValue !== undefined ? r.readingValue : r.reading_value;
      const readingDateVal = r.readingDate || r.reading_date || transactionDate;
      const notesVal = r.notes || '';
      const isSampleVal = r.isSample !== undefined ? r.isSample : r.is_sample || false;

      const created = await createComputedReading({
        stationId,
        nozzleId,
        readingValue,
        readingDate: readingDateVal,
        notes: notesVal,
        userId,
        transaction: t,
        stationPricesMap,
        isSample: isSampleVal,
        forceNotInitial: true,
        assignedEmployeeId: resolvedAssignedEmployeeId // Use validated employee ID
      });
      createdReadings.push(created);
    }

    // Build readingIds for billable readings (exclude samples AND initial readings)
    const billableReadings = createdReadings.filter(cr => !cr.isInitialReading && !cr.isSample);
    const readingIds = billableReadings.map(cr => cr.id);

    // Compute totals from billable readings only (excluding samples)
    const totalLiters = billableReadings.reduce((s, r) => s + parseFloat(r.litresSold || 0), 0);
    const totalSaleValue = billableReadings.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);

    // Check if there are any billable readings (non-sample AND non-initial)
    if (billableReadings.length === 0) {
      await t.commit();
      return sendSuccess(res, { createdReadings }, 200, { message: 'Readings recorded (samples and/or initial readings only). No transaction created.' });
    }

    // Validate or auto-balance payment breakdown
    const paymentBalance = transactionValidation.autoBalancePayment(paymentBreakdown, totalSaleValue);
    if (!paymentBalance.isValid) {
      await t.rollback();
      return sendError(res, 'PAYMENT_INVALID', paymentBalance.error, 400, paymentBalance.details);
    }

    // Validate credit allocations
    const creditValidation = transactionValidation.validateCreditAllocations(
      creditAllocations,
      paymentBalance.normalizedBreakdown.credit
    );
    if (!creditValidation.isValid) {
      await t.rollback();
      return sendError(res, 'CREDIT_INVALID', creditValidation.error, 400);
    }

    // Enrich stored paymentSubBreakdown with cash/credit from the authoritative breakdown.
    // The frontend only sends online sub-types in paymentSubBreakdown.
    const { collapsePaymentBreakdown: collapseQt } = require('../config/constants');
    let quickEntryEffectiveBreakdown = paymentBalance.normalizedBreakdown;
    if (paymentSubBreakdown && typeof paymentSubBreakdown === 'object') {
      const hasExplicitQt = quickEntryEffectiveBreakdown.cash || quickEntryEffectiveBreakdown.online || quickEntryEffectiveBreakdown.credit;
      if (!hasExplicitQt) {
        quickEntryEffectiveBreakdown = collapseQt(paymentSubBreakdown);
      }
    }
    const quickEntryEnrichedSubBreakdown = paymentSubBreakdown
      ? { ...paymentSubBreakdown, cash: quickEntryEffectiveBreakdown.cash, credit: quickEntryEffectiveBreakdown.credit }
      : null;

    // Create DailyTransaction
    const dailyTxn = await DailyTransaction.create({
      stationId,
      transactionDate,
      totalLiters,
      totalSaleValue,
      paymentBreakdown: quickEntryEffectiveBreakdown,
      paymentSubBreakdown: quickEntryEnrichedSubBreakdown,
      creditAllocations: creditAllocationService.formatCreditAllocationsForStorage(creditAllocations),
      readingIds,
      createdBy: userId,
      notes,
      status: TRANSACTION_STATUS.SUBMITTED
    }, { transaction: t });

    // Process credit allocations
    const createdCreditTxns = await creditAllocationService.processCreditAllocations({
      stationId,
      creditAllocations: creditAllocationService.formatCreditAllocationsForStorage(creditAllocations),
      transactionDate,
      readingIds,
      notes,
      userId,
      transaction: t
    });

    // Link readings to transaction
    await NozzleReading.update(
      { transactionId: dailyTxn.id },
      { where: { id: readingIds }, transaction: t }
    );

    // Audit log
    const currentUser = await User.findByPk(userId);
    await logAudit({
      userId,
      userEmail: currentUser?.email,
      userRole: currentUser?.role,
      stationId,
      action: 'CREATE',
      entityType: 'DailyTransaction',
      entityId: dailyTxn.id,
      newValues: {
        id: dailyTxn.id,
        transactionDate,
        totalLiters,
        totalSaleValue,
        paymentBreakdown: paymentBalance.normalizedBreakdown,
        creditAllocations: creditAllocations?.length || 0,
        readingsCount: readingIds?.length || 0
      },
      category: 'finance',
      severity: 'info',
      description: `Created quick entry: ₹${totalSaleValue.toFixed(2)} from ${totalLiters}L with ${(creditAllocations || []).length} credit allocations`
    });

    await t.commit();

    const result = await DailyTransaction.findByPk(dailyTxn.id, {
      include: [
        { model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] },
        { model: Station, as: 'station', attributes: ['id', 'name'] }
      ]
    });

    // Re-fetch readings so transactionId is reflected in the response
    const freshReadings = await NozzleReading.findAll({ where: { id: readingIds } });

    return sendCreated(res, { ...result.dataValues, createdReadings: freshReadings, creditTransactions: createdCreditTxns, autoBalanced: paymentBalance.autoBalanced }, { message: 'Quick entry created' });
  } catch (err) {
    await t.rollback();
    throw err;
  }
});

/**
 * Get ALL transactions for a station on a specific date
 * GET /api/v1/transactions/:stationId/:date
 */
exports.getTransactionForDate = asyncHandler(async (req, res, next) => {
  const { stationId, date } = req.params;

  const transactions = await DailyTransaction.findAll({
    where: {
      stationId,
      transactionDate: date
    },
    include: [
      { model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] },
      { model: Station, as: 'station', attributes: ['id', 'name'] }
    ],
    order: [['createdAt', 'ASC']]
  });

  // Calculate daily totals across all transactions
  const dailyTotals = transactions.reduce((totals, transaction) => {
    const breakdown = transaction.paymentBreakdown || {};
    return {
      totalLiters: totals.totalLiters + parseFloat(transaction.totalLiters || 0),
      totalSaleValue: totals.totalSaleValue + parseFloat(transaction.totalSaleValue || 0),
      cash: totals.cash + parseFloat(breakdown.cash || 0),
      online: totals.online + parseFloat(breakdown.online || 0),
      credit: totals.credit + parseFloat(breakdown.credit || 0),
      transactionCount: totals.transactionCount + 1
    };
  }, {
    totalLiters: 0,
    totalSaleValue: 0,
    cash: 0,
    online: 0,
    credit: 0,
    transactionCount: 0
  });

  return sendSuccess(res, {
    transactions,
    dailyTotals,
    summary: {
      transactionCount: transactions.length,
      totalLiters: dailyTotals.totalLiters,
      totalSaleValue: dailyTotals.totalSaleValue,
      paymentBreakdown: {
        cash: dailyTotals.cash,
        online: dailyTotals.online,
        credit: dailyTotals.credit
      }
    }
  });
});

/**
 * Get transactions for a station in date range
 * GET /api/v1/transactions/station/:stationId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getTransactionsForStation = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { startDate, endDate, status } = req.query;

  const whereClause = { stationId };

  if (startDate || endDate) {
    whereClause.transactionDate = {};
    if (startDate) whereClause.transactionDate[Op.gte] = startDate;
    if (endDate) whereClause.transactionDate[Op.lte] = endDate;
  }

  if (status) {
    whereClause.status = status;
  }

  const transactions = await DailyTransaction.findAll({
    where: whereClause,
    include: [
      { model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] },
      { model: Station, as: 'station', attributes: ['id', 'name'] }
    ],
    order: [['transactionDate', 'DESC']],
    limit: 100
  });

  return sendSuccess(res, { count: transactions.length, transactions });
});

/**
 * Get summary statistics for transactions in date range
 * GET /api/v1/transactions/station/:stationId/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getTransactionSummary = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return sendError(res, 'MISSING_FIELDS', 'startDate and endDate query parameters required', 400);
  }

  const summary = await DailyTransaction.getSummary(stationId, startDate, endDate);

  return sendSuccess(res, {
    stationId,
    dateRange: { startDate, endDate },
    ...summary
  });
});

/**
 * Update transaction (e.g., change status, update payment breakdown)
 * PUT /api/v1/transactions/:id
 */
exports.updateTransaction = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { paymentBreakdown, paymentSubBreakdown, creditAllocations, status, notes } = req.body;
  const { collapsePaymentBreakdown } = require('../config/constants');

  const transaction = await DailyTransaction.findByPk(id);
  if (!transaction) throw new NotFoundError('Transaction', id);

  // Update payment breakdown — supports explicit paymentBreakdown, paymentSubBreakdown, or both.
  // Priority: explicit paymentBreakdown > derived from paymentSubBreakdown
  if (paymentBreakdown || paymentSubBreakdown) {
    const hasExplicitBreakdown = paymentBreakdown &&
      (paymentBreakdown.cash || paymentBreakdown.online || paymentBreakdown.credit);
    
    let resolvedBreakdown;
    if (hasExplicitBreakdown) {
      resolvedBreakdown = {
        cash: parseFloat(paymentBreakdown.cash || 0),
        online: parseFloat(paymentBreakdown.online || 0),
        credit: parseFloat(paymentBreakdown.credit || 0)
      };
    } else if (paymentSubBreakdown && typeof paymentSubBreakdown === 'object') {
      resolvedBreakdown = collapsePaymentBreakdown(paymentSubBreakdown);
    }

    if (resolvedBreakdown) {
      const newTotal = resolvedBreakdown.cash + resolvedBreakdown.online + resolvedBreakdown.credit;
      const diff = Math.abs(newTotal - transaction.totalSaleValue);
      if (diff > 0.01) {
        return sendError(res, 'PAYMENT_MISMATCH', `Payment breakdown must match total sale value (₹${transaction.totalSaleValue.toFixed(2)})`, 400);
      }
      transaction.paymentBreakdown = resolvedBreakdown;

      // Update paymentSubBreakdown: enrich with resolved cash/credit so the stored
      // sub-breakdown stays consistent with the stored paymentBreakdown.
      if (paymentSubBreakdown) {
        transaction.paymentSubBreakdown = {
          ...paymentSubBreakdown,
          cash: resolvedBreakdown.cash,
          credit: resolvedBreakdown.credit
        };
      } else if (transaction.paymentSubBreakdown) {
        // No new sub-breakdown supplied — just sync cash/credit in the existing one.
        transaction.paymentSubBreakdown = {
          ...transaction.paymentSubBreakdown,
          cash: resolvedBreakdown.cash,
          credit: resolvedBreakdown.credit
        };
      }
    }
  }

  if (creditAllocations) {
    transaction.creditAllocations = creditAllocations;
  }

  if (status) {
    transaction.status = status;
  }

  if (notes !== undefined) {
    transaction.notes = notes;
  }

  await transaction.save();

  const result = await DailyTransaction.findByPk(id, {
    include: [
      { model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] },
      { model: Station, as: 'station', attributes: ['id', 'name'] }
    ]
  });

  return sendSuccess(res, result, 200, { message: 'Transaction updated' });
});

/**
 * Delete transaction
 * DELETE /api/v1/transactions/:id
 */
exports.deleteTransaction = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const transaction = await DailyTransaction.findByPk(id);
  if (!transaction) throw new NotFoundError('Transaction', id);

  // Don't allow deleting settled transactions
  if (transaction.status === 'settled') {
    return sendError(res, 'SETTLED_TRANSACTION', 'Cannot delete settled transactions', 403);
  }

  await transaction.destroy();

  return sendSuccess(res, null, 200, { message: 'Transaction deleted' });
});
