const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const stationController = require('../controllers/stationController');

router.use(authenticate);

// GET /?pumpId= - delegate to stationController.getNozzles
router.get('/', async (req, res, next) => {
  const { pumpId } = req.query;
  if (!pumpId) {
    return res.status(400).json({ success: false, error: 'pumpId query parameter is required' });
  }
  req.params.pumpId = pumpId;
  return stationController.getNozzles(req, res, next);
});

module.exports = router;
