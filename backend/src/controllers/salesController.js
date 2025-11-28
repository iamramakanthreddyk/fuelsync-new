/**
 * Sales Controller
 * Handles sales data retrieval and calculations from NozzleReading
 */

const { NozzleReading, Nozzle, Pump, Station, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Get sales data with filters
 * @route GET /api/v1/sales
 * @access Private
 */
exports.getSales = async (req, res) => {
  try {
    const { station_id, date, start_date, end_date, fuel_type, payment_type } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Build where clause
    const where = {};

    // Station filter - required for non-super_admin
    if (station_id) {
      where.stationId = station_id;
    } else if (userRole !== 'super_admin') {
      // For non-super_admin, get their accessible stations
      const userStations = await Station.findAll({
        where: {
          [Op.or]: [
            { ownerId: userId },
            { '$Users.id$': userId }
          ]
        },
        include: [{
          model: User,
          as: 'Users',
          through: { attributes: [] },
          required: false
        }],
        attributes: ['id']
      });
      
      const stationIds = userStations.map(s => s.id);
      if (stationIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      where.stationId = { [Op.in]: stationIds };
    }

    // Date filters
    if (date) {
      where.readingDate = date;
    } else if (start_date && end_date) {
      where.readingDate = {
        [Op.between]: [start_date, end_date]
      };
    } else if (start_date) {
      where.readingDate = {
        [Op.gte]: start_date
      };
    } else if (end_date) {
      where.readingDate = {
        [Op.lte]: end_date
      };
    }

    // Only get readings with actual sales
    where.litresSold = {
      [Op.gt]: 0
    };

    // Fuel type filter via nozzle
    const nozzleWhere = {};
    if (fuel_type) {
      nozzleWhere.fuelType = fuel_type;
    }

    // Fetch sales (readings with sales)
    const sales = await NozzleReading.findAll({
      where,
      include: [
        {
          model: Nozzle,
          as: 'nozzle',
          where: nozzleWhere,
          attributes: ['id', 'nozzleNumber', 'fuelType'],
          include: [{
            model: Pump,
            as: 'pump',
            attributes: ['id', 'pumpNumber', 'name']
          }]
        },
        {
          model: Station,
          as: 'station',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'enteredByUser',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
    });

    // Transform to sales format
    const salesData = sales.map(reading => ({
      id: reading.id,
      station_id: reading.stationId,
      station_name: reading.station?.name,
      nozzle_id: reading.nozzleId,
      nozzle_number: reading.nozzle?.nozzleNumber,
      fuel_type: reading.nozzle?.fuelType,
      pump_id: reading.nozzle?.pump?.id,
      pump_name: reading.nozzle?.pump?.name || `Pump ${reading.nozzle?.pump?.pumpNumber}`,
      reading_id: reading.id,
      reading_date: reading.readingDate,
      delta_volume_l: parseFloat(reading.litresSold),
      price_per_litre: parseFloat(reading.pricePerLitre),
      total_amount: parseFloat(reading.totalAmount),
      payment_breakdown: reading.paymentBreakdown,
      cash_amount: parseFloat(reading.cashAmount || 0),
      online_amount: parseFloat(reading.onlineAmount || 0),
      entered_by: reading.enteredByUser?.name,
      created_at: reading.createdAt
    }));

    // Apply payment type filter if specified
    let filteredSales = salesData;
    if (payment_type) {
      filteredSales = salesData.filter(sale => {
        if (payment_type === 'cash') {
          return sale.cash_amount > 0 || (sale.payment_breakdown && sale.payment_breakdown.cash > 0);
        } else if (payment_type === 'online') {
          return sale.online_amount > 0 || (sale.payment_breakdown && (sale.payment_breakdown.upi > 0 || sale.payment_breakdown.card > 0));
        } else if (payment_type === 'credit') {
          return sale.payment_breakdown && sale.payment_breakdown.credit > 0;
        }
        return true;
      });
    }

    res.json({ success: true, data: filteredSales });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch sales data',
      details: error.message 
    });
  }
};

/**
 * Get sales summary/aggregates
 * @route GET /api/v1/sales/summary
 * @access Private
 */
exports.getSalesSummary = async (req, res) => {
  try {
    const { station_id, date, start_date, end_date } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Build where clause (similar to getSales)
    const where = {};

    if (station_id) {
      where.stationId = station_id;
    } else if (userRole !== 'super_admin') {
      const userStations = await Station.findAll({
        where: {
          [Op.or]: [
            { ownerId: userId },
            { '$Users.id$': userId }
          ]
        },
        include: [{
          model: User,
          as: 'Users',
          through: { attributes: [] },
          required: false
        }],
        attributes: ['id']
      });
      
      const stationIds = userStations.map(s => s.id);
      if (stationIds.length === 0) {
        return res.json({ 
          success: true, 
          data: { total_sales: 0, total_litres: 0, total_amount: 0, by_fuel_type: {} }
        });
      }
      where.stationId = { [Op.in]: stationIds };
    }

    // Date filters
    if (date) {
      where.readingDate = date;
    } else if (start_date && end_date) {
      where.readingDate = { [Op.between]: [start_date, end_date] };
    } else if (start_date) {
      where.readingDate = { [Op.gte]: start_date };
    } else if (end_date) {
      where.readingDate = { [Op.lte]: end_date };
    }

    where.litresSold = { [Op.gt]: 0 };

    // Fetch sales with aggregates
    const sales = await NozzleReading.findAll({
      where,
      include: [{
        model: Nozzle,
        as: 'nozzle',
        attributes: ['fuelType']
      }],
      attributes: ['litresSold', 'totalAmount', 'cashAmount', 'onlineAmount', 'paymentBreakdown']
    });

    // Calculate summaries
    let totalLitres = 0;
    let totalAmount = 0;
    let cashAmount = 0;
    let onlineAmount = 0;
    let creditAmount = 0;
    const byFuelType = {};

    sales.forEach(sale => {
      const litres = parseFloat(sale.litresSold);
      const amount = parseFloat(sale.totalAmount);
      const fuelType = sale.nozzle?.fuelType || 'UNKNOWN';

      totalLitres += litres;
      totalAmount += amount;
      cashAmount += parseFloat(sale.cashAmount || 0);
      onlineAmount += parseFloat(sale.onlineAmount || 0);

      if (sale.paymentBreakdown && sale.paymentBreakdown.credit) {
        creditAmount += parseFloat(sale.paymentBreakdown.credit);
      }

      if (!byFuelType[fuelType]) {
        byFuelType[fuelType] = { litres: 0, amount: 0, count: 0 };
      }
      byFuelType[fuelType].litres += litres;
      byFuelType[fuelType].amount += amount;
      byFuelType[fuelType].count += 1;
    });

    res.json({
      success: true,
      data: {
        total_sales: sales.length,
        total_litres: Math.round(totalLitres * 100) / 100,
        total_amount: Math.round(totalAmount * 100) / 100,
        cash_amount: Math.round(cashAmount * 100) / 100,
        online_amount: Math.round(onlineAmount * 100) / 100,
        credit_amount: Math.round(creditAmount * 100) / 100,
        by_fuel_type: byFuelType
      }
    });
  } catch (error) {
    console.error('Get sales summary error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch sales summary',
      details: error.message 
    });
  }
};
