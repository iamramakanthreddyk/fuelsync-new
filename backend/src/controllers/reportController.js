/**
 * Report Controller
 * Generate comprehensive reports for owners and managers
 */

// ===== MODELS & DATABASE =====
const { NozzleReading, Nozzle, Pump, Station, User, Shift, FuelPrice, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');

// ===== ERROR & RESPONSE HANDLING =====
const { asyncHandler, NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');

// Filter to exclude sample readings from all reports
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };

/**
 * Helper to get station filter based on user role
 */
const getStationFilter = async (user, requestedStationId = null) => {
  if (user.role === 'super_admin') {
    return requestedStationId ? { id: requestedStationId } : {};
  }
  
  if (user.role === 'owner') {
    const baseFilter = { ownerId: user.id };
    if (requestedStationId) {
      baseFilter.id = requestedStationId;
    }
    return baseFilter;
  }
  
  // Manager/Employee - only their assigned station
  if (user.stationId) {
    return { id: user.stationId };
  }
  
  return null;
};

/**
 * Get sales reports
 * GET /api/v1/reports/sales
 */
exports.getSalesReports = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, stationId } = req.query;
  const user = await User.findByPk(req.userId);
  
  if (!startDate || !endDate) {
    return sendError(res, 'MISSING_PARAMS', 'Start date and end date are required', 400);
  }

  const stationFilter = await getStationFilter(user, stationId);
  if (stationFilter === null) {
    return sendSuccess(res, []);
  }

  const stations = await Station.findAll({
    where: stationFilter,
    attributes: ['id', 'name', 'code']
  });

  if (stations.length === 0) {
    return sendSuccess(res, []);
  }

  const stationIds = stations.map(s => s.id);
  const salesData = await NozzleReading.findAll({
    attributes: [
      [fn('DATE', col('reading_date')), 'date'],
      'stationId',
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
      [fn('SUM', col('NozzleReading.litres_sold')), 'totalQuantity'],
      [fn('COUNT', col('NozzleReading.id')), 'totalTransactions']
    ],
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    group: ['date', 'stationId'],
    raw: true
  });

  const fuelBreakdown = await NozzleReading.findAll({
    attributes: [
      [fn('DATE', col('reading_date')), 'date'],
      'stationId',
      'fuelType',
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'sales'],
      [fn('SUM', col('NozzleReading.litres_sold')), 'quantity'],
      [fn('COUNT', col('NozzleReading.id')), 'transactions']
    ],
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    group: ['date', 'stationId', 'fuelType'],
    raw: true
  });

  const reports = [];
  const stationMap = new Map(stations.map(s => [s.id, s]));
  const fuelPriceMap = new Map();
  const fuelAverageCostPriceMap = new Map();
  
  for (const stationId of stationIds) {
    const fuelTypes = [...new Set(fuelBreakdown.filter(f => f.stationId === stationId).map(f => f.fuelType))];
    for (const fuelType of fuelTypes) {
      const prices = await FuelPrice.findAll({
        where: {
          stationId,
          fuelType,
          effectiveFrom: { [Op.lte]: endDate }
        },
        order: [['effectiveFrom', 'DESC']],
        raw: true
      });
      
      const dateMap = {};
      const costPrices = [];
      
      for (const price of prices) {
        const costPrice = parseFloat(price.costPrice || 0);
        dateMap[price.effectiveFrom] = { price: parseFloat(price.price || 0), costPrice };
        if (costPrice > 0) {
          costPrices.push(costPrice);
        }
      }
      
      fuelPriceMap.set(`${stationId}-${fuelType}`, dateMap);
      if (costPrices.length > 0) {
        const avgCostPrice = costPrices.reduce((sum, p) => sum + p, 0) / costPrices.length;
        fuelAverageCostPriceMap.set(`${stationId}-${fuelType}`, avgCostPrice);
      }
    }
  }

  salesData.forEach(sale => {
    const station = stationMap.get(sale.stationId);
    if (!station) return;

    const fuelSales = fuelBreakdown
      .filter(f => f.date === sale.date && f.stationId === sale.stationId)
      .map(f => {
        const priceMap = fuelPriceMap.get(`${f.stationId}-${f.fuelType}`) || {};
        let costPrice = 0;
        
        const effectiveDates = Object.keys(priceMap).sort().reverse();
        for (const effectiveDate of effectiveDates) {
          if (effectiveDate <= f.date) {
            costPrice = priceMap[effectiveDate].costPrice;
            break;
          }
        }
        
        const quantity = parseFloat(f.quantity || 0);
        const saleValue = parseFloat(f.sales || 0);
        
        if (costPrice === 0 && quantity > 0) {
          const avgCostPrice = fuelAverageCostPriceMap.get(`${f.stationId}-${f.fuelType}`);
          if (avgCostPrice && avgCostPrice > 0) {
            costPrice = avgCostPrice;
          } else if (saleValue > 0) {
            const pricePerLitre = saleValue / quantity;
            costPrice = pricePerLitre * 0.98;
          }
        }
        
        const cogs = quantity * costPrice;
        
        return {
          fuelType: f.fuelType,
          sales: saleValue,
          quantity: quantity,
          transactions: parseInt(f.transactions || 0),
          costPrice: costPrice,
          cogs: cogs
        };
      });

    reports.push({
      stationId: sale.stationId,
      stationName: station.name,
      date: sale.date,
      totalSales: parseFloat(sale.totalSales || 0),
      totalQuantity: parseFloat(sale.totalQuantity || 0),
      totalTransactions: parseInt(sale.totalTransactions || 0),
      fuelTypeSales: fuelSales
    });
  });

  return sendSuccess(res, reports);
});

