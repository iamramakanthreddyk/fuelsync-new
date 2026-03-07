# Route Wiring Guide

## Quick Start: Connect Modular Controllers

This guide shows how to integrate the new modular controllers with the existing Express router.

---

## Step 1: Import Modules in Route Files

### readings.js
```javascript
const express = require('express');
const router = express.Router();
const { readingsService } = require('../modules');
const ReadingsController = require('../modules/readings/readings.controller');
const { requireRole } = require('../middleware/auth');

const controller = new ReadingsController(readingsService);

// Existing routes can stay; add new ones
router.post('/:stationId/readings', controller.createReading);
router.get('/:stationId/readings', controller.listReadings);
router.get('/employees/:employeeId/readings', controller.getEmployeeReadings);
router.get('/:stationId/attribution-stats', requireRole('manager', 'owner'), controller.getAttributionStats);

module.exports = router;
```

### payments.js
```javascript
const express = require('express');
const router = express.Router();
const { paymentMethodsService } = require('../modules');
const PaymentMethodsController = require('../modules/payments/payment-methods.controller');

const controller = new PaymentMethodsController(paymentMethodsService);

router.get('/methods', controller.listPaymentMethods);
router.post('/validate-breakdown', controller.validatePaymentBreakdown);

module.exports = router;
```

### expenses.js
```javascript
const express = require('express');
const router = express.Router();
const { expensesService, expenseCategoriesService } = require('../modules');
const ExpensesController = require('../modules/expenses/expenses.controller');
const { requireRole } = require('../middleware/auth');

const controller = new ExpensesController(expensesService, expenseCategoriesService);

router.post('/:stationId/expenses', controller.createExpense);
router.patch('/:id/approve', requireRole('manager', 'owner'), controller.approveExpense);
router.get('/:stationId/expenses', controller.listExpenses);
router.get('/:stationId/expense-summary', controller.getExpenseSummary);
router.get('/categories', controller.listCategories);

module.exports = router;
```

### profit.js (new or update existing)
```javascript
const express = require('express');
const router = express.Router();
const { profitabilityService } = require('../modules');
const ProfitabilityController = require('../modules/reports/profitability.controller');

const controller = new ProfitabilityController(profitabilityService);

router.get('/:stationId/profit-summary', controller.getMonthlySummary);
router.get('/:stationId/profit-daily', controller.getDailyProfit);
router.get('/:stationId/profit-trend', controller.getNetProfitTrend);

module.exports = router;
```

---

## Step 2: Register Routes in app.js

```javascript
// app.js or routes/index.js
const express = require('express');
const router = express.Router();

const readingsRouter = require('./readings');
const paymentsRouter = require('./payments');
const expensesRouter = require('./expenses');
const profitRouter = require('./profit');

const { requireAuth } = require('../middleware/auth');

// Mount routers with prefix
router.use('/readings', requireAuth, readingsRouter);
router.use('/payments', requireAuth, paymentsRouter);
router.use('/expenses', requireAuth, expensesRouter);
router.use('/profit', requireAuth, profitRouter);

module.exports = router;
```

---

## Step 3: Update Existing Controllers (Optional)

If existing route handlers call old business logic, update them to use modular services:

### Before (Old Pattern)
```javascript
// controllers/expenseController.js
exports.approveExpense = async (req, res) => {
  const { id } = req.params;
  const expense = await Expense.findByPk(id);
  expense.approvalStatus = 'approved';
  await expense.save();
  res.json(expense);
};
```

### After (Modular Pattern)
```javascript
// Keep existing route, call modular service
const { expensesService } = require('../modules');

exports.approveExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;
    const result = await expensesService.approveExpense(
      id,
      action,
      req.user.id,
      req.user.role,
      reason
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
```

---

## Complete Route Mapping

