/**
 * Validation utilities using Joi
 */
const Joi = require('joi');

// Common validation schemas
const commonSchemas = {
  id: Joi.string().uuid().messages({
    'string.guid': 'Invalid ID format'
  }),
  email: Joi.string().email().messages({
    'string.email': 'Invalid email format'
  }),
  phone: Joi.string().custom((value, helpers) => {
    if (!value) return value;
    const digits = String(value).replace(/\D/g, '');
    if (digits.length === 10) return value;
    if (digits.length === 12 && digits.startsWith('91')) return value;
    return helpers.message('Invalid phone number format');
  }).messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({
    'string.pattern.base': 'Invalid date format (YYYY-MM-DD)'
  }),
  positiveNumber: Joi.number().positive().messages({
    'number.positive': 'Must be a positive number'
  }),
  nonNegativeNumber: Joi.number().min(0).messages({
    'number.min': 'Must be non-negative'
  }),
  fuelType: Joi.string().valid('Petrol', 'Diesel', 'CNG', 'LPG').messages({
    'any.only': 'Invalid fuel type'
  }),
  userRole: Joi.string().valid('owner', 'employee', 'admin', 'superadmin').messages({
    'any.only': 'Invalid user role'
  }),
  status: Joi.string().valid('active', 'inactive', 'maintenance').messages({
    'any.only': 'Invalid status'
  })
};

// Reading validation schemas
const readingSchemas = {
  create: Joi.object({
    nozzleId: commonSchemas.id.required(),
    stationId: commonSchemas.id.optional(),
    readingValue: commonSchemas.positiveNumber.required(),
    readingDate: commonSchemas.date.optional(),
    previousReading: commonSchemas.nonNegativeNumber.optional(),
    litresSold: commonSchemas.nonNegativeNumber.optional(),
    pricePerLitre: commonSchemas.nonNegativeNumber.optional(),
    totalAmount: commonSchemas.nonNegativeNumber.optional(),
    paymentBreakdown: Joi.object({
      cash: commonSchemas.nonNegativeNumber.optional(),
      online: commonSchemas.nonNegativeNumber.optional(),
      credit: commonSchemas.nonNegativeNumber.optional()
    }).optional(),
    creditorId: commonSchemas.id.optional(),
    paymentType: Joi.string().valid('cash', 'digital', 'online', 'credit').optional(),
    notes: Joi.string().allow('').max(500).optional().messages({
      'string.max': 'Notes must be less than 500 characters'
    })

  }),
  
  update: Joi.object({
    currentReading: commonSchemas.positiveNumber.optional(),
    notes: Joi.string().max(500).optional(),
    status: Joi.string().valid('pending', 'approved', 'rejected').optional()
  }),

  query: Joi.object({
    stationId: commonSchemas.id.optional(),
    nozzleId: commonSchemas.id.optional(),
    dateFrom: commonSchemas.date.optional(),
    dateTo: commonSchemas.date.optional(),
    limit: Joi.number().min(1).max(1000).default(50),
    offset: Joi.number().min(0).default(0)
  })
};

// Station validation schemas
const stationSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
      'string.empty': 'Station name is required',
      'string.max': 'Name too long'
    }),
    address: Joi.string().min(1).max(500).required().messages({
      'string.empty': 'Address is required',
      'string.max': 'Address too long'
    }),
    phone: commonSchemas.phone.optional(),
    email: commonSchemas.email.optional()
  }),

  update: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    address: Joi.string().min(1).max(500).optional(),
    phone: commonSchemas.phone.optional(),
    email: commonSchemas.email.optional(),
    status: commonSchemas.status.optional()
  })
};

// User validation schemas
const userSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
      'string.empty': 'Name is required',
      'string.max': 'Name too long'
    }),
    email: commonSchemas.email.required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain uppercase, lowercase, and number'
    }),
    role: commonSchemas.userRole.required(),
    phone: commonSchemas.phone.optional()
  }),

  update: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional(),
    role: commonSchemas.userRole.optional(),
    isActive: Joi.boolean().optional()
  }),

  login: Joi.object({
    email: commonSchemas.email.required(),
    password: Joi.string().min(1).required().messages({
      'string.empty': 'Password is required'
    })
  })
};

// Pump validation schemas
const pumpSchemas = {
  create: Joi.object({
    stationId: commonSchemas.id.required(),
    pumpNumber: commonSchemas.positiveNumber.required(),
    name: Joi.string().max(100).optional(),
    isActive: Joi.boolean().default(true)
  }),

  update: Joi.object({
    name: Joi.string().max(100).optional(),
    isActive: Joi.boolean().optional()
  })
};

/**
 * Generic validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} source - Where to get data from ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
function validateSchema(schema, source = 'body') {
  return (req, res, next) => {
    let data = req[source];
    // Run key normalization for reading create payloads (accept snake_case from UI)
    if (schema === readingSchemas.create && source === 'body') {
      data = normalizeKeys(data);
      req[source] = data;
    }
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        type: err.type
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace the original data with validated and transformed data
    req[source] = value;
    next();
  };
}

// Normalize common snake_case keys from clients to camelCase expected by Joi schemas
function normalizeKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const res = { ...obj };

  const map = {
    'nozzle_id': 'nozzleId',
    'station_id': 'stationId',
    'reading_value': 'readingValue',
    'current_reading': 'readingValue',
    'cumulative_volume': 'readingValue',
    'reading_date': 'readingDate',
    'previous_reading': 'previousReading',
    'litres_sold': 'litresSold',
    'price_per_litre': 'pricePerLitre',
    'total_amount': 'totalAmount',
    'payment_breakdown': 'paymentBreakdown',
    'creditor_id': 'creditorId',
    'reference_number': 'referenceNumber'
  };

  Object.keys(map).forEach(k => {
    if (Object.prototype.hasOwnProperty.call(res, k) && !Object.prototype.hasOwnProperty.call(res, map[k])) {
      res[map[k]] = res[k];
      delete res[k];
    }
  });

  return res;
}

module.exports = {
  commonSchemas,
  readingSchemas,
  stationSchemas,
  userSchemas,
  pumpSchemas,
  validateSchema,
  
  // Specific validation middlewares
  validateReadingCreate: validateSchema(readingSchemas.create, 'body'),
  validateReadingUpdate: validateSchema(readingSchemas.update, 'body'),
  validateReadingQuery: validateSchema(readingSchemas.query, 'query'),
  
  validateStationCreate: validateSchema(stationSchemas.create, 'body'),
  validateStationUpdate: validateSchema(stationSchemas.update, 'body'),
  
  validateUserCreate: validateSchema(userSchemas.create, 'body'),
  validateUserUpdate: validateSchema(userSchemas.update, 'body'),
  validateUserLogin: validateSchema(userSchemas.login, 'body'),
  
  validatePumpCreate: validateSchema(pumpSchemas.create, 'body'),
  validatePumpUpdate: validateSchema(pumpSchemas.update, 'body')
};
