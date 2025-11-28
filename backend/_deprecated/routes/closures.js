/**
 * Closure Routes
 * @module routes/closures
 */

const express = require('express');
const router = express.Router();
const closureController = require('../controllers/closureController');
const auth = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roleAuth');

// All routes require authentication
router.use(auth);

/**
 * @route   GET /api/v1/closures/prepare
 * @desc    Get data to prepare a closure
 * @access  All authenticated users
 */
router.get('/prepare', closureController.prepareClosure);

/**
 * @route   GET /api/v1/closures
 * @desc    Get closures
 * @access  All authenticated users
 */
router.get('/', closureController.getClosures);

/**
 * @route   GET /api/v1/closures/:id
 * @desc    Get closure by ID
 * @access  All authenticated users
 */
router.get('/:id', closureController.getClosureById);

/**
 * @route   POST /api/v1/closures
 * @desc    Create or update a closure
 * @access  All authenticated users
 */
router.post('/', closureController.createClosure);

/**
 * @route   PUT /api/v1/closures/:id/submit
 * @desc    Submit closure for approval
 * @access  All authenticated users
 */
router.put('/:id/submit', closureController.submitClosure);

/**
 * @route   PUT /api/v1/closures/:id/review
 * @desc    Approve or reject a closure
 * @access  Manager, Owner, Super Admin
 */
router.put('/:id/review', requireMinRole('manager'), closureController.reviewClosure);

module.exports = router;
