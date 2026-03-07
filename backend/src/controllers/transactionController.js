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

const { DailyTransaction, NozzleReading, Station, User, Creditor, CreditTransaction, sequelize, FuelPrice, Nozzle, Pump } = require('../models');
const { logAudit } = require('../utils/auditLog');
const transactionValidation = require('../services/transactionValidationService');
const transactionValidationEnhancedService = require('../services/transactionValidationEnhancedService');
const creditAllocationService = require('../services/creditAllocationService');
const { VALIDATION_ERRORS, TRANSACTION_STATUS } = require('../config/transactionConstants');
const { Op } = require('sequelize');
// Minimal helper to compute litresSold and totalAmount similar to readingController
async function createComputedReading({ stationId, nozzleId, readingValue, readingDate, notes, userId, transaction, stationPricesMap, isSample = false, forceNotInitial = false }) {
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
    isSample: !!isSample
  };

  // Preserve isInitialReading flag when creating
  payload.isInitialReading = !!isInitial;

  return await NozzleReading.create(payload, { transaction });
}

/**
 * Create a daily transaction
 * POST /api/v1/transactions
 * 
 * Request body:
 * {
 *   stationId: UUID,
 *   transactionDate: YYYY-MM-DD,
 *   readingIds: UUID[],
 *   paymentBreakdown: { cash: number, online: number, credit?: number },  ← legacy (still accepted)
 *   paymentSubBreakdown?: {                                                ← NEW: detailed sub-types
 *     cash: number,
 *     upi: { gpay, phonepe, paytm, amazon_pay, cred, bhim, other_upi },
 *     card: { debit_card, credit_card },
 *     oil_company: { hp_pay, iocl_card, bpcl_smartfleet, ... },
 *     credit: number
 *   },
 *   creditAllocations?: [{ creditorId: UUID, amount: number }],
 *   notes?: string
 * }
 * 
 * If paymentSubBreakdown is provided, paymentBreakdown will be derived from it automatically.
 */
