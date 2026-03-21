/**
 * Dashboard Controller (Refactored)
 * Comprehensive analytics including sales, credits, expenses
 * 
 * Uses service and repository layers for clean separation of concerns
 */

const { User, Station, Creditor, CreditTransaction, Shift, NozzleReading, Nozzle, Pump, DailyTransaction, Settlement } = require('../models');
const { Op, fn, col, sequelize } = require('sequelize');
const dashboardRepo = require('../repositories/dashboardRepository');
const dashboardService = require('../services/dashboardService');
const paymentService = require('../services/paymentBreakdownService');
const { FUEL_TYPE_LABELS } = require('../config/constants');
const ApiResponse = require('../utils/responseFormatter');

// Filter to exclude sample readings from all queries
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };

/**
 * Get today's dashboard summary
 * GET /api/v1/dashboard/summary
 */
exports.getSummary = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const user = await User.findByPk(req.userId);
    const { stationId } = req.query;
    
    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json(new ApiResponse({ 
        date: new Date().toISOString().split('T')[0],
        today: { litres: 0, amount: 0, cash: 0, online: 0, credit: 0, readings: 0 }, 
        pumps: [] 
      }, { executionMs: Date.now() - startTime }));
    }

    const summary = await dashboardService.calculateTodaySummary(stationFilter, user.role);
    res.json(new ApiResponse(summary, { executionMs: Date.now() - startTime }));
  } catch (error) {
    console.error('Dashboard summary error:', error);
    next(error);
  }
};

/**
 * Get nozzle-wise breakdown
 * GET /api/v1/dashboard/nozzle-breakdown
 */
exports.getNozzleBreakdown = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { startDate, endDate, pumpId, start_date, end_date, pump_id, stationId } = req.query;
    const user = await User.findByPk(req.userId);
    
    const start = startDate || start_date || new Date().toISOString().split('T')[0];
    const end = endDate || end_date || start;
    const effectivePumpId = pumpId || pump_id;

    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json(new ApiResponse({ nozzles: [] }, { 
        startDate: start, 
        endDate: end,
        executionMs: Date.now() - startTime 
      }));
    }

    const nozzles = await dashboardService.calculateNozzleBreakdown(stationFilter, start, end, effectivePumpId);

    res.json(new ApiResponse({ nozzles }, { 
      startDate: start, 
      endDate: end,
      executionMs: Date.now() - startTime 
    }));
  } catch (error) {
    console.error('Nozzle breakdown error:', error);
    next(error);
  }
};

/**
 * Get daily summary for a date range
 * GET /api/v1/dashboard/daily
 * REFACTORED: Moved aggregation logic to dashboardService
 */
