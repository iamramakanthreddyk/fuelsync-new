/**
 * Dashboard Controller
 * Provides analytics and summary data for dashboards
 */

const { Station, User, Pump, Nozzle, Sale, FuelPrice, Upload, OCRReading } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Get dashboard summary for current user
 * @route GET /api/v1/dashboard/summary
 * @access All authenticated users
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let stationFilter = {};
    
    // Role-based filtering
    if (req.user.role !== 'super_admin') {
      if (!req.user.stationId) {
        return res.json({
          success: true,
          data: {
            todaySales: { revenue: 0, litres: 0, transactions: 0 },
            yesterdaySales: { revenue: 0, litres: 0, transactions: 0 },
            percentageChange: { revenue: 0, litres: 0 },
            activePumps: 0,
            activeNozzles: 0,
            pendingUploads: 0
          }
        });
      }
      stationFilter.stationId = req.user.stationId;
    }

    // Today's sales
    const todaySales = await Sale.findOne({
      where: {
        ...stationFilter,
        saleDate: today
      },
      attributes: [
        [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'revenue'],
        [fn('COALESCE', fn('SUM', col('litres_sold')), 0), 'litres'],
        [fn('COUNT', col('id')), 'transactions']
      ],
      raw: true
    });

    // Yesterday's sales for comparison
    const yesterdaySales = await Sale.findOne({
      where: {
        ...stationFilter,
        saleDate: yesterday
      },
      attributes: [
        [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'revenue'],
        [fn('COALESCE', fn('SUM', col('litres_sold')), 0), 'litres'],
        [fn('COUNT', col('id')), 'transactions']
      ],
      raw: true
    });

    // Active pumps count
    const activePumps = await Pump.count({
      where: {
        ...stationFilter,
        status: 'active'
      }
    });

    // Active nozzles count
    const activeNozzles = await Nozzle.count({
      include: [{
        model: Pump,
        as: 'pump',
        where: stationFilter.stationId ? { stationId: stationFilter.stationId } : {},
        required: true
      }],
      where: { status: 'active' }
    });

    // Pending uploads
    const pendingUploads = await Upload.count({
      where: {
        ...stationFilter,
        status: 'processing'
      }
    });

    // Calculate percentage changes
    const todayRevenue = parseFloat(todaySales?.revenue || 0);
    const yesterdayRevenue = parseFloat(yesterdaySales?.revenue || 0);
    const todayLitres = parseFloat(todaySales?.litres || 0);
    const yesterdayLitres = parseFloat(yesterdaySales?.litres || 0);

    const revenueChange = yesterdayRevenue > 0 
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
      : 0;
    const litresChange = yesterdayLitres > 0 
      ? ((todayLitres - yesterdayLitres) / yesterdayLitres) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        todaySales: {
          revenue: todayRevenue,
          litres: todayLitres,
          transactions: parseInt(todaySales?.transactions || 0)
        },
        yesterdaySales: {
          revenue: yesterdayRevenue,
          litres: yesterdayLitres,
          transactions: parseInt(yesterdaySales?.transactions || 0)
        },
        percentageChange: {
          revenue: Math.round(revenueChange * 100) / 100,
          litres: Math.round(litresChange * 100) / 100
        },
        activePumps,
        activeNozzles,
        pendingUploads
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard summary'
    });
  }
};

/**
 * Get sales trends over time
 * @route GET /api/v1/dashboard/trends
 * @access All authenticated users
 */
