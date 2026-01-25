/**
 * Dashboard Controller
 * Comprehensive analytics including sales, credits, expenses
 */

const { NozzleReading, Nozzle, Pump, Station, FuelPrice, User, Creditor, CreditTransaction, Expense, CostOfGoods, Shift } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../models');
const { FUEL_TYPE_LABELS } = require('../config/constants');

// Filter to exclude sample readings from all analytics queries
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };

/**
 * Helper to get station filter based on user role
 * Handles owners who access stations via Station.ownerId (not User.stationId)
 */
const getStationFilter = async (user, requestedStationId = null) => {
  if (user.role === 'super_admin') {
    return requestedStationId ? { stationId: requestedStationId } : {};
  }
  
  if (user.role === 'owner') {
    // Owner accesses stations they own via Station.ownerId
    const ownerStations = await Station.findAll({ 
      where: { ownerId: user.id },
      attributes: ['id']
    });
    const stationIds = ownerStations.map(s => s.id);
    if (stationIds.length === 0) return null;
    
    // If specific station requested, verify user has access
    if (requestedStationId) {
      if (!stationIds.includes(requestedStationId)) {
        return null; // User doesn't have access to this station
      }
      return { stationId: requestedStationId };
    }
    
    return { stationId: { [Op.in]: stationIds } };
  }
  
  // Manager/Employee access their assigned station
  return user.stationId ? { stationId: user.stationId } : null;
};

/**
 * Get today's dashboard summary
 * GET /api/v1/dashboard/summary
 */
exports.getSummary = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    const today = new Date().toISOString().split('T')[0];
    const { stationId } = req.query;
    
    // Get base station filter
    const baseStationFilter = await getStationFilter(user);
    if (baseStationFilter === null) {
      return res.json({
        success: true,
        data: { today: { litres: 0, amount: 0, cash: 0, online: 0, credit: 0, readings: 0 }, pumps: [] }
      });
    }
    
    // Apply stationId filter if provided
    let stationFilter = baseStationFilter;
    if (stationId) {
      // Verify user has access to this station
      if (user.role === 'owner') {
        const ownerStations = await Station.findAll({ where: { ownerId: user.id }, attributes: ['id'] });
        const ownerStationIds = ownerStations.map(s => s.id);
        if (!ownerStationIds.includes(stationId)) {
          return res.status(403).json({ success: false, error: 'Not authorized' });
        }
      } else if (user.role !== 'super_admin' && user.stationId !== stationId) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }
      stationFilter = { stationId: stationId };
    }

    // Today's sales totals (include initial readings that represent sales)
    const todayReadings = await NozzleReading.findAll({
      where: { 
        ...stationFilter, 
        ...EXCLUDE_SAMPLE_READINGS,
        readingDate: today,
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: ['id', 'litresSold', 'pricePerLitre', 'totalAmount'],
      raw: true
    });

    // Calculate sales totals from readings
    let totalLitres = 0;
    let totalAmount = 0;
    
    for (const reading of todayReadings) {
      totalLitres += parseFloat(reading.litresSold || 0);
      totalAmount += parseFloat(reading.totalAmount || 0);
    }

    // Aggregate payment breakdown from DailyTransaction (more efficient)
    const { DailyTransaction } = require('../models');
    const allTransactions = await DailyTransaction.findAll({
      where: { 
        ...stationFilter, 
        transactionDate: today
      },
      attributes: ['paymentBreakdown'],
      raw: true
    });

    // Sum payment breakdown from all transactions
    let totalCash = 0;
    let totalOnline = 0;
    let totalCredit = 0;
    
    for (const txn of allTransactions) {
      if (txn.paymentBreakdown && typeof txn.paymentBreakdown === 'object') {
        totalCash += parseFloat(txn.paymentBreakdown.cash || 0);
        totalOnline += parseFloat(txn.paymentBreakdown.online || 0);
        totalCredit += parseFloat(txn.paymentBreakdown.credit || 0);
      }
    }

    const todayStats = {
      totalLitres,
      totalAmount,
      totalCash,
      totalOnline,
      totalCredit,
      readingCount: todayReadings.length
    };

    // Today's credit summary
    const creditStats = await Creditor.findOne({
      where: { ...stationFilter, isActive: true },
      attributes: [[fn('SUM', col('current_balance')), 'totalOutstanding']],
      raw: true
    });

    // Per-pump breakdown (include initial readings that represent sales)
    const pumpStats = await NozzleReading.findAll({
      where: { 
        ...stationFilter, 
        ...EXCLUDE_SAMPLE_READINGS,
        readingDate: today,
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      include: [{
        model: Nozzle, as: 'nozzle', attributes: ['fuelType'],
        include: [{ model: Pump, as: 'pump', attributes: ['id', 'name', 'pumpNumber', 'status'] }]
      }],
      attributes: [
        [fn('SUM', col('litres_sold')), 'litres'],
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'amount']
      ],
      group: ['nozzle.pump.id', 'nozzle.pump.name', 'nozzle.pump.pump_number', 'nozzle.pump.status', 'nozzle.id', 'nozzle.fuel_type'],
      raw: true, nest: true
    });

    // All pumps (use same stationFilter as readings/credits)
    let pumpWhere = {};
    if (stationFilter && stationFilter.stationId) {
      pumpWhere.stationId = stationFilter.stationId;
    }
    const allPumps = await Pump.findAll({
      where: user.role === 'super_admin' ? {} : pumpWhere,
      attributes: ['id', 'name', 'pumpNumber', 'status'],
      include: [{ model: Nozzle, as: 'nozzles', attributes: ['id', 'nozzleNumber', 'fuelType', 'status'] }],
      order: [['pumpNumber', 'ASC']]
    });

    const pumpSummary = allPumps.map(pump => {
      const pumpReadings = pumpStats.filter(ps => ps.nozzle?.pump?.id === pump.id);
      const litres = pumpReadings.reduce((sum, r) => sum + parseFloat(r.litres || 0), 0);
      const amount = pumpReadings.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
      
      return {
        id: pump.id, name: pump.name, number: pump.pumpNumber, status: pump.status,
        nozzleCount: pump.nozzles?.length || 0,
        activeNozzles: pump.nozzles?.filter(n => n.status === 'active').length || 0,
        today: { litres: Math.round(litres * 100) / 100, amount: Math.round(amount * 100) / 100 }
      };
    });

    res.json({
      success: true,
      data: {
        date: today,
        today: {
          litres: parseFloat(todayStats?.totalLitres || 0),
          amount: parseFloat(todayStats?.totalAmount || 0),
          cash: parseFloat(todayStats?.totalCash || 0),
          online: parseFloat(todayStats?.totalOnline || 0),
          credit: parseFloat(todayStats?.totalCredit || 0),
          readings: parseInt(todayStats?.readingCount || 0)
        },
        creditOutstanding: parseFloat(creditStats?.totalOutstanding || 0),
        pumps: pumpSummary
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    next(error);
  }
};

/**
 * Get nozzle-wise breakdown (for owner)
 * GET /api/v1/dashboard/nozzle-breakdown
 */
exports.getNozzleBreakdown = async (req, res, next) => {
  try {
    const { startDate, endDate, pumpId, start_date, end_date, pump_id, stationId } = req.query;
    const user = await User.findByPk(req.userId);
    
    const today = new Date().toISOString().split('T')[0];
    const start = startDate || start_date || today;
    const end = endDate || end_date || today;
    const effectivePumpId = pumpId || pump_id;

    const stationFilter = await getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: { nozzles: [] } });
    }

    const whereClause = {
      ...stationFilter,
      ...EXCLUDE_SAMPLE_READINGS,
      readingDate: { [Op.between]: [start, end] },
      [Op.or]: [
        { isInitialReading: false },
        { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
      ]
    };
    if (effectivePumpId) whereClause.pumpId = effectivePumpId;

    // Fetch readings with nozzle and transaction data
    const readings = await NozzleReading.findAll({
      where: whereClause,
      include: [{
        model: Nozzle, as: 'nozzle', attributes: ['id', 'nozzleNumber', 'fuelType'],
        include: [{ model: Pump, as: 'pump', attributes: ['id', 'name', 'pumpNumber'] }]
      }],
      attributes: ['id', 'litresSold', 'totalAmount', 'transactionId'],
      raw: false
    });

    // Group by nozzle and calculate payment totals from transactions
    const { DailyTransaction } = require('../models');
    const nozzleMap = {};

    for (const reading of readings) {
      const nozzleId = reading.nozzle.id;
      if (!nozzleMap[nozzleId]) {
        nozzleMap[nozzleId] = {
          nozzle: reading.nozzle,
          litres: 0,
          amount: 0,
          cash: 0,
          online: 0,
          credit: 0,
          readings: 0
        };
      }

      nozzleMap[nozzleId].litres += parseFloat(reading.litresSold || 0);
      nozzleMap[nozzleId].amount += parseFloat(reading.totalAmount || 0);
      nozzleMap[nozzleId].readings += 1;

      // Fetch payment breakdown from DailyTransaction if transactionId exists
      if (reading.transactionId) {
        const transaction = await DailyTransaction.findByPk(reading.transactionId, {
          attributes: ['paymentBreakdown'],
          raw: true
        });
        if (transaction && transaction.paymentBreakdown) {
          nozzleMap[nozzleId].cash += parseFloat(transaction.paymentBreakdown.cash || 0);
          nozzleMap[nozzleId].online += parseFloat(transaction.paymentBreakdown.online || 0);
          nozzleMap[nozzleId].credit += parseFloat(transaction.paymentBreakdown.credit || 0);
        }
      }
    }

    const nozzleStats = Object.values(nozzleMap);

    res.json({
      success: true,
      data: {
        startDate: start, endDate: end,
        nozzles: nozzleStats.map(n => ({
          nozzleId: n.nozzle?.id,
          nozzleNumber: n.nozzle?.nozzleNumber,
          fuelType: n.nozzle?.fuelType,
          fuelLabel: FUEL_TYPE_LABELS[n.nozzle?.fuelType] || n.nozzle?.fuelType,
          pump: { id: n.nozzle?.pump?.id, name: n.nozzle?.pump?.name, number: n.nozzle?.pump?.pumpNumber },
          litres: parseFloat(n.litres.toFixed(2)),
          amount: parseFloat(n.amount.toFixed(2)),
          cash: parseFloat(n.cash.toFixed(2)),
          online: parseFloat(n.online.toFixed(2)),
          credit: parseFloat(n.credit.toFixed(2)),
          readings: n.readings
        }))
      }
    });
  } catch (error) {
    console.error('Nozzle breakdown error:', error);
    next(error);
  }
};

