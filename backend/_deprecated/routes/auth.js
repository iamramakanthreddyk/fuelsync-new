
const express = require('express');
const {
  login,
  getCurrentUser,
  refreshToken,
  logout
} = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.get('/me', auth, getCurrentUser);
router.post('/refresh', auth, refreshToken);
router.post('/logout', auth, logout);

module.exports = router;
