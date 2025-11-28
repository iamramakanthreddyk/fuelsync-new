
const express = require('express');
const {
  getNozzleReadings,
  createManualReading,
  updateNozzleReading,
  deleteNozzleReading
} = require('../controllers/nozzleReadingController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getNozzleReadings);
router.post('/manual', auth, createManualReading);
router.put('/:id', auth, updateNozzleReading);
router.delete('/:id', auth, deleteNozzleReading);

module.exports = router;
