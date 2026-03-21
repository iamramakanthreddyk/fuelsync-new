# Clean Backend Architecture Guide (v2.2)

**Version:** 2.2 (Enhanced Clean Architecture)
**Last Updated:** March 2026
**Status:** Implementation Guide - Refactoring Phase

---

## Overview

This guide defines the clean, maintainable architecture for the FuelSync backend. Every layer is cleanly separated with clear responsibilities.

---

## Architecture Layers

```
┌─── HTTP Request ─────────────────────────────────┐
│                                                  │
├─ Middleware ──────────────────────────────────────┤
│  1. CORS / Security headers                      │
│  2. Body parser (JSON/URL-encoded)               │
│  3. Authentication (JWT extraction)              │
│  4. Authorization (role/permission checks)       │
│  5. Request validation (Joi schema)              │
│                                                  │
├─ Routes Layer ────────────────────────────────────┤
│  • RESTful routes (GET /api/v1/resource/:id)     │
│  • Method routing (POST, PUT, DELETE)            │
│  • Parameter extraction (:id, ?query)            │
│  → Delegates to Controller                       │
│                                                  │
├─ Controller Layer ────────────────────────────────┤
│  RESPONSIBILITIES:                              │
│  • Extract parameters from HTTP request         │
│  • Validate authorization (user permissions)    │
│  • Call appropriate service method              │
│  • Format response using API helpers            │
│  • NO business logic here!                      │
│                                                  │
├─ Service Facade Layer ────────────────────────────┤
│  • services/index.js organizes all services     │
│  • Provides hierarchical service access         │
│  • Example: services.reading.create.xxx()       │
│  → Delegates to domain services                 │
│                                                  │
├─ Domain Service Layer ────────────────────────────┤
│  RESPONSIBILITIES:                              │
│  • Implement business logic                     │
│  • Validate inputs (Joi schemas)                │
│  • Orchestrate operations (call repos)          │
│  • Manage transactions (withTransaction)        │
│  • Throw custom errors                          │
│  • Log important operations                     │
│                                                  │
├─ Repository Layer ────────────────────────────────┤
│  RESPONSIBILITIES:                              │
│  • Build database queries                       │
│  • Fetch/insert/update data                    │
│  • Apply filtering, pagination                  │
│  • Return normalized objects                    │
│  • NO business logic here!                      │
│                                                  │
├─ Model Access Layer ──────────────────────────────┤
│  • Centralized model imports                    │
│  • Single source of truth for schemas           │
│  • Enables easy database swaps                  │
│  • Location: services/modelAccess.js            │
│                                                  │
├─ Database Layer ──────────────────────────────────┤
│  • Sequelize ORM                                │
│  • SQLite (dev/test)                            │
│  • PostgreSQL (production)                      │
│                                                  │
├─ Error Handler Middleware ───────────────────────┤
│  • Catches errors from all layers               │
│  • Converts to API response format              │
│  • Logs errors appropriately                    │
│  • Returns consistent error response            │
│                                                  │
└─── HTTP Response ────────────────────────────────┘
Success: { success: true, data: {...}, metadata: {...} }
Error:   { success: false, error: { code, message } }
```

---

## Layer Responsibilities

### 1. Routes

**Location:** `src/routes/*.js`

**Responsibility:** HTTP routing only

```javascript
// ✅ CORRECT
router.get('/readings', authenticate, asyncHandler(readingController.getAll));
router.post('/readings', authenticate, validate(createReadingSchema), asyncHandler(readingController.create));
router.get('/readings/:id', authenticate, asyncHandler(readingController.getById));
```

**Rules:**
- ✅ Apply authentication middleware
- ✅ Apply validation middleware (Joi schema)
- ✅ Wrap handlers with asyncHandler
- ✅ Route to appropriate controller method
- ❌ DO NOT implement logic here
- ❌ DO NOT call services directly
- ❌ DO NOT format responses