/**
 * Get daily summary for a date range
 * GET /api/v1/dashboard/daily
 */
exports.getDailySummary = async (req, res, next) => {
  try {
    const { startDate, endDate, start_date, end_date, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    const effectiveStartDate = startDate || start_date;
    const effectiveEndDate = endDate || end_date;

    if (!effectiveStartDate || !effectiveEndDate) {
      return res.status(400).json({ success: false, error: 'startDate and endDate are required' });
    }

    const stationFilter = await getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: [] });
    }

    // Fetch readings for the date range
    const readings = await NozzleReading.findAll({
      where: { 
        ...stationFilter, 
        ...EXCLUDE_SAMPLE_READINGS,
        readingDate: { [Op.between]: [effectiveStartDate, effectiveEndDate] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: ['readingDate', 'litresSold', 'totalAmount', 'transactionId'],
      raw: true
    });

    // Group by date and calculate payment totals from transactions
    const { DailyTransaction } = require('../models');
    const dateMap = {};

    for (const reading of readings) {
      const date = reading.readingDate;
      if (!dateMap[date]) {
        dateMap[date] = {
          litres: 0,
          amount: 0,
          cash: 0,
          online: 0,
          credit: 0,
          readings: 0
        };
      }

      dateMap[date].litres += parseFloat(reading.litresSold || 0);
      dateMap[date].amount += parseFloat(reading.totalAmount || 0);
      dateMap[date].readings += 1;

      // Fetch payment breakdown from DailyTransaction if transactionId exists
      if (reading.transactionId) {
        const transaction = await DailyTransaction.findByPk(reading.transactionId, {
          attributes: ['paymentBreakdown'],
          raw: true
        });
        if (transaction && transaction.paymentBreakdown) {
          dateMap[date].cash += parseFloat(transaction.paymentBreakdown.cash || 0);
          dateMap[date].online += parseFloat(transaction.paymentBreakdown.online || 0);
          dateMap[date].credit += parseFloat(transaction.paymentBreakdown.credit || 0);
        }
      }
    }

    const dailyStats = Object.keys(dateMap)
      .sort()
      .map(date => ({
        readingDate: date,
        ...dateMap[date]
      }));

    res.json({
      success: true,
      data: dailyStats.map(day => ({
        date: day.readingDate,
        litres: parseFloat(day.litres.toFixed(2)),
        amount: parseFloat(day.amount.toFixed(2)),
        cash: parseFloat(day.cash.toFixed(2)),
        online: parseFloat(day.online.toFixed(2)),
        credit: parseFloat(day.credit.toFixed(2)),
        readings: day.readings
      }))
    });
  } catch (error) {
    console.error('Daily summary error:', error);
    next(error);
  }
};

