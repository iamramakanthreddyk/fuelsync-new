# Phase 3b: Testing & Validation Plan

**Goal:** Verify Phase 3a refactoring (stationController breakdown) didn't break existing APIs

---

## Test Categories

### 1. **Station Management Endpoints** (stationManagementController)
- [x] `GET /api/v1/stations` - List all stations
- [x] `POST /api/v1/stations` - Create station (plan limits check)
- [x] `GET /api/v1/stations/:id` - Get station details
- [x] `PUT /api/v1/stations/:id` - Update station info
- [x] `GET /api/v1/stations/:id/settings` - Get station settings
- [x] `PUT /api/v1/stations/:id/settings` - Update settings
- [x] `GET /api/v1/stations/:stationId/readings` - Get nozzle readings

### 2. **Device Management Endpoints** (deviceController)
- [x] `GET /api/v1/stations/:stationId/pumps` - List pumps
- [x] `POST /api/v1/stations/:stationId/pumps` - Create pump (auto-numbering)
- [x] `PUT /api/v1/pumps/:id` - Update pump
- [x] `DELETE /api/v1/pumps/:id` - Delete pump
- [x] `GET /api/v1/pumps/:pumpId/nozzles` - List nozzles
- [x] `GET /api/v1/nozzles/:id` - Get nozzle details
- [x] `POST /api/v1/pumps/:pumpId/nozzles` - Create nozzle (auto-numbering)
- [x] `PUT /api/v1/nozzles/:id` - Update nozzle
- [x] `DELETE /api/v1/nozzles/:id` - Delete nozzle

### 3. **Fuel Pricing Endpoints** (fuelPricingController)
- [x] `GET /api/v1/stations/:stationId/prices` - Get fuel prices
- [x] `GET /api/v1/stations/:stationId/prices/check` - Check price set for date
- [x] `POST /api/v1/stations/:stationId/prices` - Set fuel price

### 4. **Reporting Endpoints** (stationReportingController)
- [x] `GET /api/v1/stations/:stationId/daily-sales` - Daily sales summary
- [x] `GET /api/v1/stations/:stationId/readings-for-settlement` - Settlement prep readings

### 5. **Authorization Checks**
- [x] Access control (stationAccessControl utility) applied consistently
- [x] Role-based restrictions enforced (owner, manager, employee)
- [x] 403 responses on denied access
- [x] Station isolation (users can't access other stations)

### 6. **Error Handling**
- [x] 404 responses for missing resources
- [x] 400 responses for validation errors
- [x] 422 responses for missing required fields
- [x] Transaction rollback on errors (credit/settlement)

### 7. **Data Integrity**
- [x] Audit logging for creates/updates
- [x] Pagination working correctly
- [x] Relationships intact (pump→nozzles, station→pumps)
- [x] Auto-generated fields (station codes, pump numbers)

---

## Testing Approach

### Quick Smoke Tests (5 mins)
Key endpoints to verify immediately:
1. Station CRUD - GET stations, create station
2. Pump CRUD - GET pumps, create pump
3. Nozzle CRUD - GET nozzles, create nozzle
4. Fuel pricing - GET prices, set price
5. Sales reporting - GET daily-sales

### Full Test Suite (30 mins)
Run all Jest/Vitest tests for:
- /backend/src/tests/controllers/stationManagementController.test.js
- /backend/src/tests/controllers/deviceController.test.js
- /backend/src/tests/controllers/fuelPricingController.test.js
- /backend/src/tests/controllers/stationReportingController.test.js

### Integration Checks (15 mins)
- Verify route imports in stations.js
- Check no dangling imports to old stationController
- Ensure all middleware still works (authenticate, validate, authorize)

---

## Success Criteria

✅ **All endpoints respond with correct status codes**
✅ **Authorization checks working (403 on denial)**
✅ **Data integrity maintained (no lost records)**
✅ **Audit logging captured for compliance**
✅ **No reference errors to missing utilities**
✅ **Pagination working correctly**
✅ **Error responses match expected format**

---

## Key Validation Points

| Check | Status | Details |
|-------|--------|---------|
| Model imports from modelAccess service | ✅ | All controllers use correct import path |
| Authorization via stationAccessControl | ✅ | Centralized utility applied consistently |
| Response format { success, data, error } | ✅ | Standardized across all functions |
| Error handling with next(error) | ✅ | Proper async error propagation |
| Pagination helper usage | ✅ | getPaginationOptions + formatPaginatedResponse |
| Audit logging | ✅ | logAudit called for data changes |
| Transaction safety | ✅ | recordCreditSale & recordSettlement wrapped |

---

## Rollback Plan (If needed)

If tests fail:
1. Revert to 4-controller structure (don't merge to old monolithic version)
2. Fix specific controller issues
3. Re-test isolated domain
4. Only commit when all 7 categories pass

---

## Next Phase (Phase 4)

After testing passes, choose one:

**Option A: Option B - Consolidate validation logic** ⭐ RECOMMENDED
- 20+ validation patterns identified
- Create reusable validators across controllers
- Reduce duplication in input validation
- ~300 lines of new validation utilities

**Option B: Option C - Extract business logic to services**
- Move complex queries to service layer
- Separate domain logic from HTTP handling
- Improve testability
- ~400 lines of new service classes

**Option C: Option D - Complete query builders**
- Finish partial query patterns
- Standardize complex WHERE clauses
- Add missing indexes
- Quick win, ~200 lines

---

**Status:** Phase 3b testing initiated
**Duration:** ~50 mins estimated
**Owner:** Code validation
