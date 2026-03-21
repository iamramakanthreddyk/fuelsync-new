# FuelSync Backend Architecture Guide

**Version:** 2.1 (Refactored)  
**Last Updated:** March 2026  
**Status:** In Progress - Phase 1 & 2 Complete

---

## Table of Contents
1. [High-Level Architecture](#high-level-architecture)
2. [Directory Structure](#directory-structure)
3. [Module Organization by Domain](#module-organization-by-domain)
4. [Import Patterns](#import-patterns)
5. [Service Composition](#service-composition)
6. [Controller Guidelines](#controller-guidelines)
7. [Error Handling](#error-handling)
8. [Data Flow Patterns](#data-flow-patterns)
9. [Common Pitfalls](#common-pitfalls)
10. [Refactoring Checklist](#refactoring-checklist)

---

## High-Level Architecture

```
┌─── Express ──────────────────────────────────────────┐
│                                                      │
├─ Middleware Layer ────────────────────────────────────┤
│  • Authentication (JWT)                              │
│  • Authorization (RBAC middleware)                   │
│  • Validation (request schema)                       │
│  • Error Wrapping (async error catcher)              │
│                                                      │
├─ Route Layer ─────────────────────────────────────────┤
│  • Routes organized by domain                        │
│  • Each domain has dedicated routes file             │
│  • Routes → Controller delegation                    │
│                                                      │
├─ Controller Layer ────────────────────────────────────┤
│  • HTTP concerns only (parsing, validation)          │
│  • Delegates to Facade Services                      │
│  • Returns formatted responses                       │
│                                                      │
├─ Service Facade Layer ────────────────────────────────┤
│  • High-level orchestration                          │
│  • Composes multiple lower-level services           │
│  • Business logic entry point                        │
│                                                      │
├─ Service Layer ───────────────────────────────────────┤
│  • Domain-specific business logic                    │
│  • Payment processing, validations, calculations     │
│  • Delegates to repositories for data access         │
│                                                      │
├─ Repository Layer ────────────────────────────────────┤
│  • Data access abstraction                           │
│  • Query building, filtering, pagination             │
│  • Does NOT manipulate business logic                │
│                                                      │
├─ Model Access Layer ──────────────────────────────────┤
│  • Centralized model imports                         │
│  • Database driver abstraction (Sequelize)           │
│  • Single source of truth for models                 │
│                                                      │
├─ Database ────────────────────────────────────────────┤
│  • PostgreSQL (production)                           │
│  • SQLite (development/testing)                      │
│  • Migrations in backend/migrations/                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Directory Structure

**BEFORE (Scattered):**
```
backend/src/
  controllers/        # 15 files (all mixed together)
  services/           # 18 files (flat, hard to navigate)
  routes/             # 25 files (no grouping)
  models/             # Models scattered
  repositories/       # Only a few, incomplete
```

**AFTER (Organized by Domain - Version 2.1):**
```
backend/src/
  config/             # Configuration & constants
  database/           # Database initialization, migrations
  middleware/         # Authentication, authorization, validation
  models/             # Sequelize model definitions (keep as-is)
  
  # ===== DOMAIN-ORGANIZED LAYERS =====
  controllers/        # HTTP handlers (refactored to use services properly)
  routes/             # Route definitions (keep organized by feature)
  services/           # Business logic (organized by domain)
    index.js          # Service composition facade
    modelAccess.js    # Centralized model imports
    
    # Reading Domain
    readingValidationService.js
    readingCalculationService.js
    readingCreationService.js
    readingCacheService.js
    readingValidationEnhancedService.js
    
    # Transaction Domain
    transactionValidationService.js
    paymentBreakdownService.js
    
    # Financial Domain
    creditAllocationService.js
    costOfGoodsService.js
    settlementVerificationService.js
    
    # Analytics Domain
    dashboardService.js
    aggregationService.js
    
    # Employee Domain
    employeeSalesService.js
    employeeShortfallsService.js
    
    # Utilities
    bulkOperations.js
    expenseCategorization.js
  
  repositories/       # Data access layer
    readingRepository.js
    dashboardRepository.js
  
  types/              # TypeScript definitions (if using)
  utils/              # Shared utilities
    readingHelpers.js # Consolidated helper functions
    auditLog.js
    errors.js
    formatters.js
    ...
```

---

## Module Organization by Domain

### Reading Domain
**Responsible for:** Reading submissions, validation, calculations, caching

Files:
- `services/readingValidationService.js` - Input validation
- `services/readingCalculationService.js` - Meter calculations
- `services/readingCreationService.js` - Creation orchestration
- `services/readingCacheService.js` - Performance caching
- `repositories/readingRepository.js` - Data access
- `utils/readingHelpers.js` - Shared helpers

### Transaction Domain
**Responsible for:** Daily transaction processing, payment breakdown, settlements

Files:
- `services/transactionValidationService.js`
- `services/paymentBreakdownService.js`
- `controllers/transactionController.js`

### Financial Domain
**Responsible for:** Credits, expenses, cost calculations, settlements

Files:
- `services/creditAllocationService.js`
- `services/costOfGoodsService.js`
- `services/settlementVerificationService.js`
- `controllers/creditController.js`
- `controllers/expenseController.js`

### Analytics Domain
**Responsible for:** Dashboards, reports, aggregations

Files:
- `services/dashboardService.js`
- `services/aggregationService.js`
- `repositories/dashboardRepository.js`
- `controllers/dashboardController.js`
- `controllers/reportController.js`

---

## Import Patterns

### ✅ CORRECT - Using Service Composition Layer

```javascript
// At TOP of controller file
const services = require('../services/index');
const { models } = require('../services/modelAccess');

// In function
const reading = await services.reading.creation.createReading({...});
const user = await models.user.findByPk(userId);
```

**Benefits:**
- All imports at module top (transparent dependencies)
- No runtime `require()` calls deep in functions
- Easy to see what a controller depends on
- Testable (can mock service layer)

### ❌ WRONG - Scattered Inline Requires

```javascript
// Inside function (BAD)
const employeeShortfallsService = require('../services/employeeShortfallsService');
const { Station } = require('../models');

// Problems:
// - Hidden dependencies
// - Circular dependency risks
// - Harder to optimize/tree-shake
// - Inconsistent import locations
```

### ✅ CORRECT - Using Model Access Layer

```javascript
// Instead of:
const { User, Station, Nozzle } = require('../models');

// Do:
const { models: { user, station, nozzle } } = require('../services/modelAccess');
// Or for Sequelize utilities:
const { Op, sequelize } = require('../services/modelAccess');
```

---

## Service Composition

### Service Organization Hierarchy

```
Controller
    ↓
Service Facade Layer (index.js)
    ├─ reading.validation
    ├─ reading.creation
    ├─ reading.calculation
    ├─ transaction.validation
    ├─ financial.creditAllocation
    ├─ analytics.dashboard
    └─ employee.sales
    
Each facade delegates to:
    ↓
    Domain-specific Services
        ↓
        Repository Layer (data access only)
```

### Usage in Controllers

```javascript
const services = require('../services');

exports.createReading = async (req, res, next) => {
  try {
    // Dedicated service for this domain
    const result = await services.reading.creation.createReading(
      { user, nozzle, station },
      req.body
    );
    
    // Another service if needed
    await services.reading.cache.invalidate(nozzleId);
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
```

---

## Controller Guidelines

### Do's ✅

1. **Import all dependencies at module top**
   ```javascript
   const services = require('../services');
   const { models, Op } = require('../services/modelAccess');
   const { readingHelpers } = require('../utils');
   ```

2. **Delegate business logic to services**
   ```javascript
   const result = await services.reading.creation.createReading(entities, input);
   ```

3. **Handle HTTP concerns only**
   ```javascript
   // Extract query params, validate format, format response
   ```

4. **Pass errors to next()**
   ```javascript
   } catch (error) {
     next(error);
   }
   ```

5. **Use consistent response format**
   ```javascript
   res.json({ success: true, data: {...} });
   // or
   return res.status(400).json({ success: false, error: 'message' });
   ```

### Don'ts ❌

1. **Don't require services/models inside functions**
   ```javascript
   // WRONG
   const service = require('../services/someService');
   ```

2. **Don't build SQL queries in controllers**
   ```javascript
   // WRONG - use repository
   const readings = await models.NozzleReading.findAll({...});
   ```

3. **Don't duplicate business logic**
   ```javascript
   // WRONG - move to utils/helpers
   if (reading.isSample) return 0;
   return reading.totalAmount;
   ```

4. **Don't mix validation logic from different domains**
   ```javascript
   // WRONG - use domain-specific services
   const validated = validate(reading);
   const calculated = calculate(reading);
   ```

---

## Error Handling

### Unified Error Structure

```javascript
// All errors inherit from AppError
const { AppError, ValidationError, NotFoundError } = require('../utils/errors');

// In service layer - throw errors
throw new NotFoundError('Reading', id);
throw new ValidationError('Invalid reading value');

// In controller - catch and pass to next()
try {
  // ...
} catch (error) {
  next(error);  // Global error handler catches this
}

// Global error handler (middleware/errorHandler.js)
// - Maps AppError types to HTTP status codes
// - Returns consistent response format
// - Logs errors appropriately
```

### Error Response Format

```javascript
// Success
res.json({
  success: true,
  data: {...}
})

// Error (consistent format)
{
  success: false,
  error: 'User not found',
  code: 'NOT_FOUND',
  statusCode: 404
}
```

---

## Data Flow Patterns

### Creating a Reading (Complete Flow)

```
Request: POST /api/v1/readings
  ↓
Route: readings.js route definition
  ↓
Controller: readingController.createReading()
  - Extract userId, nozzleId from request
  - Load entities (nozzle, station, user)
  - Validate authorization
  - Delegate to service
  ↓
Service Facade: services/index.js → reading.creation
  ↓
Service: readingCreationService.createReading()
  - Normalize input
  - Validate required fields
  - Call reading.validation service
  - Call reading.calculation service
  - Call repository.create()
  - Log audit trail
  - Return result
  ↓
Repository: readingRepository.create()
  - Build Sequelize query
  - Execute INSERT
  - Fetch created record with relations
  - Return normalized object
  ↓
Response: { success: true, data: { reading } }
```

### Fetching Readings With Filters (Complete Flow)

```
Request: GET /api/v1/readings?stationId=123&startDate=2026-01-01

Controller: readingController.getReadings()
  - Parse & validate query params
  - Check authorization
  ↓
Service Facade: services.reading (or dedicated fetch service)
  ↓
Service: readingService.fetchReadings()
  - Build filter object
  - Apply pagination
  - Call repository.getReadingsWithFilters()
  ↓
Repository: readingRepository.getReadingsWithFilters()
  - Build WHERE clause from filters
  - Build INCLUDE clause for relations
  - Apply ORDER BY, LIMIT, OFFSET
  - Execute findAndCountAll()
  - Return { count, rows }
  
Service: Enhance response
  - Format each row
  - Calculate totals
  - Apply business calculations
  ↓
Controller: Format final response
  - Wrap in response envelope
  - Add metadata (pagination)
  ↓
Response: { success: true, data: [...], pagination: {...} }
```

---

## Common Pitfalls

### 1. Inline Requires Breaking Dependency Graph

```javascript
// ❌ BAD - Found in stationController.js
exports.getEmployeeShortfalls = async (req, res, next) => {
  const employeeShortfallsService = require('../services/employeeShortfallsService');
  // ... rest of code
};

// ✅ GOOD - At top of file
const services = require('../services');
exports.getEmployeeShortfalls = async (req, res, next) => {
  const shortfalls = await services.employee.shortfalls.get(...);
};
```

### 2. Multiple Model Imports in Same File

```javascript
// ❌ BAD - Found throughout stationController.js
const { Station } = require('../models');
const { NozzleReading } = require('../models');
const { DailyTransaction } = require('../models');
const { Settlement } = require('../models');

// ✅ GOOD
const { models } = require('../services/modelAccess');
const { Station, NozzleReading, DailyTransaction, Settlement } = models;
```

### 3. Helper Functions Scattered Across Controllers

```javascript
// ❌ BAD - calcDeduplicatedTotals defined in stationController.js
function calcDeduplicatedTotals(items) {
  // ... duplicated in multiple places
}

// ✅ GOOD - In utils/readingHelpers.js
const { calculateDeduplicatedTotals } = require('../utils/readingHelpers');
```

### 4. Database Access Outside Repository Layer

```javascript
// ❌ BAD - Found in controllers
const readings = await NozzleReading.findAll({ where: {...} });

// ✅ GOOD - Use repository layer
const readings = await repositories.reading.findWithFilters({...});
```

### 5. Missing Error Handling in Controllers

```javascript
// ❌ BAD
exports.create = async (req, res) => {
  const result = await service.create(req.body);
  res.json(result);
};

// ✅ GOOD
exports.create = async (req, res, next) => {
  try {
    const result = await service.create(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
```

---

## Refactoring Checklist

Use this checklist when refactoring a controller or service:

### For Every Controller File:
- [ ] All imports moved to top of file
- [ ] Services imported via `services` facade
- [ ] Models imported via `modelAccess` layer
- [ ] All try-catch blocks pass to `next(error)`
- [ ] Response format is consistent
- [ ] Helper functions moved to utils/

### For Every Service File:
- [ ] Business logic is pure (no HTTP concerns)
- [ ] Delegates to repositories for data access
- [ ] Uses service composition for other services
- [ ] Throws custom error types
- [ ] Documented with JSDoc comments
- [ ] Has input validation

### For Every Repository File:
- [ ] Only contains database queries
- [ ] No business logic
- [ ] Re-usable, generic methods
- [ ] Efficient queries (proper indexes, joins)
- [ ] Returns normalized data

### Global:
- [ ] No circular dependencies
- [ ] No require() calls inside functions
- [ ] Error types are consistent
- [ ] Response formats are consistent
- [ ] All endpoints documented in API spec

---

## Next Steps (Implementation Lanes)

1. **Consolidate stationController.js** (15+ nested requires)
2. **Consolidate readingController.js** (4+ service imports)
3. **Create domain-specific service facades** (reading, transaction, financial, etc.)
4. **Refactor route organization** (group by feature domain)
5. **Add error handling wrapper middleware**
6. **Migrate models to modelAccess** pattern
7. **Add dependency injection** for testing

---

**Last Updated:** March 21, 2026  
**Maintained By:** FuelSync Development Team  
**Version Control:** See git history for detailed changes
