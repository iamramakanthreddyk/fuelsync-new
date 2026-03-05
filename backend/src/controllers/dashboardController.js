/**
 * Dashboard Controller (Refactored)
 * Comprehensive analytics including sales, credits, expenses
 * 
 * Uses service and repository layers for clean separation of concerns
 */

const { User, Station, Creditor, CreditTransaction, Shift, NozzleReading, Nozzle, Pump, DailyTransaction } = require('../models');
const { Op, fn, col, sequelize } = require('sequelize');
const dashboardRepo = require('../repositories/dashboardRepository');
const dashboardService = require('../services/dashboardService');
const paymentService = require('../services/paymentBreakdownService');
const { FUEL_TYPE_LABELS } = require('../config/constants');

/**
 * Get today's dashboard summary
 * GET /api/v1/dashboard/summary
 */
exports.getSummary = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    const { stationId } = req.query;
    
    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({
        success: true,
        data: { 
          date: new Date().toISOString().split('T')[0],
          today: { litres: 0, amount: 0, cash: 0, online: 0, credit: 0, readings: 0 }, 
          pumps: [] 
        }
      });
    }

    const summary = await dashboardService.calculateDailySummary(stationFilter, user.role);
    res.json({ success: true, data: summary });
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
    const { startDate, endDate, pumpId, start_date, end_date, pump_id, stationId } = req.query;
    const user = await User.findByPk(req.userId);
    
    const start = startDate || start_date || new Date().toISOString().split('T')[0];
    const end = endDate || end_date || start;
    const effectivePumpId = pumpId || pump_id;

    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: { startDate: start, endDate: end, nozzles: [] } });
    }

    const nozzles = await dashboardService.calculateNozzleBreakdown(stationFilter, start, end, effectivePumpId);

    res.json({
      success: true,
      data: { startDate: start, endDate: end, nozzles }
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

    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: [] });
    }

    const readings = await dashboardRepo.getDailyReadings(stationFilter, effectiveStartDate, effectiveEndDate);
    const { txnCache, txnReadingTotals } = await paymentService.allocatePaymentBreakdownsProportionally(readings);

    const dateMap = {};
    const seenTransactions = {};

    readings.forEach(reading => {
      const date = reading.readingDate;
      if (!dateMap[date]) {
        dateMap[date] = { litres: 0, amount: 0, cash: 0, online: 0, credit: 0, readings: 0 };
        seenTransactions[date] = new Set();
      }

      dateMap[date].litres += parseFloat(reading.litresSold || 0);
      dateMap[date].amount += parseFloat(reading.totalAmount || 0);
      dateMap[date].readings += 1;

      if (reading.transactionId && !seenTransactions[date].has(reading.transactionId)) {
        seenTransactions[date].add(reading.transactionId);
        const pb = txnCache[reading.transactionId]?.paymentBreakdown;
        if (pb) {
          dateMap[date].cash += parseFloat(pb.cash || 0);
          dateMap[date].online += parseFloat(pb.online || 0);
          dateMap[date].credit += parseFloat(pb.credit || 0);
        }
      }
    });

    const dailyStats = Object.keys(dateMap)
      .sort()
      .map(date => ({
        date,
        litres: parseFloat(dateMap[date].litres.toFixed(2)),
        amount: parseFloat(dateMap[date].amount.toFixed(2)),
        cash: parseFloat(dateMap[date].cash.toFixed(2)),
        online: parseFloat(dateMap[date].online.toFixed(2)),
        credit: parseFloat(dateMap[date].credit.toFixed(2)),
        readings: dateMap[date].readings
      }));

    res.json({ success: true, data: dailyStats });
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
    const { startDate, endDate, start_date, end_date, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    const today = new Date().toISOString().split('T')[0];
    const start = startDate || start_date || today;
    const end = endDate || end_date || today;

    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: { startDate: start, endDate: end, breakdown: [] } });
    }

    const breakdown = await dashboardService.calculateFuelBreakdown(stationFilter, start, end);

    res.json({
      success: true,
      data: { startDate: start, endDate: end, breakdown }
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
    const { startDate, endDate, start_date, end_date, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    const today = new Date().toISOString().split('T')[0];
    const start = startDate || start_date || today;
    const end = endDate || end_date || today;

    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: { startDate: start, endDate: end, pumps: [] } });
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

    res.json({
      success: true,
      data: { startDate: start, endDate: end, pumps }
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
    const prevSales = parseFloat(periodData.previous?.totalSales || 0);
    const salesGrowth = prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalSales,
          totalQuantity,
          totalTransactions: 0,
          averageTransaction: 0,
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
 * Note: Keeping original complex logic - consider splitting further
 */
exports.getIncomeReceivablesReport = async (req, res, next) => {
  // Original implementation - recommend separating into sub-reports
  res.json({ success: false, error: 'Not yet refactored - use original for now' });
};