/**
 * Get fuel type breakdown
 * GET /api/v1/dashboard/fuel-breakdown
 */
exports.getFuelBreakdown = async (req, res, next) => {
  try {
    // Accept both camelCase and snake_case
    const { startDate, endDate, start_date, end_date, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    const today = new Date().toISOString().split('T')[0];
    const start = startDate || start_date || today;
    const end = endDate || end_date || today;

    const stationFilter = await getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: { breakdown: [] } });
    }

    // Use denormalized fuelType field for faster query
    const readings = await NozzleReading.findAll({
      where: { 
        ...stationFilter, 
        ...EXCLUDE_SAMPLE_READINGS,
        readingDate: { [Op.between]: [start, end] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: ['fuelType', 'litresSold', 'totalAmount', 'transactionId'],
      raw: true
    });

    // Group by fuel type and calculate payment totals from transactions
    const { DailyTransaction } = require('../models');
    const fuelMap = {};

    for (const reading of readings) {
      const fuelType = reading.fuelType;
      if (!fuelMap[fuelType]) {
        fuelMap[fuelType] = {
          litres: 0,
          amount: 0,
          cash: 0,
          online: 0,
          credit: 0
        };
      }

      fuelMap[fuelType].litres += parseFloat(reading.litresSold || 0);
      fuelMap[fuelType].amount += parseFloat(reading.totalAmount || 0);

      // Fetch payment breakdown from DailyTransaction if transactionId exists
      if (reading.transactionId) {
        const transaction = await DailyTransaction.findByPk(reading.transactionId, {
          attributes: ['paymentBreakdown'],
          raw: true
        });
        if (transaction && transaction.paymentBreakdown) {
          fuelMap[fuelType].cash += parseFloat(transaction.paymentBreakdown.cash || 0);
          fuelMap[fuelType].online += parseFloat(transaction.paymentBreakdown.online || 0);
          fuelMap[fuelType].credit += parseFloat(transaction.paymentBreakdown.credit || 0);
        }
      }
    }

    const breakdown = Object.keys(fuelMap).map(fuelType => ({
      fuelType,
      ...fuelMap[fuelType]
    }));

    res.json({
      success: true,
      data: {
        startDate: start, endDate: end,
        breakdown: breakdown.map(item => ({
          fuelType: item.fuelType,
          label: FUEL_TYPE_LABELS[item.fuelType] || item.fuelType,
          litres: parseFloat(item.litres.toFixed(2)),
          amount: parseFloat(item.amount.toFixed(2)),
          cash: parseFloat(item.cash.toFixed(2)),
          online: parseFloat(item.online.toFixed(2)),
          credit: parseFloat(item.credit.toFixed(2))
        }))
      }
    });
  } catch (error) {
    console.error('Fuel breakdown error:', error);
    next(error);
  }
};

/**
 * Get pump performance comparison
 * GET /api/v1/dashboard/pump-performance
 */
exports.getPumpPerformance = async (req, res, next) => {
  try {
    // Accept both camelCase and snake_case
    const { startDate, endDate, start_date, end_date, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    const today = new Date().toISOString().split('T')[0];
    const start = startDate || start_date || today;
    const end = endDate || end_date || today;

    const stationFilter = await getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: { pumps: [] } });
    }

    // Get all nozzle readings for the period
    // Extract station IDs from filter (may contain Op.in() operator)
    let stationIds;
    if (stationFilter.stationId) {
      if (stationFilter.stationId[Op.in]) {
        stationIds = stationFilter.stationId[Op.in];
      } else if (Array.isArray(stationFilter.stationId)) {
        stationIds = stationFilter.stationId;
      } else {
        stationIds = [stationFilter.stationId];
      }
    } else {
      // Super admin - get all stations
      const allStations = await Station.findAll({ attributes: ['id'] });
      stationIds = allStations.map(s => s.id);
    }
    
    // Query nozzle readings with pump and station info
    const readings = await sequelize.query(`
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
        AND nr."reading_date" BETWEEN :start AND :end
      ORDER BY p."pump_number", n."nozzle_number"
    `, {
      replacements: { stationIds, start, end },
      type: sequelize.QueryTypes.SELECT
    });

    // Group readings by pump
    const pumpMap = new Map();
    readings.forEach(r => {
      if (!pumpMap.has(r.pump_id)) {
        pumpMap.set(r.pump_id, {
          pumpId: r.pump_id,
          pumpName: r.pump_name,
          pumpNumber: r.pump_number.toString(),
          stationName: r.station_name,
          totalSales: 0,
          totalQuantity: 0,
          transactions: 0,
          nozzles: new Map()
        });
      }
      
      const pump = pumpMap.get(r.pump_id);
      pump.totalSales += r.litres_sold * r.price_per_litre;
      pump.totalQuantity += r.litres_sold;
      pump.transactions += 1;

      // Group nozzles by nozzle_id
      if (!pump.nozzles.has(r.nozzle_id)) {
        pump.nozzles.set(r.nozzle_id, {
          nozzleId: r.nozzle_id,
          nozzleNumber: r.nozzle_number.toString(),
          fuelType: r.fuel_type,
          sales: 0,
          quantity: 0
        });
      }
      
      const nozzle = pump.nozzles.get(r.nozzle_id);
      nozzle.sales += r.litres_sold * r.price_per_litre;
      nozzle.quantity += r.litres_sold;
    });

    // Convert nozzle map to array and format numbers properly
    const pumpPerformance = Array.from(pumpMap.values()).map(pump => {
      const totalSalesNum = Number(pump.totalSales) || 0;
      const totalQuantityNum = Number(pump.totalQuantity) || 0;
      
      return {
        pumpId: pump.pumpId,
        pumpName: pump.pumpName,
        pumpNumber: pump.pumpNumber,
        stationName: pump.stationName,
        totalSales: Math.round(totalSalesNum * 100) / 100,
        totalQuantity: Math.round(totalQuantityNum * 100) / 100,
        transactions: pump.transactions,
        nozzles: Array.from(pump.nozzles.values())
      };
    });

    res.json({
      success: true,
      data: {
        startDate: start, 
        endDate: end,
        pumps: pumpPerformance
      }
    });
  } catch (error) {
    console.error('Pump performance error:', error);
    next(error);
  }
};

