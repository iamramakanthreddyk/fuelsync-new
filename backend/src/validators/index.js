/**
 * Request Validators using Joi
 * Centralized validation schemas for all API endpoints
 */

const Joi = require('joi');
const { FUEL_TYPES, PAYMENT_METHODS, EXPENSE_CATEGORIES, USER_ROLES } = require('../config/constants');

// Convert object values to arrays for Joi validation
const FUEL_TYPE_VALUES = Object.values(FUEL_TYPES);
const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS);
const EXPENSE_CATEGORY_VALUES = Object.values(EXPENSE_CATEGORIES);
const ROLE_VALUES = Object.values(USER_ROLES);

// ============================================
// COMMON SCHEMAS
// ============================================

// UUID validation for all entity IDs (models use UUID primary keys)
const uuidParam = Joi.string().uuid().required();
const optionalUuid = Joi.string().uuid();
// Integer ID for legacy/auto-increment tables (Shift)
const intIdParam = Joi.number().integer().positive().required();
const optionalIntId = Joi.number().integer().positive();
const dateString = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('Date must be in YYYY-MM-DD format');
const phone = Joi.string().custom((value, helpers) => {
  if (!value) return value;
  const digits = String(value).replace(/\D/g, '');
  // Accept plain 10-digit Indian numbers (e.g. 9876543210)
  // or numbers prefixed with country code 91 (e.g. +919876543210 or 91-9876543210)
  if (digits.length === 10) return value;
  if (digits.length === 12 && digits.startsWith('91')) return value;
  return helpers.message('Invalid phone number');
}).message('Invalid phone number');
const email = Joi.string().email().lowercase();
const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
};

// ============================================
// AUTH VALIDATORS
// ============================================

const authValidators = {
  login: Joi.object({
    email: email.required(),
    password: Joi.string().required()
  }),

  register: Joi.object({
    email: email.required(),
    password: Joi.string().min(6).max(100).required()
      .messages({ 'string.min': 'Password must be at least 6 characters' }),
    name: Joi.string().min(2).max(100).required(),
    phone: phone.optional(),
    role: Joi.string().valid(...ROLE_VALUES).optional(),
    stationId: optionalUuid
  })
};

// ============================================
// STATION VALIDATORS
// ============================================

const stationValidators = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    ownerId: optionalUuid, // Required for super_admin, ignored for owners (they use their own ID)
    currentPlanId: optionalUuid, // Optional: owner's current plan ID for validation
    code: Joi.string().max(20).optional(),
    address: Joi.string().max(255).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    pincode: Joi.string().pattern(/^\d{6}$/).optional().messages({ 'string.pattern.base': 'Pincode must be 6 digits' }),
    phone: phone.optional(),
    email: email.optional(),
    gstNumber: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional()
      .messages({ 'string.pattern.base': 'Invalid GST number format' }),
    dealerName: Joi.string().max(100).optional(),
    oilCompany: Joi.string().valid('IOCL', 'BPCL', 'HPCL', 'Reliance', 'Shell', 'Essar', 'Other').optional()
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    code: Joi.string().max(20).optional(),
    address: Joi.string().max(255).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    pincode: Joi.string().pattern(/^\d{6}$/).optional(),
    phone: phone.optional(),
    gstNumber: Joi.string().optional(),
    dealerName: Joi.string().max(100).optional(),
    oilCompany: Joi.string().optional(),
    isActive: Joi.boolean().optional()
  })
};

// ============================================
// PUMP VALIDATORS
// ============================================

const pumpValidators = {
  create: Joi.object({
    name: Joi.string().min(1).max(50).required(),
    pumpNumber: Joi.number().integer().min(1).optional(),
    status: Joi.string().valid('active', 'maintenance', 'inactive').default('active'),
    notes: Joi.string().max(500).optional()
  }),

  update: Joi.object({
    name: Joi.string().min(1).max(50).optional(),
    pumpNumber: Joi.number().integer().min(1).optional(),
    status: Joi.string().valid('active', 'maintenance', 'inactive').optional()
  })
};

// ============================================
// NOZZLE VALIDATORS
// ============================================

const nozzleValidators = {
  create: Joi.object({
    nozzleNumber: Joi.number().integer().min(1).optional(),
    fuelType: Joi.string().valid(...FUEL_TYPE_VALUES).required(),
    initialReading: Joi.number().min(0).default(0),
    status: Joi.string().valid('active', 'maintenance', 'inactive').default('active'),
    notes: Joi.string().max(500).optional()
  }),

  update: Joi.object({
    nozzleNumber: Joi.number().integer().min(1).optional(),
    fuelType: Joi.string().valid(...FUEL_TYPE_VALUES).optional(),
    status: Joi.string().valid('active', 'maintenance', 'inactive').optional()
  })
};

// ============================================
// READING VALIDATORS
// ============================================

