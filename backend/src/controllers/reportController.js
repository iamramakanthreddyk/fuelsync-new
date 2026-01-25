/**
 * Report Controller
 * Generate comprehensive reports for owners and managers
 */

const { NozzleReading, Nozzle, Pump, Station, User, Shift, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');

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
        ...EXCLUDE_SAMPLE_READINGS,
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
        ...EXCLUDE_SAMPLE_READINGS,
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

    // Check what values we have in litres_sold (sample)
    const sampleReadings = await NozzleReading.findAll({
      attributes: ['id', 'pumpId', 'nozzleId', 'litres_sold', 'price_per_litre', 'totalAmount', 'readingDate', 'isInitialReading'],
      where: {
        pumpId: { [Op.in]: pumpIds },
        readingDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      limit: 5,
      raw: true
    });
    console.log('[DIAGNOSTIC] Sample readings (first 5):', JSON.stringify(sampleReadings, null, 2));

    // Check if any rows exist for the pumpIds without date filtering
    const diagnosticPumpCheck = await NozzleReading.count({
      where: {
        pumpId: { [Op.in]: pumpIds }
      }
    });

    // Get pump performance data - use LEFT JOIN and filter by pump IDs
    const pumpData = await NozzleReading.findAll({
      attributes: [
        [col('pump.id'), 'pumpId'],
        [col('pump.name'), 'pumpName'],
        [col('pump.pump_number'), 'pumpNumber'],
        [fn('MAX', col('pump->station.name')), 'stationName'], // Use MAX to get station name
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
        [fn('SUM', col('litres_sold')), 'totalQuantity'],
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
        ...EXCLUDE_SAMPLE_READINGS,
        pumpId: { [Op.in]: pumpIds }, // Filter by pump IDs we know belong to user's stations
        readingDate: {
          [Op.between]: [startDate, endDate]
        }
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
        pumpId: { [Op.in]: pumpIds }, // Filter by pump IDs
        readingDate: {
          [Op.between]: [startDate, endDate]
        },
        [Op.or]: [
          { litresSold: { [Op.gt]: 0 } },
          { isInitialReading: true }
        ]
      },
      group: ['pump.id', 'nozzle.id', 'nozzle.nozzle_number', 'nozzle.fuel_type'],
      raw: true
    });
    console.log('[DEBUG] nozzleData rows returned:', nozzleData.length);
    if (nozzleData.length > 0) console.log('[DEBUG] nozzleData first row:', JSON.stringify(nozzleData[0]));

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


    // Get all readings for the date (for sale/liters/fuel breakdown)
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

    // Get settlements for the date
    const { Settlement } = require('../models');
    const settlements = await Settlement.findAll({
      where: {
        stationId: { [Op.in]: stationIds },
        date: queryDate,
        isFinal: true
      },
      raw: true
    });

    // Build report with fuel type breakdown and settled values
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

    // Attach settlement values if present
    settlements.forEach(settlement => {
      const stationId = settlement.stationId;
      if (reportData[stationId]) {
        reportData[stationId].settledCash = parseFloat(settlement.actualCash || 0);
        reportData[stationId].settledOnline = parseFloat(settlement.online || 0);
        reportData[stationId].settledCredit = parseFloat(settlement.credit || 0);
        reportData[stationId].settlementStatus = settlement.status;
      }
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
/**
 * Get sample/test readings report
 * Shows how many sample readings were taken per day for quality checks
 * GET /api/v1/reports/sample-readings
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&stationId=uuid
 */
exports.getSampleReadingsReport = async (req, res, next) => {
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
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view reports'
      });
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

    // Get sample readings grouped by date and nozzle
    const sampleReadings = await NozzleReading.findAll({
      where: {
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.between]: [startDate, endDate]
        },
        isSample: true  // Only sample readings
      },
      include: [
        {
          model: Nozzle,
          as: 'nozzle',
          attributes: ['id', 'nozzleNumber', 'fuelType'],
          include: [{
            model: Pump,
            as: 'pump',
            attributes: ['id', 'pumpNumber', 'name']
          }]
        },
        {
          model: User,
          as: 'enteredByUser',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
      raw: false
    });

    // Group by date
    const groupedByDate = {};
    sampleReadings.forEach(reading => {
      const date = reading.readingDate;
      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date,
          totalSamples: 0,
          byNozzle: {},
          readings: []
        };
      }
      
      groupedByDate[date].totalSamples += 1;
      
      const nozzleKey = `${reading.nozzle?.pump?.name || 'Unknown'} - Nozzle ${reading.nozzle?.nozzleNumber || 'N/A'} (${reading.nozzle?.fuelType || 'Unknown'})`;
      if (!groupedByDate[date].byNozzle[nozzleKey]) {
        groupedByDate[date].byNozzle[nozzleKey] = 0;
      }
      groupedByDate[date].byNozzle[nozzleKey] += 1;
      
      groupedByDate[date].readings.push({
        id: reading.id,
        readingDate: reading.readingDate,
        readingValue: parseFloat(reading.readingValue),
        litresSold: parseFloat(reading.litresSold),
        nozzleNumber: reading.nozzle?.nozzleNumber,
        fuelType: reading.nozzle?.fuelType,
        pumpName: reading.nozzle?.pump?.name,
        enteredBy: reading.enteredByUser?.name || 'Unknown',
        enteredAt: reading.createdAt,
        notes: reading.notes
      });
    });

    // Convert to array and sort by date desc
    const result = Object.values(groupedByDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      data: {
        summary: {
          dateRange: { startDate, endDate },
          totalSampleReadings: sampleReadings.length,
          stationsIncluded: stations.map(s => ({ id: s.id, name: s.name, code: s.code }))
        },
        details: result
      }
    });

  } catch (error) {
    console.error('Sample readings report error:', error);
    next(error);
  }
};

/**
 * Get sample reading statistics and frequency
 * Shows testing frequency and patterns for quality verification
 * GET /api/v1/reports/sample-statistics
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&stationId=uuid
 */
exports.getSampleStatistics = async (req, res, next) => {
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
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    const stations = await Station.findAll({
      where: stationFilter,
      attributes: ['id', 'name', 'code']
    });

    if (stations.length === 0) {
      return res.json({ success: true, data: { summary: {}, details: [] } });
    }

    const stationIds = stations.map(s => s.id);

    // Get sample reading statistics
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

    // Get per-nozzle frequency
    const nozzleFrequency = await NozzleReading.findAll({
      attributes: [
        'nozzleId',
        'stationId',
        [fn('COUNT', col('id')), 'sampleCount'],
        [fn('MAX', col('created_at')), 'lastSampleDate']
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
      group: ['nozzleId', 'stationId', 'nozzle.id', 'nozzle->pump.id'],
      order: [[col('COUNT(id)'), 'DESC']],
      raw: false
    });

    // Get per-user frequency (who performed the tests)
    const userFrequency = await NozzleReading.findAll({
      attributes: [
        'enteredBy',
        [fn('COUNT', col('id')), 'sampleCount'],
        [fn('MAX', col('created_at')), 'lastSampleDate']
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
      order: [[col('COUNT(id)'), 'DESC']],
      raw: false
    });

    // Calculate summary statistics
    const totalSamples = stats.reduce((sum, s) => sum + (parseInt(s.sampleCount) || 0), 0);
    const avgSamplesPerDay = stats.length > 0 ? (totalSamples / stats.length).toFixed(2) : 0;
    const daysWithSamples = stats.length;
    const totalDays = Math.floor((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

    res.json({
      success: true,
      data: {
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
      }
    });

  } catch (error) {
    console.error('Sample statistics error:', error);
    next(error);
  }
};