/**
 * Get shift reports
 * GET /api/v1/reports/shifts
 */
exports.getShiftReports = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, stationId } = req.query;
  const user = await User.findByPk(req.userId);
  
  if (!startDate || !endDate) {
    return sendError(res, 'MISSING_PARAMS', 'Start date and end date are required', 400);
  }

  const stationFilter = await getStationFilter(user, stationId);
  if (stationFilter === null) {
    return sendSuccess(res, []);
  }

  const stations = await Station.findAll({
    where: stationFilter,
    attributes: ['id', 'name']
  });

  if (stations.length === 0) {
    return sendSuccess(res, []);
  }

  const stationIds = stations.map(s => s.id);

  const shifts = await Shift.findAll({
    where: {
      stationId: { [Op.in]: stationIds },
      startTime: {
        [Op.between]: [
          new Date(startDate + 'T00:00:00'),
          new Date(endDate + 'T23:59:59')
        ]
      }
    },
    include: [
      {
        model: Station,
        as: 'station',
        attributes: ['name']
      },
      {
        model: User,
        as: 'employee',
        attributes: ['name']
      }
    ],
    order: [['startTime', 'DESC']]
  });

  const reports = shifts.map(shift => ({
    id: shift.id,
    stationName: shift.station?.name,
    employeeName: shift.employee?.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    openingCash: parseFloat(shift.openingCash || 0),
    closingCash: parseFloat(shift.closingCash || 0),
    totalSales: parseFloat(shift.totalSales || 0),
    cashSales: parseFloat(shift.cashSales || 0),
    digitalSales: parseFloat(shift.digitalSales || 0),
    status: shift.status
  }));

  return sendSuccess(res, reports);
});

/**
 * Get pump performance reports
 * GET /api/v1/reports/pumps
 */
