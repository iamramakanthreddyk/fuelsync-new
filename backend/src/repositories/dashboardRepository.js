/**
 * Dashboard Repository
 * Data access layer for dashboard analytics queries
 */

const { NozzleReading, Nozzle, Pump, Station, User, DailyTransaction, Expense, CostOfGoods, CreditTransaction, Creditor, Settlement } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

// Exclude sample readings from all aggregate queries
const EXCLUDE_SAMPLES = { isSample: { [Op.ne]: true } };

/**
 * Build a station ID filter clause based on user role
 * Returns { stationId: { [Op.in]: [...] } } or { stationId: id } or null (no stations)
 *
 * @param {Object} user - Authenticated user
 * @param {string} [requestedStationId] - Specific station from query params
 * @returns {Promise<Object|null>}
 */
async function getStationFilter(user, requestedStationId) {
  if (user.role === 'super_admin') {
    if (requestedStationId) return { stationId: requestedStationId };
    return {}; // No filter = all stations
  }

  if (user.role === 'owner') {
    const ownedStations = await Station.findAll({
      where: { ownerId: user.id },
      attributes: ['id']
    });
    const ids = ownedStations.map(s => s.id);
    if (ids.length === 0) return null;

    if (requestedStationId) {
      if (!ids.includes(requestedStationId)) return null;
      return { stationId: requestedStationId };
    }
    return { stationId: { [Op.in]: ids } };
  }

  // Station-level roles (manager, attendant, etc.)
  const stationId = user.stationId;
  if (!stationId) return null;
  if (requestedStationId && requestedStationId !== stationId) return null;
  return { stationId };
}

/**
 * Get all readings for today matching a station filter
 */
async function getTodayReadings(stationFilter) {
  const today = new Date().toISOString().split('T')[0];
  return NozzleReading.findAll({
    where: { ...stationFilter, ...EXCLUDE_SAMPLES, readingDate: today },
    attributes: ['id', 'litresSold', 'totalAmount', 'transactionId', 'readingDate'],
    raw: true
  });
}

/**
 * Get readings for a date range
 */
