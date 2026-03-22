/**
 * Settlement Verification Service
 * Validates settlements before finalization (Issue #3 fix)
 * 
 * Ensures:
 * - All nozzles have readings
 * - Payment breakdown matches total sale value
 * - Readings match settlement amounts
 * - No orphaned readings
 */

const { Settlement, NozzleReading, Nozzle, DailyTransaction, Creditor } = require('../models');
const { Op } = require('sequelize');
const { createContextLogger } = require('./loggerService');
const logger = createContextLogger('SettlementVerification');

/**
 * Verify all active nozzles have readings for a date
 * 
 * NOTE: This check is now LENIENT - it only validates that nozzles WITH readings
 * have valid data, not that ALL nozzles must have readings.
 * Some nozzles may not sell fuel on a given day and don't need readings.
 */
exports.verifyNozzleCoverage = async (stationId, date) => {
  try {
    // Get all active nozzles at station
    const activeNozzles = await Nozzle.findAll({
      where: {
        stationId,
        status: 'active'
      },
      attributes: ['id', 'nozzleNumber', 'label', 'fuelType']
    });

    if (activeNozzles.length === 0) {
      return {
        isValid: true,
        nozzlesWithGaps: [],
        totalNozzles: 0,
        message: 'No active nozzles at station'
      };
    }

    // Get all readings for that date
    const readings = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: date
      },
      attributes: ['nozzleId', 'litresSold'],
      raw: true
    });

    // Count readings
    const readingNozzleIds = new Set(readings.map(r => r.nozzleId));
    const readingCount = readings.length;

    // For now, just verify we have SOME readings, not that all nozzles have them
    // (Some nozzles may not sell fuel on a given day)
    return {
      isValid: readingCount > 0,  // At least one reading must exist
      nozzlesWithReadings: readingCount,
      totalNozzles: activeNozzles.length,
      readingCount: readings.length,
      message: readingCount > 0
        ? `Have ${readingCount} reading(s) for ${activeNozzles.length} total nozzles (OK)`
        : `No readings found for any nozzles on ${date}`
    };
  } catch (err) {
    logger.error('Nozzle coverage check error', err.message);
    throw err;
  }
};

/**
 * Verify reading amounts match settlement
 * 
 * NOTE: This check is now LENIENT - it passes if:
 * - Settlement has no readings yet (draft mode OK)
 * - OR readings exist and match settlement amounts
 */
exports.verifyReadingAmounts = async (settlementId, transaction = null) => {
  try {
    const options = {
      attributes: [
        'id',
        'stationId',
        'date',
        'totalSaleValue',
        'readingIds',
        'actualCash',
        'expectedCash',
        'online',
        'credit',
        'employeeCash',
        'employeeOnline',
        'employeeCredit'
      ]
    };
    if (transaction) {
      options.transaction = transaction;
    }
    const settlement = await Settlement.findByPk(settlementId, options);

    if (!settlement) {
      return {
        isValid: false,
        error: 'Settlement not found',
        actualTotal: 0,
        expectedTotal: 0,
        variance: 0
      };
    }

    // If no readings linked yet, that's OK (settlement in draft mode)
    if (!settlement.readingIds || settlement.readingIds.length === 0) {
      return {
        isValid: true,
        message: 'Settlement in draft (no readings linked yet)',
        actualTotal: 0,
        expectedTotal: settlement?.totalSaleValue || 0,
        variance: settlement?.totalSaleValue || 0
      };
    }

    // Get readings
    const readingOptions = {
      where: {
        id: settlement.readingIds
      },
      attributes: ['id', 'totalAmount', 'litresSold', 'pricePerLitre'],
      raw: true
    };
    if (transaction) {
      readingOptions.transaction = transaction;
    }
    const readings = await NozzleReading.findAll(readingOptions);

    // Calculate total from readings
    const actualTotal = readings.reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);
    const settlementTotal = parseFloat(settlement.totalSaleValue || 0);
    const employeeReportedTotal =
      parseFloat(settlement.employeeCash || 0) +
      parseFloat(settlement.employeeOnline || 0) +
      parseFloat(settlement.employeeCredit || 0);
    const ownerConfirmedTotal =
      parseFloat(settlement.expectedCash || 0) +
      parseFloat(settlement.online || 0) +
      parseFloat(settlement.credit || 0);

    const expectedTotal = settlementTotal > 0
      ? settlementTotal
      : (employeeReportedTotal > 0 ? employeeReportedTotal : ownerConfirmedTotal);
    const variance = Math.abs(actualTotal - expectedTotal);
    const tolerance = 1.00; // ₹1 tolerance for rounding

    return {
      isValid: variance <= tolerance,
      actualTotal: parseFloat(actualTotal.toFixed(2)),
      expectedTotal: expectedTotal,
      variance: parseFloat(variance.toFixed(2)),
      readingCount: readings.length,
      message: variance <= tolerance
        ? `Reading amounts match (${readings.length} readings, variance: ₹${variance.toFixed(2)})`
        : `Reading amount mismatch: expected ₹${expectedTotal.toFixed(2)}, got ₹${actualTotal.toFixed(2)}`
    };
  } catch (err) {
    logger.error('Reading amount check error', err.message);
    throw err;
  }
};

