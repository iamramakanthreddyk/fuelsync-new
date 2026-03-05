/**
 * Aggregation Service
 * Consolidates all dimension-based data aggregations
 * Replaces: calculateDailySummary, calculateFuelBreakdown, calculateNozzleBreakdown, calculatePumpPerformance
 * 
 * Usage:
 *   const daily = AggregationService.aggregateByDimension(readings, 'readingDate', txnCache, txnReadingTotals);
 *   const fuel = AggregationService.aggregateByDimension(readings, 'fuelType', txnCache, txnReadingTotals);
 *   const pump = AggregationService.aggregateByDimension(readings, 'pumpId', txnCache, txnReadingTotals);
 *   const nozzle = AggregationService.aggregateByDimension(readings, 'nozzleId', txnCache, txnReadingTotals);
 */

const { FUEL_TYPE_LABELS } = require('../config/constants');

class AggregationService {
  /**
   * Aggregate readings by a single dimension
   * 
   * @param {Array} readings - Array of reading objects with totalAmount, litresSold, transactionId
   * @param {String} dimensionKey - Property name to aggregate by (e.g., 'readingDate', 'fuelType', 'nozzleId', 'pumpId')
   * @param {Object} txnCache - Transaction cache { txnId: { paymentBreakdown: {...} } }
   * @param {Object} txnReadingTotals - Per-transaction reading totals { txnId: totalAmount }
   * 
   * @returns {Object} { summary: {...}, items: [...] }
   */
  static aggregateByDimension(
    readings,
    dimensionKey,
    txnCache = {},
    txnReadingTotals = {}
  ) {
    if (!Array.isArray(readings)) {
      return { summary: {}, items: [] };
    }

    const map = {};

    readings.forEach(reading => {
      const key = reading[dimensionKey];
      if (key === null || key === undefined) return; // Skip null keys

      if (!map[key]) {
        map[key] = {
          [dimensionKey]: key,
          litres: 0,
          amount: 0,
          cash: 0,
          online: 0,
          credit: 0,
          count: 0,
          label: this.getDimensionLabel(dimensionKey, key, reading)
        };
      }

      const readingAmount = parseFloat(reading.totalAmount || 0);
      map[key].litres += parseFloat(reading.litresSold || 0);
      map[key].amount += readingAmount;
      map[key].count += 1;

      // Allocate payment if transaction exists
      if (reading.transactionId && txnCache[reading.transactionId]) {
        const pb = txnCache[reading.transactionId].paymentBreakdown || {};
        const txnTotal = txnReadingTotals[reading.transactionId] || 1;
        const allocation = this.getProportionalAllocation(readingAmount, pb, txnTotal);

        map[key].cash += allocation.cash;
        map[key].online += allocation.online;
        map[key].credit += allocation.credit;
      }
    });

    return this.formatAggregatedData(Object.values(map));
  }

  /**
   * Get proportional payment allocation for a reading within a transaction
   * 
   * @param {Number} readingAmount - Amount for this specific reading
   * @param {Object} paymentBreakdown - Full transaction payment breakdown { cash, online, credit }
   * @param {Number} txnTotal - Total amount for the transaction
   */
  static getProportionalAllocation(readingAmount, paymentBreakdown, txnTotal) {
    if (!paymentBreakdown || txnTotal === 0) {
      return { cash: 0, online: 0, credit: 0 };
    }

    const ratio = readingAmount / txnTotal;
    return {
      cash: parseFloat(((paymentBreakdown.cash || 0) * ratio).toFixed(2)),
      online: parseFloat(((paymentBreakdown.online || 0) * ratio).toFixed(2)),
      credit: parseFloat(((paymentBreakdown.credit || 0) * ratio).toFixed(2))
    };
  }

  /**
   * Get human-readable label for dimension value
   */
  static getDimensionLabel(dimensionKey, value, reading = {}) {
    switch (dimensionKey) {
      case 'fuelType':
        return FUEL_TYPE_LABELS[value] || value;

      case 'readingDate':
      case 'date':
        try {
          return new Date(value).toLocaleDateString('en-IN');
        } catch {
          return value;
        }

      case 'nozzleId':
        return `Nozzle ${reading.nozzle?.nozzleNumber || value}`;

      case 'pumpId':
        return `Pump ${reading.nozzle?.pump?.name || reading.pump?.name || value}`;

      default:
        return String(value);
    }
  }