const readingValidators = {
  create: Joi.object({
    nozzleId: uuidParam,
    readingDate: dateString.required(),
    readingValue: Joi.number().min(0).required(),
    paymentBreakdown: Joi.object({
      cash: Joi.number().min(0).optional(),
      online: Joi.number().min(0).optional(),
      credit: Joi.number().min(0).optional(),
    }).optional(),
    creditorId: optionalUuid.when('paymentBreakdown.credit', { is: Joi.number().greater(0), then: Joi.required(), otherwise: Joi.optional() }),
    notes: Joi.string().max(500).optional()
  }),

  update: Joi.object({
    paymentBreakdown: Joi.object({
      cash: Joi.number().min(0).optional(),
      online: Joi.number().min(0).optional(),
      credit: Joi.number().min(0).optional(),
    }).optional(),
    notes: Joi.string().max(500).optional()
  }),

  query: Joi.object({
    stationId: optionalUuid,
    pumpId: optionalUuid,
    nozzleId: optionalUuid,
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    ...pagination
  })
};

// ============================================
// FUEL PRICE VALIDATORS
// ============================================

const fuelPriceValidators = {
  create: Joi.object({
    fuelType: Joi.string().valid(...FUEL_TYPE_VALUES).required(),
    price: Joi.number().positive().precision(2).required(),
    effectiveFrom: dateString.optional(),
    costPrice: Joi.number().positive().precision(2).optional()
  }),

  update: Joi.object({
    price: Joi.number().positive().precision(2).optional(),
    costPrice: Joi.number().positive().precision(2).optional()
  })
};

// ============================================
// CREDITOR VALIDATORS
// ============================================

const creditorValidators = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    contactPerson: Joi.string().max(100).optional(),
    phone: phone.optional(),
    email: email.optional(),
    address: Joi.string().max(255).optional(),
    businessName: Joi.string().max(100).optional(),
    gstNumber: Joi.string().optional(),
    creditLimit: Joi.number().min(0).default(0),
    creditPeriodDays: Joi.number().integer().min(0).max(365).default(30),
    notes: Joi.string().max(500).optional()
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    contactPerson: Joi.string().max(100).optional(),
    phone: phone.optional(),
    email: email.optional(),
    address: Joi.string().max(255).optional(),
    businessName: Joi.string().max(100).optional(),
    gstNumber: Joi.string().optional(),
    creditLimit: Joi.number().min(0).optional(),
    creditPeriodDays: Joi.number().integer().min(0).max(365).optional(),
    notes: Joi.string().max(500).optional(),
    isActive: Joi.boolean().optional()
  }),

  query: Joi.object({
    isActive: Joi.boolean().optional(),
    search: Joi.string().max(100).optional(),
    ...pagination
  })
};

// ============================================
// CREDIT TRANSACTION VALIDATORS
// ============================================

const creditTransactionValidators = {
  creditSale: Joi.object({
    creditorId: uuidParam,
    fuelType: Joi.string().valid(...FUEL_TYPE_VALUES).required(),
    litres: Joi.number().positive().required(),
    pricePerLitre: Joi.number().positive().required(),
    amount: Joi.number().positive().optional(), // Can be calculated
    transactionDate: dateString.optional(),
    vehicleNumber: Joi.string().max(20).optional(),
    referenceNumber: Joi.string().max(50).optional(),
    notes: Joi.string().max(500).optional(),
    nozzleReadingId: optionalUuid
  }),

  settlement: Joi.object({
    amount: Joi.number().positive().required(),
    transactionDate: dateString.optional(),
    referenceNumber: Joi.string().max(50).optional(),
    notes: Joi.string().max(500).optional()
  })
};

// ============================================
// EXPENSE VALIDATORS
// ============================================

const expenseValidators = {
  create: Joi.object({
    category: Joi.string().valid(...EXPENSE_CATEGORY_VALUES).required(),
    amount: Joi.number().positive().required(),
    description: Joi.string().max(255).required(),
    expenseDate: dateString.required(),
    paymentMethod: Joi.string().valid(...PAYMENT_METHOD_VALUES).default('cash'),
    referenceNumber: Joi.string().max(50).optional(),
    notes: Joi.string().max(500).optional(),
    vendorName: Joi.string().max(100).optional(),
    isRecurring: Joi.boolean().default(false),
    recurringFrequency: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').optional()
  }),

  update: Joi.object({
    category: Joi.string().valid(...EXPENSE_CATEGORY_VALUES).optional(),
    amount: Joi.number().positive().optional(),
    description: Joi.string().max(255).optional(),
    expenseDate: dateString.optional(),
    paymentMethod: Joi.string().valid(...PAYMENT_METHOD_VALUES).optional(),
    referenceNumber: Joi.string().max(50).optional(),
    notes: Joi.string().max(500).optional(),
    vendorName: Joi.string().max(100).optional()
  }),

  query: Joi.object({
    category: Joi.string().valid(...EXPENSE_CATEGORY_VALUES).optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    ...pagination
  })
};

// ============================================
// TANK VALIDATORS (NEW)
// ============================================