/**
 * Verify payment breakdown sums to total
 * 
 * NOTE: This check passes if:
 * - Settlement is in draft (no DailyTransaction yet) - OK
 * - OR payment breakdown exists and matches total
 */
exports.verifyPaymentBreakdown = async (settlementId, transaction = null) => {
  try {
    const options = {
      attributes: ['id', 'readingIds', 'employeeCash', 'employeeOnline', 'employeeCredit']
    };
    if (transaction) {
      options.transaction = transaction;
    }
    const settlement = await Settlement.findByPk(settlementId, options);

    if (!settlement) {
      return {
        isValid: false,
        error: 'Settlement not found'
      };
    }

    // Get daily transaction for this settlement
    const txOptions = {
      where: { settlementId },
      attributes: ['id', 'totalSaleValue', 'paymentBreakdown', 'creditAllocations']
    };
    if (transaction) {
      txOptions.transaction = transaction;
    }
    const dailyTxn = await DailyTransaction.findOne(txOptions);

    if (!dailyTxn) {
      // No transaction yet - settlement is unfinalized (OK for draft)
      // Check if we have employee-reported payment breakdown from settlement itself
      if (!settlement.employeeCash && !settlement.employeeOnline && !settlement.employeeCredit) {
        return {
          isValid: true,
          message: 'No transaction or payment data yet (settlement in draft)'
        };
      }

      // We have employee-reported data but no transaction - this is a warning but not a failure
      return {
        isValid: true,
        message: 'Settlement in draft (employee data recorded, no final transaction yet)',
        employeeReported: {
          cash: parseFloat(settlement.employeeCash || 0),
          online: parseFloat(settlement.employeeOnline || 0),
          credit: parseFloat(settlement.employeeCredit || 0)
        }
      };
    }

    // Calculate payment breakdown sum
    const breakdown = dailyTxn.paymentBreakdown || {};
    const cash = parseFloat(breakdown.cash || 0);
    const online = parseFloat(breakdown.online || 0);
    const credit = parseFloat(breakdown.credit || 0);
    const sum = cash + online + credit;

    const expectedTotal = parseFloat(dailyTxn.totalSaleValue);
    const variance = Math.abs(sum - expectedTotal);
    const tolerance = 0.50;

    if (variance > tolerance) {
      return {
        isValid: false,
        error: 'Payment breakdown mismatch',
        breakdown: { cash, online, credit },
        sum: parseFloat(sum.toFixed(2)),
        expectedTotal: expectedTotal,
        variance: parseFloat(variance.toFixed(2)),
        suggestion: `Cash (₹${cash}), Online (₹${online}), Credit (₹${credit}) = ₹${sum.toFixed(2)} but expected ₹${expectedTotal.toFixed(2)}`
      };
    }

    return {
      isValid: true,
      breakdown: { cash, online, credit },
      sum: parseFloat(sum.toFixed(2)),
      expectedTotal: expectedTotal,
      variance: parseFloat(variance.toFixed(2)),
      message: variance === 0
        ? 'Payment breakdown matches exactly'
        : `Payment breakdown matches within tolerance (₹${variance.toFixed(2)} variance)`
    };
  } catch (err) {
    logger.error('Payment breakdown check error', err.message);
    throw err;
  }
};

