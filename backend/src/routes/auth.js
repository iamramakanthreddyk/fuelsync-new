/**
 * Auth Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);
router.post('/register', authController.register);

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);
// Backwards-compatible alias
router.get('/profile', authenticate, authController.getCurrentUser);
// Change password
router.post('/change-password', authenticate, authController.changePassword);
// Update profile (alias to user controller update via auth)
router.put('/profile', authenticate, authController.getCurrentUser);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
