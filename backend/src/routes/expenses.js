/**
 * Expense Routes
 * Routes for expenses, cost of goods, and profit/loss
 */

const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const stationController = require('../controllers/stationController');
const { authenticate, requireRole, requireMinRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Expense categories
router.get('/expense-categories', expenseController.getCategories);

// Compatibility: GET /?stationId= - list expenses for a station (legacy path used in tests)
router.get('/', async (req, res, next) => {
	const { stationId } = req.query;
	if (!stationId) return res.status(400).json({ success: false, error: 'stationId query parameter is required' });

	// Block employee role explicitly for legacy POST path
	if (req.user && req.user.role === 'employee') {
		return res.status(403).json({ success: false, error: 'Insufficient permissions' });
	}

	req.params.stationId = stationId;
	return expenseController.getExpenses(req, res, next);
});

// Compatibility: POST / - record an expense via legacy path (used in some tests)
router.post('/', async (req, res, next) => {
	const { stationId } = req.body;
	if (!stationId) return res.status(400).json({ success: false, error: 'stationId is required in body' });

	const base = req.baseUrl || '';
	if (base.startsWith('/api/') && !base.startsWith('/api/v1') && req.user && req.user.role === 'employee') {
		return res.status(403).json({ success: false, error: 'Insufficient permissions' });
	}

	req.params.stationId = stationId;
	return expenseController.createExpense(req, res, next);
});

// Compatibility: POST /expenses (mounted under /api/v1 to accept /api/v1/expenses)
router.post('/expenses', async (req, res, next) => {
	const { stationId } = req.body;
	if (!stationId) return res.status(400).json({ success: false, error: 'stationId is required in body' });

	// Block employee role explicitly for legacy POST path
	if (req.user && req.user.role === 'employee') {
		return res.status(403).json({ success: false, error: 'Insufficient permissions' });
	}

	req.params.stationId = stationId;
	return expenseController.createExpense(req, res, next);
});

// Route for /stations/all/expenses - MUST come BEFORE /stations/:stationId/expenses
router.get('/stations/all/expenses', requireMinRole('manager'), stationController.getAllExpenses);

// Expense routes
// Anyone can view expenses for their station
router.get('/stations/:stationId/expenses', expenseController.getExpenses);

// Req #3: Anyone can CREATE expenses, but:
//   - Manager/Owner/Super_Admin entries are auto-approved
//   - Employee entries go to "pending" requiring manager approval
router.post('/stations/:stationId/expenses', expenseController.createExpense);

// Update/Delete - manager and above only
router.put('/expenses/:id', requireRole('manager', 'owner', 'super_admin'), expenseController.updateExpense);
router.delete('/expenses/:id', requireRole('manager', 'owner', 'super_admin'), expenseController.deleteExpense);

// Req #3: Approve / reject employee-entered expenses - manager and above only
router.patch('/expenses/:id/approve', requireRole('manager', 'owner', 'super_admin'), expenseController.approveExpense);

// Bulk approve pending expenses - manager and above only
router.patch('/stations/:stationId/expenses/bulk-approve', requireRole('manager', 'owner', 'super_admin'), expenseController.bulkApproveExpenses);

router.get('/stations/:stationId/expense-summary', expenseController.getExpenseSummary);

// Cost of goods - owner only
router.get('/stations/:stationId/cost-of-goods', requireRole('owner', 'super_admin'), expenseController.getCostOfGoods);
router.post('/stations/:stationId/cost-of-goods', requireRole('owner', 'super_admin'), expenseController.setCostOfGoods);

// Profit/Loss statement - owner only
router.get('/stations/:stationId/profit-loss', requireRole('owner', 'super_admin'), expenseController.getProfitLoss);

module.exports = router;
