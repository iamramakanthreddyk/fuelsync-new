/**
 * Shift Routes
 * Employee shift management
 */

const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { authenticate, requireMinRole } = require('../middleware/auth');
const { validate, shiftValidators, validateIntId } = require('../validators');

// All routes require authentication
router.use(authenticate);

// ============================================
// SHIFT LIFECYCLE
// ============================================

// Start a new shift
router.post('/start',
  validate(shiftValidators.create),
  shiftController.startShift
);

// Get active shift for current user or specified employee
router.get('/active', shiftController.getActiveShift);

// Get single shift
router.get('/:id', validateIntId(), shiftController.getShift);

// End a shift
router.post('/:id/end',
  validateIntId(),
  validate(shiftValidators.end),
  shiftController.endShift
);

// Cancel a shift (manager+)
router.post('/:id/cancel',
  requireMinRole('manager'),
  validateIntId(),
  shiftController.cancelShift
);

module.exports = router;