### 2. Controllers

**Location:** `src/controllers/*.js`

**Responsibility:** HTTP request/response handling ONLY

```javascript
// ===== IMPORTS AT TOP (always) =====
const services = require('../services');
const { models, Op } = require('../services/modelAccess');
const { asyncHandler } = require('../utils/errors');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ===== HANDLERS =====

/**
 * GET /api/v1/readings
 */
exports.getAll = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const user = await User.findByPk(req.userId); // Extract context
  
  // Validate authorization in controller if needed
  if (!canAccess(user)) {
    return sendError(res, 'FORBIDDEN', 'Access denied', 403);
  }

  // Call service (all business logic in service)
  const readings = await services.reading.getAll({ page, limit });

  // Format response
  return sendSuccess(res, readings, { message: 'Readings fetched' });
});
```

**Rules:**
- ✅ Extract user context (from middleware)
- ✅ Validate authorization (permission checks)
- ✅ Extract query/path parameters
- ✅ Pass parameters to service layer
- ✅ Format response using response helpers
- ✅ Use asyncHandler for error catching
- ❌ DO NOT implement business logic
- ❌ DO NOT query database directly
- ❌ DO NOT write try-catch (asyncHandler handles it)

**Controller Methods Pattern:**
```javascript
exports.create = asyncHandler(async (req, res, next) => {
  // 1. Extract context & parameters
  const user = await User.findByPk(req.userId);
  const { name, description } = req.body;

  // 2. Validate authorization (if needed)
  if (!hasPermission(user, 'create_resource')) {
    return sendError(res, 'FORBIDDEN', 'No permission', 403);
  }

  // 3. Delegate to service
  const result = await services.resourceService.create({
    name,
    description,
    userId: user.id,
  });

  // 4. Format response
  return sendCreated(res, result);
});
```

### 3. Services (Domain Services)

**Location:** `src/services/*.js`

**Responsibility:** Business logic implementation

```javascript
// ===== IMPORTS =====
const BaseService = require('./BaseService');
const { models, sequelize, Op } = require('./modelAccess');
const { ValidationError, NotFoundError } = require('../utils/errors');

// ===== SERVICE IMPLEMENTATION =====
class ReadingService extends BaseService {
  constructor() {
    super('ReadingService');
  }

  /**
   * Create reading (business logic here)
   */
  async create(data, userId, organizationId) {
    // 1. Validate input using Joi schema
    const { value, error } = readingSchema.validate(data);
    if (error) {
      throw new ValidationError(error.details[0].message, error.details);
    }

    // 2. Check prerequisites (e.g., nuzzle exists, is active)
    const nozzle = await models.nozzle.findByPk(data.nozzleId);
    if (!nozzle) {
      throw new NotFoundError('Nozzle', data.nozzleId);
    }

    // 3. Use transaction for multi-step operations
    return this.withTransaction(async (transaction) => {
      // 3a. Create reading record
      const reading = await models.nozzleReading.create({
        ...value,
        enteredBy: userId,
        stationId: nozzle.stationId,
      }, { transaction });

      // 3b. Invalidate cache
      await readingCacheService.invalidate(nozzle.id);

      // 3c. Audit log
      this.logInfo(`Reading created`, { readingId: reading.id, userId });

      return reading;
    });
  }

  /**
   * Get readings with filtering
   */
  async getFiltered(query, organizationId) {
    const { page = 1, limit = 20, nozzleId, startDate } = query;

    const where = { organizationId }; // Always filter by org
    if (nozzleId) where.nozzleId = nozzleId;
    if (startDate) where.createdAt = { [Op.gte]: new Date(startDate) };

    return models.nozzleReading.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']],
    });
  }
}

module.exports = new ReadingService();
```

