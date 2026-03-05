/**
 * Dashboard Repository
 * Data access layer with optimized queries
 */

const { NozzleReading, Nozzle, Pump, Station, FuelPrice, User, Creditor, CreditTransaction, Expense, CostOfGoods, Shift, DailyTransaction, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');

const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };

/**
 * Get station filter based on user role
 */
async function getStationFilter(user, requestedStationId = null) {
  if (user.role === 'super_admin') {
    return requestedStationId ? { stationId: requestedStationId } : {};
  }
  
  if (user.role === 'owner') {
    const ownerStations = await Station.findAll({ 
      where: { ownerId: user.id },
      attributes: ['id']
    });
    const stationIds = ownerStations.map(s => s.id);
    if (stationIds.length === 0) return null;
    
    if (requestedStationId) {
      if (!stationIds.includes(requestedStationId)) return null;
      return { stationId: requestedStationId };
    }
    
    return { stationId: { [Op.in]: stationIds } };
  }
  
  return user.stationId ? { stationId: user.stationId } : null;
}

/**
 * Get today's readings (exclude sample readings, include only sales)
 */
async function getTodayReadings(stationFilter) {
  return NozzleReading.findAll({
    where: { 
      ...stationFilter, 
      ...EXCLUDE_SAMPLE_READINGS,
      readingDate: new Date().toISOString().split('T')[0],
      [Op.or]: [
        { isInitialReading: false },
        { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
      ]
    },
    attributes: ['id', 'litresSold', 'pricePerLitre', 'totalAmount'],
    raw: true
  });
}

/**
 * Get credit summary for station
 */
async function getCreditSummary(stationFilter) {
  return Creditor.findOne({
    where: { ...stationFilter, isActive: true },
    attributes: [[fn('SUM', col('current_balance')), 'totalOutstanding']],
    raw: true
  });
}

/**
 * Get all pumps with nozzles for a station
 */
async function getPumpsWithNozzles(stationFilter, userRole) {
  let pumpWhere = {};
  if (stationFilter && stationFilter.stationId) {
    pumpWhere.stationId = stationFilter.stationId;
  }

  return Pump.findAll({
    where: userRole === 'super_admin' ? {} : pumpWhere,
    attributes: ['id', 'name', 'pumpNumber', 'status'],
    include: [{ model: Nozzle, as: 'nozzles', attributes: ['id', 'nozzleNumber', 'fuelType', 'status'] }],
    order: [['pumpNumber', 'ASC']]
  });
}

/**
 * Get readings for date range with nozzle and pump info
 */
async function getReadingsWithNozzleInfo(stationFilter, startDate, endDate, pumpId = null) {
  const whereClause = {
    ...stationFilter,
    ...EXCLUDE_SAMPLE_READINGS,
    readingDate: { [Op.between]: [startDate, endDate] },
    [Op.or]: [
      { isInitialReading: false },
      { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
    ]
  };

  if (pumpId) whereClause.pumpId = pumpId;

  return NozzleReading.findAll({
    where: whereClause,
    include: [{
      model: Nozzle, as: 'nozzle', attributes: ['id', 'nozzleNumber', 'fuelType'],
      include: [{ model: Pump, as: 'pump', attributes: ['id', 'name', 'pumpNumber'] }]
    }],
    attributes: ['id', 'litresSold', 'totalAmount', 'transactionId'],
    raw: false
  });
}

/**
 * Get daily readings for date range
 */
async function getDailyReadings(stationFilter, startDate, endDate) {
  return NozzleReading.findAll({
    where: {
      ...stationFilter,
      ...EXCLUDE_SAMPLE_READINGS,
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    attributes: ['readingDate', 'litresSold', 'totalAmount', 'transactionId'],
    raw: true
  });
}

/**
 * Get fuel type breakdown
 */
async function getFuelTypeReadings(stationFilter, startDate, endDate) {
  return NozzleReading.findAll({
    where: {
      ...stationFilter,
      ...EXCLUDE_SAMPLE_READINGS,
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    include: [{
      model: Nozzle, as: 'nozzle', attributes: ['fuelType'],
      required: true
    }],
    attributes: ['id', 'litresSold', 'totalAmount', 'transactionId'],
    raw: false
  });
}

/**
 * Get pump performance data (raw SQL optimized)
 */
async function getPumpPerformanceData(stationIds, startDate, endDate) {
  return sequelize.query(`
    SELECT 
      nr."id",
      nr."pump_id",
      nr."nozzle_id",
      nr."litres_sold",
      nr."price_per_litre",
      nr."cash_amount",
      nr."online_amount",
      nr."credit_amount",
      p."name" as "pump_name",
      p."pump_number",
      n."nozzle_number",
      n."fuel_type",
      s."name" as "station_name"
    FROM "nozzle_readings" nr
    INNER JOIN "pumps" p ON nr."pump_id" = p."id"
    INNER JOIN "nozzles" n ON nr."nozzle_id" = n."id"
    INNER JOIN "stations" s ON nr."station_id" = s."id"
    WHERE nr."station_id" IN (:stationIds)
      AND (nr."is_initial_reading" = false 
           OR (nr."is_initial_reading" = true AND nr."litres_sold" > 0))
      AND nr."reading_date" BETWEEN :startDate AND :endDate
    ORDER BY p."pump_number", n."nozzle_number"
  `, {
    replacements: { stationIds, startDate, endDate },
    type: sequelize.QueryTypes.SELECT
  });
}

/**
 * Get financial data for period
 */
async function getFinancialData(stationFilter, startDate, endDate) {
  const sales = await NozzleReading.findOne({
    where: { 
      ...stationFilter, 
      ...EXCLUDE_SAMPLE_READINGS,
      readingDate: { [Op.between]: [startDate, endDate] },
      [Op.or]: [
        { isInitialReading: false },
        { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
      ]
    },
    attributes: [
      [fn('SUM', col('total_amount')), 'sales'],
      [fn('SUM', col('cash_amount')), 'cash'],
      [fn('SUM', col('online_amount')), 'online'],
      [fn('SUM', col('credit_amount')), 'credit']
    ],
    raw: true
  });

  const settlements = await CreditTransaction.sum('amount', {
    where: { ...stationFilter, transactionType: 'settlement', transactionDate: { [Op.between]: [startDate, endDate] } }
  }) || 0;

  const expenses = await Expense.sum('amount', {
    where: { ...stationFilter, expenseMonth: startDate.substring(0, 7) }
  }) || 0;

  const costOfGoods = await CostOfGoods.sum('totalCost', {
    where: { ...stationFilter, month: startDate.substring(0, 7) }
  }) || 0;

  const outstanding = await Creditor.sum('currentBalance', {
    where: { ...stationFilter, isActive: true }
  }) || 0;

  return { sales, settlements, expenses, costOfGoods, outstanding };
}

/**
 * Get all accessible stations for owner
 */
async function getOwnerStations(ownerId) {
  return Station.findAll({
    where: { ownerId },
    include: [
      {
        model: Pump,
        as: 'pumps',
        attributes: ['id', 'status']
      }
    ]
  });
}

/**
 * Get employee count across stations
 */
async function getEmployeeCount(stationIds) {
  return User.count({
    where: {
      stationId: { [Op.in]: stationIds },
      role: { [Op.in]: ['manager', 'employee'] }
    }
  });
}

/**
 * Get period sales data (current and previous)
 */
async function getPeriodSalesData(stationIds, startDate, endDate, prevStartDate, prevEndDate) {
  // Use findAll with group: null to get aggregate without GROUP BY
  const [currentData] = await NozzleReading.findAll({
    attributes: [
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
      [fn('SUM', col('litres_sold')), 'totalQuantity'],
      [fn('COUNT', col('id')), 'totalTransactions']
    ],
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    group: null,  // Ensures aggregate across all rows, not grouped
    raw: true,
    subQuery: false
  });

  const [previousData] = await NozzleReading.findAll({
    attributes: [
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
      [fn('SUM', col('litres_sold')), 'totalQuantity'],
      [fn('COUNT', col('id')), 'totalTransactions']
    ],
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [prevStartDate, prevEndDate] }
    },
    group: null,  // Ensures aggregate across all rows, not grouped
    raw: true,
    subQuery: false
  });

  // Ensure we have objects even if no rows match
  const current = currentData || { totalSales: 0, totalQuantity: 0, totalTransactions: 0 };
  const previous = previousData || { totalSales: 0, totalQuantity: 0, totalTransactions: 0 };

  return { current, previous };
}

/**
 * Get sales by station for period
 */
async function getSalesByStation(stationIds, startDate, endDate) {
  return NozzleReading.findAll({
    attributes: [
      'stationId',
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'sales']
    ],
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    group: ['stationId'],
    raw: true
  });
}

/**
 * Get sales by fuel type with quantity
 */
async function getSalesByFuelType(stationIds, startDate, endDate) {
  return NozzleReading.findAll({
    attributes: [
      [sequelize.col('nozzle.fuel_type'), 'fuelType'],
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'sales'],
      [fn('SUM', col('litres_sold')), 'quantity']
    ],
    include: [{
      model: Nozzle,
      as: 'nozzle',
      attributes: []
    }],
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    group: ['nozzle.fuel_type'],
    raw: true
  });
}

/**
 * Get daily trend data (sales and quantity)
 */
async function getDailyTrendData(stationIds, startDate, endDate) {
  return NozzleReading.findAll({
    attributes: [
      [fn('DATE', col('reading_date')), 'date'],
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'sales'],
      [fn('SUM', col('litres_sold')), 'quantity']
    ],
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    group: ['date'],
    order: [[fn('DATE', col('reading_date')), 'ASC']],
    raw: true
  });
}

