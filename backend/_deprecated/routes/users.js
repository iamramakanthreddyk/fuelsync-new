
const express = require('express');
const { getAllUsers, createEmployee, updateUserPlan, setCustomLimits, deleteUser } = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getAllUsers);
router.post('/employees', auth, createEmployee);
router.put('/:userId/plan', auth, updateUserPlan);
router.put('/:userId/limits', auth, setCustomLimits); // New endpoint for custom limits
router.delete('/:userId', auth, deleteUser);

module.exports = router;