exports.getSalesTrends = async (req, res) => {
  try {
    const { period = '7d', groupBy = 'day' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d': startDate.setDate(startDate.getDate() - 7); break;
      case '14d': startDate.setDate(startDate.getDate() - 14); break;
      case '30d': startDate.setDate(startDate.getDate() - 30); break;
      case '90d': startDate.setDate(startDate.getDate() - 90); break;
      default: startDate.setDate(startDate.getDate() - 7);
    }

    let stationFilter = {};
    if (req.user.role !== 'super_admin' && req.user.stationId) {
      stationFilter.stationId = req.user.stationId;
    }

    // Get daily sales data
    const sales = await Sale.findAll({
      where: {
        ...stationFilter,
        saleDate: { [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]] }
      },
      attributes: [
        'saleDate',
        [fn('SUM', col('total_amount')), 'revenue'],
        [fn('SUM', col('litres_sold')), 'litres'],
        [fn('COUNT', col('id')), 'transactions']
      ],
      group: ['saleDate'],
      order: [['saleDate', 'ASC']],
      raw: true
    });

    // Fill in missing dates with zero values
    const dateMap = {};
    sales.forEach(s => {
      dateMap[s.saleDate] = {
        date: s.saleDate,
        revenue: parseFloat(s.revenue || 0),
        litres: parseFloat(s.litres || 0),
        transactions: parseInt(s.transactions || 0)
      };
    });

    const trends = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      trends.push(dateMap[dateStr] || {
        date: dateStr,
        revenue: 0,
        litres: 0,
        transactions: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        trends
      }
    });
  } catch (error) {
    console.error('Sales trends error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales trends'
    });
  }
};

/**
 * Get fuel type breakdown
 * @route GET /api/v1/dashboard/fuel-breakdown
 * @access All authenticated users
 */
exports.getFuelBreakdown = async (req, res) => {
  try {
    const { period = '7d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'today': break;
      case '7d': startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setDate(startDate.getDate() - 30); break;
      default: startDate.setDate(startDate.getDate() - 7);
    }

    let stationFilter = {};
    if (req.user.role !== 'super_admin' && req.user.stationId) {
      stationFilter.stationId = req.user.stationId;
    }

    const breakdown = await Sale.findAll({
      where: {
        ...stationFilter,
        saleDate: { [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]] }
      },
      attributes: [
        'fuelType',
        [fn('SUM', col('total_amount')), 'revenue'],
        [fn('SUM', col('litres_sold')), 'litres'],
        [fn('COUNT', col('id')), 'transactions'],
        [fn('AVG', col('price_per_litre')), 'avgPrice']
      ],
      group: ['fuelType'],
      raw: true
    });

    const result = {};
    let totalRevenue = 0;
    let totalLitres = 0;

    breakdown.forEach(b => {
      const revenue = parseFloat(b.revenue || 0);
      const litres = parseFloat(b.litres || 0);
      totalRevenue += revenue;
      totalLitres += litres;

      result[b.fuelType] = {
        revenue,
        litres,
        transactions: parseInt(b.transactions || 0),
        avgPrice: parseFloat(parseFloat(b.avgPrice || 0).toFixed(2))
      };
    });

    // Add percentages
    Object.keys(result).forEach(fuelType => {
      result[fuelType].revenuePercentage = totalRevenue > 0 
        ? Math.round((result[fuelType].revenue / totalRevenue) * 10000) / 100 
        : 0;
      result[fuelType].litresPercentage = totalLitres > 0 
        ? Math.round((result[fuelType].litres / totalLitres) * 10000) / 100 
        : 0;
    });

    res.json({
      success: true,
      data: {
        period,
        totals: { revenue: totalRevenue, litres: totalLitres },
        breakdown: result
      }
    });
  } catch (error) {
    console.error('Fuel breakdown error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fuel breakdown'
    });
  }
};

/**
 * Get pump performance data
 * @route GET /api/v1/dashboard/pump-performance
 * @access Manager, Owner, Super Admin
 */
exports.getPumpPerformance = async (req, res) => {
  try {
    const { period = '7d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'today': break;
      case '7d': startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setDate(startDate.getDate() - 30); break;
      default: startDate.setDate(startDate.getDate() - 7);
    }

    let stationFilter = {};
    if (req.user.role !== 'super_admin' && req.user.stationId) {
      stationFilter.stationId = req.user.stationId;
    }

    const pumps = await Pump.findAll({
      where: {
        ...stationFilter,
        status: 'active'
      },
      include: [{
        model: Sale,
        as: 'sales',
        where: {
          saleDate: { [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]] }
        },
        required: false,
        attributes: []
      }],
      attributes: [
        'id',
        'name',
        'pumpSno',
        'status',
        [fn('COALESCE', fn('SUM', col('sales.total_amount')), 0), 'totalRevenue'],
        [fn('COALESCE', fn('SUM', col('sales.litres_sold')), 0), 'totalLitres'],
        [fn('COUNT', col('sales.id')), 'transactionCount']
      ],
      group: ['Pump.id', 'Pump.name', 'Pump.pump_sno', 'Pump.status'],
      order: [[literal('totalRevenue'), 'DESC']]
    });

    const performance = pumps.map(p => ({
      id: p.id,
      name: p.name,
      pumpSno: p.pumpSno,
      status: p.status,
      revenue: parseFloat(p.getDataValue('totalRevenue') || 0),
      litres: parseFloat(p.getDataValue('totalLitres') || 0),
      transactions: parseInt(p.getDataValue('transactionCount') || 0)
    }));

    res.json({
      success: true,
      data: {
        period,
        pumps: performance
      }
    });
  } catch (error) {
    console.error('Pump performance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pump performance'
    });
  }
};

