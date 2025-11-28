/**
 * Inventory Routes
 * @module routes/inventory
 */

const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const auth = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roleAuth');

// All routes require authentication
router.use(auth);

// ============================================
// TANK ROUTES
// ============================================

/**
 * @route   POST /api/v1/inventory/tanks
 * @desc    Create a new fuel tank
 * @access  Manager, Owner, Super Admin
 */
router.post('/tanks', requireMinRole('manager'), inventoryController.createTank);

/**
 * @route   GET /api/v1/inventory/tanks
 * @desc    Get all tanks for a station
 * @access  All authenticated users
 */
router.get('/tanks', inventoryController.getTanks);

/**
 * @route   PUT /api/v1/inventory/tanks/:id
 * @desc    Update tank details or stock
 * @access  Manager, Owner, Super Admin
 */
router.put('/tanks/:id', requireMinRole('manager'), inventoryController.updateTank);

/**
 * @route   POST /api/v1/inventory/tanks/:id/dip
 * @desc    Record a dip reading
 * @access  All authenticated users
 */
router.post('/tanks/:id/dip', inventoryController.recordDipReading);

// ============================================
// DELIVERY ROUTES
// ============================================

/**
 * @route   POST /api/v1/inventory/deliveries
 * @desc    Record a fuel delivery
 * @access  All authenticated users
 */
router.post('/deliveries', inventoryController.createDelivery);

/**
 * @route   GET /api/v1/inventory/deliveries
 * @desc    Get deliveries
 * @access  All authenticated users
 */
router.get('/deliveries', inventoryController.getDeliveries);

/**
 * @route   PUT /api/v1/inventory/deliveries/:id/verify
 * @desc    Verify a delivery
 * @access  Manager, Owner, Super Admin
 */
router.put('/deliveries/:id/verify', requireMinRole('manager'), inventoryController.verifyDelivery);

// ============================================
// SUMMARY ROUTES
// ============================================

/**
 * @route   GET /api/v1/inventory/summary
 * @desc    Get inventory summary
 * @access  All authenticated users
 */
router.get('/summary', inventoryController.getInventorySummary);

module.exports = router;
