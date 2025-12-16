/**
 * Transaction Controller
 * Handles daily transaction creation and retrieval
 * Transactions record the payment breakdown for a day at station level
 */

const { DailyTransaction, NozzleReading, Station, User, Creditor, CreditTransaction, sequelize, FuelPrice, Nozzle } = require('../models');
// Minimal helper to compute litresSold and totalAmount similar to readingController
async function createComputedReading({ stationId, nozzleId, readingValue, readingDate, notes, userId, transaction, stationPricesMap }) {
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

  const previousReading = lastReading ? parseFloat(lastReading.readingValue) : 0;
  const closingReading = parseFloat(readingValue || 0);
  const litresSold = Math.max(0, closingReading - previousReading);

  // Fetch nozzle to get fuelType, then resolve price via FuelPrice.getPriceForDate
  let pricePerLitre = 0;
  try {
    const nozzle = await Nozzle.findByPk(nozzleId, { transaction });
    const fuelType = nozzle?.fuelType || null;
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
    readingValue: closingReading,
    previousReading: previousReading,
    litresSold,
    pricePerLitre,
    totalAmount,
    readingDate,
    notes: notes || '',
    enteredBy: userId
  };

  return await NozzleReading.create(payload, { transaction });
}
const { Op } = require('sequelize');

/**
 * Create a daily transaction
 * POST /api/v1/transactions
 * 
 * Request body:
 * {
 *   stationId: UUID,
 *   transactionDate: YYYY-MM-DD,
 *   readingIds: UUID[],
 *   paymentBreakdown: { cash: number, online: number, credit?: number },
 *   creditAllocations?: [{ creditorId: UUID, amount: number }],
 *   notes?: string
 * }
 */
