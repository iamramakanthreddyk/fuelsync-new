/**
 * Transaction Routes
 * API endpoints for daily transaction management
 */

const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticate, requireMinRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/transactions
 * Create a new daily transaction
 * Required: stationId, transactionDate, readingIds[], paymentBreakdown
 */
router.post('/', requireMinRole('employee'), transactionController.createTransaction);

/**
 * GET /api/v1/transactions/:stationId/:date
 * Get transaction for a station on a specific date
 */
router.get('/:stationId/:date', transactionController.getTransactionForDate);

/**
 * GET /api/v1/transactions/station/:stationId
 * Get transactions for a station with optional date range filter
 * Query params: startDate, endDate, status
 */
router.get('/station/:stationId', transactionController.getTransactionsForStation);

/**
 * GET /api/v1/transactions/:stationId/summary
 * Get summary statistics for transactions in date range
 * Query params: startDate, endDate (required)
 */
router.get('/:stationId/summary', transactionController.getTransactionSummary);

/**
 * PUT /api/v1/transactions/:id
 * Update transaction (payment breakdown, status, notes)
 */
router.put('/:id', requireMinRole('manager'), transactionController.updateTransaction);

/**
 * DELETE /api/v1/transactions/:id
 * Delete transaction
 */
router.delete('/:id', requireMinRole('manager'), transactionController.deleteTransaction);

module.exports = router;