/**
 * Get comprehensive financial overview
 * GET /api/v1/dashboard/financial-overview
 */
exports.getFinancialOverview = async (req, res, next) => {
  try {
    const { month, stationId } = req.query;
    const user = await User.findByPk(req.userId);
    
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [year, mon] = targetMonth.split('-');
    const startDate = `${year}-${mon}-01`;
    const endDate = new Date(year, mon, 0).toISOString().split('T')[0];

    const stationFilter = await getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: { month: targetMonth, noData: true } });
    }

    // Sales
    const salesResult = await NozzleReading.findOne({
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

    // Credit settlements
    const settlements = await CreditTransaction.sum('amount', {
      where: { ...stationFilter, transactionType: 'settlement', transactionDate: { [Op.between]: [startDate, endDate] } }
    }) || 0;

    // Expenses
    const expenses = await Expense.sum('amount', {
      where: { ...stationFilter, expenseMonth: targetMonth }
    }) || 0;

    // Cost of goods
    const costOfGoods = await CostOfGoods.sum('totalCost', {
      where: { ...stationFilter, month: targetMonth }
    }) || 0;

    // Outstanding credit
    const outstanding = await Creditor.sum('currentBalance', {
      where: { ...stationFilter, isActive: true }
    }) || 0;

    const sales = parseFloat(salesResult?.sales || 0);
    const cash = parseFloat(salesResult?.cash || 0);
    const online = parseFloat(salesResult?.online || 0);
    const creditSales = parseFloat(salesResult?.credit || 0);
    
    const totalReceived = cash + online + settlements;
    const grossProfit = sales - costOfGoods;
    const netProfit = grossProfit - expenses;

    res.json({
      success: true,
      data: {
        month: targetMonth,
        revenue: {
          totalSales: sales,
          cashReceived: cash,
          onlineReceived: online,
          creditSettlements: settlements,
          totalReceived
        },
        credits: {
          givenThisMonth: creditSales,
          settledThisMonth: settlements,
          totalOutstanding: outstanding
        },
        costs: {
          costOfGoods,
          expenses,
          totalCosts: costOfGoods + expenses
        },
        profit: {
          grossProfit,
          netProfit,
          margin: sales > 0 ? ((netProfit / sales) * 100).toFixed(1) : 0
        },
        notes: costOfGoods === 0 ? 'Enter cost of goods for accurate profit calculation' : null
      }
    });
  } catch (error) {
    console.error('Financial overview error:', error);
    next(error);
  }
};

/**
 * Get missed entries alerts
 * GET /api/v1/dashboard/alerts/missed-entries
 */
exports.getMissedEntriesAlert = async (req, res, next) => {
  try {
    const { stationId, thresholdDays = 1 } = req.query;
    const user = await User.findByPk(req.userId);
    
    // Authorization
    const stationFilter = await getStationFilter(user);
    if (stationFilter === null) {
      return res.json({ success: true, data: { alerts: [] } });
    }
    
    // Get station IDs to check
    let stationIds = [];
    if (stationId) {
      // Verify user has access to this station
      if (user.role === 'owner') {
        const ownerStations = await Station.findAll({ where: { ownerId: user.id }, attributes: ['id'] });
        const ownerStationIds = ownerStations.map(s => s.id);
        if (!ownerStationIds.includes(stationId)) {
          return res.status(403).json({ success: false, error: 'Not authorized' });
        }
      } else if (user.role !== 'super_admin' && user.stationId !== stationId) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }
      stationIds = [stationId];
    } else {
      // Get all accessible stations
      if (user.role === 'super_admin') {
        const allStations = await Station.findAll({ attributes: ['id'] });
        stationIds = allStations.map(s => s.id);
      } else if (user.role === 'owner') {
        const ownerStations = await Station.findAll({ where: { ownerId: user.id }, attributes: ['id'] });
        stationIds = ownerStations.map(s => s.id);
      } else if (user.stationId) {
        stationIds = [user.stationId];
      }
    }
    
    // Get nozzles with gaps for each station
    const alerts = [];
    for (const sid of stationIds) {
      const station = await Station.findByPk(sid, { attributes: ['id', 'name', 'alertOnMissedReadings', 'missedReadingThresholdDays'] });
      
      if (!station || !station.alertOnMissedReadings) continue;
      
      const effectiveThreshold = parseInt(thresholdDays) || station.missedReadingThresholdDays || 1;
      const nozzlesWithGaps = await Nozzle.getNozzlesWithGaps(sid, effectiveThreshold);
      
      if (nozzlesWithGaps.length > 0) {
        alerts.push({
          stationId: sid,
          stationName: station.name,
          alertCount: nozzlesWithGaps.length,
          nozzles: nozzlesWithGaps
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        hasAlerts: alerts.length > 0,
        totalNozzlesWithGaps: alerts.reduce((sum, a) => sum + a.alertCount, 0),
        alerts
      }
    });
  } catch (error) {
    console.error('Missed entries alert error:', error);
    next(error);
  }
};

/**
 * Get pending cash handovers
 * GET /api/v1/dashboard/alerts/pending-handovers
 */
exports.getPendingHandoversAlert = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    
    // Only return owner stats about their stations, employees, and sales
    // ...existing code for station, employee, and sales stats...
  } catch (error) {
    console.error('Pending handovers alert error:', error);
    next(error);
  }
};

/**
 * Get shift status for dashboard
 * GET /api/v1/dashboard/shift-status
 */
exports.getShiftStatus = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    
    // Get active shift for current user
    const activeShift = await Shift.getActiveShift(req.userId);
    
    // For managers, get all active shifts at their station
    let stationActiveShifts = [];
    if (['super_admin', 'owner', 'manager'].includes(user.role) && user.stationId) {
      stationActiveShifts = await Shift.findAll({
        where: {
          stationId: user.stationId,
          status: 'active'
        },
        include: [
          { model: User, as: 'employee', attributes: ['id', 'name'] }
        ]
      });
    }
    
    // Get today's completed shifts for station
    const today = new Date().toISOString().split('T')[0];
    let todayShifts = [];
    if (user.stationId) {
      todayShifts = await Shift.getDailyShifts(user.stationId, today);
    }
    
    res.json({
      success: true,
      data: {
        myActiveShift: activeShift,
        stationActiveShifts: stationActiveShifts.map(s => ({
          id: s.id,
          employeeId: s.employeeId,
          employeeName: s.employee?.name,
          startTime: s.startTime,
          shiftType: s.shiftType
        })),
        todayShiftsCount: todayShifts.length,
        todayCompletedCount: todayShifts.filter(s => s.status === 'ended').length
      }
    });
  } catch (error) {
    console.error('Shift status error:', error);
    next(error);
  }
};

