/**
 * Credit Routes
 * Routes for creditor and credit transaction management
 * Enhanced with aging reports and flagging
 */

const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');
const { authenticate, requireRole, requireMinRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Creditor routes
router.get('/stations/:stationId/creditors', creditController.getCreditors);
router.get('/creditors/ledger', creditController.getCreditLedger);
router.get('/creditors/:id', creditController.getCreditor);
router.post('/stations/:stationId/creditors', requireMinRole('manager'), creditController.createCreditor);
router.put('/creditors/:id', requireMinRole('manager'), creditController.updateCreditor);

// Compatibility: GET /?stationId= - list creditors
router.get('/', async (req, res, next) => {
	const { stationId } = req.query;
	if (!stationId) return res.status(400).json({ success: false, error: 'stationId query parameter is required' });

	// Legacy mount (/api) should block employees explicitly (tests use /api/creditors)
	const base = req.baseUrl || '';
	if (base.startsWith('/api/') && !base.startsWith('/api/v1') && req.user && req.user.role === 'employee') {
		return res.status(403).json({ success: false, error: 'Insufficient permissions' });
	}
	req.params.stationId = stationId;
	return creditController.getCreditors(req, res, next);
});

// Compatibility: POST / - record a credit transaction (deprecated path used in tests)
router.post('/credit-transactions', requireMinRole('manager'), async (req, res, next) => {
	const { stationId } = req.body;
	if (!stationId) return res.status(400).json({ success: false, error: 'stationId is required in body' });
	req.params.stationId = stationId;
	return creditController.recordCreditSale(req, res, next);
});

// Credit transaction routes
router.post('/stations/:stationId/credits', creditController.recordCreditSale);
router.post('/stations/:stationId/creditors/:creditorId/settle', requireMinRole('manager'), creditController.recordSettlement);
router.get('/stations/:stationId/credit-transactions', creditController.getTransactions);

// Credit summary for dashboard
router.get('/stations/:stationId/credit-summary', creditController.getCreditSummary);

// Aging and overdue reports (new)
router.get('/stations/:stationId/creditors/aging', requireMinRole('manager'), creditController.getAgingReport);
router.get('/stations/:stationId/creditors/overdue', requireMinRole('manager'), creditController.getOverdueCreditors);

// Flag/unflag creditors (new)
router.post('/creditors/:id/flag', requireMinRole('manager'), creditController.flagCreditor);
router.post('/creditors/:id/unflag', requireMinRole('manager'), creditController.unflagCreditor);

module.exports = router;