exports.getPumpPerformance = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, stationId } = req.query;
  const user = await User.findByPk(req.userId);
  
  if (!startDate || !endDate) {
    return sendError(res, 'MISSING_PARAMS', 'Start date and end date are required', 400);
  }

  const stationFilter = await getStationFilter(user, stationId);
  
  if (stationFilter === null) {
    return sendSuccess(res, []);
  }

  const stations = await Station.findAll({
    where: stationFilter,
    attributes: ['id', 'name']
  });
  
  if (stations.length === 0) {
    return sendSuccess(res, []);
  }

  const stationIds = stations.map(s => s.id);

  const pumpsForStations = await Pump.findAll({
    where: { stationId: { [Op.in]: stationIds } },
    attributes: ['id']
  });
  const pumpIds = pumpsForStations.map(p => p.id);
  
  if (pumpIds.length === 0) {
    return sendSuccess(res, []);
  }

  const pumpData = await NozzleReading.findAll({
    attributes: [
      [col('pump.id'), 'pumpId'],
      [col('pump.name'), 'pumpName'],
      [col('pump.pump_number'), 'pumpNumber'],
      [fn('MAX', col('pump->station.name')), 'stationName'],
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
      [fn('SUM', col('litres_sold')), 'totalQuantity'],
      [fn('COUNT', col('NozzleReading.id')), 'transactions']
    ],
    include: [{
      model: Pump,
      as: 'pump',
      attributes: [],
      required: false,
      include: [{
        model: Station,
        as: 'station',
        attributes: [],
        required: false
      }]
    }],
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      pumpId: { [Op.in]: pumpIds },
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    group: ['pump.id', 'pump.name', 'pump.pump_number'],
    raw: true
  });

  const nozzleData = await NozzleReading.findAll({
    attributes: [
      [col('pump.id'), 'pumpId'],
      [col('nozzle.id'), 'nozzleId'],
      [col('nozzle.nozzle_number'), 'nozzleNumber'],
      [col('nozzle.fuel_type'), 'fuelType'],
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'sales'],
      [fn('SUM', col('litres_sold')), 'quantity']
    ],
    include: [{
      model: Pump,
      as: 'pump',
      attributes: [],
      required: false
    }, {
      model: Nozzle,
      as: 'nozzle',
      attributes: [],
      required: false
    }],
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      pumpId: { [Op.in]: pumpIds },
      readingDate: { [Op.between]: [startDate, endDate] },
      [Op.or]: [
        { litresSold: { [Op.gt]: 0 } },
        { isInitialReading: true }
      ]
    },
    group: ['pump.id', 'nozzle.id', 'nozzle.nozzle_number', 'nozzle.fuel_type'],
    raw: true
  });

  const allPumps = await Pump.findAll({
    where: { stationId: { [Op.in]: stationIds } },
    include: [{
      model: Station,
      as: 'station',
      attributes: ['name']
    }, {
      model: Nozzle,
      as: 'nozzles',
      attributes: ['id', 'nozzleNumber', 'fuelType']
    }],
    order: [['pumpNumber', 'ASC']]
  });

  const reports = allPumps.map(pump => {
    const pumpReport = pumpData.find(p => p.pumpId === pump.id);
    const nozzles = pump.nozzles.map(nozzle => {
      const nozzleReport = nozzleData.find(n => n.nozzleId === nozzle.id);
      return {
        nozzleId: nozzle.id,
        nozzleNumber: nozzle.nozzleNumber,
        fuelType: nozzle.fuelType,
        sales: nozzleReport ? parseFloat(nozzleReport.sales || 0) : 0,
        quantity: nozzleReport ? parseFloat(nozzleReport.quantity || 0) : 0
      };
    });

    return {
      pumpId: pump.id,
      pumpName: pump.name,
      pumpNumber: pump.pumpNumber,
      stationName: pump.station.name,
      totalSales: pumpReport ? parseFloat(pumpReport.totalSales || 0) : 0,
      totalQuantity: pumpReport ? parseFloat(pumpReport.totalQuantity || 0) : 0,
      transactions: pumpReport ? parseInt(pumpReport.transactions || 0) : 0,
      nozzles
    };
  });

  return sendSuccess(res, reports);
});

/**
 * Get daily sales report for today (or specified date)
 * GET /api/v1/reports/daily-sales?date=YYYY-MM-DD
 */
