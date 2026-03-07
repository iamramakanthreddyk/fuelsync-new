# Module Integration Checklist

## Status Overview
- ✅ Modular services created (5 services with full business logic)
- ✅ Controllers created (4 controllers with request handlers)
- ✅ DTOs created (4 DTO files with type contracts)
- ✅ Unit tests created (4 test specs with Jest mocks)
- ✅ Documentation created (ARCHITECTURE.md, ROUTING_GUIDE.md)
- 🔲 **NEXT**: Route wiring (integrate controllers into existing route files)

---

## Module Files Created

```
backend/src/modules/
├── index.js                                 [barrel export]
├── ARCHITECTURE.md                          [module design docs]
├── ROUTING_GUIDE.md                         [route integration guide]
│
├── readings/
│   ├── index.js
│   ├── readings.service.js                  [ReadingsService]
│   ├── readings.controller.js               [ReadingsController]
│   ├── readings.service.spec.js             [Unit tests]
│   └── dto/create-reading.dto.ts
│
├── payments/
│   ├── index.js
│   ├── payment-methods.service.js           [PaymentMethodsService]
│   ├── payment-methods.controller.js        [PaymentMethodsController]
│   ├── payment-methods.service.spec.js      [Unit tests]
│   └── dto/payment-method.dto.ts
│
├── expenses/
│   ├── index.js
│   ├── expenses.service.js                  [ExpensesService]
│   ├── expense-categories.service.js        [ExpenseCategoriesService]
│   ├── expenses.controller.js               [ExpensesController]
│   ├── expenses.service.spec.js             [Unit tests]
│   └── dto/create-expense.dto.ts
│
└── reports/
    ├── index.js
    ├── profitability.service.js             [ProfitabilityService]
    ├── profitability.controller.js          [ProfitabilityController]
    ├── profitability.service.spec.js        [Unit tests]
    └── dto/profitability.dto.ts
```

**Total**: 35 files

---

## Task Checklist: Route Wiring

### TASK 1: Update readings.js route file

**File**: `backend/src/routes/readings.js`

**Change**: Add modular controller alongside existing ones (no breaking changes)

```javascript
// ADD AT TOP (after existing imports)
const { readingsService } = require('../modules');
const ReadingsController = require('../modules/readings/readings.controller');
const modulatedController = new ReadingsController(readingsService);

// ADD AFTER line 29 (after existing routes)
// NEW: Modular routes - Req #1: Employee attribution
router.get('/:stationId/attribution-stats', 
  requireMinRole('manager'),
  modulatedController.getAttributionStats
);

// Optional: Add new on-behalf reading endpoint
router.post('/:stationId/readings-on-behalf',
  requireMinRole('manager'),
  modulatedController.createReadingOnBehalf
);
```

**Expected**: Tests for Req #1 should pass
```bash
npm test -- readings.service.spec.js
```

---

### TASK 2: Update expenses.js route file

**File**: `backend/src/routes/expenses.js`

