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

// Legacy guard: when mounted under /api (non-v1), deny employees access explicitly
const enforceLegacyManager = (req, res, next) => {
	const base = req.baseUrl || '';
	if (base.startsWith('/api/') && !base.startsWith('/api/v1') && req.user && req.user.role === 'employee') {
		return res.status(403).json({ success: false, error: 'Insufficient permissions' });
	}
	return next();
};

// Sales reports
router.get('/sales', enforceLegacyManager, requireMinRole('manager'), reportController.getSalesReports);
router.get('/daily-sales', enforceLegacyManager, requireMinRole('manager'), reportController.getDailySalesReport);

// Sample readings report - shows quality check readings taken per day
router.get('/sample-readings', enforceLegacyManager, requireMinRole('owner'), reportController.getSampleReadingsReport);

// Sample reading statistics - shows frequency and testing patterns
router.get('/sample-statistics', enforceLegacyManager, requireMinRole('owner'), reportController.getSampleStatistics);

module.exports = router;