/**
 * Get employee performance for shift period
 */
async function getEmployeePerformance(stationIds, startDate, endDate) {
  return Shift.findAll({
    attributes: [
      [col('employee.id'), 'employeeId'],
      [col('employee.name'), 'employeeName'],
      [fn('COUNT', col('Shift.id')), 'shifts'],
      [fn('SUM', col('Shift.total_sales_amount')), 'totalSales']
    ],
    include: [{
      model: User,
      as: 'employee',
      attributes: []
    }],
    where: {
      stationId: { [Op.in]: stationIds },
      startTime: {
        [Op.between]: [
          new Date(startDate + 'T00:00:00'),
          new Date(endDate + 'T23:59:59')
        ]
      },
      status: 'ended'
    },
    group: ['employeeId'],
    raw: true
  });
}

/**
 * Get creditors with outstanding balances
 */
async function getActiveCreditors(stationFilter) {
  return Creditor.findAll({
    where: { ...stationFilter, isActive: true },
    attributes: ['id', 'name', 'currentBalance', 'creditPeriodDays', 'lastTransactionDate'],
    raw: true
  });
}

module.exports = {
  getStationFilter,
  getTodayReadings,
  getCreditSummary,
  getPumpsWithNozzles,
  getReadingsWithNozzleInfo,
  getDailyReadings,
  getFuelTypeReadings,
  getPumpPerformanceData,
  getFinancialData,
  getOwnerStations,
  getEmployeeCount,
  getPeriodSalesData,
  getSalesByStation,
  getSalesByFuelType,
  getDailyTrendData,
  getEmployeePerformance,
  getActiveCreditors,
  EXCLUDE_SAMPLE_READINGS
};
