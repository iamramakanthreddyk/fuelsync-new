# Quick Start: Using Clean Architecture

**Read this first!** This is your quick reference for using the new backend architecture.

---

## For Controllers

### Creating a New Controller

```javascript
// ========== AT TOP OF FILE ==========
const services = require('../services');
const { models, Op } = require('../services/modelAccess');
const { asyncHandler, NotFoundError } = require('../utils/errors');
const { sendSuccess, sendError, sendCreated } = require('../utils/apiResponse');

// ========== HANDLER FUNCTION ==========
exports.getAll = asyncHandler(async (req, res, next) => {
  // 1. Extract context
  const { page = 1, limit = 20 } = req.query;
  
  // 2. Call service (business logic)
  const { count, rows } = await services.resourceService.getAll({ page, limit });
  
  // 3. Send response
  return sendPaginated(res, rows, { page, limit, total: count });
});

// ========== COMPLEX OPERATION ==========
exports.create = asyncHandler(async (req, res, next) => {
  // 1. Extract context and validate
  const user = await User.findByPk(req.userId);
  if (!user) {
    return sendError(res, 'UNAUTHORIZED', 'User not found', 401);
  }

  // 2. Call service
  const result = await services.resourceService.create({
    ...req.body,
    userId: user.id,
  });

  // 3. Send response
  return sendCreated(res, result, { message: 'Resource created' });
});
```

### Key Rules
- ✅ All imports at module top
- ✅ Use asyncHandler for all handlers
- ✅ No try-catch blocks (asyncHandler catches errors)
- ✅ Always return response (return res.send...)
- ✅ Delegate logic to services
- ✅ Use response helpers

---

## For Routes

### Setting Up Routes with Validation

```javascript
const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const { validateBody, validateQuery, validateParams } = require('../middleware/validation');
const schemas = require('../validators/schemas');
const controller = require('../controllers/resourceController');

const router = Router();

// GET all (with query validation)
router.get(
  '/',
  authenticate,
  validateQuery(schemas.pagination),
  controller.getAll
);

// GET single (with param validation)
router.get(
  '/:id',
  authenticate,
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  controller.getById
);

// POST create (with body validation)
router.post(
  '/',
  authenticate,
  validateBody(schemas.createResourceSchema),
  controller.create
);

// PUT update
router.put(
  '/:id',
  authenticate,
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  validateBody(schemas.updateResourceSchema),
  controller.update
);

// DELETE
router.delete(
  '/:id',
  authenticate,
  controller.delete
);

module.exports = router;
```

---

## For Services

### Creating a New Service

```javascript
const BaseService = require('./BaseService');
const { models, sequelize, Op } = require('./modelAccess');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { createResourceSchema } = require('../validators/schemas');

class ResourceService extends BaseService {
  constructor() {
    super('ResourceService');
  }

  /**
   * Create resource
   */
  async create(data, organizationId) {
    // 1. Validate input
    const { value, error } = createResourceSchema.validate(data);
    if (error) {
      throw new ValidationError(
        error.details[0].message,
        error.details.map(d => ({ field: d.path[0], message: d.message }))
      );
    }

    // 2. Check prerequisites
    const exists = await models.resource.findOne({
      where: { name: value.name, organizationId }
    });
    if (exists) {
      throw new ConflictError('Resource with this name already exists');
    }

    // 3. Multi-step operations in transaction
    return this.withTransaction(async (transaction) => {
      const resource = await models.resource.create(
        { ...value, organizationId },
        { transaction }
      );

      // Log
      this.logInfo('Resource created', { id: resource.id, org: organizationId });

      return resource;
    });
  }

  /**
   * Get all resources
   */
  async getAll({ page = 1, limit = 20 }, organizationId) {
    const offset = (page - 1) * limit;

    return models.resource.findAndCountAll({
      where: { organizationId },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: ['relatedModel'], // Include associations
    });
  }

  /**
   * Get by ID
   */
  async getById(id, organizationId) {
    const resource = await models.resource.findOne({
      where: { id, organizationId }
    });

    if (!resource) {
      throw new NotFoundError('Resource', id);
    }

    return resource;
  }

  /**
   * Update resource
   */
  async update(id, data, organizationId) {
    const resource = await this.getById(id, organizationId);

    return this.withTransaction(async (transaction) => {
      await resource.update(data, { transaction });
      this.logInfo('Resource updated', { id });
      return resource;
    });
  }

  /**
   * Delete resource
   */
  async delete(id, organizationId) {
    const resource = await this.getById(id, organizationId);

    return this.withTransaction(async (transaction) => {
      await resource.destroy({ transaction });
      this.logInfo('Resource deleted', { id });
    });
  }
}

module.exports = new ResourceService();
```

---

## For Error Handling

### Throwing Errors (in Services)

```javascript
// Validation error (422)
throw new ValidationError('Invalid data', [
  { field: 'email', message: 'Invalid email format' }
]);

// Not found (404)
throw new NotFoundError('User', userId);

// Conflict/Already exists (409)
throw new ConflictError('Resource with this ID already exists');

// Business logic error (422)
throw new InvalidStatusTransitionError('draft', 'published');

// Insufficient balance (422)
throw new InsufficientBalanceError(balance, required);

// Unauthorized (401)
throw new UnauthorizedError('User not authenticated');

// Forbidden (403)
throw new ForbiddenError('You do not have permission');

// Database error (500)
throw new DatabaseError('Connection failed');
```

