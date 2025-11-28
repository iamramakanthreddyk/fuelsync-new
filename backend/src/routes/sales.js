/**
 * Sales Routes
 * Routes for sales data retrieval and analysis
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const salesController = require('../controllers/salesController');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/sales
 * @desc    Get sales data with filters
 * @query   station_id, date, start_date, end_date, fuel_type, payment_type
 * @access  Private
 */
router.get('/', salesController.getSales);

/**
 * @route   GET /api/v1/sales/summary
 * @desc    Get sales summary/aggregates
 * @query   station_id, date, start_date, end_date
 * @access  Private
 */
router.get('/summary', salesController.getSalesSummary);

module.exports = router;
