/**
 * Enhanced Transaction Validation Service (Issue #2 & #4 fix)
 * 
 * Validates:
 * - Payment breakdown matches total sale value
 * - Credit allocations match credit readings
 * - No over-allocation to creditors
 * - Readings exist for all creditors
 */

const { NozzleReading, Creditor, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Validate payment breakdown sums to total sale value
 * Issue #2: Strong validation with detailed errors
 */
exports.validatePaymentBreakdownAmount = (paymentBreakdown, totalSaleValue, tolerance = 0.50) => {
  if (!paymentBreakdown || typeof paymentBreakdown !== 'object') {
    return {
      isValid: false,
      error: 'Payment breakdown must be an object'
    };
  }

  const cash = parseFloat(paymentBreakdown.cash || 0);
  const online = parseFloat(paymentBreakdown.online || 0);
  const credit = parseFloat(paymentBreakdown.credit || 0);

  const sum = cash + online + credit;
  const expectedTotal = parseFloat(totalSaleValue);
  const variance = Math.abs(sum - expectedTotal);

  if (variance > tolerance) {
    return {
      isValid: false,
      error: `Payment breakdown mismatch`,
      details: {
        breakdown: { cash, online, credit },
        sum: parseFloat(sum.toFixed(2)),
        expected: parseFloat(expectedTotal.toFixed(2)),
        variance: parseFloat(variance.toFixed(2)),
        userMessage: `Payment total (₹${sum.toFixed(2)}) doesn't match sale value (₹${expectedTotal.toFixed(2)}). Variance: ₹${variance.toFixed(2)}`
      }
    };
  }

  return {
    isValid: true,
    variance: parseFloat(variance.toFixed(2)),
    autoBalance: variance > 0 ? variance : 0 // Amount to auto-adjust in cash
  };
};

/**
 * Validate payment methods contain required fields
 */
exports.validatePaymentMethods = (paymentBreakdown) => {
  if (!paymentBreakdown) {
    return {
      isValid: false,
      error: 'Payment breakdown is required'
    };
  }

  // Should have at least cash and online
  if (!('cash' in paymentBreakdown) || !('online' in paymentBreakdown)) {
    return {
      isValid: false,
      error: 'Payment breakdown must include cash and online fields'
    };
  }

  // All values should be non-negative
  for (const [method, amount] of Object.entries(paymentBreakdown)) {
    if (amount < 0) {
      return {
        isValid: false,
        error: `${method} amount cannot be negative`
      };
    }
  }

  return { isValid: true };
};

/**
 * Issue #4: Validate credit allocations match readings with that creditor
 * Ensures creditor had actual sales on that date
 */
exports.validateCreditAllocationsMatchReadings = async (
  stationId,
  transactionDate,
  creditAllocations
) => {
  if (!creditAllocations || creditAllocations.length === 0) {
    return {
      isValid: true,
      message: 'No credit allocations'
    };
  }

  try {
    // Get all readings for this transaction date and station
    const readings = await NozzleReading.scope('active').findAll({
      where: {
        stationId,
        readingDate: transactionDate,
        creditorId: { [Op.ne]: null } // Only credit readings
      },
      attributes: ['creditorId', 'totalAmount'],
      raw: true
    });

    // Build expected allocations by creditor
    const expectedByCreditor = {};
    readings.forEach(r => {
      if (!expectedByCreditor[r.creditorId]) {
        expectedByCreditor[r.creditorId] = 0;
      }
      expectedByCreditor[r.creditorId] += parseFloat(r.totalAmount || 0);
    });

    // Build provided allocations
    const providedByCreditor = {};
    creditAllocations.forEach(a => {
      providedByCreditor[a.creditorId] = a.amount;
    });

    // Find mismatches
    const issues = [];

    // Check for allocations without readings
    for (const [creditorId, amount] of Object.entries(providedByCreditor)) {
      if (!expectedByCreditor[creditorId]) {
        issues.push({
          type: 'ALLOCATION_WITHOUT_READING',
          creditorId,
          allocatedAmount: amount,
          message: `Credit allocation of ₹${amount} for creditor ${creditorId} but no readings found`
        });
      }
    }

    // Check for readings without allocations
    for (const [creditorId, expectedAmount] of Object.entries(expectedByCreditor)) {
      if (!providedByCreditor[creditorId]) {
        issues.push({
          type: 'READING_WITHOUT_ALLOCATION',
          creditorId,
          expectedAmount: parseFloat(expectedAmount.toFixed(2)),
          message: `Credit readings totaling ₹${expectedAmount.toFixed(2)} for creditor ${creditorId} but no allocation provided`
        });
      } else if (Math.abs(providedByCreditor[creditorId] - expectedAmount) > 0.50) {
        issues.push({
          type: 'ALLOCATION_AMOUNT_MISMATCH',
          creditorId,
          expectedAmount: parseFloat(expectedAmount.toFixed(2)),
          allocatedAmount: providedByCreditor[creditorId],
          variance: parseFloat((Math.abs(providedByCreditor[creditorId] - expectedAmount)).toFixed(2)),
          message: `Allocation (₹${providedByCreditor[creditorId]}) doesn't match readings (₹${expectedAmount.toFixed(2)})`
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      expectedAllocations: expectedByCreditor,
      providedAllocations: providedByCreditor,
      message: issues.length === 0 
        ? `All allocations match readings`
        : `${issues.length} allocation mismatches found`
    };
  } catch (err) {
    console.error('[validateCreditAllocationsMatchReadings] Error:', err);
    throw err;
  }
};

/**
 * Validate creditors can accept allocated amounts
 */
exports.validateCreditorLimits = async (creditAllocations) => {
  if (!creditAllocations || creditAllocations.length === 0) {
    return { isValid: true };
  }

  try {
    // Get all creditors in allocations
    const creditorIds = creditAllocations.map(a => a.creditorId);
    const creditors = await Creditor.findAll({
      where: { id: creditorIds },
      attributes: ['id', 'name', 'isActive', 'creditLimit', 'currentBalance']
    });

    const creditorMap = creditors.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});

    const issues = [];

    for (const alloc of creditAllocations) {
      const creditor = creditorMap[alloc.creditorId];

      if (!creditor) {
        issues.push({
          type: 'CREDITOR_NOT_FOUND',
          creditorId: alloc.creditorId,
          amount: alloc.amount
        });
        continue;
      }

      if (!creditor.isActive) {
        issues.push({
          type: 'CREDITOR_INACTIVE',
          creditorId: alloc.creditorId,
          creditorName: creditor.name,
          amount: alloc.amount
        });
        continue;
      }

      const newBalance = parseFloat(creditor.currentBalance) + parseFloat(alloc.amount);
      if (newBalance > creditor.creditLimit) {
        issues.push({
          type: 'CREDIT_LIMIT_EXCEEDED',
          creditorId: alloc.creditorId,
          creditorName: creditor.name,
          allocationAmount: parseFloat(alloc.amount.toFixed(2)),
          currentBalance: parseFloat(creditor.currentBalance.toFixed(2)),
          creditLimit: parseFloat(creditor.creditLimit.toFixed(2)),
          projectedBalance: parseFloat(newBalance.toFixed(2)),
          overage: parseFloat((newBalance - creditor.creditLimit).toFixed(2))
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      message: issues.length === 0
        ? `All creditors can accept allocations`
        : `${issues.length} creditor limit violations`
    };
  } catch (err) {
    console.error('[validateCreditorLimits] Error:', err);
    throw err;
  }
};

/**
 * Comprehensive validation
 */
exports.validateTransactionComplete = async (
  transactionData
) => {
  const {
    stationId,
    transactionDate,
    totalSaleValue,
    paymentBreakdown,
    creditAllocations
  } = transactionData;

  try {
    // Run all validations in parallel
    const [
      paymentAmountValidation,
      paymentMethodValidation,
      creditAllocationsValidation,
      creditorLimitsValidation
    ] = await Promise.all([
      Promise.resolve(this.validatePaymentBreakdownAmount(paymentBreakdown, totalSaleValue)),
      Promise.resolve(this.validatePaymentMethods(paymentBreakdown)),
      this.validateCreditAllocationsMatchReadings(stationId, transactionDate, creditAllocations),
      this.validateCreditorLimits(creditAllocations || [])
    ]);

    const allValid =
      paymentAmountValidation.isValid &&
      paymentMethodValidation.isValid &&
      creditAllocationsValidation.isValid &&
      creditorLimitsValidation.isValid;

    return {
      isValid: allValid,
      validations: {
        paymentAmount: paymentAmountValidation,
        paymentMethods: paymentMethodValidation,
        creditAllocations: creditAllocationsValidation,
        creditorLimits: creditorLimitsValidation
      },
      errors: [
        ...(!paymentAmountValidation.isValid ? [{ type: 'PAYMENT_AMOUNT', ...paymentAmountValidation }] : []),
        ...(!paymentMethodValidation.isValid ? [{ type: 'PAYMENT_METHODS', ...paymentMethodValidation }] : []),
        ...(!creditAllocationsValidation.isValid ? [{ type: 'CREDIT_ALLOCATIONS', ...creditAllocationsValidation }] : []),
        ...(!creditorLimitsValidation.isValid ? [{ type: 'CREDITOR_LIMITS', ...creditorLimitsValidation }] : [])
      ]
    };
  } catch (err) {
    console.error('[validateTransactionComplete] Error:', err);
    throw err;
  }
};
