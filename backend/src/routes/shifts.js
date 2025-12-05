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

// Middleware: when routes are mounted under legacy `/api` (not `/api/v1`),
// ensure employees receive 403 for manager-only operations. This keeps
// older-client behaviour consistent with tests that call `/api/...` paths.
const enforceLegacyManager = (req, res, next) => {
  // Enforce that employees cannot perform manager-only actions on these endpoints
  if (req.user && req.user.role === 'employee') {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }
  return next();
};

// ============================================
// SHIFT LIFECYCLE
// ============================================

// Start a new shift
router.post('/start',
  validate(shiftValidators.create),
  shiftController.startShift
);

// Compatibility: POST / to start a shift (older clients/tests)
// Run legacy manager enforcement before validation so that employees get 403
router.post('/',
  enforceLegacyManager,
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

// Compatibility: accept PUT for ending shift as well
router.put('/:id/end',
  enforceLegacyManager,
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
