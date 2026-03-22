/**
 * Aggregation Service
 * Reusable aggregation helpers for dashboard analytics
 * Groups readings by a dimension and allocates payment breakdowns proportionally
 */

const paymentService = require('./paymentBreakdownService');

/**
 * Aggregate readings by a specified dimension, with payment breakdown allocation.
 *
 * @param {Object[]} readings - Flat reading objects (with transactionId, litresSold, totalAmount)
 * @param {string} dimensionKey - Key to group by e.g. 'readingDate', 'nozzleId', 'fuelType'
 * @param {Object} txnCache - Map of transactionId -> transaction (from allocatePaymentBreakdownsProportionally)
 * @param {Object} txnReadingTotals - Map of transactionId -> summed totalAmount
 * @param {Object} [options]
 * @param {string} [options.dimensionLabel] - Label for the dimension field in output (defaults to dimensionKey)
 * @param {string[]} [options.preserveFields] - Additional fields to preserve from first reading (e.g. ['nozzleNumber', 'fuelType', 'pumpName'])
 * @returns {Object[]} Sorted array of aggregated dimension records
 */
function aggregateByDimension(readings, dimensionKey, txnCache, txnReadingTotals, options = {}) {
  if (!Array.isArray(readings) || readings.length === 0) return [];

  const { dimensionLabel = dimensionKey, preserveFields = [] } = options;
  const groups = {};

  readings.forEach(reading => {
    const dimValue = reading[dimensionKey];
    if (dimValue === undefined || dimValue === null) return;

    if (!groups[dimValue]) {
      // Initialize group with dimension label and any preserved fields from first reading
      const preserved = {};
      preserveFields.forEach(field => {
        if (reading[field] !== undefined && reading[field] !== null) {
          preserved[field] = reading[field];
        }
      });

      groups[dimValue] = {
        [dimensionLabel]: dimValue,
        ...preserved,
        litresSold: 0,
        totalAmount: 0,
        cash: 0,
        online: 0,
        credit: 0,
        readingCount: 0
      };
    }

    const litres = parseFloat(reading.litresSold || 0);
    const amount = parseFloat(reading.totalAmount || 0);

    groups[dimValue].litresSold += litres;
    groups[dimValue].totalAmount += amount;
    groups[dimValue].readingCount += 1;

    // Allocate payment breakdown proportionally if transaction exists
    if (reading.transactionId && txnCache && txnCache[reading.transactionId]) {
      const txn = txnCache[reading.transactionId];
      const txnTotal = (txnReadingTotals && txnReadingTotals[reading.transactionId]) || 1;
      const alloc = paymentService.getProportionalAllocation(
        amount,
        txn.paymentBreakdown || txn.payment_breakdown || {},
        txnTotal
      );
      groups[dimValue].cash += alloc.cash;
      groups[dimValue].online += alloc.online;
      groups[dimValue].credit += alloc.credit;
    } else {
      // No transaction - treat full amount as cash
      groups[dimValue].cash += amount;
    }
  });

  // Round values and return as sorted array
  return Object.values(groups)
    .map(g => ({
      ...g,
      litresSold: parseFloat(g.litresSold.toFixed(3)),
      totalAmount: parseFloat(g.totalAmount.toFixed(2)),
      cash: parseFloat(g.cash.toFixed(2)),
      online: parseFloat(g.online.toFixed(2)),
      credit: parseFloat(g.credit.toFixed(2))
    }))
    .sort((a, b) => {
      const av = a[dimensionLabel];
      const bv = b[dimensionLabel];
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv);
      return 0;
    });
}

module.exports = { aggregateByDimension };
