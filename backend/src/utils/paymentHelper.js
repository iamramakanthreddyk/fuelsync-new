/**
 * Payment Helper Utility
 * 
 * Centralized payment breakdown and validation logic
 * Used by: readingController, transactionController, settlementVerificationService, dashboardService, etc.
 * 
 * PROBLEM SOLVED:
 * - Payment validation logic repeated 5+ times
 * - Different tolerance levels in different places
 * - Inconsistent payment method handling
 * - Hard to add new payment methods
 * 
 * SOLUTION:
 * - Single source for payment logic
 * - Flexible payment method support
 * - Consistent validation and calculations
 */

/**
 * Standard payment methods
 * Can be extended with other methods like 'upi', 'card', 'wallet'
 */
const PAYMENT_METHODS = {
  CASH: 'cash',
  ONLINE: 'online',
  CREDIT: 'credit',
  UPI: 'upi',
  CARD: 'card',
  CHEQUE: 'cheque'
};

/**
 * Get all supported payment methods
 * @returns {Array<string>}
 */
const getSupportedPaymentMethods = () => Object.values(PAYMENT_METHODS);

/**
 * Validate payment breakdown structure
 * @param {Object} breakdown - Payment breakdown object
 * @returns {boolean}
 */
const isValidPaymentBreakdown = (breakdown) => {
  if (!breakdown || typeof breakdown !== 'object') return false;
  
  // At least one payment method should exist
  const methods = Object.keys(breakdown);
  return methods.length > 0 && methods.every(method => typeof breakdown[method] === 'number');
};

/**
 * Parse and normalize payment breakdown
 * @param {Object} breakdown - Payment breakdown from request
 * @returns {Object} Normalized breakdown with all methods as numbers
 */
const normalizePaymentBreakdown = (breakdown = {}) => {
  const normalized = {
    cash: parseFloat(breakdown?.cash || 0),
    online: parseFloat(breakdown?.online || 0),
    credit: parseFloat(breakdown?.credit || 0),
    upi: parseFloat(breakdown?.upi || 0),
    card: parseFloat(breakdown?.card || 0),
    cheque: parseFloat(breakdown?.cheque || 0)
  };

  // Remove invalid values
  Object.keys(normalized).forEach(key => {
    if (isNaN(normalized[key]) || normalized[key] < 0) {
      normalized[key] = 0;
    }
  });

  return normalized;
};

/**
 * Calculate total amount from payment breakdown
 * @param {Object} breakdown - Payment breakdown
 * @returns {number} Total of all payment methods
 */
const calculatePaymentTotal = (breakdown) => {
  const normalized = normalizePaymentBreakdown(breakdown);
  return Object.values(normalized).reduce((sum, amount) => sum + amount, 0);
};

/**
 * Validate payment breakdown matches expected total
 * @param {Object} breakdown - Payment breakdown
 * @param {number} expectedAmount - Expected total
 * @param {number} [tolerance=0.01] - Allowed variance (₹0.01 by default)
 * @returns {Object} { valid: boolean, total: number, variance: number }
 */
const validatePaymentBreakdown = (breakdown, expectedAmount, tolerance = 0.01) => {
  if (!isValidPaymentBreakdown(breakdown)) {
    throw new Error('Invalid payment breakdown structure');
  }

  const normalized = normalizePaymentBreakdown(breakdown);
  const total = calculatePaymentTotal(breakdown);
  const variance = Math.abs(total - expectedAmount);

  return {
    valid: variance <= tolerance,
    total,
    variance,
    methods: normalized,
    tolerance
  };
};

/**
 * Calculate variance between payment breakdown and expected amount
 * @param {Object} breakdown - Payment breakdown
 * @param {number} expectedAmount - Expected total
 * @returns {Object} { variance: number, isOverage: boolean, isShortfall: boolean }
 */
const calculatePaymentVariance = (breakdown, expectedAmount) => {
  const total = calculatePaymentTotal(breakdown);
  const variance = total - expectedAmount;

  return {
    variance: Math.abs(variance),
    direction: variance > 0 ? 'overage' : variance < 0 ? 'shortfall' : 'exact',
    isOverage: variance > 0,
    isShortfall: variance < 0,
    expectedAmount,
    actualAmount: total
  };
};

/**
 * Get payment methods used in breakdown
 * @param {Object} breakdown - Payment breakdown
 * @returns {Array<string>} Methods with non-zero amounts
 */
const getUsedPaymentMethods = (breakdown) => {
  const normalized = normalizePaymentBreakdown(breakdown);
  return Object.entries(normalized)
    .filter(([_, amount]) => amount > 0)
    .map(([method]) => method);
};

/**
 * Check if payment breakdown uses specific method
 * @param {Object} breakdown - Payment breakdown
 * @param {string} method - Payment method to check
 * @returns {boolean}
 */
const usesPaymentMethod = (breakdown, method) => {
  const normalized = normalizePaymentBreakdown(breakdown);
  return normalized[method] > 0;
};

/**
 * Get amount for specific payment method
 * @param {Object} breakdown - Payment breakdown
 * @param {string} method - Payment method
 * @returns {number}
 */
const getPaymentAmount = (breakdown, method) => {
  const normalized = normalizePaymentBreakdown(breakdown);
  return normalized[method] || 0;
};

/**
 * Allocate remaining amount across payment methods
 * Useful for distributing cash when actual received differs from expected
 * @param {number} totalAmount - Total to allocate
 * @param {Array<string>} [methods=['cash']] - Methods to distribute to (in order)
 * @returns {Object} Payment breakdown
 */
const allocatePaymentAmount = (totalAmount, methods = ['cash']) => {
  const breakdown = {
    cash: 0,
    online: 0,
    credit: 0,
    upi: 0,
    card: 0,
    cheque: 0
  };

  let remaining = totalAmount;
  for (const method of methods) {
    breakdown[method] = remaining;
    remaining = 0;
    if (remaining <= 0) break;
  }

  return breakdown;
};

/**
 * Merge multiple payment breakdowns
 * @param {Array<Object>} breakdowns - Array of payment breakdowns
 * @returns {Object} Combined breakdown
 */
const mergePaymentBreakdowns = (breakdowns = []) => {
  const merged = {
    cash: 0,
    online: 0,
    credit: 0,
    upi: 0,
    card: 0,
    cheque: 0
  };

  for (const breakdown of breakdowns) {
    const normalized = normalizePaymentBreakdown(breakdown);
    Object.keys(merged).forEach(method => {
      merged[method] += normalized[method];
    });
  }

  return merged;
};

/**
 * Format payment breakdown for display
 * @param {Object} breakdown - Payment breakdown
 * @returns {string} Human-readable format
 */
const formatPaymentBreakdown = (breakdown) => {
  const normalized = normalizePaymentBreakdown(breakdown);
  const parts = [];

  for (const [method, amount] of Object.entries(normalized)) {
    if (amount > 0) {
      parts.push(`${method}: ₹${amount.toFixed(2)}`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'No payment recorded';
};

module.exports = {
  PAYMENT_METHODS,
  getSupportedPaymentMethods,
  isValidPaymentBreakdown,
  normalizePaymentBreakdown,
  calculatePaymentTotal,
  validatePaymentBreakdown,
  calculatePaymentVariance,
  getUsedPaymentMethods,
  usesPaymentMethod,
  getPaymentAmount,
  allocatePaymentAmount,
  mergePaymentBreakdowns,
  formatPaymentBreakdown
};