  /**
   * Format aggregated data with summary and percentages
   */
  static formatAggregatedData(items) {
    // Calculate totals
    const summary = {
      totalLitres: 0,
      totalAmount: 0,
      breakdown: {
        cash: 0,
        online: 0,
        credit: 0
      },
      itemCount: items.length
    };

    items.forEach(item => {
      summary.totalLitres += item.litres;
      summary.totalAmount += item.amount;
      summary.breakdown.cash += item.cash;
      summary.breakdown.online += item.online;
      summary.breakdown.credit += item.credit;
    });

    // Format items with percentages
    const formattedItems = items.map(item => ({
      ...item,
      litres: parseFloat(item.litres.toFixed(2)),
      amount: parseFloat(item.amount.toFixed(2)),
      cash: parseFloat(item.cash.toFixed(2)),
      online: parseFloat(item.online.toFixed(2)),
      credit: parseFloat(item.credit.toFixed(2)),
      percentage: summary.totalAmount > 0
        ? parseFloat(((item.amount / summary.totalAmount) * 100).toFixed(2))
        : 0
    }));

    // Round summary totals
    summary.totalLitres = parseFloat(summary.totalLitres.toFixed(2));
    summary.totalAmount = parseFloat(summary.totalAmount.toFixed(2));
    summary.breakdown.cash = parseFloat(summary.breakdown.cash.toFixed(2));
    summary.breakdown.online = parseFloat(summary.breakdown.online.toFixed(2));
    summary.breakdown.credit = parseFloat(summary.breakdown.credit.toFixed(2));

    return { summary, items: formattedItems };
  }

  /**
   * Create unified response with multiple aggregations from same data
   * This is the key optimization: load data once, aggregate by multiple dimensions
   * 
   * @param {Array} readings - Base reading data
   * @param {Array} dimensions - Array of dimension keys to aggregate by (e.g., ['daily', 'fuel', 'pump'])
   * @param {Object} txnCache - Transaction cache
   * @param {Object} txnReadingTotals - Transaction totals
   * 
   * @returns {Object} { daily: {...}, fuel: {...}, pump: {...}, ... }
   */
  static createMultipleAggregations(readings, dimensions, txnCache, txnReadingTotals) {
    const results = {};

    dimensions.forEach(dim => {
      const key = this.mapDimensionName(dim);
      results[dim] = this.aggregateByDimension(
        readings,
        key,
        txnCache,
        txnReadingTotals
      );
    });

    return results;
  }

  /**
   * Map user-friendly dimension names to reading property names
   */
  static mapDimensionName(dim) {
    const mapping = {
      daily: 'readingDate',
      date: 'readingDate',
      fuel: 'fuelType',
      pump: 'pumpId',
      nozzle: 'nozzleId'
    };
    return mapping[dim] || dim;
  }

  /**
   * Calculate simple statistics on aggregated data
   */
  static calculateStats(aggregatedData) {
    const { summary, items } = aggregatedData;

    if (items.length === 0) {
      return {
        count: 0,
        average: 0,
        highest: null,
        lowest: null
      };
    }

    const amounts = items.map(i => i.amount);
    const highest = items.reduce((max, item) => item.amount > max.amount ? item : max);
    const lowest = items.reduce((min, item) => item.amount < min.amount ? item : min);

    return {
      count: items.length,
      average: summary.totalAmount / items.length,
      highest,
      lowest,
      median: this.calculateMedian(amounts)
    };
  }

  /**
   * Calculate median value
   */
  static calculateMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Filter aggregated data by amount range
   */
  static filterByAmount(items, minAmount, maxAmount) {
    return items.filter(item =>
      item.amount >= minAmount && item.amount <= maxAmount
    );
  }

  /**
   * Sort aggregated data
   */
  static sortItems(items, sortBy = 'amount', order = 'desc') {
    const sorted = [...items];
    const factor = order === 'desc' ? -1 : 1;

    sorted.sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return (bVal - aVal) * factor;
    });

    return sorted;
  }

  /**
   * Group aggregated items by size (for pie charts, etc.)
   */
  static groupBySize(items, buckets = 5) {
    if (items.length === 0) return [];

    const sorted = this.sortItems(items, 'amount', 'desc');
    const groups = [];

    let bucketsUsed = 0;
    let otherItems = [];

    sorted.forEach(item => {
      if (bucketsUsed < buckets) {
        groups.push(item);
        bucketsUsed++;
      } else {
        otherItems.push(item);
      }
    });

    // Combine others
    if (otherItems.length > 0) {
      const otherTotal = otherItems.reduce((sum, item) => sum + item.amount, 0);
      groups.push({
        label: `Other (${otherItems.length} items)`,
        amount: otherTotal,
        litres: otherItems.reduce((sum, item) => sum + item.litres, 0),
        cash: otherItems.reduce((sum, item) => sum + item.cash, 0),
        online: otherItems.reduce((sum, item) => sum + item.online, 0),
        credit: otherItems.reduce((sum, item) => sum + item.credit, 0),
        count: otherItems.length,
        percentage: 0 // Will be recalculated
      });
    }

    return groups;
  }
}

module.exports = AggregationService;
