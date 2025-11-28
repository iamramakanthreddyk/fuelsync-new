
const express = require('express');
const { getPumps, updatePumpStatus, updateNozzleFuelType } = require('../controllers/pumpController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getPumps);
router.put('/:id/status', auth, updatePumpStatus);
router.put('/nozzles/:nozzleId/fuel-type', auth, updateNozzleFuelType);

module.exports = router;
