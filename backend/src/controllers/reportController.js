/**
 * Report Controller
 * Generate comprehensive reports for owners and managers
 */

const { NozzleReading, Nozzle, Pump, Station, User, Shift, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');

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
exports.getSalesReports = async (req, res, next) => {
  try {
    const { startDate, endDate, stationId } = req.query;
    const user = await User.findByPk(req.userId);
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const stationFilter = await getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: [] });
    }

    // Get stations
    const stations = await Station.findAll({
      where: stationFilter,
      attributes: ['id', 'name', 'code']
    });

    if (stations.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const stationIds = stations.map(s => s.id);

    // Get sales data grouped by station and date
    const salesData = await NozzleReading.findAll({
      attributes: [
        [fn('DATE', col('reading_date')), 'date'],
        'stationId',
        [fn('SUM', col('NozzleReading.total_amount')), 'totalSales'],
        [fn('SUM', col('NozzleReading.litres_sold')), 'totalQuantity'],
        [fn('COUNT', col('NozzleReading.id')), 'totalTransactions']
      ],
      where: {
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      group: ['date', 'stationId'],
      raw: true
    });

    // Get fuel type breakdown
    const fuelBreakdown = await NozzleReading.findAll({
      attributes: [
        [fn('DATE', col('reading_date')), 'date'],
        'stationId',
        'fuelType',
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
      group: ['date', 'stationId', 'fuelType'],
      raw: true
    });

    // Build report structure
    const reports = [];
    const stationMap = new Map(stations.map(s => [s.id, s]));

    salesData.forEach(sale => {
      const station = stationMap.get(sale.stationId);
      if (!station) return;

      const fuelSales = fuelBreakdown
        .filter(f => f.date === sale.date && f.stationId === sale.stationId)
        .map(f => ({
          fuelType: f.fuelType,
          sales: parseFloat(f.sales || 0),
          quantity: parseFloat(f.quantity || 0),
          transactions: parseInt(f.transactions || 0)
        }));

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

    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    console.error('Sales reports error:', error);
    next(error);
  }
};

/**
 * Get shift reports
 * GET /api/v1/reports/shifts
 */
exports.getShiftReports = async (req, res, next) => {
  try {
    const { startDate, endDate, stationId } = req.query;
    const user = await User.findByPk(req.userId);
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const stationFilter = await getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: [] });
    }

    // Get stations
    const stations = await Station.findAll({
      where: stationFilter,
      attributes: ['id', 'name']
    });

    if (stations.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const stationIds = stations.map(s => s.id);

    // Get shifts
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

    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    console.error('Shift reports error:', error);
    next(error);
  }
};

/**
 * Get pump performance reports
 * GET /api/v1/reports/pumps
 */
exports.getPumpPerformance = async (req, res, next) => {
  try {
    const { startDate, endDate, stationId } = req.query;
    const user = await User.findByPk(req.userId);
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const stationFilter = await getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json({ success: true, data: [] });
    }

    // Get stations
    const stations = await Station.findAll({
      where: stationFilter,
      attributes: ['id', 'name']
    });

    if (stations.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const stationIds = stations.map(s => s.id);

    // Get pump performance data
    const pumpData = await NozzleReading.findAll({
      attributes: [
        [col('pump.id'), 'pumpId'],
        [col('pump.name'), 'pumpName'],
        [col('pump.pump_number'), 'pumpNumber'],
        [col('pump->station.name'), 'stationName'],
        [fn('SUM', col('NozzleReading.total_amount')), 'totalSales'],
        [fn('SUM', col('NozzleReading.litres_sold')), 'totalQuantity'],
        [fn('COUNT', col('NozzleReading.id')), 'transactions']
      ],
      include: [{
        model: Pump,
        as: 'pump',
        attributes: [],
        where: { stationId: { [Op.in]: stationIds } },
        include: [{
          model: Station,
          as: 'station',
          attributes: []
        }]
      }],
      where: {
        readingDate: {
          [Op.between]: [startDate, endDate]
        },
        isInitialReading: false,
        litresSold: { [Op.gt]: 0 }
      },
      group: ['pumpId'],
      raw: true
    });

    // Get nozzle breakdown per pump
    const nozzleData = await NozzleReading.findAll({
      attributes: [
        [col('pump.id'), 'pumpId'],
        [col('nozzle.id'), 'nozzleId'],
        [col('nozzle.nozzle_number'), 'nozzleNumber'],
        [col('nozzle.fuel_type'), 'fuelType'],
        [fn('SUM', col('NozzleReading.total_amount')), 'sales'],
        [fn('SUM', col('NozzleReading.litres_sold')), 'quantity']
      ],
      include: [{
        model: Pump,
        as: 'pump',
        attributes: [],
        where: { stationId: { [Op.in]: stationIds } }
      }, {
        model: Nozzle,
        as: 'nozzle',
        attributes: []
      }],
      where: {
        readingDate: {
          [Op.between]: [startDate, endDate]
        },
        isInitialReading: false,
        litresSold: { [Op.gt]: 0 }
      },
      group: ['pumpId', 'nozzleId'],
      raw: true
    });

    // Get all pumps for the stations
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

    // Build report structure
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

    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    console.error('Pump performance error:', error);
    next(error);
  }
};