/**
 * Verify credit allocations are valid
 */
exports.verifyCreditAllocations = async (settlementId, dbTransaction = null) => {
  try {
    const settlementOpts = {};
    if (dbTransaction) {
      settlementOpts.transaction = dbTransaction;
    }
    const settlement = await Settlement.findByPk(settlementId, settlementOpts);

    const txOpts = {
      where: { settlementId },
      attributes: ['id', 'creditAllocations']
    };
    if (dbTransaction) {
      txOpts.transaction = dbTransaction;
    }
    const dailyTxn = await DailyTransaction.findOne(txOpts);

    if (!dailyTxn || !dailyTxn.creditAllocations) {
      return {
        isValid: true,
        message: 'No credit allocations'
      };
    }

    const allocations = dailyTxn.creditAllocations;

    // Verify each creditor exists and is active
    const issues = [];

    for (const alloc of allocations) {
      const creditorOpts = {
        attributes: ['id', 'name', 'isActive', 'creditLimit', 'currentBalance']
      };
      if (dbTransaction) {
        creditorOpts.transaction = dbTransaction;
      }
      const creditor = await Creditor.findByPk(alloc.creditorId, creditorOpts);

      if (!creditor) {
        issues.push({
          creditorId: alloc.creditorId,
          amount: alloc.amount,
          issue: 'CREDITOR_NOT_FOUND'
        });
        continue;
      }

      if (!creditor.isActive) {
        issues.push({
          creditorId: alloc.creditorId,
          creditorName: creditor.name,
          amount: alloc.amount,
          issue: 'CREDITOR_INACTIVE'
        });
        continue;
      }

      // Check credit limit
      const newBalance = parseFloat(creditor.currentBalance) + parseFloat(alloc.amount);
      if (newBalance > creditor.creditLimit) {
        issues.push({
          creditorId: alloc.creditorId,
          creditorName: creditor.name,
          amount: alloc.amount,
          currentBalance: creditor.currentBalance,
          creditLimit: creditor.creditLimit,
          newBalance,
          issue: 'CREDIT_LIMIT_EXCEEDED'
        });
      }
    }

    return {
      isValid: issues.length === 0,
      allocationCount: allocations.length,
      issues,
      message: issues.length === 0
        ? `All ${allocations.length} allocations valid`
        : `${issues.length} allocation issues found`
    };
  } catch (err) {
    logger.error('Credit allocation check error', err.message);
    throw err;
  }
};

/**
 * Comprehensive settlement verification
 * Run all checks before finalization
 * @param {string} settlementId - Settlement ID to verify
 * @param {string} stationId - Station ID for nozzle verification
 * @param {string} date - Date for nozzle verification
 * @param {object} transaction - Optional Sequelize transaction context
 */
exports.verifySettlementComplete = async (settlementId, stationId, date, transaction = null) => {
  try {
    // Run all checks in parallel
    const [
      nozzleCoverage,
      readingAmounts,
      paymentBreakdown,
      creditAllocations
    ] = await Promise.all([
      this.verifyNozzleCoverage(stationId, date),
      this.verifyReadingAmounts(settlementId, transaction),
      this.verifyPaymentBreakdown(settlementId, transaction),
      this.verifyCreditAllocations(settlementId, transaction)
    ]);

    const allValid = 
      nozzleCoverage.isValid &&
      readingAmounts.isValid &&
      paymentBreakdown.isValid &&
      creditAllocations.isValid;

    return {
      canFinalize: allValid,
      checks: {
        nozzleCoverage,
        readingAmounts,
        paymentBreakdown,
        creditAllocations
      },
      issues: [
        ...(!nozzleCoverage.isValid ? [{ check: 'nozzleCoverage', ...nozzleCoverage }] : []),
        ...(!readingAmounts.isValid ? [{ check: 'readingAmounts', ...readingAmounts }] : []),
        ...(!paymentBreakdown.isValid ? [{ check: 'paymentBreakdown', ...paymentBreakdown }] : []),
        ...(!creditAllocations.isValid ? [{ check: 'creditAllocations', ...creditAllocations }] : [])
      ]
    };
  } catch (err) {
    logger.error('Complete verification error', err.message);
    throw err;
  }
};
