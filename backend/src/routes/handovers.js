/**
 * Cash Handover Routes
 * Cash confirmation and bank deposit tracking
 */

const express = require('express');
const router = express.Router();
const cashHandoverController = require('../controllers/cashHandoverController');
const { authenticate, requireMinRole } = require('../middleware/auth');
const { validate, validateId } = require('../validators');
const Joi = require('joi');

// Validation schemas
const handoverValidators = {
  create: Joi.object({
    stationId: Joi.string().uuid().required(),
    handoverType: Joi.string().valid(
      'shift_collection',
      'employee_to_manager',
      'manager_to_owner',
      'deposit_to_bank'
    ).required(),
    handoverDate: Joi.string().isoDate().optional(),
    fromUserId: Joi.string().uuid().optional(),
    expectedAmount: Joi.number().min(0).optional(),
    notes: Joi.string().max(500).optional()
  }),
  
  confirm: Joi.object({
    actualAmount: Joi.number().min(0).required(),
    notes: Joi.string().max(500).optional()
  }),
  
  bankDeposit: Joi.object({
    stationId: Joi.string().uuid().required(),
    handoverDate: Joi.string().isoDate().optional(),
    amount: Joi.number().min(0).required(),
    bankName: Joi.string().max(100).optional(),
    depositReference: Joi.string().max(50).optional(),
    depositReceiptUrl: Joi.string().uri().optional(),
    notes: Joi.string().max(500).optional()
  }),
  
  resolve: Joi.object({
    resolutionNotes: Joi.string().max(500).required()
  })
};

// All routes require authentication
router.use(authenticate);

// ============================================
// HANDOVER MANAGEMENT
// ============================================

// Get pending handovers for current user
router.get('/pending', cashHandoverController.getPendingHandovers);

// Create a new handover (manager+)
router.post('/',
  requireMinRole('manager'),
  validate(handoverValidators.create),
  cashHandoverController.createHandover
);

// Confirm a handover
router.post('/:id/confirm',
  validateId(),
  validate(handoverValidators.confirm),
  cashHandoverController.confirmHandover
);

// Resolve a disputed handover (owner+)
router.post('/:id/resolve',
  requireMinRole('owner'),
  validateId(),
  validate(handoverValidators.resolve),
  cashHandoverController.resolveDispute
);

// Record bank deposit (owner+)
router.post('/bank-deposit',
  requireMinRole('owner'),
  validate(handoverValidators.bankDeposit),
  cashHandoverController.recordBankDeposit
);

module.exports = router;
