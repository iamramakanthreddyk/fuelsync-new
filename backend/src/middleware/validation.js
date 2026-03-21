/**
 * Request Validation Middleware
 * 
 * Validates request body/query against Joi schemas
 * Returns consistent validation error format
 */

const { formatError } = require('../utils/apiResponse');

/**
 * Create validation middleware for a Joi schema
 * @param {Object} schema - Joi schema
 * @param {string} [source='body'] - What to validate (body, query, params)
 * @returns {Function} Middleware function
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];

    if (!dataToValidate) {
      if (source === 'body') {
        return res.status(400).json(
          formatError('INVALID_REQUEST', 'Request body is required')
        );
      }
      return next();
    }

    const { value, error } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type,
      }));

      return res.status(422).json(
        formatError('VALIDATION_ERROR', 'Validation failed', {
          details,
        })
      );
    }

    // Replace request data with validated data
    req[source] = value;
    next();
  };
};

/**
 * Validate request body
 * @param {Object} schema - Joi schema
 * @returns {Function} Middleware
 */
const validateBody = (schema) => validate(schema, 'body');

/**
 * Validate query parameters
 * @param {Object} schema - Joi schema
 * @returns {Function} Middleware
 */
const validateQuery = (schema) => validate(schema, 'query');

/**
 * Validate URL parameters
 * @param {Object} schema - Joi schema
 * @returns {Function} Middleware
 */
const validateParams = (schema) => validate(schema, 'params');

/**
 * Validate multiple sources
 * @param {Object} schemas - { body: schema, query: schema, params: schema }
 * @returns {Array} Array of middleware functions
 */
const validateAll = (schemas) => {
  const middleware = [];
  if (schemas.body) middleware.push(validateBody(schemas.body));
  if (schemas.query) middleware.push(validateQuery(schemas.query));
  if (schemas.params) middleware.push(validateParams(schemas.params));
  return middleware;
};

// ============================================
// USAGE EXAMPLES
// ============================================

/**
 * USAGE IN ROUTES:
 * 
 * const { validate } = require('../middleware/validation');
 * const { createReadingSchema, getReadingsQuerySchema } = require('../validators/schemas');
 * 
 * // Single validation (body)
 * router.post('/readings', validate(createReadingSchema), controller.create);
 * 
 * // Query validation
 * router.get('/readings', validate(getReadingsQuerySchema, 'query'), controller.getAll);
 * 
 * // Multiple validations
 * router.put('/readings/:id',
 *   validate(updateReadingSchema, 'body'),
 *   validate(idSchema, 'params'),
 *   controller.update
 * );
 * 
 * // Using validateAll for complex routes
 * router.get('/path/:id',
 *   ...validateAll({
 *     params: idSchema,
 *     query: paginationSchema,
 *   }),
 *   controller.handler
 * );
 */

module.exports = {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateAll,
};
