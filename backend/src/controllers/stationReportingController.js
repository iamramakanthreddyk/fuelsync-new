/**
 * Station Reporting Controller
 * 
 * Handles reporting and analytics for fuel stations.
 * Responsibilities:
 * - Daily sales summaries and metrics
 * - Settlement reading compilation
 * - Sales analysis by fuel type, payment method
 * - Variance reporting for cash reconciliation
 * 
 * REPORTING ENTITIES:
 * - Readings: Individual nozzle meter reads
 * - Transactions: Daily transaction records with payment breakdown
 * - Settlements: Cash reconciliation records
 */

// ===== SERVICE LAYER =====
const stationReportingService = require('../services/stationReportingService');

// ===== MODEL & DATABASE ACCESS =====
const { Station, NozzleReading, Nozzle, User, FuelPrice, DailyTransaction, Settlement, sequelize } = require('../services/modelAccess');

// ===== SEQUELIZE UTILITIES =====
const { Op, fn, col } = require('sequelize');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');
const { canAccessStation } = require('../utils/stationAccessControl');
const { calculateDeduplicatedTotals } = require('../utils/readingHelpers');
const { createContextLogger } = require('../services/loggerService');

// ===== LOGGER =====
const logger = createContextLogger('StationReportingController');

// ===== CONSTANTS =====
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };

// ============================================
// DAILY REPORTING
// ============================================

/**
 * Get daily sales summary for a specific station and date
 * GET /api/v1/stations/:stationId/daily-sales?date=YYYY-MM-DD
 * 
 * Business logic delegated to StationReportingService.getDailySales().
 * Returns aggregated sales by fuel type, nozzle, and settlement status.
 */
exports.getDailySales = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const queryDate = date || new Date().toISOString().split('T')[0];

    // Delegate to service
    const sales = await stationReportingService.getDailySales(stationId, queryDate);
    res.json({ success: true, data: sales });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Get readings available for settlement (unlinked or for review)
 * GET /api/v1/stations/:stationId/readings-for-settlement?date=YYYY-MM-DD
 * 
 * Returns readings categorized by settlement status (unlinked vs linked).
 * Includes employee info, payment breakdown, and status.
 * 
 * Business logic delegated to StationReportingService.getReadingsForSettlement().
 */
exports.getReadingsForSettlement = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const queryDate = date || new Date().toISOString().split('T')[0];

    // Delegate to service
    const readings = await stationReportingService.getReadingsForSettlement(stationId, queryDate);
    res.json({ success: true, data: readings });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};
