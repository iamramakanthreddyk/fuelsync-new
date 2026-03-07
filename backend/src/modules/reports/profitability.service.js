/**
 * Profitability Service
 * Req #3: Calculate net profit = revenue - COGS - approved expenses
 * Handles profit summary, daily profit, and net profit trending
 */

const { NozzleReading, FuelPrice, Expense, Op, fn, col } = require('../../models');
const expensesService = require('../expenses/expenses.service');

class ProfitabilityService {
  /**
   * Get monthly profit summary (Req #3)
   * Revenue - COGS - Approved Expenses = Net Profit
   */
  async getMonthlySummary(stationId, month) {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

    // Calculate revenue and COGS from readings
    const readings = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: { [Op.between]: [startDate, endDate] }
      },
      attributes: ['id', 'litresSold', 'pricePerLitre', 'fuelType', 'readingDate']
    });

    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    let totalLitres = 0;
    let readingsWithCostPrice = 0;
    const byFuelType = {};

    for (const reading of readings) {
      const litres = parseFloat(reading.litresSold || 0);
      const revenue = litres * parseFloat(reading.pricePerLitre || 0);
      totalRevenue += revenue;
      totalLitres += litres;

      // Get cost price for COGS
      const priceData = await FuelPrice.findOne({
        where: {
          stationId,
          fuelType: reading.fuelType,
          effectiveFrom: { [Op.lte]: reading.readingDate }
        },
        order: [['effectiveFrom', 'DESC']]
      });

      let costOfGoods = 0;
      if (priceData?.costPrice) {
        costOfGoods = litres * parseFloat(priceData.costPrice);
        totalCostOfGoods += costOfGoods;
        readingsWithCostPrice++;
      }

      if (!byFuelType[reading.fuelType]) {
        byFuelType[reading.fuelType] = {
          litres: 0,
          revenue: 0,
          cogs: 0,
          profit: 0
        };
      }
      byFuelType[reading.fuelType].litres += litres;
      byFuelType[reading.fuelType].revenue += revenue;
      byFuelType[reading.fuelType].cogs += costOfGoods;
      byFuelType[reading.fuelType].profit += revenue - costOfGoods;
    }

    // Get approved and pending expenses (Req #3)
    const totalExpenses = await expensesService.getTotalApprovedExpenses(
      stationId,
      startDate,
      endDate
    );
    const pendingExpenses = await expensesService.getPendingExpenses(
      stationId,
      startDate,
      endDate
    );

    // Calculate profits
    const grossProfit = totalRevenue - totalCostOfGoods;
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const profitPerLitre = totalLitres > 0 ? netProfit / totalLitres : 0;

    // Get expense breakdown
    const expenseBreakdown = await Expense.findAll({
      attributes: [
        'category',
        [fn('SUM', col('amount')), 'total']
      ],
      where: {
        stationId,
        expenseDate: { [Op.between]: [startDate, endDate] },
        approvalStatus: { [Op.in]: ['approved', 'auto_approved'] }
      },
      group: ['category'],
      raw: true
    });

    return {
      month,
      stationId,
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCostOfGoods: parseFloat(totalCostOfGoods.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        pendingExpenses: parseFloat(pendingExpenses.toFixed(2)),
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        totalLitres: parseFloat(totalLitres.toFixed(3)),
        profitPerLitre: parseFloat(profitPerLitre.toFixed(2))
      },
      breakdown: {
        byFuelType,
        byExpenseCategory: expenseBreakdown.map(item => ({
          category: item.category,
          amount: parseFloat(item.total || 0)
        }))
      },
      dataCompleteness: {
        totalReadings: readings.length,
        readingsUsedForCalculation: readingsWithCostPrice,
        readingsExcluded: readings.length - readingsWithCostPrice,
        completenessPercentage:
          readings.length > 0
            ? parseFloat(((readingsWithCostPrice / readings.length) * 100).toFixed(2))
            : 0,
        note:
          readingsWithCostPrice < readings.length
            ? `Profit calculated from ${readingsWithCostPrice}/${readings.length} readings. ${
                readings.length - readingsWithCostPrice
              } readings excluded (missing cost price).`
            : 'All readings have cost price data - profit calculations are 100% accurate.'
      }
    };
  }

  /**
   * Get daily profit (Req #3)
   */
  async getDailyProfit(stationId, date) {
    const readings = await NozzleReading.findAll({
      where: { stationId, readingDate: date },
      attributes: ['id', 'litresSold', 'pricePerLitre', 'fuelType']
    });

    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    let totalLitres = 0;
    let readingsWithCostPrice = 0;

    for (const reading of readings) {
      const litres = parseFloat(reading.litresSold || 0);
      const revenue = litres * parseFloat(reading.pricePerLitre || 0);
      totalRevenue += revenue;
      totalLitres += litres;

      const priceData = await FuelPrice.findOne({
        where: {
          stationId,
          fuelType: reading.fuelType,
          effectiveFrom: { [Op.lte]: date }
        },
        order: [['effectiveFrom', 'DESC']]
      });

      if (priceData?.costPrice) {
        const costOfGoods = litres * parseFloat(priceData.costPrice);
        totalCostOfGoods += costOfGoods;
        readingsWithCostPrice++;
      }
    }

    // Get daily expenses (approved only)
    const dailyExpenses = await Expense.sum('amount', {
      where: {
        stationId,
        expenseDate: date,
        approvalStatus: { [Op.in]: ['approved', 'auto_approved'] }
      }
    }) || 0;

    const grossProfit = totalRevenue - totalCostOfGoods;
    const netProfit = grossProfit - dailyExpenses;

    return {
      date,
      stationId,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCostOfGoods: parseFloat(totalCostOfGoods.toFixed(2)),
      dailyExpenses: parseFloat(dailyExpenses.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      totalLitres: parseFloat(totalLitres.toFixed(3)),
      dataCompleteness: {
        totalReadings: readings.length,
        readingsWithCostPrice,
        readingsWithoutCostPrice: readings.length - readingsWithCostPrice,
        completenessPercentage:
          readings.length > 0
            ? parseFloat(((readingsWithCostPrice / readings.length) * 100).toFixed(2))
            : 0
      }
    };
  }

  /**
   * Get net profit trend over a date range
   */
  async getNetProfitTrend(stationId, startDate, endDate, period = 'daily') {
    const dates = this.getDateRange(startDate, endDate, period);
    const trends = [];

    for (const date of dates) {
      if (period === 'daily') {
        const profit = await this.getDailyProfit(stationId, date);
        trends.push({
          date,
          revenue: profit.totalRevenue,
          expenses: profit.dailyExpenses,
          netProfit: profit.netProfit,
          profitMargin: profit.totalRevenue > 0
            ? parseFloat(((profit.netProfit / profit.totalRevenue) * 100).toFixed(2))
            : 0
        });
      } else if (period === 'monthly') {
        const profit = await this.getMonthlySummary(stationId, date);
        trends.push({
          date,
          revenue: profit.summary.totalRevenue,
          expenses: profit.summary.totalExpenses,
          netProfit: profit.summary.netProfit,
          profitMargin: profit.summary.profitMargin
        });
      }
    }

    const totals = {
      totalRevenue: trends.reduce((sum, t) => sum + t.revenue, 0),
      totalExpenses: trends.reduce((sum, t) => sum + t.expenses, 0),
      netProfit: trends.reduce((sum, t) => sum + t.netProfit, 0),
      avgProfitMargin: trends.length > 0
        ? parseFloat((trends.reduce((sum, t) => sum + t.profitMargin, 0) / trends.length).toFixed(2))
        : 0
    };

    return {
      period,
      stationId,
      startDate,
      endDate,
      totals,
      trends
    };
  }

  /**
   * Helper: Generate date range
   */
  getDateRange(startDate, endDate, period) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (period === 'daily') {
      const current = new Date(start);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    } else if (period === 'monthly') {
      const current = new Date(start);
      while (current <= end) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        dates.push(`${year}-${month}`);
        current.setMonth(current.getMonth() + 1);
      }
    }

    return dates;
  }
}

module.exports = new ProfitabilityService();
