const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const stationController = require('../controllers/stationController');

router.use(authenticate);

// GET /?stationId= - delegate to stationController.getFuelPrices
router.get('/', async (req, res, next) => {
  const { stationId } = req.query;
  if (!stationId) {
    return res.status(400).json({ success: false, error: 'stationId query parameter is required' });
  }
  req.params.stationId = stationId;
  return stationController.getFuelPrices(req, res, next);
});

module.exports = router;
