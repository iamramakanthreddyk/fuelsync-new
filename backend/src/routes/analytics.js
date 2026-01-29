/**
 * Analytics Routes
 * Consolidated analytics and reporting endpoints
 * Replaces: /dashboard/* and /sales/* (removes duplications)
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const salesController = require('../controllers/salesController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireRole, enforceDateRangeLimit, PERMISSIONS } = require('../middleware/permissions');

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
router.get('/daily', requireRole('manager'), dashboardController.getDailySummary);

// ============================================
// BREAKDOWNS & ANALYSIS
// ============================================

/**
 * GET /api/v1/analytics/fuel-breakdown
 * Fuel type breakdown
 */
router.get('/fuel-breakdown', requireRole('manager'), dashboardController.getFuelBreakdown);

/**
 * GET /api/v1/analytics/pump-performance
 * Pump performance metrics
 */
// Allow both managers and owners to view pump performance
router.get('/pump-performance', requireRole('manager', 'owner'), dashboardController.getPumpPerformance);

/**
 * GET /api/v1/analytics/nozzle-breakdown
 * Nozzle-wise breakdown (owner+)
 */
router.get('/nozzle-breakdown', requireRole('owner'), dashboardController.getNozzleBreakdown);

/**
 * GET /api/v1/analytics/financial
 * Financial overview (owner+)
 */
router.get('/financial', requireRole('owner'), dashboardController.getFinancialOverview);

// ============================================
// ALERTS & STATUS
// ============================================

/**
 * GET /api/v1/analytics/alerts/missed-entries
 * Missed readings alerts
 */
router.get('/alerts/missed-entries', requireRole('manager'), dashboardController.getMissedEntriesAlert);

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
router.get('/owner/analytics', requireRole('owner'), enforceDateRangeLimit('analytics'), dashboardController.getOwnerAnalytics);

/**
 * GET /api/v1/analytics/income-receivables
 * Income & receivables comprehensive report
 */
router.get('/income-receivables', requireRole('manager'), enforceDateRangeLimit('profit_reports'), dashboardController.getIncomeReceivablesReport);

// ============================================
// SALES (Consolidated from /api/v1/sales)
// ============================================

/**
 * GET /api/v1/analytics/sales
 * Get sales data with filters
 * Query: station_id, date, start_date, end_date, fuel_type, payment_type
 */
router.get('/sales', enforceDateRangeLimit('sales_reports'), salesController.getSales);

/**
 * GET /api/v1/analytics/sales/summary
 * Get sales summary/aggregates
 * Query: station_id, date, start_date, end_date
 */
router.get('/sales/summary', enforceDateRangeLimit('sales_reports'), salesController.getSalesSummary);

module.exports = router;