async function getDailyReadings(stationFilter, startDate, endDate) {
  return NozzleReading.findAll({
    where: {
      ...stationFilter,
      ...EXCLUDE_SAMPLES,
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    attributes: ['id', 'readingDate', 'litresSold', 'totalAmount', 'transactionId'],
    raw: true
  });
}

/**
 * Get credit summary (total outstanding credits)
 */
async function getCreditSummary(stationFilter) {
  const outstanding = await CreditTransaction.sum('amount', {
    where: { ...stationFilter, status: 'pending' }
  });
  return { totalOutstanding: parseFloat(outstanding || 0) };
}

/**
 * Get pumps with nozzles for station filter
 */
async function getPumpsWithNozzles(stationFilter, userRole) {
  const where = {};
  if (stationFilter.stationId) {
    where.stationId = stationFilter.stationId;
  }

  const pumps = await Pump.findAll({
    where,
    include: [{
      model: Nozzle,
      as: 'nozzles',
      attributes: ['id', 'name', 'fuelType', 'status', 'nozzleNumber']
    }],
    attributes: ['id', 'name', 'pumpNumber', 'stationId', 'status'],
    order: [['pumpNumber', 'ASC']]
  });

  return pumps.map(p => p.toJSON());
}

/**
 * Get readings with nozzle info for nozzle breakdown
 */
async function getReadingsWithNozzleInfo(stationFilter, startDate, endDate, pumpId) {
  const where = {
    ...stationFilter,
    ...EXCLUDE_SAMPLES,
    readingDate: { [Op.between]: [startDate, endDate] }
  };
  if (pumpId) where.pumpId = pumpId;

  const readings = await NozzleReading.findAll({
    where,
    include: [{
      model: Nozzle,
      as: 'nozzle',
      attributes: ['id', 'nozzleNumber', 'fuelType'],
      include: [{ model: Pump, as: 'pump', attributes: ['id', 'name', 'pumpNumber'] }]
    }],
    attributes: ['id', 'litresSold', 'totalAmount', 'transactionId', 'nozzleId']
  });

  return readings.map(r => r.toJSON());
}

/**
 * Get readings grouped by fuel type
 */
async function getFuelTypeReadings(stationFilter, startDate, endDate) {
  const readings = await NozzleReading.findAll({
    where: {
      ...stationFilter,
      ...EXCLUDE_SAMPLES,
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    include: [{
      model: Nozzle,
      as: 'nozzle',
      attributes: ['id', 'fuelType']
    }],
    attributes: ['id', 'litresSold', 'totalAmount', 'transactionId']
  });
  return readings.map(r => r.toJSON());
}

/**
 * Get pump performance data (raw query for efficiency)
 */
async function getPumpPerformanceData(stationIds, startDate, endDate) {
  const where = {
    ...EXCLUDE_SAMPLES,
    readingDate: { [Op.between]: [startDate, endDate] },
    stationId: { [Op.in]: stationIds }
  };

  const readings = await NozzleReading.findAll({
    where,
    include: [
      {
        model: Nozzle,
        as: 'nozzle',
        attributes: ['id', 'nozzleNumber', 'fuelType'],
        include: [{
          model: Pump,
          as: 'pump',
          attributes: ['id', 'name', 'pumpNumber'],
          include: [{ model: Station, as: 'station', attributes: ['id', 'name'] }]
        }]
      }
    ],
    attributes: ['id', 'litresSold', 'pricePerLitre', 'totalAmount', 'nozzleId', 'pumpId', 'stationId'],
    raw: false
  });

  // Flatten to expected format
  return readings.map(r => {
    const j = r.toJSON();
    return {
      nozzle_id: j.nozzleId,
      nozzle_number: j.nozzle?.nozzleNumber,
      fuel_type: j.nozzle?.fuelType,
      pump_id: j.pumpId,
      pump_name: j.nozzle?.pump?.name,
      pump_number: j.nozzle?.pump?.pumpNumber,
      station_name: j.nozzle?.pump?.station?.name,
      litres_sold: j.litresSold,
      price_per_litre: j.pricePerLitre,
      total_amount: j.totalAmount
    };
  });
}

/**
 * Get financial overview data for a station filter and date range
 * Returns { sales, settlements, expenses, costOfGoods, outstanding }
 */
async function getFinancialData(stationFilter, startDate, endDate) {
  const where = {
    ...stationFilter,
    ...EXCLUDE_SAMPLES,
    readingDate: { [Op.between]: [startDate, endDate] }
  };

  const txnWhere = { ...stationFilter, transactionDate: { [Op.between]: [startDate, endDate] } };
  const expWhere = { ...stationFilter, expenseDate: { [Op.between]: [startDate, endDate] } };
  const cogWhere = { ...stationFilter, date: { [Op.between]: [startDate, endDate] } };
  const settWhere = { ...stationFilter, settlementDate: { [Op.between]: [startDate, endDate] } };

  const [readingTotals, transactions, expenses, costOfGoods, settlements, outstandingAmt] = await Promise.all([
    NozzleReading.findOne({
      where,
      attributes: [
        [fn('SUM', col('total_amount')), 'sales']
      ],
      raw: true
    }),
    DailyTransaction.findAll({
      where: txnWhere,
      attributes: ['paymentBreakdown'],
      raw: true
    }),
    Expense.sum('amount', { where: expWhere }),
    CostOfGoods.sum('amount', { where: cogWhere }),
    Settlement.sum('expectedAmount', { where: settWhere }),
    CreditTransaction.sum('amount', { where: { status: 'pending', ...stationFilter } })
  ]);

  // Aggregate payment breakdown from transactions
  let cash = 0, online = 0, credit = 0;
  transactions.forEach(t => {
    const pb = t.paymentBreakdown || {};
    cash += parseFloat(pb.cash || 0);
    online += parseFloat(pb.online || 0);
    credit += parseFloat(pb.credit || 0);
  });

  return {
    sales: {
      sales: parseFloat(readingTotals?.sales || 0),
      cash,
      online,
      credit
    },
    settlements: parseFloat(settlements || 0),
    expenses: parseFloat(expenses || 0),
    costOfGoods: parseFloat(costOfGoods || 0),
    outstanding: parseFloat(outstandingAmt || 0)
  };
}

/**
 * Get stations owned by a user
 */
async function getOwnerStations(ownerId) {
  const stations = await Station.findAll({
    where: { ownerId },
    attributes: ['id', 'name', 'code', 'isActive']
  });
  return stations.map(s => s.toJSON());
}

/**
 * Get count of employees for a set of stations
 */
async function getEmployeeCount(stationIds) {
  return User.count({
    where: {
      stationId: { [Op.in]: stationIds },
      role: { [Op.in]: ['manager', 'attendant'] },
      isActive: true
    }
  });
}

/**
 * Get aggregated sales for a period (current + optional comparison period)
 * @returns {{ current: { totalSales, totalQuantity, totalTransactions }, previous: {...} }}
 */
async function getPeriodSalesData(stationIds, currentStart, currentEnd, prevStart, prevEnd) {
  const baseWhere = { stationId: { [Op.in]: stationIds }, ...EXCLUDE_SAMPLES };

  const [currentRows, prevRows] = await Promise.all([
    NozzleReading.findOne({
      where: { ...baseWhere, readingDate: { [Op.between]: [currentStart, currentEnd] } },
      attributes: [
        [fn('SUM', col('total_amount')), 'totalSales'],
        [fn('SUM', col('litres_sold')), 'totalQuantity'],
        [fn('COUNT', col('id')), 'totalTransactions']
      ],
      raw: true
    }),
    prevStart && prevEnd ? NozzleReading.findOne({
      where: { ...baseWhere, readingDate: { [Op.between]: [prevStart, prevEnd] } },
      attributes: [
        [fn('SUM', col('total_amount')), 'totalSales'],
        [fn('SUM', col('litres_sold')), 'totalQuantity'],
        [fn('COUNT', col('id')), 'totalTransactions']
      ],
      raw: true
    }) : Promise.resolve(null)
  ]);

  return {
    current: {
      totalSales: parseFloat(currentRows?.totalSales || 0),
      totalQuantity: parseFloat(currentRows?.totalQuantity || 0),
      totalTransactions: parseInt(currentRows?.totalTransactions || 0, 10)
    },
    previous: prevRows ? {
      totalSales: parseFloat(prevRows?.totalSales || 0),
      totalQuantity: parseFloat(prevRows?.totalQuantity || 0),
      totalTransactions: parseInt(prevRows?.totalTransactions || 0, 10)
    } : null
  };
}

/**
 * Get sales grouped by station for owner analytics
 */
async function getSalesByStation(stationIds, startDate, endDate) {
  const rows = await NozzleReading.findAll({
    where: {
      stationId: { [Op.in]: stationIds },
      ...EXCLUDE_SAMPLES,
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    attributes: [
      'stationId',
      [fn('SUM', col('total_amount')), 'sales']
    ],
    group: ['station_id'],
    raw: true
  });
  return rows.map(r => ({ stationId: r.stationId || r.station_id, sales: r.sales }));
}

/**
 * Get sales grouped by fuel type for owner analytics
 */
async function getSalesByFuelType(stationIds, startDate, endDate) {
  const rows = await NozzleReading.findAll({
    where: {
      stationId: { [Op.in]: stationIds },
      ...EXCLUDE_SAMPLES,
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    attributes: [
      'fuelType',
      [fn('SUM', col('total_amount')), 'sales'],
      [fn('SUM', col('litres_sold')), 'quantity']
    ],
    group: ['fuel_type'],
    raw: true
  });
  return rows.map(r => ({ fuelType: r.fuelType || r.fuel_type, sales: r.sales, quantity: r.quantity }));
}

/**
 * Get daily sales trend for owner analytics
 */
async function getDailyTrendData(stationIds, startDate, endDate) {
  const rows = await NozzleReading.findAll({
    where: {
      stationId: { [Op.in]: stationIds },
      ...EXCLUDE_SAMPLES,
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    attributes: [
      'readingDate',
      [fn('SUM', col('total_amount')), 'sales'],
      [fn('SUM', col('litres_sold')), 'quantity']
    ],
    group: ['reading_date'],
    order: [['reading_date', 'ASC']],
    raw: true
  });
  return rows.map(r => ({
    date: r.readingDate || r.reading_date,
    sales: r.sales,
    quantity: r.quantity
  }));
}

module.exports = {
  getStationFilter,
  getTodayReadings,
  getDailyReadings,
  getCreditSummary,
  getPumpsWithNozzles,
  getReadingsWithNozzleInfo,
  getFuelTypeReadings,
  getPumpPerformanceData,
  getFinancialData,
  getOwnerStations,
  getEmployeeCount,
  getPeriodSalesData,
  getSalesByStation,
  getSalesByFuelType,
  getDailyTrendData
};
