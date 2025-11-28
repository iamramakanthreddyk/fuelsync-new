/**
 * Joi Validation Schemas
 * Centralized input validation for all API endpoints
 */

const Joi = require('joi');

// ============================================
// COMMON SCHEMAS
// ============================================

const uuidSchema = Joi.string().uuid();
const emailSchema = Joi.string().email().lowercase().trim();
const passwordSchema = Joi.string().min(8).max(128);
const dateSchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/);

// ============================================
// AUTH SCHEMAS
// ============================================

const authSchemas = {
  login: Joi.object({
    email: emailSchema.required(),
    password: Joi.string().required()
  }),

  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: emailSchema.required(),
    password: passwordSchema.required(),
    role: Joi.string().valid('owner', 'manager', 'employee').default('employee'),
    stationId: uuidSchema.optional()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: passwordSchema.required(),
    confirmPassword: Joi.ref('newPassword')
  }),

  resetPasswordRequest: Joi.object({
    email: emailSchema.required()
  }),

  resetPassword: Joi.object({
    token: Joi.string().length(64).required(),
    newPassword: passwordSchema.required(),
    confirmPassword: Joi.ref('newPassword')
  })
};

// ============================================
// USER SCHEMAS
// ============================================

const userSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: emailSchema.required(),
    password: passwordSchema.required(),
    role: Joi.string().valid('owner', 'manager', 'employee').required(),
    stationId: uuidSchema.when('role', {
      is: Joi.valid('manager', 'employee'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    planId: uuidSchema.optional()
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: emailSchema.optional(),
    role: Joi.string().valid('owner', 'manager', 'employee').optional(),
    stationId: uuidSchema.optional().allow(null),
    planId: uuidSchema.optional().allow(null),
    isActive: Joi.boolean().optional(),
    customLimits: Joi.object().optional()
  }).min(1)
};

// ============================================
// STATION SCHEMAS
// ============================================

const stationSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(200).required(),
    location: Joi.string().max(500).optional(),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      pincode: Joi.string().optional()
    }).optional(),
    contactInfo: Joi.object({
      phone: Joi.string().optional(),
      email: emailSchema.optional(),
      managerName: Joi.string().optional()
    }).optional(),
    licenseNumber: Joi.string().optional()
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(200).optional(),
    location: Joi.string().max(500).optional().allow(null),
    address: Joi.object().optional(),
    contactInfo: Joi.object().optional(),
    licenseNumber: Joi.string().optional().allow(null),
    isActive: Joi.boolean().optional()
  }).min(1)
};

// ============================================
// PUMP SCHEMAS
// ============================================

const pumpSchemas = {
  create: Joi.object({
    stationId: uuidSchema.required(),
    pumpSno: Joi.string().required(),
    name: Joi.string().required(),
    location: Joi.string().optional(),
    status: Joi.string().valid('active', 'inactive', 'maintenance').default('active')
  }),

  update: Joi.object({
    name: Joi.string().optional(),
    location: Joi.string().optional().allow(null),
    status: Joi.string().valid('active', 'inactive', 'maintenance').optional()
  }).min(1)
};

// ============================================
// NOZZLE SCHEMAS
// ============================================

const nozzleSchemas = {
  create: Joi.object({
    nozzleId: Joi.number().integer().min(1).max(8).required(),
    fuelType: Joi.string().valid('petrol', 'diesel').required(),
    maxFlowRate: Joi.number().positive().optional()
  }),

  update: Joi.object({
    fuelType: Joi.string().valid('petrol', 'diesel').optional(),
    status: Joi.string().valid('active', 'inactive').optional(),
    maxFlowRate: Joi.number().positive().optional().allow(null)
  }).min(1),

  bulk: Joi.object({
    nozzles: Joi.array().items(
      Joi.object({
        nozzleId: Joi.number().integer().min(1).max(8).required(),
        fuelType: Joi.string().valid('petrol', 'diesel').required(),
        status: Joi.string().valid('active', 'inactive').default('active'),
        maxFlowRate: Joi.number().positive().optional()
      })
    ).min(1).required()
  })
};

// ============================================
// FUEL PRICE SCHEMAS
// ============================================

const priceSchemas = {
  update: Joi.object({
    fuelType: Joi.string().valid('petrol', 'diesel').required(),
    price: Joi.number().positive().max(999).required()
  }),

  bulkUpdate: Joi.object({
    prices: Joi.array().items(
      Joi.object({
        fuelType: Joi.string().valid('petrol', 'diesel').required(),
        price: Joi.number().positive().max(999).required()
      })
    ).min(1).required()
  })
};