/**
 * Get owner dashboard statistics
 * GET /api/v1/dashboard/owner/stats
 * 
 * Query params (optional):
 * - ownerId: Requested owner ID (ignored for security - always uses authenticated user's ID)
 */
exports.getOwnerStats = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    const { ownerId: requestedOwnerId } = req.query;
    
    console.log('🔍 getOwnerStats - User:', { id: user.id, name: user.name, role: user.role });
    console.log('🔍 getOwnerStats - Query:', { requestedOwnerId });
    
    // Only owners can access this
    if (user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Owner role required.'
      });
    }
    
    // SECURITY: Always use authenticated user's ID, never the query parameter
    // This prevents one owner from viewing another owner's stats
    const ownerId = user.id;
    console.log('🔍 getOwnerStats - Using ownerId:', ownerId);

    // Get all stations owned by this user
    const stations = await Station.findAll({
      where: { ownerId: ownerId },
      include: [
        {
          model: Pump,
          as: 'pumps',
          attributes: ['id', 'status']
        }
      ]
    });

    const stationIds = stations.map(s => s.id);
    const totalStations = stations.length;
    const activeStations = stations.filter(s => s.isActive).length;

    console.log('📍 getOwnerStats - Stations:', { 
      ownerId: user.id, 
      totalStations, 
      activeStations,
      stationIds 
    });

    // Count employees across all owned stations
    const totalEmployees = await User.count({
      where: {
        stationId: { [Op.in]: stationIds },
        role: { [Op.in]: ['manager', 'employee'] }
      }
    });

    // Today's sales across all owned stations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // If no stations, return 0 sales
    if (stationIds.length === 0) {
      return res.json({
        success: true,
        data: {
          totalStations: 0,
          activeStations: 0,
          totalEmployees: 0,
          todaySales: 0,
          monthSales: 0
        }
      });
    }
    
    const todaySalesData = await NozzleReading.findAll({
      attributes: [
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalAmount']
      ],
      include: [{
        model: Nozzle,
        as: 'nozzle',
        attributes: [],
        required: true,
        include: [{
          model: Pump,
          as: 'pump',
          attributes: [],
          required: true,
          where: { stationId: { [Op.in]: stationIds } }
        }]
      }],
      where: {
        ...EXCLUDE_SAMPLE_READINGS,
        readingDate: {
          [Op.gte]: today
        }
      },
      raw: true
    });

    const todaySales = parseFloat(todaySalesData[0]?.totalAmount || 0);

    // Month's sales across all owned stations
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const monthSalesData = await NozzleReading.findAll({
      attributes: [
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalAmount']
      ],
      include: [{
        model: Nozzle,
        as: 'nozzle',
        attributes: [],
        required: true,
        include: [{
          model: Pump,
          as: 'pump',
          attributes: [],
          required: true,
          where: { stationId: { [Op.in]: stationIds } }
        }]
      }],
      where: {
        ...EXCLUDE_SAMPLE_READINGS,
        readingDate: {
          [Op.gte]: monthStart
        }
      },
      raw: true
    });

    const monthSales = parseFloat(monthSalesData[0]?.totalAmount || 0);

    // Count pending actions (pending handovers)
    res.json({
      success: true,
      data: {
        totalStations,
        activeStations,
        totalEmployees,
        todaySales,
        monthSales
      }
    });

  } catch (error) {
    console.error('Owner stats error:', error);
    next(error);
  }
};

/**
 * Get owner analytics with trends and insights
 * GET /api/v1/dashboard/owner/analytics
 */
