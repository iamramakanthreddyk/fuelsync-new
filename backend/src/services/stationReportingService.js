/**
 * Station Reporting Service
 * 
 * Business logic for station reporting and settlement operations.
 * Responsibilities:
 * - Daily sales aggregation and breakdown by fuel type
 * - Settlement preparation (categorizing readings)
 * - Variance analysis between sales and readings
 * - Complex aggregation queries
 */

const { NozzleReading, Pump, Nozzle, Station, User, DailyTransaction, sequelize } = require('./modelAccess');
const { Op, fn, col, literal } = require('sequelize');
const { logAudit } = require('../utils/auditLog');
const { createContextLogger } = require('./loggerService');

const logger = createContextLogger('StationReportingService');

// ===== CONSTANTS =====
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };

/**
 * Get daily sales summary for a station
 * 
 * Returns aggregated sales data for a specific date:
 * - Total sales volume and value
 * - Breakdown by fuel type
 * - Nozzle-level details
 * - Multiple settlement categories
 * 
 * Data returned:
 * - date: The date being reported on
 * - totalVolume: Total litres sold
 * - totalValue: Total ₹ value
 * - byFuelType: Breakdown [{ fuelType, volume, value }]
 * - nozzleDetails: Per-nozzle contribution
 * - settlementCategories: Readings by settlement status
 * 
 * @param {string} stationId - Station ID
 * @param {string} date - Date in YYYY-MM-DD format (or Date object)
 * @returns {Promise<Object>} Daily sales aggregate
 */
async function getDailySales(stationId, date) {
  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  // Parse date to YYYY-MM-DD string for DATEONLY column
  const queryDateStr = typeof date === 'string' ? date.split('T')[0] : new Date(date).toISOString().split('T')[0];

  // Fetch readings for the day
  const readings = await NozzleReading.findAll({
    where: {
      stationId,
      readingDate: queryDateStr,
      ...EXCLUDE_SAMPLE_READINGS
    },
    include: [
      {
        model: Nozzle,
        as: 'nozzle',
        attributes: ['id', 'fuelType', 'nozzleNumber'],
        include: [
          {
            model: Pump,
            as: 'pump',
            attributes: ['id', 'pumpNumber', 'name']
          }
        ]
      }
    ],
    raw: false,
    subQuery: false
  });

  if (readings.length === 0) {
    logger.debug('No readings found for station on date', { stationId, date: queryDateStr });
    return {
      stationId,
      date: queryDateStr,
      totalVolume: 0,
      totalValue: 0,
      byFuelType: [],
      nozzleDetails: [],
      settlementCategories: {
        settled: { count: 0, readings: [] },
        pending: { count: 0, readings: [] }
      }
    };
  }

  // Aggregate by fuel type
  const fuelTypeMap = {};
  const nozzleDetailsMap = {};
  let totalVolume = 0;
  let totalValue = 0;

  readings.forEach(reading => {
    const fuelType = reading.nozzle?.fuelType || 'unknown';
    const volume = parseFloat(reading.litresSold) || 0;
    const value = parseFloat(reading.totalAmount) || 0;

    totalVolume += volume;
    totalValue += value;

    // Aggregate by fuel type
    if (!fuelTypeMap[fuelType]) {
      fuelTypeMap[fuelType] = { fuelType, volume: 0, value: 0, count: 0 };
    }
    fuelTypeMap[fuelType].volume += volume;
    fuelTypeMap[fuelType].value += value;
    fuelTypeMap[fuelType].count += 1;

    // Track nozzle-level details
    const nozzleId = reading.nozzle?.id;
    if (nozzleId && !nozzleDetailsMap[nozzleId]) {
      nozzleDetailsMap[nozzleId] = {
        nozzleId,
        pumpNumber: reading.nozzle?.pump?.pumpNumber,
        nozzleNumber: reading.nozzle?.nozzleNumber,
        fuelType,
        volume: 0,
        value: 0,
        count: 0
      };
    }
    if (nozzleId) {
      nozzleDetailsMap[nozzleId].volume += volume;
      nozzleDetailsMap[nozzleId].value += value;
      nozzleDetailsMap[nozzleId].count += 1;
    }
  });

  // Categorize by settlement status
  const settled = readings.filter(r => r.settlementId);
  const pending = readings.filter(r => !r.settlementId);

  logger.info('Daily sales calculated', { 
    stationId, 
    date: queryDateStr,
    totalReadings: readings.length,
    settled: settled.length,
    pending: pending.length 
  });

  return {
    stationId,
    date: queryDateStr,
    totalVolume: parseFloat(totalVolume.toFixed(2)),
    totalValue: parseFloat(totalValue.toFixed(2)),
    byFuelType: Object.values(fuelTypeMap).map(ft => ({
      ...ft,
      volume: parseFloat(ft.volume.toFixed(2)),
      value: parseFloat(ft.value.toFixed(2))
    })),
    nozzleDetails: Object.values(nozzleDetailsMap).map(nd => ({
      ...nd,
      volume: parseFloat(nd.volume.toFixed(2)),
      value: parseFloat(nd.value.toFixed(2))
    })),
    settlementCategories: {
      settled: {
        count: settled.length,
        volume: parseFloat(settled.reduce((sum, r) => sum + (parseFloat(r.litresSold) || 0), 0).toFixed(2)),
        value: parseFloat(settled.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0).toFixed(2))
      },
      pending: {
        count: pending.length,
        volume: parseFloat(pending.reduce((sum, r) => sum + (parseFloat(r.litresSold) || 0), 0).toFixed(2)),
        value: parseFloat(pending.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0).toFixed(2))
      }
    }
  };
}

