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
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
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
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'sales'],
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
  // Move these declarations outside try so they are available in catch
  let startDate, endDate, stationId, stationFilter;
  try {
    ({ startDate, endDate, stationId } = req.query);
    const user = await User.findByPk(req.userId);
    
    console.log('Pump performance request:', {
      userId: req.userId,
      userRole: user?.role,
      stationId,
      startDate,
      endDate
    });
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    stationFilter = await getStationFilter(user, stationId);
    console.log('Station filter:', stationFilter);
    
    if (stationFilter === null) {
      return res.json({ success: true, data: [] });
    }

    // Get stations
    const stations = await Station.findAll({
      where: stationFilter,
      attributes: ['id', 'name']
    });

    console.log('Found stations:', stations.length, stations.map(s => s.name));
    
    if (stations.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const stationIds = stations.map(s => s.id);

    // Get pump IDs for the stations first to avoid complex joins
    const pumpsForStations = await Pump.findAll({
      where: { stationId: { [Op.in]: stationIds } },
      attributes: ['id']
    });
    const pumpIds = pumpsForStations.map(p => p.id);

    console.log('Found pumps:', pumpIds.length);
    
    if (pumpIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get pump performance data - use LEFT JOIN and filter by pump IDs
    const pumpData = await NozzleReading.findAll({
      attributes: [
        [col('pump.id'), 'pumpId'],
        [col('pump.name'), 'pumpName'],
        [col('pump.pump_number'), 'pumpNumber'],
        [fn('MAX', col('pump->station.name')), 'stationName'], // Use MAX to get station name
        [fn('SUM', col('NozzleReading.total_amount')), 'totalSales'],
        [fn('SUM', col('NozzleReading.litres_sold')), 'totalQuantity'],
        [fn('COUNT', col('NozzleReading.id')), 'transactions']
      ],
      include: [{
        model: Pump,
        as: 'pump',
        attributes: [],
        required: false, // LEFT JOIN to handle missing pumps
        include: [{
          model: Station,
          as: 'station',
          attributes: [],
          required: false // LEFT JOIN for station
        }]
      }],
      where: {
        pumpId: { [Op.in]: pumpIds }, // Filter by pump IDs we know belong to user's stations
        readingDate: {
          [Op.between]: [startDate, endDate]
        },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ],
        litresSold: { [Op.gt]: 0 }
      },
      group: ['pump.id', 'pump.name', 'pump.pump_number'], // Remove station name from GROUP BY
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
        required: false
      }, {
        model: Nozzle,
        as: 'nozzle',
        attributes: [],
        required: false
      }],
      where: {
        pumpId: { [Op.in]: pumpIds }, // Filter by pump IDs
        readingDate: {
          [Op.between]: [startDate, endDate]
        },
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ],
        litresSold: { [Op.gt]: 0 }
      },
      group: ['pump.id', 'nozzle.id', 'nozzle.nozzle_number', 'nozzle.fuel_type'],
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
    console.error('Pump performance error:', {
      message: error.message,
      stack: error.stack,
      query: {
        startDate,
        endDate,
        stationId,
        stationFilter: stationFilter ? Object.keys(stationFilter) : null
      }
    });
    next(error);
  }
};

/**
 * Get daily sales report for today (or specified date)
 * GET /api/v1/reports/daily-sales?date=YYYY-MM-DD
 */
exports.getDailySalesReport = async (req, res, next) => {
  try {
    const { date, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    const queryDate = date || new Date().toISOString().split('T')[0];
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

    // Get all readings for the date
    const readings = await NozzleReading.findAll({
      attributes: [
        'stationId',
        'fuelType',
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalValue'],
        [fn('SUM', col('NozzleReading.litres_sold')), 'totalLiters'],
        [fn('COUNT', col('NozzleReading.id')), 'readingsCount']
      ],
      where: {
        stationId: { [Op.in]: stationIds },
        readingDate: queryDate
      },
      group: ['stationId', 'fuelType'],
      raw: true
    });

    // Build report with fuel type breakdown
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
          byFuelType: {}
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

    // Convert to array and round values
    const result = Object.values(reportData).map(report => ({
      ...report,
      totalSaleValue: parseFloat(report.totalSaleValue.toFixed(2)),
      totalLiters: parseFloat(report.totalLiters.toFixed(2))
    }));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Daily sales report error:', error);
    next(error);
  }
};
