/**
 * User Routes
 * User management with role-based access
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRole, requireMinRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// ============================================
// USER CRUD
// ============================================

// List users (filtered by role permissions)
router.get('/', userController.getUsers);

// Get single user
router.get('/:id', userController.getUser);

// Effective features for auditing (super_admin only)
router.get('/:id/effective-features', requireRole(['super_admin']), userController.getEffectiveFeatures);

// Create user (super_admin creates owners, owner creates managers/employees, etc.)
router.post('/', requireMinRole('manager'), userController.createUser);

// Update user
router.put('/:id', userController.updateUser);

// Deactivate user (soft delete)
router.delete('/:id', requireMinRole('manager'), userController.deactivateUser);

// Reset password
router.post('/:id/reset-password', userController.resetPassword);

module.exports = router;
