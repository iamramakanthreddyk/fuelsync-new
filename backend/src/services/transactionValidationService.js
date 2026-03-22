/**
 * Transaction Validation Service
 * Handles all payment breakdown and credit allocation validation logic
 */

const { PAYMENT_TOLERANCE, CREDIT_TOLERANCE, VALIDATION_ERRORS } = require('../config/transactionConstants');

/**
 * Validate payment breakdown values and format for persistence
 * @param {Object} paymentBreakdown - { cash, online, credit }
 * @param {number} totalSaleValue - Expected total from readings
 * @returns {Object} - { isValid, error, details, normalizedBreakdown }
 */
exports.validatePaymentBreakdown = (paymentBreakdown = {}, totalSaleValue) => {
  const cash = parseFloat(paymentBreakdown.cash || 0);
  const online = parseFloat(paymentBreakdown.online || 0);
  const credit = parseFloat(paymentBreakdown.credit || 0);
  const paymentTotal = cash + online + credit;

  // Critical: At least one payment method must be > 0
  if (paymentTotal <= 0 || (cash <= 0 && online <= 0 && credit <= 0)) {
    return {
      isValid: false,
      error: VALIDATION_ERRORS.PAYMENT_REQUIRED,
      details: { cash, online, credit }
    };
  }

  // Check if payment total matches sale value
  const diff = Math.abs(paymentTotal - totalSaleValue);
  
  if (diff > PAYMENT_TOLERANCE) {
    return {
      isValid: false,
      error: `${VALIDATION_ERRORS.PAYMENT_MISMATCH} (₹${totalSaleValue.toFixed(2)}) vs (₹${paymentTotal.toFixed(2)}). Difference: ₹${diff.toFixed(2)}`,
      details: {
        totalSaleValue: parseFloat(totalSaleValue.toFixed(2)),
        paymentTotal: parseFloat(paymentTotal.toFixed(2)),
        difference: parseFloat(diff.toFixed(2))
      }
    };
  }

  return {
    isValid: true,
    normalizedBreakdown: {
      cash,
      online,
      credit
    }
  };
};

/**
 * Auto-balance payment breakdown by adjusting cash
 * Useful for quick entry when rounding may cause small mismatches
 * @param {Object} paymentBreakdown - { cash, online, credit }
 * @param {number} totalSaleValue - Expected total
 * @returns {Object} - { isValid, error, normalizedBreakdown, autoBalanced }
 */
exports.autoBalancePayment = (paymentBreakdown = {}, totalSaleValue) => {
  const cash = parseFloat(paymentBreakdown.cash || 0);
  const online = parseFloat(paymentBreakdown.online || 0);
  const credit = parseFloat(paymentBreakdown.credit || 0);
  const paymentTotal = cash + online + credit;

  // If totalSaleValue is 0, accept payment as-is (miscellaneous income)
  if (totalSaleValue <= 0) {
    return {
      isValid: true,
      autoBalanced: false,
      normalizedBreakdown: { cash, online, credit }
    };
  }

  const diff = Math.abs(paymentTotal - totalSaleValue);

  // If within tolerance, no auto-balancing needed
  if (diff <= PAYMENT_TOLERANCE) {
    return {
      isValid: true,
      autoBalanced: false,
      normalizedBreakdown: { cash, online, credit }
    };
  }

  // Auto-balance cash to match total sale value
  const newCash = Math.max(0, totalSaleValue - (online + credit));
  const newTotal = newCash + online + credit;
  const newDiff = Math.abs(newTotal - totalSaleValue);

  // If still not within tolerance after balancing, fail
  if (newDiff > PAYMENT_TOLERANCE) {
    return {
      isValid: false,
      error: `Payment total mismatch (₹${totalSaleValue.toFixed(2)}) vs (₹${newTotal.toFixed(2)}). Difference: ₹${newDiff.toFixed(2)}`,
      details: {
        totalSaleValue: parseFloat(totalSaleValue.toFixed(2)),
        paymentTotal: parseFloat(newTotal.toFixed(2)),
        difference: parseFloat(newDiff.toFixed(2))
      }
    };
  }

  return {
    isValid: true,
    autoBalanced: true,
    normalizedBreakdown: {
      cash: newCash,
      online,
      credit
    }
  };
};