| Method | Endpoint | Handler | Module | Req |
|--------|----------|---------|--------|-----|
| POST | /readings/:stationId/readings | createReading | Readings | #1 |
| GET | /readings/:stationId/readings | listReadings | Readings | #1 |
| GET | /readings/:stationId/attribution-stats | getAttributionStats | Readings | #1 |
| GET | /payments/methods | listPaymentMethods | Payments | #2 |
| POST | /payments/validate-breakdown | validatePaymentBreakdown | Payments | #2 |
| POST | /expenses/:stationId/expenses | createExpense | Expenses | #3 |
| PATCH | /expenses/:id/approve | approveExpense | Expenses | #3 |
| GET | /expenses/:stationId/expenses | listExpenses | Expenses | #3 |
| GET | /expenses/:stationId/expense-summary | getExpenseSummary | Expenses | #3 |
| GET | /expenses/categories | listCategories | Expenses | #3 |
| GET | /profit/:stationId/profit-summary | getMonthlySummary | Reports | #3 |
| GET | /profit/:stationId/profit-daily | getDailyProfit | Reports | #3 |
| GET | /profit/:stationId/profit-trend | getNetProfitTrend | Reports | #3 |

---

## Request/Response Examples

### Req #1: Create Reading (On-Behalf)
```bash
POST /readings/station-1/readings
{
  "date": "2025-03-07",
  "litresSold": 500,
  "fuelType": "petrol",
  "assignedEmployeeId": "emp-123",  # NEW: Req #1
  "paymentSubBreakdown": {          # Req #2
    "cash": 2000,
    "upi": { "gpay": 1200, "phonepe": 800 },
    "card": { "debit_card": 500 }
  }
}

Response:
{
  "id": "reading-uuid",
  "stationId": "station-1",
  "enteredBy": "user-456",           # Who entered
  "assignedEmployeeId": "emp-123",   # NEW: Req #1
  "litresSold": 500,
  "fuelType": "petrol",
  "attributionStatus": "on_behalf",  # NEW: Clear labeling
  "createdAt": "2025-03-07T10:00:00Z"
}
```

### Req #2: List Payment Methods
```bash
GET /payments/methods

Response:
{
  "success": true,
  "data": {
    "methods": [
      {
        "type": "upi",
        "label": "UPI",
        "subtypes": {
          "gpay": "Google Pay",
          "phonepe": "PhonePe",
          "paytm": "Paytm",
          "amazon_pay": "Amazon Pay",
          "cred": "CRED",
          "bhim": "BHIM",
          "other": "Other UPI"
        }
      },
      {
        "type": "card",
        "label": "Card",
        "subtypes": {
          "debit_card": "Debit Card",
          "credit_card": "Credit Card"
        }
      },
      {
        "type": "oil_company",
        "label": "Oil Company",
        "subtypes": {
          "hp_pay": "HP Pay",
          "iocl": "IOCL",
          "bpcl": "BPCL SmartFleet",
          "essar": "Essar Fleet",
          "reliance": "Reliance Fleet",
          "other": "Other Oil Company"
        }
      }
    ]
  }
}
```

### Req #3: Create Expense (Auto-Approval for Manager)
```bash
POST /expenses/station-1/expenses
{
  "category": "cleaning",
  "amount": 5000,
  "expenseDate": "2025-03-07",
  "frequency": "monthly",
  "tags": ["maintenance"]
}

Response (Manager enters):
{
  "id": "exp-uuid",
  "category": "cleaning",
  "amount": 5000,
  "expenseDate": "2025-03-07",
  "approvalStatus": "auto_approved",  # NEW: Req #3 - Auto-approved
  "enteredBy": "mgr-456",
  "approvedBy": "mgr-456",
  "approvedAt": "2025-03-07T10:00:00Z",
  "createdAt": "2025-03-07T10:00:00Z"
}

Response (Employee enters):
{
  "id": "exp-uuid",
  "category": "cleaning",
  "amount": 5000,
  "approvalStatus": "pending",        # NEW: Req #3 - Pending
  "enteredBy": "emp-123",
  "createdAt": "2025-03-07T10:00:00Z"
}
```

### Req #3: Approve Expense (Manager)
```bash
PATCH /expenses/exp-uuid/approve
{
  "action": "approve",
  "reason": "Approved for March cleaning services"
}

Response:
{
  "id": "exp-uuid",
  "approvalStatus": "approved",
  "approvedBy": "mgr-456",
  "approvedAt": "2025-03-07T11:00:00Z"
}
```

