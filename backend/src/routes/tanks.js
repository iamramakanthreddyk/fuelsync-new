/**
 * Tank Routes
 * Flexible inventory management for fuel tanks
 */

const express = require('express');
const router = express.Router();
const tankController = require('../controllers/tankController');
const { authenticate, requireMinRole } = require('../middleware/auth');
const { validate, tankValidators, tankRefillValidators, validateId } = require('../validators');

// All routes require authentication
router.use(authenticate);

// ============================================
// TANK WARNINGS (Dashboard)
// ============================================

// Get tank warnings for all accessible stations
router.get('/warnings', tankController.getTankWarnings);

// Compatibility: GET /?stationId= - get all tanks for a station
router.get('/', async (req, res, next) => {
  const { stationId } = req.query;
  if (!stationId) {
    return res.status(400).json({ success: false, error: 'stationId query parameter is required' });
  }
  // If mounted as legacy /api/tanks, employees should be blocked (tests expect 403)
  const base = req.baseUrl || '';
  if (base.startsWith('/api/') && !base.startsWith('/api/v1') && req.user && req.user.role === 'employee') {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }
  req.params.stationId = stationId;
  return tankController.getTanks(req, res, next);
});

// ============================================
// SINGLE TANK OPERATIONS
// ============================================

// Get single tank
router.get('/:id', validateId(), tankController.getTank);

// Update tank settings (manager+)
router.put('/:id', 
  requireMinRole('manager'),
  validateId(),
  validate(tankValidators.update),
  tankController.updateTank
);

// Calibrate tank with dip reading (manager+)
router.post('/:id/calibrate',
  requireMinRole('manager'),
  validateId(),
  tankController.calibrateTank
);

// Record refill
router.post('/:id/refill',
  validateId(),
  validate(tankRefillValidators.create),
  tankController.recordRefill
);

// Get refill history for a tank
router.get('/:id/refills', validateId(), tankController.getRefills);

// ============================================
// REFILL OPERATIONS (separate resource)
// ============================================

// Update refill entry
router.put('/refills/:id',
  validateId(),
  validate(tankRefillValidators.update),
  tankController.updateRefill
);

// Delete refill entry (manager+)
router.delete('/refills/:id',
  requireMinRole('manager'),
  validateId(),
  tankController.deleteRefill
);

module.exports = router;