// ============================================
// INVENTORY SCHEMAS
// ============================================

const inventorySchemas = {
  createTank: Joi.object({
    stationId: uuidSchema.optional(), // Required for super_admin
    tankNumber: Joi.number().integer().min(1).max(20).required(),
    fuelType: Joi.string().valid('petrol', 'diesel').required(),
    capacity: Joi.number().positive().required(),
    currentStock: Joi.number().min(0).default(0),
    reorderLevel: Joi.number().min(0).optional()
  }),

  updateTank: Joi.object({
    currentStock: Joi.number().min(0).optional(),
    reorderLevel: Joi.number().min(0).optional(),
    status: Joi.string().valid('active', 'inactive', 'maintenance').optional(),
    lastDipReading: Joi.number().min(0).optional()
  }).min(1),

  dipReading: Joi.object({
    dipReading: Joi.number().min(0).required(),
    adjustStock: Joi.boolean().default(false)
  }),

  createDelivery: Joi.object({
    stationId: uuidSchema.optional(),
    tankId: uuidSchema.required(),
    deliveryDate: dateSchema.optional(),
    deliveryTime: timeSchema.optional(),
    supplierName: Joi.string().optional(),
    vehicleNumber: Joi.string().optional(),
    invoiceNumber: Joi.string().optional(),
    orderedQuantity: Joi.number().positive().optional(),
    receivedQuantity: Joi.number().positive().required(),
    pricePerLitre: Joi.number().positive().required(),
    notes: Joi.string().max(1000).optional()
  }),

  verifyDelivery: Joi.object({
    status: Joi.string().valid('verified', 'disputed').required(),
    notes: Joi.string().max(500).optional()
  })
};

// ============================================
// CLOSURE SCHEMAS
// ============================================

const closureSchemas = {
  create: Joi.object({
    stationId: uuidSchema.optional(),
    closureDate: dateSchema.required(),
    shift: Joi.string().valid('morning', 'afternoon', 'night', 'full_day').required(),
    actualCash: Joi.number().min(0).optional(),
    cardPayments: Joi.number().min(0).default(0),
    upiPayments: Joi.number().min(0).default(0),
    creditSales: Joi.number().min(0).default(0),
    dipReadings: Joi.array().optional(),
    nozzleReadings: Joi.array().optional(),
    notes: Joi.string().max(2000).optional()
  }),

  review: Joi.object({
    action: Joi.string().valid('approve', 'reject').required(),
    rejectionReason: Joi.string().when('action', {
      is: 'reject',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })
};

// ============================================
// SALE SCHEMAS
// ============================================

const saleSchemas = {
  create: Joi.object({
    pumpId: uuidSchema.required(),
    nozzleId: Joi.number().integer().min(1).max(8).required(),
    fuelType: Joi.string().valid('petrol', 'diesel').required(),
    litresSold: Joi.number().positive().required(),
    pricePerLitre: Joi.number().positive().required(),
    saleDate: dateSchema.optional(),
    shift: Joi.string().valid('morning', 'afternoon', 'night').required()
  }),

  query: Joi.object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    pumpId: uuidSchema.optional(),
    fuelType: Joi.string().valid('petrol', 'diesel').optional(),
    shift: Joi.string().valid('morning', 'afternoon', 'night').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

// ============================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================

/**
 * Create validation middleware from schema
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {string} property - Request property to validate (body, query, params)
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
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace with validated/sanitized values
    req[property] = value;
    next();
  };
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Schemas
  authSchemas,
  userSchemas,
  stationSchemas,
  pumpSchemas,
  nozzleSchemas,
  priceSchemas,
  inventorySchemas,
  closureSchemas,
  saleSchemas,
  
  // Helper schemas
  uuidSchema,
  emailSchema,
  passwordSchema,
  dateSchema,
  timeSchema,
  
  // Middleware factory
  validate,

  // Pre-built validators for common use
  validateLogin: validate(authSchemas.login),
  validateRegister: validate(authSchemas.register),
  validateChangePassword: validate(authSchemas.changePassword),
  validateCreateUser: validate(userSchemas.create),
  validateUpdateUser: validate(userSchemas.update),
  validateCreateStation: validate(stationSchemas.create),
  validateUpdateStation: validate(stationSchemas.update),
  validateCreateNozzle: validate(nozzleSchemas.create),
  validateUpdateNozzle: validate(nozzleSchemas.update),
  validateCreateTank: validate(inventorySchemas.createTank),
  validateCreateDelivery: validate(inventorySchemas.createDelivery),
  validateCreateClosure: validate(closureSchemas.create)
};
