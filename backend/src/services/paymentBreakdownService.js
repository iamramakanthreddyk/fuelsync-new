/**
 * Payment Breakdown Service
 * Centralized logic for aggregating payment breakdowns from transactions
 */

const { DailyTransaction } = require('../models');

/**
 * Aggregate payment breakdown from DailyTransaction records
 * @param {Object} where - Sequelize where clause for filtering
 * @returns {Promise<{cash, online, credit}>} Aggregated payment totals
 */
async function getPaymentBreakdownAggregates(where) {
  try {
    const transactions = await DailyTransaction.findAll({
      where,
      attributes: ['paymentBreakdown'],
      raw: true
    });

    const totals = {
      cash: 0,
      online: 0,
      credit: 0
    };

    if (!transactions || transactions.length === 0) {
      return totals;
    }

    transactions.forEach(txn => {
      if (txn.paymentBreakdown && typeof txn.paymentBreakdown === 'object') {
        totals.cash += parseFloat(txn.paymentBreakdown.cash || 0);
        totals.online += parseFloat(txn.paymentBreakdown.online || 0);
        totals.credit += parseFloat(txn.paymentBreakdown.credit || 0);
      }
    });

    return totals;
  } catch (error) {
    console.error('Error aggregating payment breakdowns:', error);
    throw error;
  }
}

/**
 * Allocate transaction payment breakdown proportionally to readings
 * @param {Array} readings - Array of readings with transactionId
 * @returns {Promise<Map>} Map of transactionId -> paymentBreakdown
 */
async function allocatePaymentBreakdownsProportionally(readings) {
  if (!readings || readings.length === 0) {
    return {};
  }

  // Get unique transaction IDs
  const txnIds = [...new Set(readings.map(r => r.transactionId).filter(Boolean))];
  const txnCache = {};

  if (txnIds.length === 0) {
    return txnCache;
  }

  // Fetch all transactions
  const transactions = await DailyTransaction.findAll({
    where: { id: txnIds },
    attributes: ['id', 'paymentBreakdown'],
    raw: true
  });

  // Build cache and compute transaction totals
  const txnReadingTotals = {};

  transactions.forEach(t => {
    txnCache[t.id] = t;
  });

  readings.forEach(reading => {
    if (reading.transactionId) {
      const amount = parseFloat(reading.totalAmount || 0);
      txnReadingTotals[reading.transactionId] = 
        (txnReadingTotals[reading.transactionId] || 0) + amount;
    }
  });

  return { txnCache, txnReadingTotals };
}

/**
 * Calculate proportional payment breakdown for a reading
 * @param {number} readingAmount - Total amount of the reading
 * @param {Object} paymentBreakdown - Transaction's payment breakdown
 * @param {number} transactionTotal - Sum of all reading amounts in transaction
 * @returns {Object} Proportionally allocated payment breakdown
 */
function getProportionalAllocation(readingAmount, paymentBreakdown, transactionTotal) {
  if (!paymentBreakdown || transactionTotal <= 0) {
    return { cash: 0, online: 0, credit: 0 };
  }

  const ratio = readingAmount / transactionTotal;

  return {
    cash: parseFloat(paymentBreakdown.cash || 0) * ratio,
    online: parseFloat(paymentBreakdown.online || 0) * ratio,
    credit: parseFloat(paymentBreakdown.credit || 0) * ratio
  };
}

module.exports = {
  getPaymentBreakdownAggregates,
  allocatePaymentBreakdownsProportionally,
  getProportionalAllocation
};