const tankValidators = {
  create: Joi.object({
    fuelType: Joi.string().valid(...FUEL_TYPE_VALUES).required(),
    name: Joi.string().max(50).optional(),
    capacity: Joi.number().positive().required()
      .messages({ 'number.positive': 'Tank capacity must be greater than 0' }),
    currentLevel: Joi.number().min(0).optional()
      .messages({ 'number.min': 'Current level cannot be negative' }),
    lowLevelWarning: Joi.number().positive().optional(),
    criticalLevelWarning: Joi.number().positive().optional()
  }).custom((value, helpers) => {
    if (value.currentLevel > value.capacity) {
      return helpers.error('custom.levelExceedsCapacity');
    }
    if (value.lowLevelWarning && value.criticalLevelWarning && 
        value.criticalLevelWarning >= value.lowLevelWarning) {
      return helpers.error('custom.criticalMustBeLower');
    }
    return value;
  }).messages({
    'custom.levelExceedsCapacity': 'Current level cannot exceed tank capacity',
    'custom.criticalMustBeLower': 'Critical warning level must be lower than low warning level'
  }),

  update: Joi.object({
    name: Joi.string().max(50).optional(),
    capacity: Joi.number().positive().optional(),
    currentLevel: Joi.number().min(0).optional(),
    lowLevelWarning: Joi.number().positive().optional(),
    criticalLevelWarning: Joi.number().positive().optional(),
    isActive: Joi.boolean().optional()
  })
};

// ============================================
// TANK REFILL VALIDATORS (NEW)
// ============================================

const tankRefillValidators = {
  create: Joi.object({
    litres: Joi.number().positive().required(),
    refillDate: dateString.optional(), // Allows backdating, defaults to today
    refillTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
    costPerLitre: Joi.number().positive().optional(),
    totalCost: Joi.number().positive().optional(),
    invoiceNumber: Joi.string().max(50).optional(),
    invoiceDate: dateString.optional(),
    supplierName: Joi.string().max(100).optional(),
    vehicleNumber: Joi.string().max(20).optional(),
    driverName: Joi.string().max(100).optional(),
    driverPhone: Joi.string().max(20).optional(),
    notes: Joi.string().max(500).optional()
  }),

  update: Joi.object({
    refillDate: dateString.optional(),
    refillTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
    costPerLitre: Joi.number().positive().optional(),
    totalCost: Joi.number().positive().optional(),
    invoiceNumber: Joi.string().max(50).optional(),
    invoiceDate: dateString.optional(),
    supplierName: Joi.string().max(100).optional(),
    vehicleNumber: Joi.string().max(20).optional(),
    driverName: Joi.string().max(100).optional(),
    driverPhone: Joi.string().max(20).optional(),
    notes: Joi.string().max(500).optional()
  }),

  query: Joi.object({
    tankId: optionalUuid,
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    ...pagination
  })
};

// ============================================
// SHIFT VALIDATORS (NEW)
// ============================================

const shiftValidators = {
  create: Joi.object({
    employeeId: optionalUuid, // Optional - defaults to current user
    stationId: optionalUuid,  // Optional - defaults to employee's station
    shiftDate: dateString.optional(), // Defaults to today
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional()
      .messages({ 'string.pattern.base': 'Start time must be in HH:MM format' }),
    shiftType: Joi.string().valid('morning', 'evening', 'night', 'full_day', 'custom').optional(),
    notes: Joi.string().max(500).optional()
  }),

  update: Joi.object({
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
    notes: Joi.string().max(500).optional()
  }),

  end: Joi.object({
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
    cashCollected: Joi.number().min(0).optional(),
    onlineCollected: Joi.number().min(0).optional(),
    endNotes: Joi.string().max(500).optional()
  })
};

// ============================================
// USER VALIDATORS
// ============================================

const userValidators = {
  create: Joi.object({
    email: email.required(),
    password: Joi.string().min(6).max(100).required(),
    name: Joi.string().min(2).max(100).required(),
    phone: phone.optional(),
    role: Joi.string().valid('employee', 'manager').required(),
    stationId: uuidParam
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    phone: phone.optional(),
    stationId: optionalUuid,
    isActive: Joi.boolean().optional()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(100).required()
  })
};

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

/**
 * Creates validation middleware for a Joi schema
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, '')
      }));

      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors
        }
      });
    }

    // Replace with validated/sanitized values
    req[property] = value;
    next();
  };
};

/**
 * Validate UUID ID parameter (default for most entities)
 */
const validateId = (paramName = 'id') => {
  return validate(
    Joi.object({ [paramName]: uuidParam }),
    'params'
  );
};

/**
 * Validate integer ID parameter (for Shift and other auto-increment tables)
 */
const validateIntId = (paramName = 'id') => {
  return validate(
    Joi.object({ [paramName]: intIdParam }),
    'params'
  );
};

module.exports = {
  // Validators
  authValidators,
  stationValidators,
  pumpValidators,
  nozzleValidators,
  readingValidators,
  fuelPriceValidators,
  creditorValidators,
  creditTransactionValidators,
  expenseValidators,
  tankValidators,
  tankRefillValidators,
  shiftValidators,
  userValidators,
  
  // Middleware helpers
  validate,
  validateId,
  validateIntId,
  
  // Common schemas for reuse
  schemas: {
    uuidParam,
    optionalUuid,
    intIdParam,
    optionalIntId,
    dateString,
    phone,
    email,
    pagination
  }
};
