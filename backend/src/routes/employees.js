const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireMinRole } = require('../middleware/auth');

router.use(authenticate);

// List employees (manager+ only)
router.get('/', requireMinRole('manager'), userController.getUsers);

// Create employee (manager+ only)
router.post('/', requireMinRole('manager'), userController.createUser);

module.exports = router;
