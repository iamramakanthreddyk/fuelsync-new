const express = require('express');
const router = express.Router();
const tankController = require('../controllers/tankController');
const { authenticate, requireMinRole } = require('../middleware/auth');

router.use(authenticate);

// Compatibility: POST /api/v1/tank-refills - expects stationId in body
router.post('/', requireMinRole('manager'), async (req, res, next) => {
  // This compatibility endpoint is a convenience wrapper; manager+ required
  const { tankId } = req.body;
  if (!tankId) return res.status(400).json({ success: false, error: 'tankId is required in body' });
  req.params.id = tankId;
  return tankController.recordRefill(req, res, next);
});

module.exports = router;
