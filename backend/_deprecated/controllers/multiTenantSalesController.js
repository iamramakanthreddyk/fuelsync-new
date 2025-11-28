const { Sale, OCRReading, Station, User, Pump, Nozzle } = require('../models');
const { Op } = require('sequelize');
const MultiTenantSalesService = require('../services/multiTenantSalesService');

// Main paginated/filterable list endpoint
exports.salesPageList = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Access denied" });
    }
    let result;
    try {
      result = await MultiTenantSalesService.listSalesPaginated({ user, query: req.query });
    } catch (e) {
      return res.status(403).json({ success: false, error: e.message || "Denied" });
    }
    res.json({ success: true, data: result.sales, pagination: result.pagination });
  } catch (err) {
    console.error('[Sales List Error]', err);
    res.status(500).json({ success: false, error: 'Failed to fetch sales list' });
  }
};

// Sales summary endpoint
exports.salesSummary = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Access denied" });
    }
    let summary;
    try {
      summary = await MultiTenantSalesService.getSalesSummary({ user, query: req.query });
    } catch (e) {
      return res.status(403).json({ success: false, error: e.message || "Denied" });
    }
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('[Sales Summary Error]', err);
    res.status(500).json({ success: false, error: 'Failed to fetch summary' });
  }
};

/**
 * Multi-tenant sales controller with station-based isolation
 */
class MultiTenantSalesController {
  
  /**
   * Get sales trends for dashboard charts
   */
  static async getSalesTrends(req, res) {
    try {
      console.log('📈 Fetching sales trends for user:', req.userId);
      const { days = 7 } = req.query;

      // Get user with station info
      const user = await User.findByPk(req.userId, {
        include: [{ model: Station, as: 'station' }]
      });

      if (!user || !user.station) {
        return res.status(400).json({
          success: false,
          error: 'User must be assigned to a station'
        });
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(days));

      const sales = await Sale.findAll({
        where: {
          stationId: user.stationId,
          saleDate: {
            [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
          }
        },
        order: [['saleDate', 'ASC']]
      });

      // Group by date
      const trendsMap = {};
      sales.forEach(sale => {
        const date = sale.saleDate;
        if (!trendsMap[date]) {
          trendsMap[date] = {
            date,
            revenue: 0,
            litres: 0,
            transactions: 0
          };
        }
        trendsMap[date].revenue += parseFloat(sale.totalAmount);
        trendsMap[date].litres += parseFloat(sale.litresSold);
        trendsMap[date].transactions += 1;
      });

      const trends = Object.values(trendsMap);

      console.log('✅ Sales trends calculated for', days, 'days');

      res.json({
        success: true,
        data: trends
      });

    } catch (error) {
      console.error('❌ Get sales trends error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sales trends'
      });
    }
  }

  /**
   * Get daily summary for user's station
   */
  static async getDailySummary(req, res) {
    try {
      console.log('📊 Fetching daily summary for user:', req.userId);
      const { date } = req.params;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: 'Date parameter is required'
        });
      }

      // Get user with station info
      const user = await User.findByPk(req.userId, {
        include: [{ model: Station, as: 'station' }]
      });

      if (!user || !user.station) {
        return res.status(400).json({
          success: false,
          error: 'User must be assigned to a station'
        });
      }

      // Get sales for the specific date
      const sales = await Sale.findAll({
        where: {
          stationId: user.stationId,
          saleDate: date
        },
        include: [
          {
            model: Pump,
            as: 'pump',
            attributes: ['name', 'pumpSno']
          }
        ]
      });

      // Calculate summary
      const summary = {
        date,
        totalRevenue: 0,
        totalLitres: 0,
        totalTransactions: sales.length,
        fuelTypeBreakdown: {
          petrol: { litres: 0, revenue: 0, transactions: 0 },
          diesel: { litres: 0, revenue: 0, transactions: 0 }
        }
      };

      sales.forEach(sale => {
        const litres = parseFloat(sale.litresSold);
        const amount = parseFloat(sale.totalAmount);
        const fuelType = sale.fuelType.toLowerCase();

        summary.totalLitres += litres;
        summary.totalRevenue += amount;

        if (summary.fuelTypeBreakdown[fuelType]) {
          summary.fuelTypeBreakdown[fuelType].litres += litres;
          summary.fuelTypeBreakdown[fuelType].revenue += amount;
          summary.fuelTypeBreakdown[fuelType].transactions += 1;
        }
      });

      console.log('✅ Daily summary calculated for', date, '- Revenue:', summary.totalRevenue);

      res.json({
        success: true,
        data: summary
      });

    } catch (error) {
      console.error('❌ Get daily summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch daily summary'
      });
    }
  }
}

module.exports = MultiTenantSalesController;