/**
 * Validate credit allocations match the credit amount
 * @param {Array} creditAllocations - [{ creditorId, amount }]
 * @param {number} creditAmount - Expected credit total from payment breakdown
 * @returns {Object} - { isValid, error }
 */
exports.validateCreditAllocations = (creditAllocations = [], creditAmount = 0) => {
  // If credit amount is 0, allocations should be empty
  if (creditAmount <= 0) {
    return { isValid: true };
  }

  // If credit amount > 0, allocations must exist
  if (!Array.isArray(creditAllocations) || creditAllocations.length === 0) {
    return {
      isValid: false,
      error: VALIDATION_ERRORS.CREDIT_ALLOCATIONS_REQUIRED
    };
  }

  // Sum allocations and compare
  const creditTotal = creditAllocations.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
  const diff = Math.abs(creditTotal - creditAmount);

  if (diff > CREDIT_TOLERANCE) {
    return {
      isValid: false,
      error: `${VALIDATION_ERRORS.CREDIT_AMOUNT_MISMATCH} (₹${creditTotal.toFixed(2)}) vs (₹${creditAmount.toFixed(2)})`
    };
  }

  return { isValid: true };
};

/**
 * Check if all readings in array are sample readings
 * @param {Array} readings - NozzleReading model instances
 * @returns {boolean}
 */
exports.areAllReadingsSamples = (readings = []) => {
  if (readings.length === 0) return false;
  
  return readings.every(r => {
    // Handle both Sequelize camelCase and snake_case properties
    const isSampleVal = r.isSample !== undefined ? r.isSample : (r.dataValues?.isSample || r.dataValues?.is_sample || false);
    return isSampleVal === true;
  });
};

/**
 * Normalize credit allocations to consistent format
 * @param {Array} allocations - [{ creditorId | creditor_id, amount }]
 * @returns {Array} - Normalized allocations
 */
exports.normalizeCreditAllocations = (allocations = []) => {
  return allocations.map(c => ({
    creditorId: c.creditorId || c.creditor_id,
    amount: parseFloat(c.amount || 0)
  })).filter(c => c.creditorId && c.amount > 0);
};

/**
 * Run ALL validation checks for complete transaction submission
 * Consolidated from transactionValidationEnhancedService
 * @param {Object} opts - Validation options
 * @returns {Object} - { isValid, error?, normalizedBreakdown, issues? }
 */
exports.validateTransactionComplete = async (opts) => {
  const {
    stationId,
    transactionDate,
    readingIds,
    readings,
    paymentBreakdown = {},
    creditAllocations = [],
    totalSaleValue
  } = opts;
  
  const issues = [];

  // Auto-balance payment breakdown (adjust cash for minor rounding)
  const balanceResult = exports.autoBalancePayment(paymentBreakdown, totalSaleValue);
  if (!balanceResult.isValid) {
    return {
      isValid: false,
      error: balanceResult.error,
      details: balanceResult.details,
      issues: [balanceResult.error]
    };
  }

  const normalizedBreakdown = balanceResult.normalizedBreakdown;

  // Validate credit allocations match credit amount
  const creditAmount = parseFloat(normalizedBreakdown.credit || 0);
  const creditValidation = exports.validateCreditAllocations(
    creditAllocations,
    creditAmount
  );
  if (!creditValidation.isValid) {
    return {
      isValid: false,
      error: creditValidation.error,
      issues: [creditValidation.error]
    };
  }

  if (balanceResult.autoBalanced) {
    issues.push('Payment was auto-balanced to match sale total');
  }

  return {
    isValid: true,
    normalizedBreakdown,
    issues
  };
};
