/**
 * Nozzle Routes
 * @module routes/nozzles
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // Enable access to parent route params
const nozzleController = require('../controllers/nozzleController');
const auth = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/roleAuth');

// All routes require authentication
router.use(auth);

/**
 * Routes for /api/v1/pumps/:pumpId/nozzles
 */

/**
 * @route   POST /api/v1/pumps/:pumpId/nozzles
 * @desc    Create a new nozzle for a pump
 * @access  Manager, Owner, Super Admin
 */
router.post('/', requireMinRole('manager'), nozzleController.createNozzle);

/**
 * @route   GET /api/v1/pumps/:pumpId/nozzles
 * @desc    Get all nozzles for a pump
 * @access  All authenticated users (with station access)
 */
router.get('/', nozzleController.getNozzlesByPump);

/**
 * @route   POST /api/v1/pumps/:pumpId/nozzles/bulk
 * @desc    Bulk create/update nozzles
 * @access  Manager, Owner, Super Admin
 */
router.post('/bulk', requireMinRole('manager'), nozzleController.bulkUpsertNozzles);

module.exports = router;