exports.getDailySalesReport = asyncHandler(async (req, res, next) => {
  const { date, stationId } = req.query;
  const user = await User.findByPk(req.userId);

  const queryDate = date || new Date().toISOString().split('T')[0];
  const stationFilter = await getStationFilter(user, stationId);

  if (stationFilter === null) {
    return sendSuccess(res, []);
  }

  const stations = await Station.findAll({
    where: stationFilter,
    attributes: ['id', 'name', 'code']
  });

  if (stations.length === 0) {
    return sendSuccess(res, []);
  }

  const stationIds = stations.map(s => s.id);
  const readings = await NozzleReading.findAll({
    attributes: [
      'stationId',
      'fuelType',
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalValue'],
      [fn('SUM', col('NozzleReading.litres_sold')), 'totalLiters'],
      [fn('COUNT', col('NozzleReading.id')), 'readingsCount']
    ],
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      stationId: { [Op.in]: stationIds },
      readingDate: queryDate
    },
    group: ['stationId', 'fuelType'],
    raw: true
  });

  const { Settlement } = require('../models');
  const settlements = await Settlement.findAll({
    where: {
      stationId: { [Op.in]: stationIds },
      date: queryDate,
      isFinal: true
    },
    raw: true
  });

  const stationMap = new Map(stations.map(s => [s.id, s]));
  const reportData = {};

  readings.forEach(reading => {
    const stationId = reading.stationId;
    if (!reportData[stationId]) {
      const station = stationMap.get(stationId);
      reportData[stationId] = {
        stationId,
        stationName: station.name,
        date: queryDate,
        totalSaleValue: 0,
        totalLiters: 0,
        readingsCount: 0,
        byFuelType: {},
        settledCash: null,
        settledOnline: null,
        settledCredit: null,
        settlementStatus: null
      };
    }

    const value = parseFloat(reading.totalValue || 0);
    const liters = parseFloat(reading.totalLiters || 0);
    const count = parseInt(reading.readingsCount || 0);

    reportData[stationId].totalSaleValue += value;
    reportData[stationId].totalLiters += liters;
    reportData[stationId].readingsCount += count;
    reportData[stationId].byFuelType[reading.fuelType] = {
      value,
      liters,
      count
    };
  });

  settlements.forEach(settlement => {
    const stationId = settlement.stationId;
    if (reportData[stationId]) {
      reportData[stationId].settledCash = parseFloat(settlement.actualCash || 0);
      reportData[stationId].settledOnline = parseFloat(settlement.online || 0);
      reportData[stationId].settledCredit = parseFloat(settlement.credit || 0);
      reportData[stationId].settlementStatus = settlement.status;
    }
  });

  const result = Object.values(reportData).map(report => ({
    ...report,
    totalSaleValue: parseFloat(report.totalSaleValue.toFixed(2)),
    totalLiters: parseFloat(report.totalLiters.toFixed(2))
  }));

  return sendSuccess(res, result);
});
/**
 * Get sample/test readings report
 * GET /api/v1/reports/sample-readings
 */
exports.getSampleReadingsReport = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, stationId } = req.query;
  const user = await User.findByPk(req.userId);
  
  if (!startDate || !endDate) {
    return sendError(res, 'MISSING_PARAMS', 'Start date and end date are required', 400);
  }

  const stationFilter = await getStationFilter(user, stationId);
  if (stationFilter === null) {
    throw new AuthorizationError('Not authorized to view reports');
  }

  const stations = await Station.findAll({
    where: stationFilter,
    attributes: ['id', 'name', 'code']
  });

  if (stations.length === 0) {
    return sendSuccess(res, []);
  }

  const stationIds = stations.map(s => s.id);
  const sampleReadings = await NozzleReading.findAll({
    where: {
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [startDate, endDate] },
      isSample: true
    },
    include: [{
      model: Nozzle,
      as: 'nozzle',
      attributes: ['id', 'nozzleNumber', 'fuelType'],
      include: [{
        model: Pump,
        as: 'pump',
        attributes: ['id', 'pumpNumber', 'name']
      }]
    }, {
      model: User,
      as: 'enteredByUser',
      attributes: ['id', 'name', 'email']
    }],
    order: [['readingDate', 'DESC']],
    raw: false
  });

  const result = sampleReadings.map(r => ({
    id: r.id,
    date: r.readingDate,
    stationId: r.stationId,
    pump: { number: r.nozzle?.pump?.pumpNumber, name: r.nozzle?.pump?.name },
    nozzle: { number: r.nozzle?.nozzleNumber, fuelType: r.nozzle?.fuelType },
    litres: parseFloat(r.litresSold || 0),
    value: parseFloat(r.totalAmount || 0),
    enteredBy: r.enteredByUser?.name,
    createdAt: r.createdAt
  }));

  return sendSuccess(res, {
    summary: {
      totalSampleReadings: sampleReadings.length,
      stationsIncluded: stations.map(s => ({ id: s.id, name: s.name, code: s.code }))
    },
    details: result
  });
});

