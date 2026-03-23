/**
 * Transaction Configuration Constants
 * Centralized magic values for transaction processing
 */

module.exports = {
  // Transaction statuses
  TRANSACTION_STATUS: {
    SUBMITTED: 'submitted',
    SETTLED: 'settled',
    PENDING: 'pending'
  },

  // Payment tolerance (₹)
  PAYMENT_TOLERANCE: 0.5,

  // Credit tolerance (₹) - stricter for credit allocations
  CREDIT_TOLERANCE: 0.01,

  // Validation messages
  VALIDATION_ERRORS: {
    STATION_REQUIRED: 'stationId is required',
    DATE_REQUIRED: 'transactionDate is required (YYYY-MM-DD)',
    READINGS_REQUIRED: 'readingIds must be a non-empty array',
    STATION_NOT_FOUND: 'Station not found',
    NO_READINGS_FOUND: 'No valid readings found for specified IDs, station, and date',
    PAYMENT_REQUIRED: 'At least one payment method (cash, online, or credit) must be greater than 0',
    PAYMENT_MISMATCH: 'Payment total must match total sale value',
    CREDIT_ALLOCATIONS_REQUIRED: 'Credit allocations required when credit amount > 0',
    CREDIT_AMOUNT_MISMATCH: 'Credit allocations must match credit amount',
    CREDITOR_NOT_FOUND: 'One or more creditors not found',
    CREDITOR_NOT_FOUND_FOR_ALLOCATION: 'Creditor not found for allocation',
    CREDIT_LIMIT_EXCEEDED: 'Credit limit exceeded'
  },

  // Defaults
  EMPTY_RESPONSES: {
    SUMMARY: {
      today: {
        totalLiters: 0,
        totalSaleValue: 0,
        transactionCount: 0,
        paymentBreakdown: {
          cash: 0,
          online: 0,
          credit: 0
        }
      },
      pumps: []
    }
  }
};
