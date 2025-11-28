/**
 * Config Routes
 * Provides dropdown options and configuration values for frontend
 * These endpoints help frontend populate select/dropdown options
 */

const express = require('express');
const router = express.Router();
const { 
  FUEL_TYPES, 
  FUEL_TYPE_LABELS,
  PAYMENT_METHODS, 
  PAYMENT_METHOD_LABELS,
  EXPENSE_CATEGORIES, 
  EXPENSE_CATEGORY_LABELS,
  USER_ROLES, 
  ROLE_HIERARCHY,
  PUMP_STATUS,
  CREDIT_STATUS,
  DEFAULT_PLAN_LIMITS,
  CURRENCY,
  DATE_FORMATS
} = require('../config/constants');

/**
 * Get all configuration options
 * GET /api/v1/config
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      fuelTypes: Object.entries(FUEL_TYPES).map(([key, value]) => ({
        value,
        label: FUEL_TYPE_LABELS[value] || value,
        key
      })),
      paymentMethods: Object.entries(PAYMENT_METHODS).map(([key, value]) => ({
        value,
        label: PAYMENT_METHOD_LABELS[value] || value,
        key
      })),
      expenseCategories: Object.entries(EXPENSE_CATEGORIES).map(([key, value]) => ({
        value,
        label: EXPENSE_CATEGORY_LABELS[value] || value,
        key
      })),
      roles: Object.entries(USER_ROLES).map(([key, value]) => ({
        value,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        hierarchy: ROLE_HIERARCHY[value],
        key
      })).sort((a, b) => b.hierarchy - a.hierarchy),
      pumpStatuses: Object.entries(PUMP_STATUS).map(([key, value]) => ({
        value,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        key
      })),
      creditStatuses: Object.entries(CREDIT_STATUS).map(([key, value]) => ({
        value,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        key
      })),
      shiftTypes: [
        { value: 'morning', label: 'Morning Shift' },
        { value: 'evening', label: 'Evening Shift' },
        { value: 'night', label: 'Night Shift' },
        { value: 'full_day', label: 'Full Day' },
        { value: 'custom', label: 'Custom' }
      ],
      handoverTypes: [
        { value: 'shift_collection', label: 'Shift Collection' },
        { value: 'employee_to_manager', label: 'Employee to Manager' },
        { value: 'manager_to_owner', label: 'Manager to Owner' },
        { value: 'deposit_to_bank', label: 'Bank Deposit' }
      ],
      tankTrackingModes: [
        { value: 'off', label: 'Off (No Tracking)' },
        { value: 'warning', label: 'Warning Only' },
        { value: 'strict', label: 'Strict (Block if insufficient)' }
      ],
      currency: CURRENCY,
      dateFormats: DATE_FORMATS
    }
  });
});

/**
 * Get fuel types for dropdown
 * GET /api/v1/config/fuel-types
 */
router.get('/fuel-types', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(FUEL_TYPES).map(([key, value]) => ({
      value,
      label: FUEL_TYPE_LABELS[value] || value
    }))
  });
});

/**
 * Get payment methods for dropdown
 * GET /api/v1/config/payment-methods
 */
router.get('/payment-methods', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(PAYMENT_METHODS).map(([key, value]) => ({
      value,
      label: PAYMENT_METHOD_LABELS[value] || value
    }))
  });
});

/**
 * Get expense categories for dropdown
 * GET /api/v1/config/expense-categories
 */
router.get('/expense-categories', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(EXPENSE_CATEGORIES).map(([key, value]) => ({
      value,
      label: EXPENSE_CATEGORY_LABELS[value] || value
    }))
  });
});

/**
 * Get user roles for dropdown
 * GET /api/v1/config/roles
 */
router.get('/roles', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(USER_ROLES).map(([key, value]) => ({
      value,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      hierarchy: ROLE_HIERARCHY[value]
    })).sort((a, b) => b.hierarchy - a.hierarchy)
  });
});

/**
 * Get pump statuses for dropdown
 * GET /api/v1/config/pump-statuses
 */
router.get('/pump-statuses', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(PUMP_STATUS).map(([key, value]) => ({
      value,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }))
  });
});

/**
 * Get plan options (for display, not subscription)
 * GET /api/v1/config/plans
 */
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(DEFAULT_PLAN_LIMITS).map(([name, limits]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      ...limits
    }))
  });
});

/**
 * Get oil company options (for station registration)
 * GET /api/v1/config/oil-companies
 */
router.get('/oil-companies', (req, res) => {
  res.json({
    success: true,
    data: [
      { value: 'IOCL', label: 'Indian Oil Corporation (IOCL)' },
      { value: 'BPCL', label: 'Bharat Petroleum (BPCL)' },
      { value: 'HPCL', label: 'Hindustan Petroleum (HPCL)' },
      { value: 'Reliance', label: 'Reliance Petroleum' },
      { value: 'Shell', label: 'Shell' },
      { value: 'Essar', label: 'Nayara Energy (Essar)' },
      { value: 'Other', label: 'Other' }
    ]
  });
});

/**
 * Get Indian states for dropdown
 * GET /api/v1/config/states
 */
router.get('/states', (req, res) => {
  res.json({
    success: true,
    data: [
      'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
      'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
      'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
      'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
      'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
      'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
      'Delhi', 'Chandigarh', 'Puducherry', 'Ladakh', 'Jammu and Kashmir'
    ].map(state => ({ value: state, label: state }))
  });
});

module.exports = router;