### Req #3: Get Profit Summary
```bash
GET /profit/station-1/profit-summary?month=2025-03

Response:
{
  "stationId": "station-1",
  "month": "2025-03",
  "summary": {
    "totalRevenue": 500000,
    "totalCostOfGoods": 400000,
    "grossProfit": 100000,
    "totalApprovedExpenses": 15000,  # NEW: Req #3
    "totalPendingExpenses": 5000,    # NEW: Req #3 - Shown, not deducted
    "netProfit": 85000               # NEW: Req #3 - Formula: grossProfit - approvedExpenses
  },
  "breakdown": {
    "byFuelType": {
      "petrol": { revenue: 250000, cogs: 200000, netProfit: 40000 },
      "diesel": { revenue: 250000, cogs: 200000, netProfit: 40000 }
    },
    "byExpenseCategory": {
      "salary": { approved: 10000, pending: 0 },
      "cleaning": { approved: 5000, pending: 5000 }
    }
  }
}
```

---

## Middleware Integration

### Authentication Middleware
```javascript
// middleware/auth.js
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

module.exports = { requireAuth, requireRole };
```

### Example: Expense Creation
```javascript
// Manager enters: requires POST /expenses/:stationId/expenses
// Controller checks req.user.role
// ExpensesService receives userRole
// If userRole in ['manager', 'owner'], setup auto-approval
// If userRole == 'employee', set pending

// This logic is in service layer, not controller
```

---

## Testing Routes

### Using cURL
```bash
# Create reading on behalf
curl -X POST http://localhost:3001/api/v1/readings/station-1/readings \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-03-07",
    "litresSold": 500,
    "fuelType": "petrol",
    "assignedEmployeeId": "emp-123"
  }'

# Get profit summary
curl -X GET "http://localhost:3001/api/v1/profit/station-1/profit-summary?month=2025-03" \
  -H "Authorization: Bearer token"
```

### Using Postman
- Import request collection: [See API_DOCUMENTATION.md for full examples]
- Set env variables: `base_url=http://localhost:3001`, `auth_token=...`
- Run requests against modular endpoints

---

## Rollout Strategy

### Phase 1: Shadow Deployment (No Breaking Changes)
```javascript
// Old endpoint still works
router.get('/api/v1/readings', readingController.getReadings);  // OLD

// New endpoint runs alongside
router.get('/api/v1/readings', controller.listReadings);         // NEW

// Both hit same database, responses are compatible
// Allows A/B testing, gradual migration
```

### Phase 2: Redirect Old to New
```javascript
// Map old controller methods to new service calls
const { readingsService } = require('../modules');

exports.getReadings = async (req, res) => {
  // Delegate to new service
  const result = await readingsService.listReadings(req.query);
  res.json(result);
};
```

### Phase 3: Full Migration
```javascript
// Remove old controller methods
// Keep only modular routes
// Delete backend/src/controllers/readingController.js (optional, deprecated)
```

---

## Validation & Error Handling

### DTO Validation Example
```javascript
// In controller
const { validateCreateExpenseDto } = require('../modules/expenses/dto');

router.post('/:stationId/expenses', async (req, res) => {
  try {
    const dto = await validateCreateExpenseDto(req.body);
    const result = await expensesService.createExpense(dto, req.user);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message, field: error.field });
  }
});
```

### Error Responses
```json
{
  "error": "Invalid payment breakdown",
  "field": "paymentSubBreakdown",
  "details": "UPI total (3500) exceeds reading amount (3000)"
}
```

---

## Next Steps

1. **Create route files**: readings.js, payments.js, expenses.js, profit.js (as shown above)
2. **Update app.js**: Register routes with middleware
3. **Test endpoints**: Use cURL or Postman examples
4. **Migrate existing endpoints**: Redirect old handlers to modular services
5. **Deploy**: Use shadow deployment for zero-downtime rollout

See [ARCHITECTURE.md](./ARCHITECTURE.md) for module details and data flows.
