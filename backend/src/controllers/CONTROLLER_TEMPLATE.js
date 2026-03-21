/**
 * CLEAN CONTROLLER ARCHITECTURE TEMPLATE
 * 
 * This template shows how ALL controllers should be structured:
 * 1. All imports at module top (services, models, utilities)
 * 2. No inline requires or deferred imports
 * 3. Clean separation of HTTP concerns from business logic
 * 4. Consistent error handling and response formatting
 * 5. Proper use of async/await with error wrapping
 */

// ===== SERVICE LAYER =====
const services = require('../services');

// ===== MODEL & DATABASE ACCESS =====
const { models, sequelize, Op } = require('../services/modelAccess');
const { User, Station, Nozzle } = models;

// ===== UTILITIES & MIDDLEWARE =====
const { asyncHandler } = require('../utils/errors');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/apiResponse');
const { validateRequest } = require('../middleware/validation');

// ===== CONSTANTS =====
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };

/**
 * GET /api/v1/resource
 * Get all resources with pagination and filtering
 */
exports.getAll = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, search, startDate, endDate } = req.query;
  const user = await User.findByPk(req.userId);
  
  // Build where clause
  const where = { isActive: true };
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  // Fetch from service or repository
  const { count, rows } = await services.resourceService.getFiltered({
    where,
    page,
    limit,
  });

  // Send paginated response
  return sendPaginated(res, rows, { page, limit, total: count });
});

/**
 * GET /api/v1/resource/:id
 * Get single resource by ID
 */
exports.getById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findByPk(req.userId);

  // Fetch from service
  const resource = await services.resourceService.getById(id);

  // Handle not found
  if (!resource) {
    return sendError(res, 'NOT_FOUND', `Resource with ID ${id} not found`, 404);
  }

  // Send response
  return sendSuccess(res, resource);
});

/**
 * POST /api/v1/resource
 * Create new resource
 */
exports.create = asyncHandler(async (req, res, next) => {
  const { name, description, type } = req.body;
  const user = await User.findByPk(req.userId);

  // Validate request (middleware or manual)
  if (!name || !description) {
    return sendError(res, 'VALIDATION_ERROR', 'name and description are required', 422, {
      details: [
        { field: 'name', message: 'required' },
        { field: 'description', message: 'required' },
      ],
    });
  }

  // Create via service (business logic is in service layer)
  const resource = await services.resourceService.create({
    name,
    description,
    type,
    createdBy: user.id,
  });

  // Send response
  return sendCreated(res, resource, { message: 'Resource created successfully' });
});

/**
 * PUT /api/v1/resource/:id
 * Update existing resource
 */
exports.update = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, type } = req.body;
  const user = await User.findByPk(req.userId);

  // Check ownership or permission
  const resource = await services.resourceService.getById(id);
  if (!resource) {
    return sendError(res, 'NOT_FOUND', `Resource not found`, 404);
  }

  // Update via service
  const updated = await services.resourceService.update(id, {
    name,
    description,
    type,
    updatedBy: user.id,
  });

  // Send response
  return sendSuccess(res, updated, { message: 'Resource updated successfully' });
});

/**
 * DELETE /api/v1/resource/:id
 * Delete resource
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findByPk(req.userId);

  // Check ownership or permission
  const resource = await services.resourceService.getById(id);
  if (!resource) {
    return sendError(res, 'NOT_FOUND', `Resource not found`, 404);
  }

  // Delete via service
  await services.resourceService.delete(id, { deletedBy: user.id });

  // Send response
  return sendSuccess(res, { id }, { message: 'Resource deleted successfully' });
});

/**
 * Complex operation example
 * POST /api/v1/resource/:id/action
 */
exports.performAction = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { actionType, amount } = req.body;
  const user = await User.findByPk(req.userId);

  // Get resource
  const resource = await services.resourceService.getById(id);
  if (!resource) {
    return sendError(res, 'NOT_FOUND', 'Resource not found', 404);
  }

  // Perform action via service (which handles all business logic)
  const result = await services.resourceService.performAction(resource, actionType, amount, user);

  // Send response
  return sendSuccess(res, result, { message: `${actionType} completed successfully` });
});

// ============================================
// ARCHITECTURE NOTES
// ============================================

/**
 * CORRECT PATTERNS:
 * 
 * 1. ✅ All imports at module top
 *    const services = require('../services');
 *    const { models, Op } = require('../services/modelAccess');
 * 
 * 2. ✅ Use asyncHandler wrapper
 *    exports.getAll = asyncHandler(async (req, res, next) => { ... })
 * 
 * 3. ✅ Use standardized response helpers
 *    sendSuccess(res, data);
 *    sendCreated(res, data);
 *    sendError(res, code, message, statusCode);
 * 
 * 4. ✅ Delegate business logic to services
 *    const result = await services.resourceService.create(data);
 * 
 * 5. ✅ Catch errors via asyncHandler (forwarded to errorHandler middleware)
 *    No try-catch needed
 * 
 * ============================================
 * 
 * INCORRECT PATTERNS TO AVOID:
 * 
 * 1. ❌ Inline requires in functions
 *    const Resource = require('../models').Resource;
 * 
 * 2. ❌ Direct model access without service layer
 *    const resource = await Resource.findByPk(id);
 * 
 * 3. ❌ Inconsistent response formats
 *    res.json({ ... })
 *    res.status(200).json({ data: ... })
 * 
 * 4. ❌ Business logic in controller
 *    if (amount > balance) { ... } // Move to service
 * 
 * 5. ❌ Missing error handling
 *    exports.getAll = async (req, res) => { ... } // No try-catch or errorHandler
 * 
 * 6. ❌ Try-catch in async handlers wrapped by asyncHandler
 *    asyncHandler(async (req, res, next) => {
 *      try { ... } // NOT NEEDED
 *      catch { ... }
 *    })
 */