/**
 * Get readings for settlement processing
 * 
 * Categorizes readings into:
 * - Linked: Already associated with a settlement (settled)
 * - Unlinked: Ready to be settled (pending settlement)
 * - Excludes sample readings
 * 
 * Used during settlement initiation to identify which readings
 * should be included in the settlement batch.
 * 
 * @param {string} stationId - Station ID
 * @param {Object} options - Query options
 * @param {string} options.status - 'linked', 'unlinked', or undefined (all)
 * @param {number} options.limit - Max records to return
 * @returns {Promise<Object>} Categorized readings
 */
async function getReadingsForSettlement(stationId, dateOrOptions = {}) {
  // Support both date string (new) and options object (legacy) as second argument
  let date, status, limit;
  if (typeof dateOrOptions === 'string') {
    date = dateOrOptions;
    status = undefined;
    limit = 1000;
  } else {
    date = dateOrOptions.date;
    status = dateOrOptions.status;
    limit = dateOrOptions.limit || 1000;
  }

  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  // Build where clause
  const whereClause = {
    stationId,
    ...EXCLUDE_SAMPLE_READINGS
  };

  // Filter by date
  if (date) {
    const dateStr = typeof date === 'string' ? date.split('T')[0] : new Date(date).toISOString().split('T')[0];
    whereClause.readingDate = dateStr;
  }

  if (status === 'linked') {
    whereClause.settlementId = { [Op.ne]: null };
  } else if (status === 'unlinked') {
    whereClause.settlementId = null;
  }

  // Fetch readings with all associations needed by the settlement UI
  const readings = await NozzleReading.findAll({
    where: whereClause,
    include: [
      {
        model: Nozzle,
        as: 'nozzle',
        attributes: ['id', 'fuelType', 'nozzleNumber'],
        include: [
          {
            model: Pump,
            as: 'pump',
            attributes: ['pumpNumber']
          }
        ]
      },
      {
        model: User,
        as: 'enteredByUser',
        attributes: ['id', 'name']
      },
      {
        model: User,
        as: 'assignedEmployee',
        attributes: ['id', 'name'],
        required: false
      },
      {
        model: DailyTransaction,
        as: 'transaction',
        attributes: ['id', 'transactionDate', 'status', 'createdBy', 'paymentBreakdown', 'paymentSubBreakdown'],
        required: false
      }
    ],
    order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
    limit,
    raw: false
  });

  if (readings.length === 0) {
    logger.debug('No readings found for settlement', { stationId, date, status });
    return {
      stationId,
      date,
      unlinked: { count: 0, readings: [], totals: { cash: 0, online: 0, credit: 0, litres: 0, value: 0 } },
      linked: { count: 0, readings: [] },
      allReadingsCount: 0
    };
  }

  // Categorize
  const linked = readings.filter(r => r.settlementId);
  const unlinked = readings.filter(r => !r.settlementId);

  const formatReading = r => ({
    id: r.id,
    stationId: r.stationId,
    nozzleId: r.nozzle?.id,
    pumpNumber: r.nozzle?.pump?.pumpNumber,
    nozzleNumber: r.nozzle?.nozzleNumber,
    fuelType: r.nozzle?.fuelType,
    openingReading: parseFloat(r.previousReading) || 0,
    closingReading: parseFloat(r.readingValue) || 0,
    litresSold: parseFloat(r.litresSold) || 0,
    saleValue: parseFloat(r.totalAmount) || 0,
    cashAmount: parseFloat(r.cashAmount) || 0,
    onlineAmount: parseFloat(r.onlineAmount) || 0,
    creditAmount: parseFloat(r.creditAmount) || 0,
    readingDate: r.readingDate,
    recordedAt: r.createdAt,
    assignedEmployeeId: r.assignedEmployeeId || null,
    assignedEmployee: r.assignedEmployee ? { id: r.assignedEmployee.id, name: r.assignedEmployee.name } : null,
    recordedBy: r.enteredByUser ? { id: r.enteredByUser.id, name: r.enteredByUser.name } : null,
    settlementId: r.settlementId || null,
    linkedSettlement: null,
    transaction: r.transaction ? {
      id: r.transaction.id,
      transactionDate: r.transaction.transactionDate,
      status: r.transaction.status,
      createdBy: r.transaction.createdBy,
      paymentBreakdown: r.transaction.paymentBreakdown || { cash: 0, online: 0, credit: 0 },
      paymentSubBreakdown: r.transaction.paymentSubBreakdown || null
    } : null
  });

  const formattedUnlinked = unlinked.map(formatReading);
  const formattedLinked = linked.map(formatReading);

  // Compute totals for unlinked readings
  const unlinkedTotals = formattedUnlinked.reduce(
    (acc, r) => {
      if (r.transaction?.paymentBreakdown) {
        acc.cash += r.transaction.paymentBreakdown.cash || 0;
        acc.online += r.transaction.paymentBreakdown.online || 0;
        acc.credit += r.transaction.paymentBreakdown.credit || 0;
      } else {
        acc.cash += r.cashAmount;
        acc.online += r.onlineAmount;
        acc.credit += r.creditAmount;
      }
      acc.litres += r.litresSold;
      acc.value += r.saleValue;
      return acc;
    },
    { cash: 0, online: 0, credit: 0, litres: 0, value: 0 }
  );

  logger.info('Readings prepared for settlement', { 
    stationId,
    date,
    total: readings.length,
    linked: linked.length,
    unlinked: unlinked.length
  });

  return {
    stationId,
    date,
    unlinked: {
      count: unlinked.length,
      readings: formattedUnlinked,
      totals: unlinkedTotals
    },
    linked: {
      count: linked.length,
      readings: formattedLinked
    },
    allReadingsCount: readings.length
  };
}

