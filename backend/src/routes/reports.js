/**
 * Reports Routes
 * Comprehensive reporting endpoints for owners
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, requireMinRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Sales reports
router.get('/sales', requireMinRole('manager'), reportController.getSalesReports);

// Shift reports
router.get('/shifts', requireMinRole('manager'), reportController.getShiftReports);

// Pump performance reports
router.get('/pumps', requireMinRole('manager'), reportController.getPumpPerformance);

module.exports = router;
