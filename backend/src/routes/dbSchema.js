const express = require('express');
const router = express.Router();
const { getFullSchema } = require('../controllers/dbSchemaController');

// GET /api/v1/db/schema
router.get('/db/schema', getFullSchema);

module.exports = router;