exports.getDailySummary = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { startDate, endDate, start_date, end_date, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    const effectiveStartDate = startDate || start_date;
    const effectiveEndDate = endDate || end_date;

    if (!effectiveStartDate || !effectiveEndDate) {
      return res.status(400).json(ApiResponse.error('startDate and endDate are required', 400));
    }

    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json(new ApiResponse([], { 
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        executionMs: Date.now() - startTime 
      }));
    }

    // REFACTORED: Use new service function instead of inline aggregation
    const dailyStats = await dashboardService.calculateDailySummary(
      stationFilter, 
      effectiveStartDate, 
      effectiveEndDate
    );

    res.json(new ApiResponse(dailyStats, { 
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      executionMs: Date.now() - startTime 
    }));
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
    const startTime = Date.now();
    const { startDate, endDate, start_date, end_date, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    const today = new Date().toISOString().split('T')[0];
    const start = startDate || start_date || today;
    const end = endDate || end_date || today;

    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json(new ApiResponse({ breakdown: [] }, { 
        startDate: start, 
        endDate: end,
        executionMs: Date.now() - startTime 
      }));
    }

    const breakdown = await dashboardService.calculateFuelBreakdown(stationFilter, start, end);

    res.json(new ApiResponse({ breakdown }, { 
      startDate: start, 
      endDate: end,
      executionMs: Date.now() - startTime 
    }));
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
    const startTime = Date.now();
    const { startDate, endDate, start_date, end_date, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    const today = new Date().toISOString().split('T')[0];
    const start = startDate || start_date || today;
    const end = endDate || end_date || today;

    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json(new ApiResponse({ pumps: [] }, { 
        startDate: start, 
        endDate: end,
        executionMs: Date.now() - startTime 
      }));
    }

    // Extract station IDs from filter
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
      const allStations = await Station.findAll({ attributes: ['id'] });
      stationIds = allStations.map(s => s.id);
    }

    const readings = await dashboardRepo.getPumpPerformanceData(stationIds, start, end);
    const pumps = dashboardService.formatPumpPerformance(readings);

    res.json(new ApiResponse({ pumps }, { 
      startDate: start, 
      endDate: end,
      executionMs: Date.now() - startTime 
    }));
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

    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: { month: targetMonth, noData: true } });
    }

    const { sales, settlements, expenses, costOfGoods, outstanding } = await dashboardRepo.getFinancialData(
      stationFilter,
      startDate,
      endDate
    );

    const salesAmount = parseFloat(sales?.sales || 0);
    const cash = parseFloat(sales?.cash || 0);
    const online = parseFloat(sales?.online || 0);
    const creditSales = parseFloat(sales?.credit || 0);
    
    const totalReceived = cash + online + settlements;
    const grossProfit = salesAmount - costOfGoods;
    const netProfit = grossProfit - expenses;

    res.json({
      success: true,
      data: {
        month: targetMonth,
        revenue: {
          totalSales: salesAmount,
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
          margin: salesAmount > 0 ? ((netProfit / salesAmount) * 100).toFixed(1) : 0
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
    
    const stationFilter = await dashboardRepo.getStationFilter(user);
    if (stationFilter === null) {
      return res.json({ success: true, data: { alerts: [] } });
    }
    
    let stationIds = [];
    if (stationId) {
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
      if (user.role === 'super_admin') {
        const allStations = await Station.findAll({ attributes: ['id'] });
        stationIds = allStations.map(s => s.id);
      } else if (user.role === 'owner') {
        const ownerStations = await Station.findAll({ where: { ownerId: user.id }, attributes: ['id'] });
        stationIds = ownerStations.map(s => s.id);
      } else {
        stationIds = user.stationId ? [user.stationId] : [];
      }
    }
    
    const alerts = [];
    for (const sid of stationIds) {
      const station = await Station.findByPk(sid, { attributes: ['id', 'name', 'alertOnMissedReadings', 'missedReadingThresholdDays'] });
      
      if (!station || !station.alertOnMissedReadings) continue;
      
      const effectiveThreshold = parseInt(thresholdDays, 10) || station.missedReadingThresholdDays || 1;
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
    
    const activeShift = await Shift.getActiveShift(req.userId);
    
    let stationActiveShifts = [];
    if (['super_admin', 'owner', 'manager'].includes(user.role) && user.stationId) {
      stationActiveShifts = await Shift.findAll({
        where: { stationId: user.stationId, status: 'active' },
        include: [{ model: User, as: 'employee', attributes: ['id', 'name'] }]
      });
    }
    
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
    
    if (user.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Access denied. Owner role required.' });
    }
    
    const stations = await dashboardRepo.getOwnerStations(user.id);
    const stationIds = stations.map(s => s.id);
    const totalStations = stations.length;
    const activeStations = stations.filter(s => s.isActive).length;

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

    const [totalEmployees, todaySalesData, monthSalesData] = await Promise.all([
      dashboardRepo.getEmployeeCount(stationIds),
      dashboardRepo.getPeriodSalesData(
        stationIds,
        new Date().toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
        new Date(new Date().setDate(1)).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      ),
      dashboardRepo.getPeriodSalesData(
        stationIds,
        new Date(new Date().setDate(1)).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
        new Date(new Date().setDate(1)).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      )
    ]);

    const todaySales = parseFloat(todaySalesData.current?.totalSales || 0);
    const monthSales = parseFloat(monthSalesData.current?.totalSales || 0);

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
 * Note: Full implementation in original controller - this is simplified version
 */
exports.getOwnerAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, stationId, start_date, end_date, station_id } = req.query;
    const user = await User.findByPk(req.userId);

    const effectiveStartDate = startDate || start_date;
    const effectiveEndDate = endDate || end_date;
    const effectiveStationId = stationId || station_id;

    if (!effectiveStartDate || !effectiveEndDate) {
      return res.status(400).json({ success: false, error: 'Start date and end date are required' });
    }

    const stationFilter = { ownerId: user.id };
    if (effectiveStationId && effectiveStationId !== 'all') {
      stationFilter.id = effectiveStationId;
    }

    const stations = await Station.findAll({ where: stationFilter, attributes: ['id', 'name', 'code'] });
    if (stations.length === 0) {
      return res.json({
        success: true,
        data: {
          overview: { totalSales: 0, totalQuantity: 0, totalTransactions: 0, averageTransaction: 0, salesGrowth: 0 },
          salesByStation: [],
          salesByFuelType: [],
          dailyTrend: []
        }
      });
    }

    const stationIds = stations.map(s => s.id);

    // Calculate comparison periods
    const start = new Date(effectiveStartDate);
    const end = new Date(effectiveEndDate);
    const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - periodDays);
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);

    const [periodData, salesByStationData, fuelTypeData, dailyTrendData] = await Promise.all([
      dashboardRepo.getPeriodSalesData(
        stationIds,
        effectiveStartDate,
        effectiveEndDate,
        prevStart.toISOString().split('T')[0],
        prevEnd.toISOString().split('T')[0]
      ),
      dashboardRepo.getSalesByStation(stationIds, effectiveStartDate, effectiveEndDate),
      dashboardRepo.getSalesByFuelType(stationIds, effectiveStartDate, effectiveEndDate),
      dashboardRepo.getDailyTrendData(stationIds, effectiveStartDate, effectiveEndDate)
    ]);

    const totalSales = parseFloat(periodData.current?.totalSales || 0);
    const totalQuantity = parseFloat(periodData.current?.totalQuantity || 0);
    const totalTransactions = parseInt(periodData.current?.totalTransactions || 0, 10);
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    const prevSales = parseFloat(periodData.previous?.totalSales || 0);
    const salesGrowth = prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalSales,
          totalQuantity,
          totalTransactions,
          averageTransaction: Math.round(averageTransaction * 100) / 100,
          salesGrowth: Math.round(salesGrowth * 100) / 100
        },
        salesByStation: salesByStationData.map(s => ({
          stationId: s.stationId,
          stationName: stations.find(st => st.id === s.stationId)?.name,
          sales: parseFloat(s.sales || 0),
          percentage: totalSales > 0 ? (parseFloat(s.sales || 0) / totalSales) * 100 : 0
        })),
        salesByFuelType: fuelTypeData.map(f => ({
          fuelType: f.fuelType || 'Unknown',
          label: FUEL_TYPE_LABELS[f.fuelType] || f.fuelType,
          sales: parseFloat(f.sales || 0),
          quantity: parseFloat(f.quantity || 0)
        })),
        dailyTrend: dailyTrendData.map(d => ({
          date: d.date,
          sales: parseFloat(d.sales || 0),
          quantity: parseFloat(d.quantity || 0)
        }))
      }
    });
  } catch (error) {
    console.error('Owner analytics error:', error);
    next(error);
  }
};