exports.getOwnerAnalytics = async (req, res, next) => {
  try {
    // Accept both camelCase and snake_case
    const { startDate, endDate, stationId, start_date, end_date, station_id } = req.query;
    const user = await User.findByPk(req.userId);

    const effectiveStartDate = startDate || start_date;
    const effectiveEndDate = endDate || end_date;
    const effectiveStationId = stationId || station_id;

    if (!effectiveStartDate || !effectiveEndDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    // Get owner's stations
    const stationFilter = { ownerId: user.id };
    if (effectiveStationId && effectiveStationId !== 'all') {
      stationFilter.id = effectiveStationId;
    }

    const stations = await Station.findAll({
      where: stationFilter,
      attributes: ['id', 'name', 'code']
    });

    if (stations.length === 0) {
      return res.json({
        success: true,
        data: {
          overview: {
            totalSales: 0,
            totalQuantity: 0,
            totalTransactions: 0,
            averageTransaction: 0,
            salesGrowth: 0,
            quantityGrowth: 0
          },
          salesByStation: [],
          salesByFuelType: [],
          dailyTrend: [],
          topPerformingStations: [],
          employeePerformance: []
        }
      });
    }

    const stationIds = stations.map(s => s.id);

    // Calculate previous period for growth comparison
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - periodDays);
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);

    // Overview - current period
    const currentPeriod = await NozzleReading.findOne({
      attributes: [
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
        [fn('SUM', col('litres_sold')), 'totalQuantity']
      ],
      where: {
        ...EXCLUDE_SAMPLE_READINGS,
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.between]: [effectiveStartDate, effectiveEndDate]
        }
      },
      raw: true
    });

    // Overview - previous period for growth calculation
    const previousPeriod = await NozzleReading.findOne({
      attributes: [
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
        [fn('SUM', col('litres_sold')), 'totalQuantity']
      ],
      where: {
        ...EXCLUDE_SAMPLE_READINGS,
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.between]: [prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]]
        }
      },
      raw: true
    });

    let totalSales = parseFloat(currentPeriod?.totalSales || 0);
    let totalQuantity = parseFloat(currentPeriod?.totalQuantity || 0);

    // Transactions should count DailyTransaction records (a transaction may include multiple readings)
    let totalTransactions = 0;
    try {
      const txCountRow = await sequelize.models.DailyTransaction.findOne({
        attributes: [[fn('COUNT', col('id')), 'txCount']],
        where: { stationId: { [Op.in]: stationIds }, transactionDate: { [Op.between]: [startDate, endDate] } },
        raw: true
      });
      totalTransactions = parseInt(txCountRow?.txCount || 0);
    } catch (e) {
      // Fallback: if DailyTransaction not available, fall back to counting readings
      totalTransactions = parseInt(currentPeriod?.totalTransactions || 0);
    }
    const prevSales = parseFloat(previousPeriod?.totalSales || 0);
    const prevQuantity = parseFloat(previousPeriod?.totalQuantity || 0);

    const salesGrowth = prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : 0;
    // Note: quantityGrowth is now calculated per fuel type (see salesByFuelTypeData)
    // Combined quantity doesn't make sense since fuel types are different products
    const quantityGrowth = prevQuantity > 0 ? ((totalQuantity - prevQuantity) / prevQuantity) * 100 : 0;
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Sales by station
    const salesByStation = await NozzleReading.findAll({
      attributes: [
        'stationId',
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'sales']
      ],
      where: {
        ...EXCLUDE_SAMPLE_READINGS,
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      group: ['stationId'],
      raw: true
    });

    const stationMap = new Map(stations.map(s => [s.id, s]));
    const salesMap = new Map(salesByStation.map(s => [s.stationId, parseFloat(s.sales || 0)]));
    
    const salesByStationData = stations.map(station => {
      const sales = salesMap.get(station.id) || 0;
      return {
        stationId: station.id,
        stationName: station.name,
        sales,
        percentage: totalSales > 0 ? (sales / totalSales) * 100 : 0
      };
    });

    // Sales by fuel type - current period
    // Join NozzleReading with Nozzle to get canonical fuelType
    const salesByFuelType = await NozzleReading.findAll({
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
        readingDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      group: ['nozzle.fuel_type'],
      raw: true
    });

    // Sales by fuel type - previous period (for growth calculation)
    const prevSalesByFuelType = await NozzleReading.findAll({
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
        readingDate: {
          [Op.between]: [prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]]
        }
      },
      group: ['nozzle.fuel_type'],
      raw: true
    });

    const prevFuelTypeMap = new Map(prevSalesByFuelType.map(f => [f.fuelType || 'Unknown', { quantity: parseFloat(f.quantity || 0), sales: parseFloat(f.sales || 0) }]));

    const salesByFuelTypeData = salesByFuelType.map(f => {
      const sales = parseFloat(f.sales || 0);
      const quantity = parseFloat(f.quantity || 0);
      const fuelType = f.fuelType ? f.fuelType : 'Unknown';
      
      // Calculate growth per fuel type
      const prevData = prevFuelTypeMap.get(fuelType) || { quantity: 0, sales: 0 };
      const quantityGrowth = prevData.quantity > 0 ? ((quantity - prevData.quantity) / prevData.quantity) * 100 : 0;
      const salesGrowthFuel = prevData.sales > 0 ? ((sales - prevData.sales) / prevData.sales) * 100 : 0;
      
      return {
        fuelType,
        sales,
        quantity,
        percentage: totalSales > 0 ? (sales / totalSales) * 100 : 0,
        quantityGrowth: Math.round(quantityGrowth * 100) / 100,
        salesGrowth: Math.round(salesGrowthFuel * 100) / 100
      };
    });

    // Recompute total sales from aggregates to be robust against dialect/aliasing differences
    totalSales = salesByStationData.reduce((s, it) => s + (it.sales || 0), 0);
    
    // Compute total quantity from fuel type breakdown
    // Note: This is a sum across different fuel types (diesel + petrol + cng, etc.)
    // It's provided for UI display/reference only. For analytics, use per-fuel-type quantities in salesByFuelType
    totalQuantity = salesByFuelTypeData.reduce((s, it) => s + (it.quantity || 0), 0);
    
    // Compute WEIGHTED average quantity growth across fuel types
    // Weight each fuel type's growth by its quantity percentage
    // This reflects actual volume growth, not just averaging different rates
    const avgQuantityGrowth = totalQuantity > 0
      ? salesByFuelTypeData.reduce((s, it) => s + ((it.quantityGrowth || 0) * (it.quantity || 0)), 0) / totalQuantity
      : 0;

    // Daily trend
    // Daily trend: sales and quantity from readings; transactions from DailyTransaction (one transaction may reference many readings)
    const dailyTrend = await NozzleReading.findAll({
      attributes: [
        [fn('DATE', col('reading_date')), 'date'],
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'sales'],
        [fn('SUM', col('litres_sold')), 'quantity']
      ],
      where: {
        ...EXCLUDE_SAMPLE_READINGS,
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      group: ['date'],
      order: [[fn('DATE', col('reading_date')), 'ASC']],
      raw: true
    });

    // Get transaction counts per date
    let txTrend = [];
    try {
      txTrend = await sequelize.models.DailyTransaction.findAll({
        attributes: [[fn('DATE', col('transaction_date')), 'date'], [fn('COUNT', col('id')), 'transactions']],
        where: { stationId: { [Op.in]: stationIds }, transactionDate: { [Op.between]: [startDate, endDate] } },
        group: ['date'],
        raw: true
      });
    } catch (e) {
      txTrend = [];
    }

    const txMap = new Map(txTrend.map(t => [t.date, parseInt(t.transactions || 0)]));

    const dailyTrendData = dailyTrend.map(d => ({
      date: d.date,
      sales: parseFloat(d.sales || 0),
      quantity: parseFloat(d.quantity || 0),
      transactions: txMap.get(d.date) || 0
    }));

    // Top performing stations (with growth)
    const topStations = await Promise.all(
      salesByStation.map(async (s) => {
        const prevStationSales = await NozzleReading.findOne({
          attributes: [
            [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'sales']
          ],
          where: {
            ...EXCLUDE_SAMPLE_READINGS,
            stationId: s.stationId,
            readingDate: {
              [Op.between]: [prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]]
            }
          },
          raw: true
        });

        const currentSales = parseFloat(s.sales || 0);
        const prevSales = parseFloat(prevStationSales?.sales || 0);
        const growth = prevSales > 0 ? ((currentSales - prevSales) / prevSales) * 100 : 0;
        const station = stationMap.get(s.stationId);

        return {
          stationId: s.stationId,
          stationName: station?.name || 'Unknown',
          sales: currentSales,
          growth
        };
      })
    );

    const topPerformingStations = topStations.sort((a, b) => b.sales - a.sales).slice(0, 5);

    // Employee performance
    const employeePerformance = await Shift.findAll({
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

    const employeePerformanceData = employeePerformance.map(e => {
      const shifts = parseInt(e.shifts || 0);
      const totalSales = parseFloat(e.totalSales || 0);
      return {
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        shifts,
        totalSales,
        averageSales: shifts > 0 ? totalSales / shifts : 0
      };
    }).sort((a, b) => b.totalSales - a.totalSales).slice(0, 10);

    res.json({
      success: true,
      data: {
        overview: {
          totalSales,
          totalQuantity,
          // Note: totalQuantity is sum of different fuel types - for UI reference only
          // For detailed analysis, see salesByFuelType array with per-fuel quantities and growth
          totalTransactions,
          averageTransaction,
          salesGrowth,
          quantityGrowth: Math.round(avgQuantityGrowth * 100) / 100
          // Note: quantityGrowth is average growth across fuel types - see salesByFuelType for per-fuel growth
        },
        salesByStation: salesByStationData,
        salesByFuelType: salesByFuelTypeData,
        dailyTrend: dailyTrendData,
        topPerformingStations,
        employeePerformance: employeePerformanceData
      }
    });

  } catch (error) {
    console.error('Owner analytics error:', error);
    next(error);
  }
};

