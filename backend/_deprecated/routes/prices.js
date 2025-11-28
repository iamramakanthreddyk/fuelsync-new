
const express = require('express');
const { getFuelPrices, updateFuelPrice } = require('../controllers/priceController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getFuelPrices);
router.put('/', auth, updateFuelPrice);

module.exports = router;
