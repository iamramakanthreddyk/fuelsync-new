/**
 * Dashboard Controller
 * Comprehensive analytics including sales, credits, expenses
 */

const { NozzleReading, Nozzle, Pump, Station, FuelPrice, User, Creditor, CreditTransaction, Expense, CostOfGoods, CashHandover, Shift } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../models');
const { FUEL_TYPE_LABELS } = require('../config/constants');

/**
 * Helper to get station filter based on user role
 * Handles owners who access stations via Station.ownerId (not User.stationId)
 */
const getStationFilter = async (user) => {
  if (user.role === 'super_admin') return {};
  
  if (user.role === 'owner') {
    // Owner accesses stations they own via Station.ownerId
    const ownerStations = await Station.findAll({ 
      where: { ownerId: user.id },
      attributes: ['id']
    });
    const stationIds = ownerStations.map(s => s.id);
    if (stationIds.length === 0) return null;
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
    
    const stationFilter = await getStationFilter(user);
    if (stationFilter === null) {
      return res.json({
        success: true,
        data: { today: { litres: 0, amount: 0, cash: 0, online: 0, credit: 0, readings: 0 }, pumps: [] }
      });
    }

    // Today's sales totals (include initial readings that represent sales)
    const todayStats = await NozzleReading.findOne({
      where: { 
        ...stationFilter, 
        readingDate: today,
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: [
        [fn('SUM', col('litres_sold')), 'totalLitres'],
        [fn('SUM', col('total_amount')), 'totalAmount'],
        [fn('SUM', col('cash_amount')), 'totalCash'],
        [fn('SUM', col('online_amount')), 'totalOnline'],
        [fn('SUM', col('credit_amount')), 'totalCredit'],
        [fn('COUNT', col('id')), 'readingCount']
      ],
      raw: true
    });

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
        [fn('SUM', col('total_amount')), 'amount']
      ],
      group: ['nozzle.pump.id', 'nozzle.pump.name', 'nozzle.pump.pump_number', 'nozzle.pump.status', 'nozzle.id', 'nozzle.fuel_type'],
      raw: true, nest: true
    });

    // All pumps
    const allPumps = await Pump.findAll({
      where: user.role === 'super_admin' ? {} : { stationId: user.stationId },
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
    const { startDate, endDate, pumpId } = req.query;
    const user = await User.findByPk(req.userId);
    
    const today = new Date().toISOString().split('T')[0];
    const start = startDate || today;
    const end = endDate || today;

    const stationFilter = await getStationFilter(user);
    if (stationFilter === null) {
      return res.json({ success: true, data: { nozzles: [] } });
    }

    const whereClause = {
      ...stationFilter,
      readingDate: { [Op.between]: [start, end] },
      [Op.or]: [
        { isInitialReading: false },
        { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
      ]
    };
    if (pumpId) whereClause.pumpId = pumpId;

    const nozzleStats = await NozzleReading.findAll({
      where: whereClause,
      include: [{
        model: Nozzle, as: 'nozzle', attributes: ['id', 'nozzleNumber', 'fuelType'],
        include: [{ model: Pump, as: 'pump', attributes: ['id', 'name', 'pumpNumber'] }]
      }],
      attributes: [
        [fn('SUM', col('NozzleReading.litres_sold')), 'litres'],
        [fn('SUM', col('NozzleReading.total_amount')), 'amount'],
        [fn('SUM', col('NozzleReading.cash_amount')), 'cash'],
        [fn('SUM', col('NozzleReading.online_amount')), 'online'],
        [fn('SUM', col('NozzleReading.credit_amount')), 'credit'],
        [fn('COUNT', col('NozzleReading.id')), 'readings']
      ],
      group: ['nozzle.id', 'nozzle.nozzle_number', 'nozzle.fuel_type', 'nozzle.pump.id', 'nozzle.pump.name', 'nozzle.pump.pump_number'],
      raw: true, nest: true
    });

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
          litres: parseFloat(n.litres || 0),
          amount: parseFloat(n.amount || 0),
          cash: parseFloat(n.cash || 0),
          online: parseFloat(n.online || 0),
          credit: parseFloat(n.credit || 0),
          readings: parseInt(n.readings || 0)
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
    const { startDate, endDate } = req.query;
    const user = await User.findByPk(req.userId);

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate and endDate are required' });
    }

    const stationFilter = await getStationFilter(user);
    if (stationFilter === null) {
      return res.json({ success: true, data: [] });
    }

    const dailyStats = await NozzleReading.findAll({
      where: { 
        ...stationFilter, 
        readingDate: { [Op.between]: [startDate, endDate] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: [
        'readingDate',
        [fn('SUM', col('litres_sold')), 'litres'],
        [fn('SUM', col('total_amount')), 'amount'],
        [fn('SUM', col('cash_amount')), 'cash'],
        [fn('SUM', col('online_amount')), 'online'],
        [fn('SUM', col('credit_amount')), 'credit'],
        [fn('COUNT', col('id')), 'readings']
      ],
      group: ['readingDate'],
      order: [['readingDate', 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      data: dailyStats.map(day => ({
        date: day.readingDate,
        litres: parseFloat(day.litres || 0),
        amount: parseFloat(day.amount || 0),
        cash: parseFloat(day.cash || 0),
        online: parseFloat(day.online || 0),
        credit: parseFloat(day.credit || 0),
        readings: parseInt(day.readings || 0)
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
    const { startDate, endDate } = req.query;
    const user = await User.findByPk(req.userId);

    const today = new Date().toISOString().split('T')[0];
    const start = startDate || today;
    const end = endDate || today;

    const stationFilter = await getStationFilter(user);
    if (stationFilter === null) {
      return res.json({ success: true, data: { breakdown: [] } });
    }

    // Use denormalized fuelType field for faster query
    const breakdown = await NozzleReading.findAll({
      where: { 
        ...stationFilter, 
        readingDate: { [Op.between]: [start, end] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      attributes: [
        'fuelType',
        [fn('SUM', col('litres_sold')), 'litres'],
        [fn('SUM', col('total_amount')), 'amount'],
        [fn('SUM', col('cash_amount')), 'cash'],
        [fn('SUM', col('online_amount')), 'online'],
        [fn('SUM', col('credit_amount')), 'credit']
      ],
      group: ['fuelType'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        startDate: start, endDate: end,
        breakdown: breakdown.map(item => ({
          fuelType: item.fuelType,
          label: FUEL_TYPE_LABELS[item.fuelType] || item.fuelType,
          litres: parseFloat(item.litres || 0),
          amount: parseFloat(item.amount || 0),
          cash: parseFloat(item.cash || 0),
          online: parseFloat(item.online || 0),
          credit: parseFloat(item.credit || 0)
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
    const { startDate, endDate } = req.query;
    const user = await User.findByPk(req.userId);

    const today = new Date().toISOString().split('T')[0];
    const start = startDate || today;
    const end = endDate || today;

    const stationFilter = await getStationFilter(user);
    if (stationFilter === null) {
      return res.json({ success: true, data: { pumps: [] } });
    }

    // Use denormalized pumpId for faster query
    const pumpStats = await NozzleReading.findAll({
      where: { 
        ...stationFilter, 
        readingDate: { [Op.between]: [start, end] },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      include: [{ model: Pump, as: 'pump', attributes: ['id', 'name', 'pumpNumber', 'status'] }],
      attributes: [
        [fn('SUM', col('NozzleReading.litres_sold')), 'litres'],
        [fn('SUM', col('NozzleReading.total_amount')), 'amount'],
        [fn('SUM', col('NozzleReading.cash_amount')), 'cash'],
        [fn('SUM', col('NozzleReading.online_amount')), 'online'],
        [fn('SUM', col('NozzleReading.credit_amount')), 'credit'],
        [fn('COUNT', col('NozzleReading.id')), 'readings']
      ],
      group: ['pump.id', 'pump.name', 'pump.pump_number', 'pump.status'],
      raw: true, nest: true
    });

    res.json({
      success: true,
      data: {
        startDate: start, endDate: end,
        pumps: pumpStats.map(p => ({
          id: p.pump?.id, name: p.pump?.name, number: p.pump?.pumpNumber, status: p.pump?.status,
          litres: parseFloat(p.litres || 0),
          amount: parseFloat(p.amount || 0),
          cash: parseFloat(p.cash || 0),
          online: parseFloat(p.online || 0),
          credit: parseFloat(p.credit || 0),
          readings: parseInt(p.readings || 0)
        }))
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
    const { month } = req.query;
    const user = await User.findByPk(req.userId);
    
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [year, mon] = targetMonth.split('-');
    const startDate = `${year}-${mon}-01`;
    const endDate = new Date(year, mon, 0).toISOString().split('T')[0];

    const stationFilter = await getStationFilter(user);
    if (stationFilter === null) {
      return res.json({ success: true, data: { month: targetMonth, noData: true } });
    }

    // Sales
    const salesResult = await NozzleReading.findOne({
      where: { 
        ...stationFilter, 
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
    
    // Get pending handovers for this user
    const pendingHandovers = await CashHandover.getPendingForUser(req.userId);
    
    // Get disputed handovers for owners
    let disputedCount = 0;
    if (['super_admin', 'owner'].includes(user.role)) {
      const stationFilter = await getStationFilter(user);
      if (stationFilter && stationFilter.stationId) {
        disputedCount = await CashHandover.count({
          where: {
            ...stationFilter,
            status: 'disputed'
          }
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        pendingCount: pendingHandovers.length,
        disputedCount,
        pendingHandovers: pendingHandovers.slice(0, 10), // Limit to first 10
        hasAlerts: pendingHandovers.length > 0 || disputedCount > 0
      }
    });
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
 */
exports.getOwnerStats = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    
    // Only owners can access this
    if (user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Owner role required.'
      });
    }

    // Get all stations owned by this user
    const stations = await Station.findAll({
      where: { ownerId: user.id },
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

    // Count employees across all owned stations
    const totalEmployees = await User.count({
      where: {
        stationId: { [Op.in]: stationIds },
        role: { [Op.in]: ['manager', 'employee'] }
      }
    });

    // Today's sales across all stations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySalesData = await NozzleReading.findAll({
      attributes: [
        [fn('SUM', col('NozzleReading.total_amount')), 'totalAmount']
      ],
      include: [{
        model: Nozzle,
        as: 'nozzle',
        attributes: [],
        include: [{
          model: Pump,
          as: 'pump',
          attributes: [],
          where: { stationId: { [Op.in]: stationIds } }
        }]
      }],
      where: {
        readingDate: {
          [Op.gte]: today
        }
      },
      raw: true
    });

    const todaySales = parseFloat(todaySalesData[0]?.totalAmount || 0);

    // Month's sales across all stations
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const monthSalesData = await NozzleReading.findAll({
      attributes: [
        [fn('SUM', col('NozzleReading.total_amount')), 'totalAmount']
      ],
      include: [{
        model: Nozzle,
        as: 'nozzle',
        attributes: [],
        include: [{
          model: Pump,
          as: 'pump',
          attributes: [],
          where: { stationId: { [Op.in]: stationIds } }
        }]
      }],
      where: {
        readingDate: {
          [Op.gte]: monthStart
        }
      },
      raw: true
    });

    const monthSales = parseFloat(monthSalesData[0]?.totalAmount || 0);

    // Count pending actions (pending handovers)
    const pendingActions = await CashHandover.count({
      where: {
        stationId: { [Op.in]: stationIds },
        status: 'pending'
      }
    });

    res.json({
      success: true,
      data: {
        totalStations,
        activeStations,
        totalEmployees,
        todaySales,
        monthSales,
        pendingActions
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
    const { startDate, endDate, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    // Get owner's stations
    const stationFilter = { ownerId: user.id };
    if (stationId && stationId !== 'all') {
      stationFilter.id = stationId;
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
        [fn('SUM', col('NozzleReading.total_amount')), 'totalSales'],
        [fn('SUM', col('NozzleReading.litres_sold')), 'totalQuantity'],
        [fn('COUNT', col('NozzleReading.id')), 'totalTransactions']
      ],
      include: [{
        model: Pump,
        as: 'pump',
        attributes: [],
        where: { stationId: { [Op.in]: stationIds } }
      }],
      where: {
        readingDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      raw: true
    });

    // Overview - previous period for growth calculation
    const previousPeriod = await NozzleReading.findOne({
      attributes: [
        [fn('SUM', col('NozzleReading.total_amount')), 'totalSales'],
        [fn('SUM', col('NozzleReading.litres_sold')), 'totalQuantity']
      ],
      include: [{
        model: Pump,
        as: 'pump',
        attributes: [],
        where: { stationId: { [Op.in]: stationIds } }
      }],
      where: {
        readingDate: {
          [Op.between]: [prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]]
        }
      },
      raw: true
    });

    const totalSales = parseFloat(currentPeriod?.totalSales || 0);
    const totalQuantity = parseFloat(currentPeriod?.totalQuantity || 0);
    const totalTransactions = parseInt(currentPeriod?.totalTransactions || 0);
    const prevSales = parseFloat(previousPeriod?.totalSales || 0);
    const prevQuantity = parseFloat(previousPeriod?.totalQuantity || 0);

    const salesGrowth = prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : 0;
    const quantityGrowth = prevQuantity > 0 ? ((totalQuantity - prevQuantity) / prevQuantity) * 100 : 0;
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Sales by station
    const salesByStation = await NozzleReading.findAll({
      attributes: [
        'stationId',
        [fn('SUM', col('NozzleReading.total_amount')), 'sales']
      ],
      where: {
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      group: ['stationId'],
      raw: true
    });

    const stationMap = new Map(stations.map(s => [s.id, s]));
    const salesByStationData = salesByStation.map(s => {
      const station = stationMap.get(s.stationId);
      const sales = parseFloat(s.sales || 0);
      return {
        stationId: s.stationId,
        stationName: station?.name || 'Unknown',
        sales,
        percentage: totalSales > 0 ? (sales / totalSales) * 100 : 0
      };
    });

    // Sales by fuel type
    const salesByFuelType = await NozzleReading.findAll({
      attributes: [
        'fuelType',
        [fn('SUM', col('NozzleReading.total_amount')), 'sales'],
        [fn('SUM', col('NozzleReading.litres_sold')), 'quantity']
      ],
      where: {
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      group: ['fuelType'],
      raw: true
    });

    const salesByFuelTypeData = salesByFuelType.map(f => {
      const sales = parseFloat(f.sales || 0);
      return {
        fuelType: f.fuelType,
        sales,
        quantity: parseFloat(f.quantity || 0),
        percentage: totalSales > 0 ? (sales / totalSales) * 100 : 0
      };
    });

    // Daily trend
    const dailyTrend = await NozzleReading.findAll({
      attributes: [
        [fn('DATE', col('reading_date')), 'date'],
        [fn('SUM', col('NozzleReading.total_amount')), 'sales'],
        [fn('SUM', col('NozzleReading.litres_sold')), 'quantity'],
        [fn('COUNT', col('NozzleReading.id')), 'transactions']
      ],
      where: {
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      group: ['date'],
      order: [[fn('DATE', col('reading_date')), 'ASC']],
      raw: true
    });

    const dailyTrendData = dailyTrend.map(d => ({
      date: d.date,
      sales: parseFloat(d.sales || 0),
      quantity: parseFloat(d.quantity || 0),
      transactions: parseInt(d.transactions || 0)
    }));

    // Top performing stations (with growth)
    const topStations = await Promise.all(
      salesByStation.map(async (s) => {
        const prevStationSales = await NozzleReading.findOne({
          attributes: [
            [fn('SUM', col('NozzleReading.total_amount')), 'sales']
          ],
          where: {
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
          totalTransactions,
          averageTransaction,
          salesGrowth,
          quantityGrowth
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