**Rules:**
- ✅ Extend BaseService for consistency
- ✅ Implement all business logic here
- ✅ Validate inputs with Joi schemas
- ✅ Check prerequisites and permissions
- ✅ Use transactions for multi-step operations
- ✅ Throw custom errors (from errors.js)
- ✅ Log important operations
- ✅ Call repositories/models for data access
- ❌ DO NOT return raw error strings
- ❌ DO NOT format HTTP responses
- ❌ DO NOT access request/response objects

### 4. Repositories

**Location:** `src/repositories/*.js`

**Responsibility:** Data access only (optional - can use services directly)

```javascript
// OPTIONAL: Use if complex queries need abstraction

class ReadingRepository {
  async find(where, options = {}) {
    const { limit = 20, offset = 0, include = [] } = options;
    return models.nozzleReading.findAndCountAll({
      where,
      limit,
      offset,
      include,
      order: [['createdAt', 'DESC']],
    });
  }

  async findById(id) {
    return models.nozzleReading.findByPk(id, {
      include: ['nozzle', 'station', 'enteredByUser'],
    });
  }

  async create(data, transaction) {
    return models.nozzleReading.create(data, { transaction });
  }
}

module.exports = new ReadingRepository();
```

**Rules:**
- ✅ Build Sequelize queries
- ✅ Handle filtering, pagination
- ✅ Return normalized objects
- ❌ DO NOT implement business logic
- ❌ DO NOT validate data
- ❌ DO NOT throw domain-specific errors

### 5. Model Access Layer

**Location:** `src/services/modelAccess.js`

**Responsibility:** Centralized model and database access

```javascript
// models.nozzleReading
// models.station
// models.user
// Op (Sequelize operator)
// sequelize (connection)

// Usage in services:
const { models, sequelize, Op } = require('./modelAccess');
```

---

## API Response Format

### Success Response (200/201)

```javascript
// GET request
{
  "success": true,
  "data": [ {...}, {...} ],
  "metadata": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5,
      "hasMore": true
    }
  }
}

// Single resource
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Nozzle 1",
    ...
  }
}

// Create (201)
{
  "success": true,
  "data": { id: "456", ... },
  "message": "Resource created successfully"
}
```

### Error Response (400+)

```javascript
// Validation error (422)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "name", "message": "required" },
      { "field": "email", "message": "invalid email format" }
    ],
    "timestamp": "2026-03-21T10:30:00.000Z"
  }
}

// Not found (404)
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Reading with ID 123 not found",
    "timestamp": "2026-03-21T10:30:00.000Z"
  }
}

// Forbidden (403)
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource",
    "timestamp": "2026-03-21T10:30:00.000Z"
  }
}
```

---

## Service Facade Example

**File:** `services/index.js`

```javascript
// Organized by domain
module.exports = {
  // Reading Services
  reading: {
    create: readingCreationService,
    validate: readingValidationService,
    calculate: readingCalculationService,
    cache: readingCacheService,
  },

  // Financial Services
  financial: {
    creditAllocation: creditAllocationService,
    settlement: settlementVerificationService,
  },

  // Employee Services
  employee: {
    sales: employeeSalesService,
    shortfalls: employeeShortfallsService,
  },

  // ... more services
};

// USAGE in controller:
// await services.reading.create.createReading(data);
// await services.financial.settlement.verify(settlementId);
// await services.employee.sales.getBreakdown(query);
```

---

## Error Handling Pattern

### Define Custom Errors (in utils/errors.js)

```javascript
// Already provided, use these:
- NotFoundError - 404
- ValidationError - 422
- UnauthorizedError - 401
- ForbiddenError - 403
- ConflictError - 409
- InsufficientBalanceError - 422
- InvalidStatusTransitionError - 422
- DatabaseError - 500
```

### Throw Errors in Services

```javascript
// In service
if (!nozzle) {
  throw new NotFoundError('Nozzle', nozzleId);
}

if (amount > balance) {
  throw new InsufficientBalanceError(balance, amount);
}
```

### Catch Automatically in Controller