/**
 * Get shift-wise breakdown
 * @route GET /api/v1/dashboard/shift-breakdown
 * @access All authenticated users
 */
exports.getShiftBreakdown = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let stationFilter = {};
    if (req.user.role !== 'super_admin' && req.user.stationId) {
      stationFilter.stationId = req.user.stationId;
    }

    const shifts = await Sale.findAll({
      where: {
        ...stationFilter,
        saleDate: targetDate
      },
      attributes: [
        'shift',
        [fn('SUM', col('total_amount')), 'revenue'],
        [fn('SUM', col('litres_sold')), 'litres'],
        [fn('COUNT', col('id')), 'transactions']
      ],
      group: ['shift'],
      raw: true
    });

    const shiftTimes = {
      morning: { start: '06:00', end: '14:00' },
      afternoon: { start: '14:00', end: '22:00' },
      night: { start: '22:00', end: '06:00' }
    };

    const breakdown = {};
    ['morning', 'afternoon', 'night'].forEach(shift => {
      const shiftData = shifts.find(s => s.shift === shift);
      breakdown[shift] = {
        ...shiftTimes[shift],
        revenue: parseFloat(shiftData?.revenue || 0),
        litres: parseFloat(shiftData?.litres || 0),
        transactions: parseInt(shiftData?.transactions || 0)
      };
    });

    res.json({
      success: true,
      data: {
        date: targetDate,
        shifts: breakdown
      }
    });
  } catch (error) {
    console.error('Shift breakdown error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shift breakdown'
    });
  }
};

/**
 * Get super admin overview (platform-wide stats)
 * @route GET /api/v1/dashboard/admin-overview
 * @access Super Admin only
 */
exports.getAdminOverview = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Super admin access required'
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get counts
    const [
      totalStations,
      activeStations,
      totalUsers,
      activeUsers,
      totalPumps,
      todayRevenue
    ] = await Promise.all([
      Station.count(),
      Station.count({ where: { isActive: true } }),
      User.count(),
      User.count({ where: { isActive: true } }),
      Pump.count({ where: { status: 'active' } }),
      Sale.sum('total_amount', { where: { saleDate: today } })
    ]);

    // Users by role
    const usersByRole = await User.findAll({
      attributes: [
        'role',
        [fn('COUNT', col('id')), 'count']
      ],
      group: ['role'],
      raw: true
    });

    // Top performing stations today
    const topStations = await Sale.findAll({
      where: { saleDate: today },
      attributes: [
        'stationId',
        [fn('SUM', col('total_amount')), 'revenue']
      ],
      include: [{
        model: Station,
        as: 'station',
        attributes: ['name', 'location']
      }],
      group: ['stationId', 'station.id', 'station.name', 'station.location'],
      order: [[literal('revenue'), 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalStations,
          activeStations,
          totalUsers,
          activeUsers,
          totalPumps,
          todayRevenue: parseFloat(todayRevenue || 0)
        },
        usersByRole: usersByRole.reduce((acc, u) => {
          acc[u.role] = parseInt(u.count);
          return acc;
        }, {}),
        topStations: topStations.map(s => ({
          id: s.stationId,
          name: s.station?.name,
          location: s.station?.location,
          revenue: parseFloat(s.getDataValue('revenue') || 0)
        }))
      }
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin overview'
    });
  }
};
