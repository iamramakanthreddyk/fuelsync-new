const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const stationController = require('../controllers/stationController');

router.use(authenticate);

// GET /?pumpId= or /?stationId= - delegate to stationController.getNozzles
router.get('/', async (req, res, next) => {
  const { pumpId, stationId } = req.query;
  if (pumpId) {
    req.params.pumpId = pumpId;
  } else if (stationId) {
    req.params.stationId = stationId;
  } else {
    return res.status(400).json({ success: false, error: 'pumpId or stationId query parameter is required' });
  }
  return stationController.getNozzles(req, res, next);
});

// POST / - create nozzle (compatibility) - expects pumpId in body or query
router.post('/', async (req, res, next) => {
  const { pumpId } = req.body;
  if (!pumpId) {
    return res.status(400).json({ success: false, error: 'pumpId is required in body' });
  }
  req.params.pumpId = pumpId;
  return stationController.createNozzle(req, res, next);
});

// PUT /:id - update nozzle
router.put('/:id', async (req, res, next) => {
  return stationController.updateNozzle(req, res, next);
});

// DELETE /:id - delete nozzle (compatibility)
router.delete('/:id', async (req, res, next) => {
  return stationController.deleteNozzle ? stationController.deleteNozzle(req, res, next) : res.status(404).json({ success: false, error: 'Not implemented' });
});

module.exports = router;