exports.createTransaction = async (req, res, next) => {
  try {
    const { stationId, transactionDate, readingIds = [], paymentBreakdown = {}, paymentSubBreakdown = null, creditAllocations = [], notes = '' } = req.body;
    const userId = req.userId;

    // Input validation
    if (!stationId) return res.status(400).json({ success: false, error: VALIDATION_ERRORS.STATION_REQUIRED });
    if (!transactionDate) return res.status(400).json({ success: false, error: VALIDATION_ERRORS.DATE_REQUIRED });
    if (!Array.isArray(readingIds) || readingIds.length === 0) return res.status(400).json({ success: false, error: VALIDATION_ERRORS.READINGS_REQUIRED });

    // Verify station exists
    const station = await Station.findByPk(stationId);
    if (!station) return res.status(404).json({ success: false, error: VALIDATION_ERRORS.STATION_NOT_FOUND });

    // Fetch readings to validate and sum
    const readings = await NozzleReading.findAll({
      where: { id: readingIds, stationId, readingDate: transactionDate, isInitialReading: false }
    });

    if (readings.length === 0) return res.status(400).json({ success: false, error: VALIDATION_ERRORS.NO_READINGS_FOUND });

    // Calculate totals
    const totalLiters = readings.reduce((sum, r) => sum + parseFloat(r.litresSold || 0), 0);
    const totalSaleValue = readings.reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);

    // Check if all readings are samples
    if (transactionValidation.areAllReadingsSamples(readings)) {
      return res.status(400).json({ success: false, error: VALIDATION_ERRORS.SAMPLE_READINGS_ONLY });
    }

    // Validate using enhanced service (checks amount variance, methods required, credit allocations linked to readings)
    const enhancedValidation = await transactionValidationEnhancedService.validateTransactionComplete({
      stationId,
      transactionDate,
      readingIds,
      readings,
      paymentBreakdown,
      creditAllocations,
      totalSaleValue
    });

    if (!enhancedValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: enhancedValidation.error,
        details: enhancedValidation.details,
        issues: enhancedValidation.issues
      });
    }

    const normalizedBreakdown = enhancedValidation.normalizedBreakdown;

    // Req #2: If paymentSubBreakdown provided, derive the legacy paymentBreakdown from it
    const { collapsePaymentBreakdown } = require('../config/constants');
    let effectiveBreakdown = normalizedBreakdown;
    if (paymentSubBreakdown && typeof paymentSubBreakdown === 'object') {
      effectiveBreakdown = collapsePaymentBreakdown(paymentSubBreakdown);
    }

    // Persist atomically
    const t = await sequelize.transaction();
    try {
      const dailyTxn = await DailyTransaction.create({
        stationId,
        transactionDate,
        totalLiters,
        totalSaleValue,
        paymentBreakdown: effectiveBreakdown,
        // Req #2: Store structured sub-type breakdown if supplied
        paymentSubBreakdown: paymentSubBreakdown || null,
        creditAllocations: creditAllocationService.formatCreditAllocationsForStorage(creditAllocations),
        readingIds,
        createdBy: userId,
        notes,
        status: TRANSACTION_STATUS.SUBMITTED
      }, { transaction: t });

      // Process credit allocations (creates CreditTransactions and updates creditor balances)
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

      return res.status(201).json({
        success: true,
        message: `Transaction created for ${readings.length} readings`,
        data: result,
        creditTransactions: createdCreditTxns
      });
    } catch (err) {
      await t.rollback();
      console.error('[ERROR] createTransaction:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  } catch (error) {
    console.error('[ERROR] createTransaction:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create quick-entry: accepts readings (full objects) and a transaction payload
 * POST /api/v1/transactions/quick-entry
 * Request body:
 * {
 *   stationId,
 *   transactionDate,
 *   readings: [{ nozzleId, readingValue, readingDate, notes }],
 *   paymentBreakdown, creditAllocations, notes
 * }
 */
exports.createQuickEntry = async (req, res, next) => {
  try {
    const { stationId, transactionDate, readings = [], paymentBreakdown, creditAllocations = [], notes = '' } = req.body;
    const userId = req.userId;

    if (!stationId) return res.status(400).json({ success: false, error: VALIDATION_ERRORS.STATION_REQUIRED });
    if (!transactionDate) return res.status(400).json({ success: false, error: VALIDATION_ERRORS.DATE_REQUIRED });
    if (!Array.isArray(readings) || readings.length === 0) return res.status(400).json({ success: false, error: VALIDATION_ERRORS.READINGS_REQUIRED });

    const station = await Station.findByPk(stationId);
    if (!station) return res.status(404).json({ success: false, error: VALIDATION_ERRORS.STATION_NOT_FOUND });

    const t = await sequelize.transaction();
    try {
      // Create readings sequentially to preserve previous-reading logic
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
          forceNotInitial: true
        });
        createdReadings.push(created);
      }

      // Build readingIds for billable readings (exclude initial readings)
      const billableReadings = createdReadings.filter(cr => !cr.isInitialReading);
      const readingIds = billableReadings.map(cr => cr.id);

      // Compute totals from created, billable readings only
      const totalLiters = billableReadings.reduce((s, r) => s + parseFloat(r.litresSold || 0), 0);
      const totalSaleValue = billableReadings.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);

      // Check if all readings are samples
      if (transactionValidation.areAllReadingsSamples(createdReadings)) {
        await t.commit();
        return res.status(201).json({
          success: true,
          message: 'Sample readings recorded. No transaction created.',
          data: { createdReadings }
        });
      }

      // If no billable readings, commit and return
      if (readingIds.length === 0) {
        await t.commit();
        return res.status(201).json({
          success: true,
          message: 'Initial readings recorded. No transaction created.',
          data: { createdReadings }
        });
      }

      // Validate or auto-balance payment breakdown
      const paymentBalance = transactionValidation.autoBalancePayment(paymentBreakdown, totalSaleValue);
      if (!paymentBalance.isValid) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          error: paymentBalance.error,
          details: paymentBalance.details
        });
      }

      // Validate credit allocations
      const creditValidation = transactionValidation.validateCreditAllocations(
        creditAllocations,
        paymentBalance.normalizedBreakdown.credit
      );
      if (!creditValidation.isValid) {
        await t.rollback();
        return res.status(400).json({ success: false, error: creditValidation.error });
      }

      // Create DailyTransaction
      const dailyTxn = await DailyTransaction.create({
        stationId,
        transactionDate,
        totalLiters,
        totalSaleValue,
        paymentBreakdown: paymentBalance.normalizedBreakdown,
        creditAllocations: creditAllocationService.formatCreditAllocationsForStorage(creditAllocations),
        readingIds,
        createdBy: userId,
        notes,
        status: TRANSACTION_STATUS.SUBMITTED
      }, { transaction: t });

      // Process credit allocations (batch query creditors, fix N+1)
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

      return res.status(201).json({
        success: true,
        message: 'Quick entry created',
        data: result,
        createdReadings,
        creditTransactions: createdCreditTxns,
        autoBalanced: paymentBalance.autoBalanced
      });
    } catch (err) {
      await t.rollback();
      console.error('[ERROR] createQuickEntry:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  } catch (error) {
    console.error('[ERROR] createQuickEntry:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get ALL transactions for a station on a specific date
 * GET /api/v1/transactions/:stationId/:date
 * Returns array of transactions (multiple employees/shifts per day)
 */
exports.getTransactionForDate = async (req, res, next) => {
  try {
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
      order: [['createdAt', 'ASC']] // Order by creation time
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

    return res.json({
      success: true,
      data: {
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
      }
    });
  } catch (error) {
    console.error('[ERROR] getTransactionForDate:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get transactions for a station in date range
 * GET /api/v1/transactions/station/:stationId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getTransactionsForStation = async (req, res, next) => {
  try {
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

    return res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    console.error('[ERROR] getTransactionsForStation:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get summary statistics for transactions in date range
 * GET /api/v1/transactions/station/:stationId/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getTransactionSummary = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate query parameters required'
      });
    }

    const summary = await DailyTransaction.getSummary(stationId, startDate, endDate);

    return res.json({
      success: true,
      data: {
        stationId,
        dateRange: { startDate, endDate },
        ...summary
      }
    });
  } catch (error) {
    console.error('[ERROR] getTransactionSummary:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Update transaction (e.g., change status, update payment breakdown)
 * PUT /api/v1/transactions/:id
 */
exports.updateTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentBreakdown, creditAllocations, status, notes } = req.body;

    const transaction = await DailyTransaction.findByPk(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Validate new payment breakdown if provided
    if (paymentBreakdown) {
      const newTotal = parseFloat(paymentBreakdown.cash || 0) +
                      parseFloat(paymentBreakdown.online || 0) +
                      parseFloat(paymentBreakdown.credit || 0);

      const diff = Math.abs(newTotal - transaction.totalSaleValue);
      if (diff > 0.01) {
        return res.status(400).json({
          success: false,
          error: `Payment breakdown must match total sale value (₹${transaction.totalSaleValue.toFixed(2)})`
        });
      }

      transaction.paymentBreakdown = {
        cash: parseFloat(paymentBreakdown.cash || 0),
        online: parseFloat(paymentBreakdown.online || 0),
        credit: parseFloat(paymentBreakdown.credit || 0)
      };
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

    return res.json({
      success: true,
      message: 'Transaction updated',
      data: result
    });
  } catch (error) {
    console.error('[ERROR] updateTransaction:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Delete transaction
 * DELETE /api/v1/transactions/:id
 */
exports.deleteTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    const transaction = await DailyTransaction.findByPk(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Don't allow deleting settled transactions
    if (transaction.status === 'settled') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete settled transactions'
      });
    }

    await transaction.destroy();

    return res.json({
      success: true,
      message: 'Transaction deleted'
    });
  } catch (error) {
    console.error('[ERROR] deleteTransaction:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