exports.createTransaction = async (req, res, next) => {
  try {
    const {
      stationId,
      transactionDate,
      readingIds = [],
      paymentBreakdown = { cash: 0, online: 0, credit: 0 },
      creditAllocations = [],
      notes = ''
    } = req.body;

    const userId = req.userId;

    // Validation
    if (!stationId) {
      return res.status(400).json({
        success: false,
        error: 'stationId is required'
      });
    }

    if (!transactionDate) {
      return res.status(400).json({
        success: false,
        error: 'transactionDate is required (YYYY-MM-DD)'
      });
    }

    if (!Array.isArray(readingIds) || readingIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'readingIds must be a non-empty array'
      });
    }

    // Verify user has access to station
    const station = await Station.findByPk(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }

    // Fetch all readings to validate and sum
    const readings = await NozzleReading.findAll({
      where: {
        id: readingIds,
        stationId,
        readingDate: transactionDate,
        isInitialReading: false
      }
    });

    if (readings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid readings found for specified IDs, station, and date'
      });
    }

    // Sum readings to get totals
    const totalLiters = readings.reduce((sum, r) => sum + parseFloat(r.litresSold || 0), 0);
    const totalSaleValue = readings.reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);

    // Validate payment breakdown sums correctly
    const paymentTotal = parseFloat(paymentBreakdown.cash || 0) +
                        parseFloat(paymentBreakdown.online || 0) +
                        parseFloat(paymentBreakdown.credit || 0);

    // Build per-reading breakdown for better error messages
    const perReading = readings.map(r => ({ id: r.id, litresSold: parseFloat(r.litresSold || 0), totalAmount: parseFloat(r.totalAmount || 0) }));
    const diff = Math.abs(paymentTotal - totalSaleValue);
    // Allow a small tolerance (₹0.50) to account for rounding differences introduced on the client
    const TOLERANCE = 0.5;
    if (diff > TOLERANCE) {
      return res.status(400).json({
        success: false,
        error: `Payment breakdown (₹${paymentTotal.toFixed(2)}) must match total sale value (₹${totalSaleValue.toFixed(2)}). Difference: ₹${diff.toFixed(2)}`,
        details: {
          totalSaleValue: parseFloat(totalSaleValue.toFixed(2)),
          paymentTotal: parseFloat(paymentTotal.toFixed(2)),
          difference: parseFloat(diff.toFixed(2)),
          perReading
        }
      });
    }

    // Validate credit allocations if credit amount > 0
    if (paymentBreakdown.credit > 0) {
      if (!Array.isArray(creditAllocations) || creditAllocations.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Credit allocations required when credit amount > 0'
        });
      }

      const creditTotal = creditAllocations.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
      const creditDiff = Math.abs(creditTotal - paymentBreakdown.credit);
      if (creditDiff > 0.01) {
        return res.status(400).json({
          success: false,
          error: `Credit allocations (₹${creditTotal.toFixed(2)}) must match credit amount (₹${paymentBreakdown.credit.toFixed(2)})`
        });
      }

      // Verify creditors exist
      const creditorIds = creditAllocations.map(c => c.creditorId);
      const creditors = await Creditor.findAll({
        where: { id: creditorIds }
      });

      if (creditors.length !== creditorIds.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more creditors not found'
        });
      }
    }

    // Check if transaction already exists for this date - REMOVED
    // Multiple transactions per day are now allowed (for multiple employees/shifts)
    // Settlement will aggregate all transactions for the day

    // Persist transaction and any credit allocations atomically
    const t = await sequelize.transaction();
    try {
      const dailyTxn = await DailyTransaction.create({
        stationId,
        transactionDate,
        totalLiters,
        totalSaleValue,
        paymentBreakdown: {
          cash: parseFloat(paymentBreakdown.cash || 0),
          online: parseFloat(paymentBreakdown.online || 0),
          credit: parseFloat(paymentBreakdown.credit || 0)
        },
        creditAllocations: creditAllocations.map(c => ({
          creditorId: c.creditorId,
          amount: parseFloat(c.amount)
        })),
        readingIds,
        createdBy: userId,
        notes,
        status: 'submitted'
      }, { transaction: t });

      // If there are credit allocations, create CreditTransaction rows and update creditor balances
      const createdCreditTxns = [];
      if (Array.isArray(creditAllocations) && creditAllocations.length > 0) {
        for (const alloc of creditAllocations) {
          const creditorId = alloc.creditorId;
          const allocAmount = parseFloat(alloc.amount || 0);
          if (!creditorId || !allocAmount || allocAmount <= 0) continue;

          // Lock creditor row for update (non-sqlite)
          const findOptions = { transaction: t };
          if (sequelize.getDialect() !== 'sqlite') findOptions.lock = t.LOCK.UPDATE;

          const creditor = await Creditor.findByPk(creditorId, findOptions);
          if (!creditor || String(creditor.stationId) !== String(stationId)) {
            await t.rollback();
            return res.status(404).json({ success: false, error: 'Creditor not found for allocation' });
          }

          // Check credit limit
          if (!creditor.canTakeCredit(allocAmount)) {
            await t.rollback();
            return res.status(400).json({ success: false, error: { message: `Credit limit exceeded for ${creditor.name}` } });
          }

          const creditTxn = await CreditTransaction.create({
            stationId,
            creditorId,
            transactionType: 'credit',
            amount: allocAmount,
            transactionDate: transactionDate || new Date().toISOString().split('T')[0],
            notes: notes || null,
            nozzleReadingId: readingIds && readingIds.length > 0 ? readingIds[0] : null,
            enteredBy: userId
          }, { transaction: t });

          // Update creditor balance
          await creditor.update({
            currentBalance: parseFloat(creditor.currentBalance) + allocAmount,
            lastTransactionDate: new Date()
          }, { transaction: t });

          createdCreditTxns.push(creditTxn);
        }
      }

      // Update all related NozzleReadings to set transactionId
      await NozzleReading.update(
        { transactionId: dailyTxn.id },
        { where: { id: readingIds }, transaction: t }
      );

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
      console.error('[ERROR] createTransaction (commit):', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  } catch (error) {
    console.error('[ERROR] createTransaction:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
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

    if (!stationId) return res.status(400).json({ success: false, error: 'stationId is required' });
    if (!transactionDate) return res.status(400).json({ success: false, error: 'transactionDate is required' });
    if (!Array.isArray(readings) || readings.length === 0) return res.status(400).json({ success: false, error: 'readings array required' });

    const station = await Station.findByPk(stationId);
    if (!station) return res.status(404).json({ success: false, error: 'Station not found' });

    const t = await sequelize.transaction();
    try {
      // Create readings sequentially to preserve previous-reading logic
      const createdReadings = [];
      // Build station prices map from payload if provided
      const stationPricesArr = Array.isArray(req.body.stationPrices) ? req.body.stationPrices : [];
      const stationPricesMap = stationPricesArr.reduce((acc, p) => {
        const key = (p.fuelType || p.fuel_type || '').toString().toLowerCase();
        const val = p.price !== undefined ? p.price : p.price_per_litre;
        if (key && val !== undefined && val !== null) acc[key] = parseFloat(String(val));
        return acc;
      }, {});

      for (const r of readings) {
        const nozzleId = r.nozzleId || r.nozzle_id;
        const readingValue = r.readingValue !== undefined ? r.readingValue : r.reading_value;
        const readingDateVal = r.readingDate || r.reading_date || transactionDate;
        const notesVal = r.notes || '';

        const created = await createComputedReading({
          stationId,
          nozzleId,
          readingValue,
          readingDate: readingDateVal,
          notes: notesVal,
          userId,
          transaction: t,
          stationPricesMap
        });
        createdReadings.push(created);
      }

      // Build readingIds and reuse transaction creation logic - but within same transaction
      const readingIds = createdReadings.map(cr => cr.id);

      // Compute totals from created readings
      const totalLiters = createdReadings.reduce((s, r) => s + parseFloat(r.litresSold || 0), 0);
      const totalSaleValue = createdReadings.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);

      // Validate paymentBreakdown presence
      let paymentTotal = parseFloat((paymentBreakdown && paymentBreakdown.cash) || 0) +
             parseFloat((paymentBreakdown && paymentBreakdown.online) || 0) +
             parseFloat((paymentBreakdown && paymentBreakdown.credit) || 0);

      let diff = Math.abs(paymentTotal - totalSaleValue);
      const TOLERANCE = 0.5;
      let autoBalanced = false;
      if (diff > TOLERANCE) {
        // Auto-balance cash to match computed sale total
        const onlineAmt = parseFloat((paymentBreakdown && paymentBreakdown.online) || 0);
        const creditAmt = parseFloat((paymentBreakdown && paymentBreakdown.credit) || 0);
        const newCash = Math.max(0, parseFloat(totalSaleValue) - (onlineAmt + creditAmt));
        paymentTotal = newCash + onlineAmt + creditAmt;
        diff = Math.abs(paymentTotal - totalSaleValue);
        autoBalanced = true;
        // If still not within tolerance, return details for debugging
        if (diff > TOLERANCE) {
          await t.rollback();
          const perReading = createdReadings.map(r => ({ id: r.id, nozzleId: r.nozzleId, litresSold: parseFloat(r.litresSold || 0), pricePerLitre: parseFloat(r.pricePerLitre || 0), totalAmount: parseFloat(r.totalAmount || 0) }));
          return res.status(400).json({ success: false, error: 'Payment total mismatch with created readings', details: { paymentTotal: parseFloat(paymentTotal.toFixed(2)), totalSaleValue: parseFloat(totalSaleValue.toFixed(2)), difference: parseFloat(diff.toFixed(2)), perReading } });
        }
        // Update paymentBreakdown.cash to newCash for persistence
        paymentBreakdown.cash = newCash;
      }

      // Create DailyTransaction
      const dailyTxn = await DailyTransaction.create({
        stationId,
        transactionDate,
        totalLiters,
        totalSaleValue,
        paymentBreakdown: {
          cash: parseFloat((paymentBreakdown && paymentBreakdown.cash) || 0),
          online: parseFloat((paymentBreakdown && paymentBreakdown.online) || 0),
          credit: parseFloat((paymentBreakdown && paymentBreakdown.credit) || 0)
        },
        creditAllocations: (creditAllocations || []).map(c => ({ creditorId: c.creditorId || c.creditor_id, amount: parseFloat(c.amount || 0) })),
        readingIds,
        createdBy: userId,
        notes,
        status: 'submitted'
      }, { transaction: t });

      // Handle credit allocations same as createTransaction
      const createdCreditTxns = [];
      if (Array.isArray(creditAllocations) && creditAllocations.length > 0) {
        for (const alloc of creditAllocations) {
          const creditorId = alloc.creditorId || alloc.creditor_id;
          const allocAmount = parseFloat(alloc.amount || 0);
          if (!creditorId || !allocAmount || allocAmount <= 0) continue;

          const findOptions = { transaction: t };
          if (sequelize.getDialect() !== 'sqlite') findOptions.lock = t.LOCK.UPDATE;
          const creditor = await Creditor.findByPk(creditorId, findOptions);
          if (!creditor || String(creditor.stationId) !== String(stationId)) {
            await t.rollback();
            return res.status(404).json({ success: false, error: 'Creditor not found for allocation' });
          }
          if (!creditor.canTakeCredit(allocAmount)) {
            await t.rollback();
            return res.status(400).json({ success: false, error: `Credit limit exceeded for ${creditor.name}` });
          }

          const creditTxn = await CreditTransaction.create({
            stationId,
            creditorId,
            transactionType: 'credit',
            amount: allocAmount,
            transactionDate: transactionDate || new Date().toISOString().split('T')[0],
            notes: notes || null,
            nozzleReadingId: readingIds && readingIds.length > 0 ? readingIds[0] : null,
            enteredBy: userId
          }, { transaction: t });

          await creditor.update({ currentBalance: parseFloat(creditor.currentBalance) + allocAmount, lastTransactionDate: new Date() }, { transaction: t });
          createdCreditTxns.push(creditTxn);
        }
      }

      await t.commit();

      const result = await DailyTransaction.findByPk(dailyTxn.id, {
        include: [
          { model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] },
          { model: Station, as: 'station', attributes: ['id', 'name'] }
        ]
      });

      return res.status(201).json({ success: true, message: 'Quick entry created', data: result, createdReadings, creditTransactions: createdCreditTxns, autoBalanced });
    } catch (err) {
      await t.rollback();
      console.error('[ERROR] createQuickEntry (commit):', err);
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