/**
 * Get sample reading statistics and frequency
 * GET /api/v1/reports/sample-statistics
 */
exports.getSampleStatistics = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, stationId } = req.query;
  const user = await User.findByPk(req.userId);
  
  if (!startDate || !endDate) {
    return sendError(res, 'MISSING_PARAMS', 'Start date and end date are required', 400);
  }

  const stationFilter = await getStationFilter(user, stationId);
  if (stationFilter === null) {
    throw new AuthorizationError('Not authorized to view statistics');
  }

  const stations = await Station.findAll({
    where: stationFilter,
    attributes: ['id', 'name', 'code']
  });

  if (stations.length === 0) {
    return sendSuccess(res, { summary: {}, details: [] });
  }

  const stationIds = stations.map(s => s.id);

  const stats = await NozzleReading.findAll({
    attributes: [
      'readingDate',
      [fn('COUNT', col('id')), 'sampleCount'],
      [fn('SUM', col('litres_sold')), 'totalLitres'],
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalValue']
    ],
    where: {
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [startDate, endDate] },
      isSample: true
    },
    group: ['readingDate'],
    order: [['readingDate', 'DESC']],
    raw: true
  });

  const nozzleFrequency = await NozzleReading.findAll({
    attributes: [
      'nozzleId',
      'stationId',
      [fn('COUNT', col('NozzleReading.id')), 'sampleCount'],
      [fn('MAX', col('NozzleReading.created_at')), 'lastSampleDate']
    ],
    include: [{
      model: Nozzle,
      as: 'nozzle',
      attributes: ['id', 'nozzleNumber', 'fuelType'],
      include: [{
        model: Pump,
        as: 'pump',
        attributes: ['id', 'pumpNumber', 'name']
      }]
    }],
    where: {
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [startDate, endDate] },
      isSample: true
    },
    group: ['NozzleReading.nozzle_id', 'NozzleReading.station_id', 'nozzle.id', 'nozzle->pump.id'],
    order: [[fn('COUNT', col('NozzleReading.id')), 'DESC']],
    raw: false
  });

  const userFrequency = await NozzleReading.findAll({
    attributes: [
      'enteredBy',
      [fn('COUNT', col('NozzleReading.id')), 'sampleCount'],
      [fn('MAX', col('NozzleReading.created_at')), 'lastSampleDate']
    ],
    include: [{
      model: User,
      as: 'enteredByUser',
      attributes: ['id', 'name', 'email', 'role']
    }],
    where: {
      stationId: { [Op.in]: stationIds },
      readingDate: { [Op.between]: [startDate, endDate] },
      isSample: true
    },
    group: ['enteredBy', 'enteredByUser.id'],
    order: [[fn('COUNT', col('NozzleReading.id')), 'DESC']],
    raw: false
  });

  const totalSamples = stats.reduce((sum, s) => sum + (parseInt(s.sampleCount) || 0), 0);
  const avgSamplesPerDay = stats.length > 0 ? (totalSamples / stats.length).toFixed(2) : 0;
  const daysWithSamples = stats.length;
  const totalDays = Math.floor((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

  return sendSuccess(res, {
    summary: {
      dateRange: { startDate, endDate },
      totalDays,
      daysWithSamples,
      totalSampleReadings: totalSamples,
      avgSamplesPerDay,
      testingCoverage: `${((daysWithSamples / totalDays) * 100).toFixed(1)}%`,
      stationsIncluded: stations.length
    },
    dailyStats: stats.map(s => ({
      date: s.readingDate,
      sampleCount: parseInt(s.sampleCount),
      totalLitres: parseFloat(s.totalLitres || 0),
      totalValue: parseFloat(s.totalValue || 0)
    })),
    nozzleFrequency: nozzleFrequency.map(n => ({
      nozzleId: n.nozzleId,
      nozzleNumber: n.nozzle?.nozzleNumber,
      fuelType: n.nozzle?.fuelType,
      pumpNumber: n.nozzle?.pump?.pumpNumber,
      pumpName: n.nozzle?.pump?.name,
      sampleCount: parseInt(n.dataValues.sampleCount),
      lastSampleDate: n.dataValues.lastSampleDate
    })),
    userFrequency: userFrequency.map(u => ({
      userId: u.enteredBy,
      userName: u.enteredByUser?.name,
      userEmail: u.enteredByUser?.email,
      userRole: u.enteredByUser?.role,
      sampleCount: parseInt(u.dataValues.sampleCount),
      lastSampleDate: u.dataValues.lastSampleDate
    }))
  });
});

