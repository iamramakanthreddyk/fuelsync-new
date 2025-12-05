const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const stationController = require('../controllers/stationController');

router.use(authenticate);

// GET /?stationId= - delegate to stationController.getPumps
router.get('/', async (req, res, next) => {
  const { stationId } = req.query;
  if (!stationId) {
    return res.status(400).json({ success: false, error: 'stationId query parameter is required' });
  }
  req.params.stationId = stationId;
  return stationController.getPumps(req, res, next);
});

// POST / - create pump with stationId in body (compatibility)
// Only owner/super_admin may create pumps
router.post('/', requireRole(['owner', 'super_admin']), async (req, res, next) => {
  const { stationId } = req.body;
  if (!stationId) {
    return res.status(400).json({ success: false, error: 'stationId is required in body' });
  }
  req.params.stationId = stationId;
  return stationController.createPump(req, res, next);
});

// PUT /:id - update pump (id in path)
// Only owner/super_admin may update pumps
router.put('/:id', requireRole(['owner', 'super_admin']), async (req, res, next) => {
  return stationController.updatePump(req, res, next);
});

// DELETE /:id - delete pump (compatibility) - delegate to controller
// Only owner/super_admin may delete pumps
router.delete('/:id', requireRole(['owner', 'super_admin']), async (req, res, next) => {
  req.params.id = req.params.id;
  return stationController.deletePump ? stationController.deletePump(req, res, next) : res.status(404).json({ success: false, error: 'Not implemented' });
});

module.exports = router;
