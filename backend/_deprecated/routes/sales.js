
const express = require('express');
const { getSales, getDailySummary } = require('../controllers/salesController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getSales);
router.get('/daily/:date', auth, getDailySummary);

module.exports = router;
