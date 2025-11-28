/**
 * Dashboard Routes
 * @module routes/dashboard
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/roleAuth');

// All routes require authentication
router.use(auth);

/**
 * @route   GET /api/v1/dashboard/summary
 * @desc    Get dashboard summary for current user
 * @access  All authenticated users
 */
router.get('/summary', dashboardController.getDashboardSummary);

/**
 * @route   GET /api/v1/dashboard/trends
 * @desc    Get sales trends over time
 * @access  All authenticated users
 */
router.get('/trends', dashboardController.getSalesTrends);

/**
 * @route   GET /api/v1/dashboard/fuel-breakdown
 * @desc    Get fuel type breakdown
 * @access  All authenticated users
 */
router.get('/fuel-breakdown', dashboardController.getFuelBreakdown);

/**
 * @route   GET /api/v1/dashboard/pump-performance
 * @desc    Get pump performance data
 * @access  Manager, Owner, Super Admin
 */
router.get('/pump-performance', requireMinRole('manager'), dashboardController.getPumpPerformance);

/**
 * @route   GET /api/v1/dashboard/shift-breakdown
 * @desc    Get shift-wise breakdown
 * @access  All authenticated users
 */
router.get('/shift-breakdown', dashboardController.getShiftBreakdown);

/**
 * @route   GET /api/v1/dashboard/admin-overview
 * @desc    Get super admin platform overview
 * @access  Super Admin only
 */
router.get('/admin-overview', requireRole(['super_admin']), dashboardController.getAdminOverview);

module.exports = router;
