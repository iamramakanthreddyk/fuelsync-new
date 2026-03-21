# Architecture Refactoring Action Plan

**Status**: In Progress  
**Last Updated**: March 21, 2026  
**Priority**: Critical (Maintainability Issue)

---

## Executive Summary

The FuelSync backend has **scattered module dependencies and disorganized code structure** that makes the project difficult to maintain:

- **58+ files** to manage (15 controllers + 18 services + 25 routes)
- **17+ inline `require()` calls** in stationController alone (should be 3-4 top-level imports)
- **4 separate reading-related services** with no clear facade hierarchy
- **Multiple code attempts** at the same functionality (e.g., payment deduplication)

**Goal**: Restructure for 60% easier maintenance and debugging by consolidating imports, creating service facades, and organizing by feature domain.

---

## Phase Breakdown

### Phase 1: Foundation Layers ✅ COMPLETE
- [x] Create service composition facade (`services/index.js`)
- [x] Create model access layer (`services/modelAccess.js`)
- [x] Create shared reading helpers (`utils/readingHelpers.js`)
- [x] Document new architecture patterns (`ARCHITECTURE_V2.md`)

**Output**: 3 new files, 1 architecture guide ready for developer reference

### Phase 2: Consolidate High-Impact Controllers 🔄 IN PROGRESS
**Target Controllers** (by impact):
1. `stationController.js` - 17 inline requires (CRITICAL)
2. `readingController.js` - 4 service imports scattered
3. `creditController.js` - Hardcoded queries
4. `dashboardController.js` - Mixed concerns

**For Each Controller:**
- [ ] Move all `require()` to top of file
- [ ] Use `services` facade for service access
- [ ] Use `modelAccess` layer for database models
- [ ] Add error handling wrapper (`next(error)`)
- [ ] Extract helper functions to utils/

**Timeline**: 2-3 hours per controller (4 controllers = 8-12 hours)

### Phase 3: Create Service Facades by Domain 🔄 NEXT
**Reading Domain Facade:**
```javascript
// Instead of importing 4+ services:
const readingCreationService = require('../services/readingCreationService');
const readingValidationService = require('../services/readingValidationService');
const readingCalculationService = require('../services/readingCalculationService');
const readingCache = require('../services/readingCacheService');

// Do this:
const readingFacade = {
  create: readingCreationService, 
  validate: readingValidationService,
  calculate: readingCalculationService,
  cache: readingCacheService,
};
// Usage: await readingFacade.create(...)
```

Services to facade-wrap:
- [ ] Reading services (5 files)
- [ ] Transaction services (3 files)
- [ ] Financial services (4 files)
- [ ] Analytics services (2 files)

**Timeline**: 4-6 hours

### Phase 4: Async Error Handling Middleware ⏳ TODO
Create wrapper middleware to ensure all async errors caught:

```javascript
// Instead of:
exports.create = async (req, res, next) => {
  try {
    // ...
    next(error);
  } catch (e) {
    // Some errors might escape
  }
};

// Do this:
const asyncHandler = (fn) => (req, res, next) => 
  Promise.resolve(fn(req, res, next)).catch(next);

exports.create = asyncHandler(async (req, res) => {
  // All errors automatically caught
  const result = await service.create(req.body);
  res.json(result);
});
```

**Timeline**: 2-3 hours

### Phase 5: Reorganize Routes by Feature Domain ⏳ TODO
**Current** (scattered):
```
routes/
  readings.js
  stations.js
  credits.js
  expenses.js
  ... 21 more files
```

**Target** (organized):
```
routes/
  domains/
    readings/
      index.js
      GET, POST, PUT, DELETE endpoints
    stations/
    transactions/
    financial/  # credits + expenses grouped
    analytics/
```

**Timeline**: 4-6 hours

### Phase 6: Standardize Response Format ⏳ TODO
Ensure all endpoints return:
```javascript
{
  success: true/false,
  data: {...},
  error?: {
    code: 'ERROR_CODE',
    message: 'User friendly message'
  },
  pagination?: { page, limit, total, pages }
}
```

**Timeline**: 2 hours

### Phase 7: Add API Documentation ⏳ TODO
- OpenAPI/Swagger spec for all endpoints
- Endpoint grouping by domain
- Request/response schemas

**Timeline**: 4 hours

---

## Implementation Order (Priority)

1. **stationController.js** (17 inline requires - CRITICAL)
2. **readingController.js** (4 service imports)
3. **Async error handler middleware** (catch all errors)
4. **creditController.js & expenseController.js** (financial domain)
5. **dashboardController.js & reportController.js** (analytics domain)
6. Route reorganization (Phase 5)
7. Response format standardization (Phase 6)
8. API documentation (Phase 7)

---

## Detailed Task: Refactor stationController.js

### Current State Problems

