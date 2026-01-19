/**
 * Analytics Routes
 * Consolidated analytics and reporting endpoints
 * Replaces: /dashboard/* and /sales/* (removes duplications)
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const salesController = require('../controllers/salesController');
const { authenticate, requireMinRole, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// ============================================
// SUMMARY & AGGREGATES
// ============================================

/**
 * GET /api/v1/analytics/summary
 * Dashboard summary (all authenticated users - filtered by role)
 */
router.get('/summary', dashboardController.getSummary);

/**
 * GET /api/v1/analytics/daily
 * Daily summary
 */
router.get('/daily', requireMinRole('manager'), dashboardController.getDailySummary);

// ============================================
// BREAKDOWNS & ANALYSIS
// ============================================

/**
 * GET /api/v1/analytics/fuel-breakdown
 * Fuel type breakdown
 */
router.get('/fuel-breakdown', requireMinRole('manager'), dashboardController.getFuelBreakdown);

/**
 * GET /api/v1/analytics/pump-performance
 * Pump performance metrics
 */
router.get('/pump-performance', requireMinRole('manager'), dashboardController.getPumpPerformance);

/**
 * GET /api/v1/analytics/nozzle-breakdown
 * Nozzle-wise breakdown (owner+)
 */
router.get('/nozzle-breakdown', requireRole('owner', 'super_admin'), dashboardController.getNozzleBreakdown);

/**
 * GET /api/v1/analytics/financial
 * Financial overview (owner+)
 */
router.get('/financial', requireRole('owner', 'super_admin'), dashboardController.getFinancialOverview);

// ============================================
// ALERTS & STATUS
// ============================================

/**
 * GET /api/v1/analytics/alerts/missed-entries
 * Missed readings alerts
 */
router.get('/alerts/missed-entries', requireMinRole('manager'), dashboardController.getMissedEntriesAlert);

/**
 * GET /api/v1/analytics/alerts/pending-handovers
 * Pending handovers alerts
 */
router.get('/alerts/pending-handovers', dashboardController.getPendingHandoversAlert);

/**
 * GET /api/v1/analytics/shift-status
 * Current shift status
 */
router.get('/shift-status', dashboardController.getShiftStatus);

// ============================================
// OWNER ANALYTICS
// ============================================

/**
 * GET /api/v1/analytics/owner/stats
 * Owner dashboard stats (owner+)
 */
router.get('/owner/stats', requireRole('owner'), dashboardController.getOwnerStats);

/**
 * GET /api/v1/analytics/owner/analytics
 * Owner analytics report (owner+)
 */
router.get('/owner/analytics', requireRole('owner'), dashboardController.getOwnerAnalytics);

/**
 * GET /api/v1/analytics/income-receivables
 * Income & receivables comprehensive report
 */
router.get('/income-receivables', requireMinRole('manager'), dashboardController.getIncomeReceivablesReport);

// ============================================
// SALES (Consolidated from /api/v1/sales)
// ============================================

/**
 * GET /api/v1/analytics/sales
 * Get sales data with filters
 * Query: station_id, date, start_date, end_date, fuel_type, payment_type
 */
router.get('/sales', salesController.getSales);

/**
 * GET /api/v1/analytics/sales/summary
 * Get sales summary/aggregates
 * Query: station_id, date, start_date, end_date
 */
router.get('/sales/summary', salesController.getSalesSummary);

module.exports = router;