/**
 * Get variance summary: Sales vs Settlements
 * 
 * Compares:
 * - Total sales recorded by nozzles
 * - Total settled amounts
 * - Variance (difference)
 * - Variance percentage
 * 
 * Used for variance analysis and reconciliation.
 * 
 * @param {string} stationId - Station ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Variance analysis
 */
async function getVarianceSummary(stationId, startDate, endDate) {
  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Fetch readings in date range
  const readings = await NozzleReading.findAll({
    where: {
      stationId,
      readingDate: { [Op.between]: [start, end] },
      ...EXCLUDE_SAMPLE_READINGS
    },
    raw: true
  });

  // Calculate totals
  const totalSalesVolume = readings.reduce((sum, r) => sum + (r.volume || 0), 0);
  const totalSalesValue = readings.reduce((sum, r) => sum + (r.value || 0), 0);

  // Calculate settled amounts
  const settledReadings = readings.filter(r => r.settlementId);
  const totalSettledVolume = settledReadings.reduce((sum, r) => sum + (r.volume || 0), 0);
  const totalSettledValue = settledReadings.reduce((sum, r) => sum + (r.value || 0), 0);

  // Calculate variance
  const volumeVariance = totalSalesVolume - totalSettledVolume;
  const valueVariance = totalSalesValue - totalSettledValue;
  const volumeVariancePercent = totalSalesVolume > 0 ? ((volumeVariance / totalSalesVolume) * 100).toFixed(2) : 0;
  const valueVariancePercent = totalSalesValue > 0 ? ((valueVariance / totalSalesValue) * 100).toFixed(2) : 0;

  logger.info('Variance calculated', { 
    stationId, 
    period: `${startDate} to ${endDate}`,
    salesVolume: totalSalesVolume,
    settledVolume: totalSettledVolume,
    varianceVolume: volumeVariance
  });

  return {
    stationId,
    period: { start: startDate, end: endDate },
    sales: {
      volume: parseFloat(totalSalesVolume.toFixed(2)),
      value: parseFloat(totalSalesValue.toFixed(2)),
      readingCount: readings.length
    },
    settled: {
      volume: parseFloat(totalSettledVolume.toFixed(2)),
      value: parseFloat(totalSettledValue.toFixed(2)),
      readingCount: settledReadings.length
    },
    variance: {
      volume: parseFloat(volumeVariance.toFixed(2)),
      value: parseFloat(valueVariance.toFixed(2)),
      volumePercent: parseFloat(volumeVariancePercent),
      valuePercent: parseFloat(valueVariancePercent)
    }
  };
}

module.exports = {
  getDailySales,
  getReadingsForSettlement,
  getVarianceSummary
};