### Errors Are Automatically Caught
- asyncHandler wraps the function
- Error middleware converts to response
- User gets consistent error response

```javascript
// This throws in service:
throw new NotFoundError('Reading', id);

// Automatically becomes:
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Reading with 123 not found",
    "timestamp": "2026-03-21T10:30:00.000Z"
  }
}
// With HTTP 404 status
```

---

## For Validation

### Using Schemas in Routes

```javascript
// Pre-defined schemas (in validators/schemas.js)
const {
  createReadingSchema,
  getReadingsQuerySchema,
  loginSchema,
  createStationSchema,
} = require('../validators/schemas');

// Apply to routes
router.post('/readings', validateBody(createReadingSchema), controller.create);
router.get('/readings', validateQuery(getReadingsQuerySchema), controller.getAll);
router.post('/auth/login', validateBody(loginSchema), controller.login);
```

### Creating Custom Schemas

```javascript
const Joi = require('joi');

const mySchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
  amount: Joi.number().positive().required(),
  status: Joi.string().valid('draft', 'published', 'archived'),
  notes: Joi.string().max(5000).allow(null, ''),
}).unknown(false); // Reject unknown fields

// Use it
router.post('/resource', validateBody(mySchema), controller.create);
```

---

## For Responses

### Response Helpers

```javascript
// Success (200)
sendSuccess(res, data);
sendSuccess(res, data, 200, { message: 'Success!' });

// Success with metadata (200)
sendSuccess(res, data, 200, {
  message: 'Loaded successfully',
  metadata: { count: 42 }
});

// Paginated response (200)
sendPaginated(res, items, { page: 1, limit: 20, total: 100 });

// Created (201)
sendCreated(res, newResource);
sendCreated(res, newResource, { message: 'Resource created!' });

// Error (4xx/5xx)
sendError(res, 'NOT_FOUND', 'Resource not found', 404);
sendError(res, 'VALIDATION_ERROR', 'Invalid input', 422, {
  details: [{ field: 'email', message: 'Invalid email' }]
});

// No content (204)
res.sendNoContent(); // If using middleware
```

---

## For Importing Services

### Service Facade Pattern

```javascript
const services = require('../services');

// Reading operations
await services.reading.create.createReading(data);
await services.reading.validate.validateReading(data);
await services.reading.calculate.calculateTotals(reading);

// Financial operations
await services.financial.creditAllocation.allocate(data);
await services.financial.settlement.verify(settlementId);

// Employee operations
await services.employee.sales.getBreakdown(query);
await services.employee.shortfalls.calculate(query);

// Direct access (backwards compatible)
await services.readingCreationService.create(data);
```

---

## File Locations Reference

| What | Where |
|------|-------|
| **Controllers** | `src/controllers/*.js` |
| **Services** | `src/services/*Service.js` |
| **Models** | `src/models/*.js` |
| **Routes** | `src/routes/*.js` |
| **Middleware** | `src/middleware/*.js` |
| **Validators** | `src/validators/schemas.js` |
| **Errors** | `src/utils/errors.js` |
| **Response helpers** | `src/utils/apiResponse.js` |
| **Constants** | `src/config/constants.js` |

---

## Common Patterns

### GET All with Pagination
```javascript
exports.getAll = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const { count, rows } = await services.xxx.getAll({ page, limit });
  return sendPaginated(res, rows, { page, limit, total: count });
});
```

### GET Single
```javascript
exports.getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const resource = await services.xxx.getById(id);
  if (!resource) {
    return sendError(res, 'NOT_FOUND', 'Not found', 404);
  }
  return sendSuccess(res, resource);
});
```

### POST Create
```javascript
exports.create = asyncHandler(async (req, res) => {
  const result = await services.xxx.create(req.body);
  return sendCreated(res, result);
});
```

### PUT Update
```javascript
exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await services.xxx.update(id, req.body);
  return sendSuccess(res, result, 200, { message: 'Updated' });
});
```

### DELETE
```javascript
exports.delete = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await services.xxx.delete(id);
  return sendSuccess(res, { id }, 200, { message: 'Deleted' });
});
```

---

## Debugging Tips

1. **Error Response Format:** Check `error.code`, `error.message`
2. **Validation Errors:** Include `error.details` with field info
3. **Status Codes:** 422 (validation), 404 (not found), 403 (forbidden), 500 (server error)
4. **Async Issues:** Always use `asyncHandler` to catch promise rejections
5. **Response Helpers:** Use provided helpers for consistency

---

## Reference Documentation

- **Full Architecture Guide:** `CLEAN_ARCHITECTURE_V2.2.md`
- **API Types:** `src/types/api.types.js`
- **Error Classes:** `src/utils/errors.js`
- **Response Helpers:** `src/utils/apiResponse.js`
- **Validation Schemas:** `src/validators/schemas.js`
- **Controller Template:** `src/controllers/CONTROLLER_TEMPLATE.js`

---

**Questions?** Refer to the full architecture guide or check stationController.js for refactored example!
