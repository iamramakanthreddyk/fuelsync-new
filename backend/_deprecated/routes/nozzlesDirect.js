/**
 * Standalone Nozzle Routes (for direct nozzle access by ID)
 * @module routes/nozzlesDirect
 */

const express = require('express');
const router = express.Router();
const nozzleController = require('../controllers/nozzleController');
const auth = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roleAuth');

// All routes require authentication
router.use(auth);

/**
 * @route   GET /api/v1/nozzles/:id
 * @desc    Get nozzle by ID
 * @access  All authenticated users (with station access)
 */
router.get('/:id', nozzleController.getNozzleById);

/**
 * @route   PUT /api/v1/nozzles/:id
 * @desc    Update nozzle
 * @access  Manager, Owner, Super Admin
 */
router.put('/:id', requireMinRole('manager'), nozzleController.updateNozzle);

/**
 * @route   DELETE /api/v1/nozzles/:id
 * @desc    Delete nozzle (soft delete)
 * @access  Owner, Super Admin
 */
router.delete('/:id', requireMinRole('owner'), nozzleController.deleteNozzle);

module.exports = router;