1. **17 inline requires**
   ```javascript
   // Line 1464
   const { NozzleReading, Nozzle, User, Settlement, DailyTransaction } = require('../models');
   
   // Line 1687
   const { DailyTransaction } = require('../models');
   
   // Line 1741
   const sequelize = require('../models').sequelize;
   
   // Line 2375
   const employeeShortfallsService = require('../services/employeeShortfallsService');
   
   // Line 2558
   const employeeSalesService = require('../services/employeeSalesService');
   ```

2. **Duplicate helper function**
   ```javascript
   // Lines 82-134: calcDeduplicatedTotals() defined locally
   // Should be in utils/readingHelpers.js
   ```

3. **No consistent error handling**
   - Some endpoints have try-catch, others don't
   - Error handling not tested

### Refactoring Steps

**Step 1: Consolidate imports**
```javascript
// At TOP of stationController.js (after module doc)
const services = require('../services');
const { models, sequelize, Op } = require('../services/modelAccess');
const { logAudit } = require('../utils/auditLog');
const { calculateDeduplicatedTotals } = require('../utils/readingHelpers');
const { fn, col } = require('sequelize');
const { FUEL_TYPES } = require('../config/constants');
```

**Step 2: Remove all inline requires**
- [ ] Delete line 1464 require
- [ ] Delete line 1687 require
- [ ] Delete lines 2375, 2558 requires, etc.

**Step 3: Replace inline require usages**
```javascript
// OLD:
const { DailyTransaction } = require('../models');
const transaction = await DailyTransaction.findByPk(id);

// NEW:
const transaction = await models.dailyTransaction.findByPk(id);

// OR use service:
const transaction = await services.transaction.getById(id);
```

**Step 4: Replace scattered service calls**
```javascript
// OLD:
const employeeShortfallsService = require('../services/employeeShortfallsService');
const shortfalls = await employeeShortfallsService.get(...);

// NEW:
const shortfalls = await services.employee.shortfalls.get(...);
```

**Step 5: Replace helper function calls**
```javascript
// Find line 82:
const calcDeduplicatedTotals = (items) => { ... }

// Replace with import:
const { calculateDeduplicatedTotals } = require('../utils/readingHelpers');
// Delete function definition

// Replace calls:
// OLD: const totals = calcDeduplicatedTotals(items);
// NEW: const totals = calculateDeduplicatedTotals(items);
```

**Step 6: Verify all exports use async error handling**
```javascript
exports.functionName = async (req, res, next) => {
  try {
    // function body
  } catch (error) {
    next(error);
  }
};
```

### Success Criteria
- [ ] Zero inline `require()` calls inside functions
- [ ] All imports at module top
- [ ] No duplicate helper definitions
- [ ] All exports have try-catch with `next(error)`
- [ ] App still boots without errors
- [ ] All read
ing tests still pass

### Estimated Time: 2-3 hours

---

## Validation & Testing

After each phase, run:
```bash
# Syntax check
node backend/src/app.js

# Run tests
npm test

# Linting
npm run lint

# Code coverage
npm run test:coverage
```

---

## Metrics to Track

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Inline requires | 17 (stationController) | 0 | 0 |
| Import clarity | High variance | Consistent at top | Consistent |
| Duplicate functions | 3+ instances | 1 canonical | 1 |
| Error handling | Inconsistent | Wrapped middleware | Wrapped |
| Time to find code | 5-10 min | 1-2 min | <1 min |
| Controller file size | 2800+ lines | 2500 lines | <2000 lines |

---

## Risk Assessment

**Low Risk:**
- Creating new utility/helper files
- Moving helper functions
- Consolidating imports

**Medium Risk:**
- Refactoring controllers (test changes)
- Reorganizing routes (verify endpoint URLs)
- Async error wrapper (test all error paths)

**Mitigation:**
- [ ] Run full test suite before each phase
- [ ] Git commit after each controller refactor
- [ ] Manual testing of affected endpoints
- [ ] Code review before merging

---

## Communication Plan

**Stakeholders:**
- [ ] Development team
- [ ] QA for regression testing
- [ ] Frontend team (verify no API changes)

**Deliverables:**
- Architecture guide (ARCHITECTURE_V2.md) - ✅ Done
- Refactoring checklist (this document)
- New utility modules (modelAccess, readingHelpers)
- Updated controller code
- Updated documentation

---

## Success Definition

✅ **Project is "easier to maintain" when:**
1. New developers can find code in < 2 minutes
2. Circular dependencies are eliminated
3. Service composition is transparent (visible in imports)
4. Adding new features doesn't require understanding 5 files
5. Tests pass consistently
6. Code review time is reduced by 30%

---

## Next Steps

1. **Immediate** (Next 2-3 hours):
   - Start with stationController.js refactor
   - Test each change incrementally
   - Commit after each major change

2. **This week**:
   - Complete Phase 2 (all controllers)
   - Create service facades (Phase 3)
   - Add async error middleware (Phase 4)

3. **Next week**:
   - Route reorganization (Phase 5)
   - Response standardization (Phase 6)
   - API documentation (Phase 7)

---

**Author**: Code Review Agent  
**Created**: March 21, 2026  
**Status**: Ready for Implementation