/**
 * Export sales data to CSV
 * GET /api/v1/reports/sales/export
 */
exports.exportSalesCSV = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, stationId } = req.query;
  const user = await User.findByPk(req.userId);

  if (!startDate || !endDate) {
    return sendError(res, 'MISSING_PARAMS', 'Start date and end date are required', 400);
  }

  if (req.exportLimits && !req.exportLimits.allowed) {
    return sendError(res, 'QUOTA_EXCEEDED', 'Export quota exceeded for this month', 403, {
      quota: req.exportLimits.quota,
      upgradeMessage: 'Upgrade your plan to increase export limits'
    });
  }

  const stationFilter = await getStationFilter(user, stationId);
  const maxRows = req.exportLimits?.maxRows || 10000;
  
  const readings = await NozzleReading.findAll({
    where: {
      ...EXCLUDE_SAMPLE_READINGS,
      readingDate: { [Op.between]: [startDate, endDate] },
      ...stationFilter
    },
    include: [{
      model: Nozzle,
      as: 'nozzle',
      include: [{
        model: Pump,
        as: 'pump',
        include: [{
          model: Station,
          as: 'station'
        }]
      }]
    }],
    order: [['readingDate', 'ASC'], ['createdAt', 'ASC']],
    limit: maxRows
  });

  const csvData = readings.map(reading => ({
    Date: reading.readingDate,
    Station: reading.nozzle?.pump?.station?.name || 'Unknown',
    Pump: reading.nozzle?.pump?.pumpNumber || 'Unknown',
    Nozzle: reading.nozzle?.nozzleNumber || 'Unknown',
    'Fuel Type': reading.nozzle?.fuelType || 'Unknown',
    'Litres Sold': reading.litresSold || 0,
    'Total Amount': reading.totalAmount || 0,
    'Cash Amount': reading.cashAmount || 0,
    'Online Amount': reading.onlineAmount || 0,
    'Manual Entry': reading.isManualEntry ? 'Yes' : 'No',
    'Entered By': reading.enteredByUser?.name || 'Unknown',
    'Created At': reading.createdAt
  }));

  const { Parser } = require('json2csv');
  const fields = Object.keys(csvData[0] || {});
  const parser = new Parser({ fields });
  let csv = parser.parse(csvData);

  if (req.exportLimits?.watermark) {
    csv += `\n\n--- FUELSYNC LIMITED EXPORT ---\nUpgrade to remove this limitation.\nVisit: https://fuelsync.com/upgrade\n---`;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="fuelsync-sales-${startDate}-to-${endDate}.csv"`);
  return res.send(csv);
});