**Change**: Add modular controller for approval workflow (Req #3)

```javascript
// ADD AT TOP (after existing imports)
const { expensesService, expenseCategoriesService } = require('../modules');
const ExpensesController = require('../modules/expenses/expenses.controller');
const modulatedController = new ExpensesController(expensesService, expenseCategoriesService);

// ADD AFTER existing routes (around line 60+)
// NEW: Modular approval endpoint - Req #3: Workflow
router.patch('/:id/approve',
  requireRole('manager', 'owner', 'super_admin'),
  modulatedController.approveExpense
);

// NEW: Modular summary endpoint - Req #3: Daily/monthly breakdown
router.get('/:stationId/expense-summary',
  modulatedController.getExpenseSummary
);
```

**Expected**: Tests for Req #3 (approval) should pass
```bash
npm test -- expenses.service.spec.js
```

---

### TASK 3: Create payments.js route file

**File**: `backend/src/routes/payments.js` (NEW FILE)

**Content**:
```javascript
/**
 * Payment Methods Routes
 * API for online payment breakdown (Req #2)
 */

const express = require('express');
const router = express.Router();
const { paymentMethodsService } = require('../modules');
const PaymentMethodsController = require('../modules/payments/payment-methods.controller');
const { authenticate } = require('../middleware/auth');

const controller = new PaymentMethodsController(paymentMethodsService);

// All routes require authentication
router.use(authenticate);

// Get available payment methods and subtypes (Req #2)
router.get('/methods', controller.listPaymentMethods);

// Validate payment breakdown
router.post('/validate-breakdown', controller.validatePaymentBreakdown);

module.exports = router;
```

**Integration**: Register in app.js (see STEP 5 below)

---

### TASK 4: Update profit.js route file

**File**: `backend/src/routes/profit.js`

**Change**: Add modular profitability controller (Req #3 net profit)

```javascript
// ADD AT TOP (after existing imports)
const { profitabilityService } = require('../modules');
const ProfitabilityController = require('../modules/reports/profitability.controller');
const modulatedController = new ProfitabilityController(profitabilityService);

// ADD AFTER existing routes
// NEW: Modular net profit endpoints - Req #3: Net profit with expense deduction
router.get('/:stationId/profit-summary',
  modulatedController.getMonthlySummary
);

router.get('/:stationId/profit-daily',
  modulatedController.getDailyProfit
);

router.get('/:stationId/profit-trend',
  modulatedController.getNetProfitTrend
);
```

**Expected**: Tests for Req #3 (profitability) should pass
```bash
npm test -- profitability.service.spec.js
```

---

### TASK 5: Register payments route in app.js

**File**: `backend/src/app.js` or `backend/src/routes/index.js`

**Find**: Where other routes are registered (search for `router.use('/readings'`)

**Add**:
```javascript
// Payment methods routes (Req #2)
router.use('/payments', require('./routes/payments'));
```

**Full example**:
```javascript
// After existing route registrations
router.use('/readings', require('./routes/readings'));
router.use('/expenses', require('./routes/expenses'));
router.use('/profit', require('./routes/profit'));
router.use('/payments', require('./routes/payments'));  // ADD THIS LINE
```

---

## Validation: Req #1, #2, #3 Checklist

### Req #1: Employee Attribution (Readings on Behalf)
- [ ] `readingsService.createReading()` accepts `assignedEmployeeId`
- [ ] Route `GET /readings/:stationId/attribution-stats` returns employee attribution %
- [ ] Test: `npm test -- readings.service.spec.js` passes "should create reading with assignedEmployeeId"

### Req #2: Online Payment Sub-Types
- [ ] `paymentMethodsService.getAvailablePaymentMethods()` returns UPI/Card/OilCompany subtypes
- [ ] Route `GET /payments/methods` lists all subtypes
- [ ] Route `POST /payments/validate-breakdown` validates payment breakdown
- [ ] Test: `npm test -- payment-methods.service.spec.js` passes validation tests

### Req #3: Expense Tracking with Approval & Net Profit
- [ ] `expensesService.createExpense()` auto-approves manager entries, pending for employees
- [ ] Route `PATCH /expenses/:id/approve` approves/rejects (requires manager role)
- [ ] Route `GET /expenses/:stationId/expense-summary` groups by category/frequency
- [ ] `profitabilityService.getMonthlySummary()` calculates: netProfit = grossProfit - approvedExpenses
- [ ] Route `GET /profit/:stationId/profit-summary` returns net profit (pending expenses shown separately)
- [ ] Test: `npm test -- expenses.service.spec.js` passes approval workflow tests
- [ ] Test: `npm test -- profitability.service.spec.js` passes net profit formula tests

---

## Testing Commands

### Run All Module Tests
```bash
# Unit tests for all services
npm test -- services.spec.js
# OR individually
npm test -- readings.service.spec.js
npm test -- payment-methods.service.spec.js
npm test -- expenses.service.spec.js
npm test -- profitability.service.spec.js
```

### Manual API Testing

```bash
# 1. Create reading on behalf (Req #1)
curl -X POST http://localhost:3001/api/v1/readings/station-123/readings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-03-07",
    "litresSold": 500,
    "assignedEmployeeId": "emp-456"
  }'

# 2. List payment methods (Req #2)
curl http://localhost:3001/api/v1/payments/methods \
  -H "Authorization: Bearer $TOKEN"

# 3. Create expense (Req #3)
curl -X POST http://localhost:3001/api/v1/expenses/station-123/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "cleaning",
    "amount": 5000,
    "expenseDate": "2025-03-07"
  }'

# 4. Get profit summary (Req #3)
curl http://localhost:3001/api/v1/profit/station-123/profit-summary?month=2025-03 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Integration Steps (In Order of Execution)

### Step 1: Update Existing Routes (No Breaking Changes)
- [ ] Update `readings.js` to import modular controller
- [ ] Update `expenses.js` to import modular controller
- [ ] Update `profit.js` to import modular controller
- [ ] Test: Existing tests still pass

### Step 2: Create New Route File
- [ ] Create `payments.js` with modular controller
- [ ] Register in app.js

### Step 3: Test Individual Modules
- [ ] `npm test -- readings.service.spec.js` ✅
- [ ] `npm test -- payment-methods.service.spec.js` ✅
- [ ] `npm test -- expenses.service.spec.js` ✅
- [ ] `npm test -- profitability.service.spec.js` ✅

### Step 4: Test API Endpoints
- [ ] POST /readings/:stationId/readings (Req #1) → 201 Created
- [ ] GET /payments/methods (Req #2) → 200 with subtypes
- [ ] POST /expenses/:stationId/expenses (Req #3) → 201 with auto-approval
- [ ] PATCH /expenses/:id/approve (Req #3) → 200 approved
- [ ] GET /profit/:stationId/profit-summary (Req #3) → 200 with net profit

### Step 5: Verify Data Flows
- [ ] Req #1: Manager enters reading → assignedEmployeeId set → Employee sees in their readings list
- [ ] Req #2: Payment breakdown stored → Can query by UPI subtype → Simple breakdown derived
- [ ] Req #3: Employee enters expense → Pending status → Manager approves → Excluded from net profit initially → Included after approval

---

## Common Issues & Fixes

### Issue: "Module not found: modules/readings/readings.controller"
**Fix**: Verify `/backend/src/modules/readings/readings.controller.js` exists

### Issue: "ReadingsService is not a constructor"
**Fix**: Update `/backend/src/modules/readings/index.js` to export:
```javascript
module.exports = require('./readings.service');
```

### Issue: "Cannot find property 'readingsService' on modules"
**Fix**: Update `/backend/src/modules/index.js` to export all services:
```javascript
module.exports = {
  readingsService: require('./readings'),
  paymentMethodsService: require('./payments'),
  expensesService: require('./expenses'),
  expenseCategoriesService: require('./expenses/expense-categories.service'),
  profitabilityService: require('./reports')
};
```

### Issue: Tests failing with "ValidationError"
**Fix**: Check DTOs are validating correctly
```javascript
// In controller
const { createReadingDto } = require('./dto/create-reading.dto');
const validated = createReadingDto.parse(req.body);  // Throws if invalid
```

---

## Success Criteria

✅ **All requirements implemented**:
- Req #1: Manager enters reading on behalf of employee ← `assignedEmployeeId`
- Req #2: Online payment breakdown with UPI/Card/OilCompany ← `paymentSubBreakdown`
- Req #3: Expense tracking with approval workflow + net profit ← `approvalStatus`, `netProfit = grossProfit - approvedExpenses`

✅ **All tests pass**:
```bash
npm test -- modules/
```

✅ **All APIs functional**:
```bash
curl http://localhost:3001/api/v1/readings/... (Req #1)
curl http://localhost:3001/api/v1/payments/... (Req #2)
curl http://localhost:3001/api/v1/expenses/... (Req #3)
curl http://localhost:3001/api/v1/profit/...   (Req #3)
```

✅ **Documentation complete**:
- [ARCHITECTURE.md](./ARCHITECTURE.md) → Module responsibilities
- [ROUTING_GUIDE.md](./ROUTING_GUIDE.md) → Route mapping
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) → Full endpoint reference

---

## Estimated Effort

| Task | Effort | Time |
|------|--------|------|
| Update readings.js | Low | 15 min |
| Update expenses.js | Low | 15 min |
| Update profit.js | Low | 10 min |
| Create payments.js | Low | 10 min |
| Register routes in app.js | Trivial | 5 min |
| Test endpoints | Medium | 30 min |
| **Total** | **Low** | **85 min** |

---

## Next Phase: Database Migration & Deployment

Once route wiring complete:

1. **Verify database schema** (models already have fields)
   - `NozzleReading.assignedEmployeeId` (Req #1)
   - `DailyTransaction.paymentSubBreakdown` (Req #2)
   - `Expense.approvalStatus, frequency` (Req #3)

2. **Run integration tests**
   - Test full flow: Employee entry → Manager approval → Profit recalculated

3. **Deploy** (shadow or full)
   - Option A: Run modular routes alongside old controllers
   - Option B: Replace old controllers with modular ones

See [DEPLOYMENT_CHECKLIST.md](../../DEPLOYMENT_CHECKLIST.md) for full deployment strategy.