/**
 * GET COMPREHENSIVE INCOME & RECEIVABLES REPORT
 * GET /api/v1/dashboard/income-receivables?stationId=xxx&startDate=2025-12-01&endDate=2025-12-31
 * 
 * Returns:
 * 1. Summary metrics (total liters, fuel breakdown)
 * 2. Income breakdown (sales, cash, online, credit pending)
 * 3. Daily settlements with variances
 * 4. Receivables status (credit sales aging, amounts due)
 * 5. Creditor settlements (payments received from credit sales)
 * 6. Income statement (actual cash income)
 */
exports.getIncomeReceivablesReport = async (req, res, next) => {
  try {
    const { stationId, startDate, endDate } = req.query;
    const user = await User.findByPk(req.userId);

    if (!stationId) {
      return res.status(400).json({ success: false, error: 'stationId required' });
    }

    const queryStart = startDate || new Date().toISOString().split('T')[0];
    const queryEnd = endDate || new Date().toISOString().split('T')[0];

    // Get all readings for the period
    const readings = await NozzleReading.findAll({
      where: {
        ...EXCLUDE_SAMPLE_READINGS,
        stationId,
        readingDate: { [Op.between]: [queryStart, queryEnd] }
      },
      attributes: [
        'id', 'readingDate', 'fuelType', 'litresSold', 'totalAmount',
        'paymentBreakdown'
      ],
      raw: true
    });

    // Get settlements for the period
    const settlements = await sequelize.models.Settlement.findAll({
      where: {
        stationId,
        date: { [Op.between]: [queryStart, queryEnd] }
      },
      attributes: ['date', 'expectedCash', 'actualCash', 'variance', 'online', 'credit', 'notes'],
      raw: true
    });

    // Get credit transactions for the period
    const creditTransactions = await CreditTransaction.findAll({
      where: {
        stationId,
        transactionDate: { [Op.between]: [queryStart, queryEnd] }
      },
      include: [{ model: Creditor, as: 'creditor', attributes: ['id', 'name'] }],
      attributes: ['transactionType', 'amount', 'transactionDate', 'creditorId', 'notes'],
      raw: true
    });

    // === 1. SUMMARY METRICS ===
    let totalLiters = 0;
    let totalSaleValue = 0;
    const fuelBreakdown = {};

    readings.forEach(r => {
      totalLiters += parseFloat(r.litresSold || 0);
      totalSaleValue += parseFloat(r.totalAmount || 0);

      if (!fuelBreakdown[r.fuelType]) {
        fuelBreakdown[r.fuelType] = { liters: 0, value: 0 };
      }
      fuelBreakdown[r.fuelType].liters += parseFloat(r.litresSold || 0);
      fuelBreakdown[r.fuelType].value += parseFloat(r.totalAmount || 0);
    });

    // === 2. INCOME BREAKDOWN ===
    let totalCashReceived = 0;
    let totalOnlineReceived = 0;
    let totalCreditPending = 0;

    // Aggregate payment breakdown from DailyTransaction (authoritative source)
    try {
      const { DailyTransaction } = require('../models');
      const txns = await DailyTransaction.findAll({
        where: { 
          stationId, 
          transactionDate: { [Op.between]: [queryStart, queryEnd] } 
        },
        attributes: ['paymentBreakdown', 'transactionDate'],
        raw: true
      });

      if (txns && txns.length > 0) {
        txns.forEach(tx => {
          // Handle both camelCase and snake_case from raw query
          const pbData = tx.paymentBreakdown;
          
          if (pbData && typeof pbData === 'object') {
            totalCashReceived += parseFloat(pbData.cash || 0);
            totalOnlineReceived += parseFloat(pbData.online || 0);
            totalCreditPending += parseFloat(pbData.credit || 0);
          }
        });
      }
    } catch (e) {
      console.error('Error fetching DailyTransaction for payment breakdown:', e.message);
      // If DailyTransaction fetch fails, don't fall back - report zeros with the error logged
    }

    // Aggregate settled (owner) values for the period
    let settledCash = 0;
    let settledOnline = 0;
    let settledCredit = 0;
    settlements.forEach(s => {
      settledCash += parseFloat(s.actualCash || 0);
      settledOnline += parseFloat(s.online || 0);
      settledCredit += parseFloat(s.credit || 0);
    });

    // Calculate differences
    const diffCash = settledCash - totalCashReceived;
    const diffOnline = settledOnline - totalOnlineReceived;
    const diffCredit = settledCredit - totalCreditPending;

    // === 3. SETTLEMENT DATA (with variance analysis) ===
    const settlementData = settlements.map(s => {
      const variance = parseFloat(s.variance);
      const expectedCash = parseFloat(s.expectedCash);
      const variancePercent = expectedCash > 0 ? (variance / expectedCash) * 100 : 0;

      let varianceStatus = 'OK';
      if (Math.abs(variancePercent) > 3) varianceStatus = 'INVESTIGATE';
      else if (Math.abs(variancePercent) > 1) varianceStatus = 'REVIEW';

      return {
        date: s.date,
        expectedCash: parseFloat(s.expectedCash),
        actualCash: parseFloat(s.actualCash),
        variance: variance,
        variancePercent: parseFloat(variancePercent.toFixed(2)),
        varianceStatus,
        onlineRef: parseFloat(s.online),
        creditRef: parseFloat(s.credit),
        notes: s.notes
      };
    });

    // === 4. CREDIT RECEIVABLES AGING ===
    const allCreditors = await Creditor.findAll({
      where: { stationId },
      attributes: ['id', 'name', 'currentBalance', 'creditPeriodDays', 'lastTransactionDate'],
      raw: true
    });

    const receivablesAging = [];
    let totalOverdue = 0;
    let totalCurrent = 0;

    allCreditors.forEach(creditor => {
      const balance = parseFloat(creditor.currentBalance || 0);
      if (balance <= 0) return;

      const lastTxDate = creditor.lastTransactionDate ? new Date(creditor.lastTransactionDate) : null;
      const dueDate = lastTxDate ? new Date(lastTxDate.getTime() + (creditor.creditPeriodDays * 24 * 60 * 60 * 1000)) : null;
      const today = new Date();

      let agingBucket = 'Current';
      if (dueDate && dueDate < today) {
        const daysOverdue = Math.floor((today - dueDate) / (24 * 60 * 60 * 1000));
        if (daysOverdue > 60) agingBucket = 'Over60Days';
        else if (daysOverdue > 30) agingBucket = 'Over30Days';
        else agingBucket = 'Overdue';
        totalOverdue += balance;
      } else {
        totalCurrent += balance;
      }

      receivablesAging.push({
        creditorId: creditor.id,
        creditorName: creditor.name,
        balance: balance,
        dueDate: dueDate ? dueDate.toISOString().split('T')[0] : null,
        agingBucket
      });
    });

    // === 5. CREDITOR SETTLEMENTS (payments received) ===
    const creditorSettlements = {};

    creditTransactions.forEach(tx => {
      if (tx.transactionType === 'settlement') {
        const creditorName = tx['creditor.name'] || tx.creditorId;
        if (!creditorSettlements[creditorName]) {
          creditorSettlements[creditorName] = {
            totalCredited: 0,
            totalSettled: 0,
            outstanding: 0,
            transactions: []
          };
        }
        creditorSettlements[creditorName].totalSettled += parseFloat(tx.amount || 0);
        creditorSettlements[creditorName].transactions.push({
          date: tx.transactionDate,
          amount: parseFloat(tx.amount),
          notes: tx.notes
        });
      } else if (tx.transactionType === 'credit') {
        const creditorName = tx['creditor.name'] || tx.creditorId;
        if (!creditorSettlements[creditorName]) {
          creditorSettlements[creditorName] = {
            totalCredited: 0,
            totalSettled: 0,
            outstanding: 0,
            transactions: []
          };
        }
        creditorSettlements[creditorName].totalCredited += parseFloat(tx.amount || 0);
      }
    });

    // Calculate outstanding for each creditor
    Object.keys(creditorSettlements).forEach(creditorName => {
      const cs = creditorSettlements[creditorName];
      cs.outstanding = cs.totalCredited - cs.totalSettled;
    });

    // === FINAL REPORT ===
    res.json({
      success: true,
      data: {
        period: { startDate: queryStart, endDate: queryEnd },
        
        summaryMetrics: {
          totalLiters: parseFloat(totalLiters.toFixed(2)),
          totalSaleValue: parseFloat(totalSaleValue.toFixed(2)),
          fuelBreakdown: Object.keys(fuelBreakdown).map(fuelType => ({
            fuelType,
            liters: parseFloat(fuelBreakdown[fuelType].liters.toFixed(2)),
            value: parseFloat(fuelBreakdown[fuelType].value.toFixed(2)),
            percentage: ((fuelBreakdown[fuelType].liters / totalLiters) * 100).toFixed(1)
          }))
        },

        incomeBreakdown: {
          calculatedSaleValue: parseFloat(totalSaleValue.toFixed(2)),
          // Raw (employee-entered) values
          cashReceived: parseFloat(totalCashReceived.toFixed(2)),
          onlineReceived: parseFloat(totalOnlineReceived.toFixed(2)),
          creditPending: parseFloat(totalCreditPending.toFixed(2)),
          // Settled (owner-approved) values
          settledCash: parseFloat(settledCash.toFixed(2)),
          settledOnline: parseFloat(settledOnline.toFixed(2)),
          settledCredit: parseFloat(settledCredit.toFixed(2)),
          // Difference (settled - raw)
          diffCash: parseFloat(diffCash.toFixed(2)),
          diffOnline: parseFloat(diffOnline.toFixed(2)),
          diffCredit: parseFloat(diffCredit.toFixed(2)),
          verification: {
            total: parseFloat((totalCashReceived + totalOnlineReceived + totalCreditPending).toFixed(2)),
            match: Math.abs((totalCashReceived + totalOnlineReceived + totalCreditPending) - totalSaleValue) < 0.01
          }
        },

        settlements: settlementData,
        settlementSummary: {
          count: settlementData.length,
          totalVariance: parseFloat(settlementData.reduce((sum, s) => sum + s.variance, 0).toFixed(2)),
          avgVariancePercent: parseFloat((settlementData.reduce((sum, s) => sum + s.variancePercent, 0) / (settlementData.length || 1)).toFixed(2))
        },

        receivables: {
          aging: receivablesAging,
          summary: {
            totalOutstanding: parseFloat((totalCurrent + totalOverdue).toFixed(2)),
            current: parseFloat(totalCurrent.toFixed(2)),
            overdue: parseFloat(totalOverdue.toFixed(2))
          }
        },

        creditorSettlements: creditorSettlements,

        incomeStatement: {
          totalSalesGenerated: parseFloat(totalSaleValue.toFixed(2)),
          lessCreditPending: parseFloat(totalCreditPending.toFixed(2)),
          lessCashVariance: parseFloat(settlementData.reduce((sum, s) => sum + Math.max(0, s.variance), 0).toFixed(2)),
          netCashIncome: parseFloat(((totalCashReceived + totalOnlineReceived) - settlementData.reduce((sum, s) => sum + Math.max(0, s.variance), 0)).toFixed(2)),
          actualCashBasis: parseFloat((totalCashReceived + totalOnlineReceived - settlementData.reduce((sum, s) => sum + Math.max(0, s.variance), 0)).toFixed(2))
        }
      }
    });

  } catch (error) {
    console.error('Income receivables report error:', error);
    next(error);
  }
};
