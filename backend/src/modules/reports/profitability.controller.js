/**
 * Profitability Controller
 * HTTP handlers for profit reports
 * Req #3: Net profit calculation (Revenue - COGS - Approved Expenses)
 */

const { profitabilityService } = require('./index');

/**
 * Get monthly profit summary with expense deduction
 */
exports.getMonthlySummary = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Month must be in YYYY-MM format' }
      });
    }

    const summary = await profitabilityService.getMonthlySummary(stationId, month);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Get daily profit summary
 */
exports.getDailyProfit = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Date must be in YYYY-MM-DD format' }
      });
    }

    const profit = await profitabilityService.getDailyProfit(stationId, date);

    res.json({
      success: true,
      data: profit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Get net profit trend over time
 */
exports.getNetProfitTrend = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate, period = 'daily' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: { message: 'startDate and endDate are required' }
      });
    }

    if (!['daily', 'monthly'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Period must be "daily" or "monthly"' }
      });
    }

    const trend = await profitabilityService.getNetProfitTrend(
      stationId,
      startDate,
      endDate,
      period
    );

    res.json({
      success: true,
      data: trend
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

module.exports = exports;
