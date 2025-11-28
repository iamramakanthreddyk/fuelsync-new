
const express = require('express');
const { generateReport } = require('../controllers/reportController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/generate', auth, generateReport);

module.exports = router;