/**
 * GET COMPREHENSIVE INCOME & RECEIVABLES REPORT
 * GET /api/v1/dashboard/income-receivables
 * Returns: Summary metrics, income breakdown, settlements, credit receivables, creditor settlements
 */
exports.getIncomeReceivablesReport = async (req, res, next) => {
  try {
    const { stationId, startDate, endDate } = req.query;

    if (!stationId) {
      return res.status(400).json(new ApiResponse(null, null, 'stationId required', false));
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
    const settlements = await Settlement.findAll({
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
    res.json(new ApiResponse({
      period: { startDate: queryStart, endDate: queryEnd },
      
      summaryMetrics: {
        totalLiters: parseFloat(totalLiters.toFixed(2)),
        totalSaleValue: parseFloat(totalSaleValue.toFixed(2)),
        fuelBreakdown: Object.keys(fuelBreakdown).map(fuelType => ({
          fuelType,
          liters: parseFloat(fuelBreakdown[fuelType].liters.toFixed(2)),
          value: parseFloat(fuelBreakdown[fuelType].value.toFixed(2)),
          percentage: totalLiters > 0 ? parseFloat(((fuelBreakdown[fuelType].liters / totalLiters) * 100).toFixed(1)) : 0
        }))
      },

      incomeBreakdown: {
        calculatedSaleValue: parseFloat(totalSaleValue.toFixed(2)),
        cashReceived: parseFloat(totalCashReceived.toFixed(2)),
        onlineReceived: parseFloat(totalOnlineReceived.toFixed(2)),
        creditPending: parseFloat(totalCreditPending.toFixed(2)),
        settledCash: parseFloat(settledCash.toFixed(2)),
        settledOnline: parseFloat(settledOnline.toFixed(2)),
        settledCredit: parseFloat(settledCredit.toFixed(2)),
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
    }));

  } catch (error) {
    console.error('Income receivables report error:', error);
    next(error);
  }
};
