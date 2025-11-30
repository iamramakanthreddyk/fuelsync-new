/**
 * Dashboard Routes
 * Analytics and summary endpoints
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, requireMinRole, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Dashboard summary (all authenticated users - filtered by role)
router.get('/summary', dashboardController.getSummary);

// Daily summary
router.get('/daily', requireMinRole('manager'), dashboardController.getDailySummary);

// Fuel type breakdown
router.get('/fuel-breakdown', requireMinRole('manager'), dashboardController.getFuelBreakdown);

// Pump performance
router.get('/pump-performance', requireMinRole('manager'), dashboardController.getPumpPerformance);

// Nozzle-wise breakdown (owner+)
router.get('/nozzle-breakdown', requireRole('owner', 'super_admin'), dashboardController.getNozzleBreakdown);

// Financial overview (owner+)
router.get('/financial-overview', requireRole('owner', 'super_admin'), dashboardController.getFinancialOverview);

// Alerts
router.get('/alerts/missed-entries', requireMinRole('manager'), dashboardController.getMissedEntriesAlert);
router.get('/alerts/pending-handovers', dashboardController.getPendingHandoversAlert);

// Shift status
router.get('/shift-status', dashboardController.getShiftStatus);

// Owner dashboard stats
router.get('/owner/stats', requireRole('owner'), dashboardController.getOwnerStats);

// Owner analytics
router.get('/owner/analytics', requireRole('owner'), dashboardController.getOwnerAnalytics);

module.exports = router;
