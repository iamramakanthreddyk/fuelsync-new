
const express = require('express');
const MultiTenantSalesController = require('../controllers/multiTenantSalesController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Main paginated/filterable sales endpoint
router.get('/', MultiTenantSalesController.salesPageList);

// Sales summary endpoint
router.get('/summary', MultiTenantSalesController.salesSummary);

// Trend/daily routes kept for any upstream legacy dash features
router.get('/trends', MultiTenantSalesController.getSalesTrends);

// Per-day legacy
router.get('/daily/:date', MultiTenantSalesController.getDailySummary);

module.exports = router;
