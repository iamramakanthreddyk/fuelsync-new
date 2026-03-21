/**
 * Transaction Validation Enhanced Service
 * Comprehensive transaction validation combining all checks into one call
 */

const transactionValidation = require('./transactionValidationService');

/**
 * Run all validation checks for a complete transaction submission.
 * Returns { isValid, error?, details?, issues?, normalizedBreakdown }
 *
 * @param {Object} opts
 * @param {string} opts.stationId
 * @param {string} opts.transactionDate
 * @param {string[]} opts.readingIds
 * @param {Object[]} opts.readings - NozzleReading instances
 * @param {Object} opts.paymentBreakdown - { cash, online, credit }
 * @param {Object[]} opts.creditAllocations - [{ creditorId, amount }]
 * @param {number} opts.totalSaleValue - Sum of reading totalAmounts
 */
exports.validateTransactionComplete = async ({
  stationId,
  transactionDate,
  readingIds,
  readings,
  paymentBreakdown = {},
  creditAllocations = [],
  totalSaleValue
}) => {
  const issues = [];

  // Auto-balance payment breakdown (adjust cash for minor rounding)
  const balanceResult = transactionValidation.autoBalancePayment(paymentBreakdown, totalSaleValue);
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
  const creditValidation = transactionValidation.validateCreditAllocations(
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