```javascript
// asyncHandler wraps the async function
exports.create = asyncHandler(async (req, res, next) => {
  // Errors thrown here are caught and forwarded to errorHandler
  const result = await service.create(data);
  return sendCreated(res, result);
});

// errorHandler middleware converts to API response
```

---

## Import Guidelines

### ✅ CORRECT - Module Top Imports

```javascript
// At TOP of controller
const services = require('../services');
const { models, Op } = require('../services/modelAccess');
const { asyncHandler, NotFoundError } = require('../utils/errors');
const { sendSuccess, sendError } = require('../utils/apiResponse');

exports.getAll = asyncHandler(async (req, res, next) => {
  // use services, models, etc
});
```

### ❌ WRONG - Inline Requires

```javascript
// NEVER do this
exports.getAll = async (req, res) => {
  const service = require('../services/someService');
  const { Model } = require('../models');
  
  // ... code
};
```

---

## Migration Checklist

For existing controllers, follow this checklist:

- [ ] Move ALL requires to module top
- [ ] Replace inline requires with services facade
- [ ] Replace direct Model access with modelAccess layer
- [ ] Wrap all handlers with asyncHandler
- [ ] Remove try-catch blocks (asyncHandler handles errors)
- [ ] Replace custom response formatting with response helpers
- [ ] Extract all business logic to services
- [ ] Add proper error throwing (custom errors)
- [ ] Test that errors are caught properly
- [ ] Verify backend loads: `node src/app.js`

---

## Project File Structure

```
backend/src/
  ├─ app.js              # Express app initialization
  ├─ config/             # Environment and constants
  ├─ database/           # Database initialization
  ├─ middleware/         # Express middleware
  │  ├─ authenticate.js
  │  ├─ authorize.js
  │  ├─ validation.js
  │  ├─ errorHandler.js
  │  └─ asyncHandler.js
  │
  ├─ models/             # Sequelize models
  │  └─ index.js         # Model exports
  │
  ├─ controllers/        # HTTP request handlers (REFACTORED)
  │  ├─ readingController.js
  │  ├─ stationController.js (✅ Already refactored)
  │  ├─ dashboardController.js
  │  └─ ... others
  │
  ├─ services/           # Business logic (REFACTORED)
  │  ├─ index.js         # Service facade
  │  ├─ modelAccess.js   # Model access layer
  │  ├─ BaseService.js
  │  ├─ readingCreationService.js
  │  ├─ settlementVerificationService.js
  │  └─ ... others
  │
  ├─ repositories/       # Data access (optional)
  │
  ├─ routes/             # Route definitions
  │  ├─ stations.js
  │  ├─ readings.js
  │  ├─ settlements.js
  │  └─ ... others
  │
  ├─ types/              # Type definitions
  │  ├─ responseTypes.json
  │  └─ api.types.js
  │
  ├─ utils/              # Shared utilities
  │  ├─ apiResponse.js   # Response helpers
  │  ├─ errors.js        # Error classes
  │  ├─ auditLog.js
  │  ├─ readingHelpers.js
  │  └─ ... others
  │
  └─ validators/         # Joivalidation schemas
```

---

## Summary

| Layer | Location | Responsibility | Do | Don't |
|-------|----------|-----------------|----|----|
| **Route** | routes/ | URL mapping | Define routes | Implement logic |
| **Controller** | controllers/ | Extract HTTP data | Extract params, validate auth, call service | Business logic, DB access, try-catch |
| **Service** | services/ | Business logic | Implement logic, validate, throw errors | Format responses, access HTTP |
| **Repository** | repositories/ | Query building | Build queries, fetch data | Business logic, validation |
| **Model** | models/ | Data schema | Define schema | Logic |
| **Middleware** | middleware/ | Request processing | Authenticate, validate, handle errors | Business logic |
| **Utils** | utils/ | Shared code | Response formatting, errors, helpers | - |

---

**Next Steps:** Refactor all remaining controllers following stationController.js as the template.
