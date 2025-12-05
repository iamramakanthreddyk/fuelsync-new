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

// Shift reports
router.get('/shifts', enforceLegacyManager, requireMinRole('manager'), reportController.getShiftReports);

// Pump performance reports
router.get('/pumps', enforceLegacyManager, requireMinRole('manager'), reportController.getPumpPerformance);

module.exports = router;
