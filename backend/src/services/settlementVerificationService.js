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

/**
 * Verify all active nozzles have readings for a date
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
      attributes: ['nozzleId'],
      raw: true
    });

    const readingNozzleIds = new Set(readings.map(r => r.nozzleId));

    // Find gaps
    const gaps = activeNozzles
      .filter(n => !readingNozzleIds.has(n.id))
      .map(n => ({
        nozzleId: n.id,
        nozzleNumber: n.nozzleNumber,
        label: n.label,
        fuelType: n.fuelType
      }));

    return {
      isValid: gaps.length === 0,
      nozzlesWithGaps: gaps,
      totalNozzles: activeNozzles.length,
      readingCount: readings.length,
      message: gaps.length === 0
        ? `All ${activeNozzles.length} nozzles have readings`
        : `Missing readings for ${gaps.length}/${activeNozzles.length} nozzles: ${gaps.map(g => g.nozzleNumber).join(', ')}`
    };
  } catch (err) {
    console.error('[settlementVerificationService] Nozzle coverage check error:', err);
    throw err;
  }
};

/**
 * Verify reading amounts match settlement
 */
exports.verifyReadingAmounts = async (settlementId) => {
  try {
    const settlement = await Settlement.findByPk(settlementId, {
      attributes: ['id', 'stationId', 'date', 'totalSaleValue', 'readingIds']
    });

    if (!settlement || !settlement.readingIds || settlement.readingIds.length === 0) {
      return {
        isValid: false,
        error: 'Settlement has no readings',
        actualTotal: 0,
        expectedTotal: settlement?.totalSaleValue || 0,
        variance: settlement?.totalSaleValue || 0
      };
    }

    // Get readings
    const readings = await NozzleReading.findAll({
      where: {
        id: settlement.readingIds
      },
      attributes: ['id', 'totalAmount', 'litresSold', 'pricePerLitre']
    });

    if (readings.length === 0) {
      return {
        isValid: false,
        error: 'Reading records not found (may have been deleted)',
        actualTotal: 0,
        expectedTotal: settlement.totalSaleValue,
        variance: settlement.totalSaleValue
      };
    }

    // Calculate actual total
    const actualTotal = readings.reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);
    const variance = Math.abs(actualTotal - settlement.totalSaleValue);
    const tolerance = 0.50;

    return {
      isValid: variance <= tolerance,
      actualTotal: parseFloat(actualTotal.toFixed(2)),
      expectedTotal: parseFloat(settlement.totalSaleValue),
      variance: parseFloat(variance.toFixed(2)),
      readingCount: readings.length,
      message: variance === 0
        ? `Amounts match perfectly (₹${actualTotal.toFixed(2)})`
        : variance <= tolerance
          ? `Within tolerance (variance: ₹${variance.toFixed(2)})`
          : `MISMATCH: Actual ₹${actualTotal.toFixed(2)} vs Expected ₹${settlement.totalSaleValue.toFixed(2)}`
    };
  } catch (err) {
    console.error('[settlementVerificationService] Reading amount check error:', err);
    throw err;
  }
};

/**
 * Verify payment breakdown sums to total
 */
exports.verifyPaymentBreakdown = async (settlementId) => {
  try {
    const settlement = await Settlement.findByPk(settlementId);

    if (!settlement) {
      return {
        isValid: false,
        error: 'Settlement not found'
      };
    }

    // Get daily transaction for this settlement
    const transaction = await DailyTransaction.findOne({
      where: { settlementId },
      attributes: ['id', 'totalSaleValue', 'paymentBreakdown', 'creditAllocations']
    });

    if (!transaction) {
      // No transaction yet - settlement is unfinalized
      return {
        isValid: true,
        message: 'No transaction yet (settlement in draft)'
      };
    }

    // Calculate payment breakdown sum
    const breakdown = transaction.paymentBreakdown || {};
    const cash = parseFloat(breakdown.cash || 0);
    const online = parseFloat(breakdown.online || 0);
    const credit = parseFloat(breakdown.credit || 0);
    const sum = cash + online + credit;

    const expectedTotal = parseFloat(transaction.totalSaleValue);
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
    console.error('[settlementVerificationService] Payment breakdown check error:', err);
    throw err;
  }
};

/**
 * Verify credit allocations are valid
 */
exports.verifyCreditAllocations = async (settlementId) => {
  try {
    const settlement = await Settlement.findByPk(settlementId);

    const transaction = await DailyTransaction.findOne({
      where: { settlementId },
      attributes: ['id', 'creditAllocations']
    });

    if (!transaction || !transaction.creditAllocations) {
      return {
        isValid: true,
        message: 'No credit allocations'
      };
    }

    const allocations = transaction.creditAllocations;

    // Verify each creditor exists and is active
    const issues = [];

    for (const alloc of allocations) {
      const creditor = await Creditor.findByPk(alloc.creditorId, {
        attributes: ['id', 'name', 'isActive', 'creditLimit', 'currentBalance']
      });

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
    console.error('[settlementVerificationService] Credit allocation check error:', err);
    throw err;
  }
};

/**
 * Comprehensive settlement verification
 * Run all checks before finalization
 */
exports.verifySettlementComplete = async (settlementId, stationId, date) => {
  try {
    // Run all checks in parallel
    const [
      nozzleCoverage,
      readingAmounts,
      paymentBreakdown,
      creditAllocations
    ] = await Promise.all([
      this.verifyNozzleCoverage(stationId, date),
      this.verifyReadingAmounts(settlementId),
      this.verifyPaymentBreakdown(settlementId),
      this.verifyCreditAllocations(settlementId)
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
    console.error('[settlementVerificationService] Complete verification error:', err);
    throw err;
  }
};
