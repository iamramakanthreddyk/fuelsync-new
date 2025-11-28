/**
 * Station Routes
 * @module routes/stations
 */

const express = require('express');
const router = express.Router();
const stationController = require('../controllers/stationController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roleAuth');

// All routes require authentication
router.use(auth);

/**
 * @route   POST /api/v1/stations
 * @desc    Create a new station
 * @access  Owner, Super Admin
 */
router.post('/', requireRole(['owner', 'super_admin']), stationController.createStation);

/**
 * @route   GET /api/v1/stations
 * @desc    Get all stations (filtered by role)
 * @access  All authenticated users
 */
router.get('/', stationController.getStations);

/**
 * @route   GET /api/v1/stations/:id
 * @desc    Get station by ID with full details
 * @access  Station owner/manager, Super Admin
 */
router.get('/:id', stationController.getStationById);

/**
 * @route   GET /api/v1/stations/:id/summary
 * @desc    Get station summary/stats
 * @access  Station owner/manager, Super Admin
 */
router.get('/:id/summary', stationController.getStationSummary);

/**
 * @route   PUT /api/v1/stations/:id
 * @desc    Update station
 * @access  Station owner, Super Admin
 */
router.put('/:id', requireRole(['owner', 'super_admin']), stationController.updateStation);

/**
 * @route   DELETE /api/v1/stations/:id
 * @desc    Delete station (soft delete)
 * @access  Super Admin only
 */
router.delete('/:id', requireRole(['super_admin']), stationController.deleteStation);

module.exports = router;
