
const { Sale, Pump, User } = require('../models');
const { Op } = require('sequelize');

const generateReport = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.body;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Type, start date, and end date are required'
      });
    }

    const whereClause = {
      createdAt: {
        [Op.gte]: new Date(startDate),
        [Op.lte]: new Date(endDate)
      }
    };

    const sales = await Sale.findAll({
      where: whereClause,
      include: [
        { model: Pump, as: 'pump', attributes: ['name'] },
        { model: User, as: 'user', attributes: ['name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const reportData = {
      type,
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
      totalRevenue: 0,
      totalLitres: 0,
      totalTransactions: sales.length,
      fuelTypeBreakdown: {
        petrol: { litres: 0, revenue: 0, transactions: 0 },
        diesel: { litres: 0, revenue: 0, transactions: 0 }
      },
      pumpBreakdown: {},
      shiftBreakdown: {
        morning: { litres: 0, revenue: 0, transactions: 0 },
        afternoon: { litres: 0, revenue: 0, transactions: 0 },
        night: { litres: 0, revenue: 0, transactions: 0 }
      },
      salesData: sales
    };

    // Calculate totals and breakdowns
    sales.forEach(sale => {
      const revenue = parseFloat(sale.totalAmount);
      const litres = parseFloat(sale.litres);

      reportData.totalRevenue += revenue;
      reportData.totalLitres += litres;

      // Fuel type breakdown
      const fuelKey = sale.fuelType.toLowerCase();
      if (reportData.fuelTypeBreakdown[fuelKey]) {
        reportData.fuelTypeBreakdown[fuelKey].litres += litres;
        reportData.fuelTypeBreakdown[fuelKey].revenue += revenue;
        reportData.fuelTypeBreakdown[fuelKey].transactions += 1;
      }

      // Pump breakdown
      const pumpName = sale.pump?.name || 'Unknown';
      if (!reportData.pumpBreakdown[pumpName]) {
        reportData.pumpBreakdown[pumpName] = { litres: 0, revenue: 0, transactions: 0 };
      }
      reportData.pumpBreakdown[pumpName].litres += litres;
      reportData.pumpBreakdown[pumpName].revenue += revenue;
      reportData.pumpBreakdown[pumpName].transactions += 1;

      // Shift breakdown
      if (reportData.shiftBreakdown[sale.shift]) {
        reportData.shiftBreakdown[sale.shift].litres += litres;
        reportData.shiftBreakdown[sale.shift].revenue += revenue;
        reportData.shiftBreakdown[sale.shift].transactions += 1;
      }
    });

    // In a real implementation, you would generate PDF/Excel files here
    // and upload them to Azure Blob Storage, then return the download URL
    const downloadUrl = `/api/reports/download/${type}-${Date.now()}.pdf`;

    res.json({
      success: true,
      data: {
        ...reportData,
        downloadUrl
      }
    });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  generateReport
};
