const { Sale, User, Pump, NozzleReading } = require('../models');
const { Op } = require('sequelize');

// Get sales with role-based filtering
exports.getSales = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = {};
    
    // Apply date filters if provided
    if (startDate || endDate) {
      whereClause.readingDate = {};
      if (startDate) whereClause.readingDate[Op.gte] = new Date(startDate);
      if (endDate) whereClause.readingDate[Op.lte] = new Date(endDate);
    }

    // Role-based access control
    if (req.user.role === 'Employee') {
      whereClause.userId = req.userId;
    } else if (req.user.role === 'Pump Owner') {
      const stationUsers = await User.findAll({
        where: { stationId: req.user.stationId },
        attributes: ['id']
      });
      whereClause.userId = stationUsers.map(u => u.id);
    }

    // Get sales data from nozzle readings
    const readings = await NozzleReading.findAndCountAll({
      where: {
        ...whereClause,
        litresSold: { [Op.gt]: 0 } // Only readings with actual sales
      },
      include: [{ model: User, as: 'user', attributes: ['name'] }],
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['readingDate', 'DESC'], ['readingTime', 'DESC']]
    });

    // Transform nozzle readings to sales format
    const salesData = readings.rows.map(reading => ({
      id: reading.id,
      pumpId: reading.pumpSno,
      fuelType: reading.fuelType,
      litres: reading.litresSold,
      pricePerLitre: reading.pricePerLitre,
      totalAmount: reading.totalAmount,
      timestamp: `${reading.readingDate}T${reading.readingTime || '00:00:00'}`,
      shift: getCurrentShiftFromReading(reading),
      user: reading.user,
      nozzleId: reading.nozzleId
    }));

    res.json({
      success: true,
      data: salesData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: readings.count,
        totalPages: Math.ceil(readings.count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales data'
    });
  }
};

// Get daily summary with role-based filtering
exports.getDailySummary = async (req, res) => {
  try {
    const { date } = req.params;
    
    let whereClause = {
      readingDate: date,
      litresSold: { [Op.gt]: 0 }
    };

    // Role-based access control
    if (req.user.role === 'Employee') {
      whereClause.userId = req.userId;
    } else if (req.user.role === 'Pump Owner') {
      const stationUsers = await User.findAll({
        where: { stationId: req.user.stationId },
        attributes: ['id']
      });
      whereClause.userId = stationUsers.map(u => u.id);
    }

    const readings = await NozzleReading.findAll({
      where: whereClause,
      attributes: ['fuelType', 'totalAmount', 'litresSold', 'readingTime']
    });

    if (readings.length === 0) {
      return res.json({
        success: true,
        data: {
          date,
          totalRevenue: 0,
          totalLitres: 0,
          totalTransactions: 0,
          fuelTypeBreakdown: {
            petrol: { revenue: 0, litres: 0, transactions: 0 },
            diesel: { revenue: 0, litres: 0, transactions: 0 }
          },
          hourlyBreakdown: []
        }
      });
    }

    const summary = readings.reduce((acc, reading) => {
      const revenue = parseFloat(reading.totalAmount || 0);
      const litres = parseFloat(reading.litresSold || 0);

      acc.totalRevenue += revenue;
      acc.totalLitres += litres;
      acc.totalTransactions += 1;

      const fuelKey = reading.fuelType.toLowerCase();
      if (acc.fuelTypeBreakdown[fuelKey]) {
        acc.fuelTypeBreakdown[fuelKey].revenue += revenue;
        acc.fuelTypeBreakdown[fuelKey].litres += litres;
        acc.fuelTypeBreakdown[fuelKey].transactions += 1;
      }

      return acc;
    }, {
      date,
      totalRevenue: 0,
      totalLitres: 0,
      totalTransactions: 0,
      fuelTypeBreakdown: {
        petrol: { revenue: 0, litres: 0, transactions: 0 },
        diesel: { revenue: 0, litres: 0, transactions: 0 }
      },
      hourlyBreakdown: []
    });

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch daily summary'
    });
  }
};

// Helper function to determine shift from reading time
const getCurrentShiftFromReading = (reading) => {
  if (!reading.readingTime) return 'morning';
  
  const hour = parseInt(reading.readingTime.split(':')[0]);
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'afternoon';
  return 'night';
};

// Get shift summary
exports.getShiftSummary = async (req, res) => {
  try {
    const { date, shift } = req.params;
    
    let whereClause = {
      shift,
      createdAt: {
        [require('sequelize').Op.gte]: new Date(date),
        [require('sequelize').Op.lt]: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
      }
    };

    // Role-based access control
    if (req.user.role === 'Employee') {
      whereClause.userId = req.userId;
    } else if (req.user.role === 'Pump Owner') {
      const stationUsers = await User.findAll({
        where: { stationId: req.user.stationId },
        attributes: ['id']
      });
      whereClause.userId = stationUsers.map(u => u.id);
    }

    const sales = await Sale.findAll({ where: whereClause });

    const summary = sales.reduce((acc, sale) => {
      acc.revenue += parseFloat(sale.totalAmount);
      acc.litres += parseFloat(sale.litres);
      acc.transactions += 1;
      return acc;
    }, {
      date,
      shift,
      revenue: 0,
      litres: 0,
      transactions: 0,
      startTime: shift === 'morning' ? '06:00' : shift === 'afternoon' ? '14:00' : '22:00',
      endTime: shift === 'morning' ? '14:00' : shift === 'afternoon' ? '22:00' : '06:00'
    });

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching shift summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shift summary'
    });
  }
};

// Get sales trends
exports.getSalesTrends = async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    let whereClause = {
      createdAt: {
        [require('sequelize').Op.gte]: startDate,
        [require('sequelize').Op.lte]: endDate
      }
    };

    // Role-based access control
    if (req.user.role === 'Employee') {
      whereClause.userId = req.userId;
    } else if (req.user.role === 'Pump Owner') {
      const stationUsers = await User.findAll({
        where: { stationId: req.user.stationId },
        attributes: ['id']
      });
      whereClause.userId = stationUsers.map(u => u.id);
    }

    const sales = await Sale.findAll({
      where: whereClause,
      attributes: ['createdAt', 'totalAmount', 'litres'],
      order: [['createdAt', 'ASC']]
    });

    // Group sales by date
    const trends = sales.reduce((acc, sale) => {
      const date = sale.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, revenue: 0, litres: 0 };
      }
      acc[date].revenue += parseFloat(sale.totalAmount);
      acc[date].litres += parseFloat(sale.litres);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        period,
        data: Object.values(trends)
      }
    });
  } catch (error) {
    console.error('Error fetching sales trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales trends'
    });
  }
};
