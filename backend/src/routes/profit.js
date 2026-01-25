/**
 * Profit & Loss Routes
 * Owner-only endpoints for viewing profit reports
 */

const express = require('express');
const router = express.Router();
const profitController = require('../controllers/profitController');
const { authenticate, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

/**
 * Get monthly profit summary
 * GET /api/v1/stations/:stationId/profit-summary?month=2025-01
 * Access: Owner only
 */
router.get('/stations/:stationId/profit-summary', 
  requireRole('owner', 'super_admin'), 
  profitController.getProfitSummary
);

/**
 * Get daily profit summary
 * GET /api/v1/stations/:stationId/profit-daily?date=2025-01-25
 * Access: Owner only
 */
router.get('/stations/:stationId/profit-daily', 
  requireRole('owner', 'super_admin'), 
  profitController.getDailyProfit
);

/**
 * Export profitable sales with cost price data
 * GET /api/v1/stations/:stationId/profit-export?month=2025-01&format=csv
 * Access: Owner only
 * Query params:
 *   - month: YYYY-MM format (optional, defaults to current month)
 *   - format: 'csv' or 'json' (optional, defaults to json)
 */
router.get('/stations/:stationId/profit-export', 
  requireRole('owner', 'super_admin'), 
  profitController.exportProfitableData
);

module.exports = router;
