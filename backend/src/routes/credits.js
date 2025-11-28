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
router.get('/creditors/:id', creditController.getCreditor);
router.post('/stations/:stationId/creditors', requireMinRole('manager'), creditController.createCreditor);
router.put('/creditors/:id', requireMinRole('manager'), creditController.updateCreditor);

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
