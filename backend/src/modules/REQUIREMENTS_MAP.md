# Requirements-to-Implementation Map

## Visual Overview

```
USER REQUIREMENTS (3)                MODULES CREATED (4)             DATABASE
─────────────────────────────────────────────────────────────────────────────

Req #1:                              
"Manager enters reading              ┌─────────────────────────┐     
on behalf of employee"               │  READINGS MODULE        │
                                     │  ────────────────────   │     NozzleReading
                                     │  - ReadingsService      │     ├─ assignedEmployeeId ✓
                                     │  - ReadingsController   │     ├─ enteredBy
                                     │  - create-reading.dto   │     └─ ...
                                     │  - Unit tests           │
                                     └─────────────────────────┘

Req #2:                              
"Online payment needs                ┌─────────────────────────┐
sub-types: UPI/Card/                 │  PAYMENTS MODULE        │     DailyTransaction
Oil Company"                          │  ────────────────────   │     ├─ paymentSubBreakdown
                                     │  - PaymentMethodsService│     │  ├─ upi: {...}
                                     │  - PaymentMethodsCtrl   │     │  ├─ card: {...}
                                     │  - payment-method.dto   │     │  ├─ oil_company: {...}
                                     │  - Unit tests           │     │  └─ ...
                                     └─────────────────────────┘     └─ ...

Req #3a:                             
"Enter daily/monthly                 ┌─────────────────────────┐
expenses"                             │  EXPENSES MODULE        │     Expense
                                     │  ────────────────────   │     ├─ category
Req #3b:                             │  - ExpensesService      │     ├─ amount
"Manager approval                    │  - ExpenseCategoriesS.  │     ├─ approvalStatus ✓
workflow"                             │  - ExpensesController   │     ├─ enteredBy
                                     │  - create-expense.dto   │     ├─ approvedBy
                                     │  - Unit tests           │     └─ ...
                                     └─────────────────────────┘

Req #3c:                             
"Combine with sales                  ┌─────────────────────────┐
to show net profit"                  │  REPORTS MODULE         │     (calculated)
                                     │  ────────────────────   │     ├─ netProfit
                                     │  - ProfitabilityService │     ├─ grossProfit
                                     │  - ProfitabilityCtrl    │     ├─ approvedExpenses
                                     │  - profitability.dto    │     ├─ pendingExpenses
                                     │  - Unit tests           │     └─ ...
                                     └─────────────────────────┘
```

---

## Requirement → Implementation Mapping

### Requirement #1: Employee Attribution

**User's Need**:
```
Manager: "I need to quickly enter a reading for an absent employee 
          without logging in as them"
```

**Solution Provided**:
```javascript
// ReadingsService: Handle employee attribution
createReading(data, userId, userRole) {
  if (data.assignedEmployeeId) {
    // Validate employee exists
    // Record: assignedEmployeeId = emp-123
    // This reading belongs to emp-123, not the manager
  }
}

// New field: NozzleReading.assignedEmployeeId
// Result: Reading shows "entered on behalf of" + attribution stats
```

**Endpoints Created**:
- `POST /readings/:stationId/readings` ← Req #1: Add assignedEmployeeId
- `GET /readings/:stationId/attribution-stats` ← Attribution metrics

**Test Coverage**:
```javascript
// readings.service.spec.js
✓ Should create reading with assignedEmployeeId
✓ Should validate assigned employee exists
✓ Should track attribution in stats
✓ Should handle self-entry (null assignedEmployeeId)
```

---

### Requirement #2: Payment Sub-Types

**User's Need**:
```
Pump Owner: "Online payment is too generic. I need to know
             HOW they paid - which UPI app, debit or credit,
             oil company card, etc."
```

**Solution Provided**:
```javascript
// PaymentMethodsService: Define + validate sub-types
const PAYMENT_SUBTYPES = {
  upi: { gpay, phonepe, paytm, amazon_pay, cred, bhim, other },
  card: { debit_card, credit_card },
  oil_company: { hp_pay, iocl, bpcl, essar, reliance, other }
}

// ReadingsService: Accept detailed breakdown
paymentSubBreakdown = {
  cash: 2000,
  upi: { gpay: 1200, phonepe: 800 },
  card: { debit_card: 500 },
  oil_company: { hp_pay: 1000 }
}

// Validate: Sum of all sub-types = total amount
// Derive: Simple breakdown (cash/online/credit) for reporting
```

**Endpoints Created**:
- `GET /payments/methods` ← List all payment methods + subtypes
- `POST /payments/validate-breakdown` ← Validate payment amounts

**Test Coverage**:
```javascript
// payment-methods.service.spec.js
✓ Should list all payment methods and subtypes
✓ Should validate UPI amounts sum correctly
✓ Should validate card types
✓ Should validate oil company cards
✓ Should reject invalid subtypes
✓ Should derive simple breakdown from detailed
```

---

### Requirement #3: Expense Tracking + Approval + Net Profit

**User's Need**:
```
"I need to:
 - Track daily/monthly operational expenses (salary, electricity, rent, etc.)
 - Have manager review and approve before including costs
 - See accurate net profit (sales - cost of goods - approved expenses)"
```

### 3a: Expense Tracking

**Solution Provided**:
```javascript
// ExpensesService: Full CRUD with auto-approval logic
createExpense(data, userId, userRole) {
  if (['manager', 'owner'].includes(userRole)) {
    approvalStatus = 'auto_approved'  // Manager auto-approves
  } else {
    approvalStatus = 'pending'        // Employee waits for approval
  }
  // Store: enteredBy, category, amount, frequency, tags
}

// ExpenseCategoriesService: Define categories + suggested frequency
categories: {
  salary: { label: "Salary", suggestedFrequency: "monthly" },
  electricity: { label: "Electricity Bill", suggestedFrequency: "monthly" },
  rent: { label: "Rent/Lease", suggestedFrequency: "monthly" },
  cleaning: { label: "Cleaning", suggestedFrequency: "weekly" },
  // ... more categories
}
```

**Endpoints Created**:
- `POST /expenses/:stationId/expenses` ← Create (auto-approve if manager)
- `GET /expenses/:stationId/expenses` ← List
- `GET /expenses/:stationId/expense-summary` ← Group by category/frequency

**Test Coverage**:
```javascript
// expenses.service.spec.js
✓ Should create expense with auto-approval for manager
✓ Should create expense with pending status for employee
✓ Should group expenses by category
✓ Should calculate total by frequency
✓ Should return approved vs pending totals
```

---

### 3b: Approval Workflow

**Solution Provided**:
```javascript
// ExpensesService: Approval workflow
approveExpense(id, action, userId, userRole, reason) {
  // Only manager/owner can approve
  if (!['manager', 'owner'].includes(userRole)) {
    throw "Insufficient permissions"
  }
  
  expense.approvalStatus = action === 'approve' ? 'approved' : 'rejected'
  expense.approvedBy = userId
  expense.approvedAt = now()
  
  // Log: Who approved what and when
}

// Visible in dashboard:
// "₹5000 cleaning expense entered by emp-123"
// "Status: pending (awaiting approval from manager)"
// [Approve] [Reject]
```

**Endpoint Created**:
- `PATCH /expenses/:id/approve` ← Approve/reject (manager-only)

**Test Coverage**:
```javascript
✓ Should approve expense
✓ Should reject expense
✓ Should only allow manager to approve
✓ Should record approver info
✓ Should track approval timestamp
```

---

### 3c: Net Profit Calculation

**User's Need**:
```
"Show me: Sales - Cost of Goods - Expenses = NET PROFIT
Only count APPROVED expenses, show pending separately"
```

**Solution Provided**:
```javascript
// ProfitabilityService: Full profit calculation
getMonthlySummary(stationId, month) {
  
  // Query revenue & COGS
  totalRevenue = SUM(litresSold × pricePerLitre)  // from NozzleReadings
  totalCOGS = SUM(litresSold × costPrice)         // from NozzleReadings
  grossProfit = totalRevenue - totalCOGS
  
  // Query ONLY APPROVED expenses (key point!)
  approvedExpenses = SUM(expense.amount 
    WHERE approvalStatus IN ['approved', 'auto_approved'])
  
  // Query pending for visibility
  pendingExpenses = SUM(expense.amount 
    WHERE approvalStatus = 'pending')
  
  // NET PROFIT = excludes pending!
  netProfit = grossProfit - approvedExpenses
  
  return {
    totalRevenue,
    totalCOGS,
    grossProfit,
    approvedExpenses,      // ✓ Only this is deducted
    pendingExpenses,       // ℹ️ Shown for transparency
    netProfit              // Key metric
  }
}

// Breakdown by:
// - Fuel type (petrol vs diesel)
// - Expense category (salary vs cleaning)
// - Date trends (daily, weekly, monthly)
```

**Endpoints Created**:
- `GET /profit/:stationId/profit-summary?month=2025-03` ← Monthly P&L
- `GET /profit/:stationId/profit-daily?date=2025-03-07` ← Daily snapshot
- `GET /profit/:stationId/profit-trend` ← Trending over period

**Test Coverage**:
```javascript
// profitability.service.spec.js
✓ Should calculate net profit = grossProfit - approvedExpenses
✓ Should exclude pending from profit calculation
✓ Should show pending separately
✓ Should break down by fuel type
✓ Should break down by expense category
✓ Should calculate trending
✓ Should handle zero expenses
```

---

## Data Flow: End-to-End (Req #3 Complete Cycle)

```
MARCH 2025 SCENARIO
═════════════════════════════════════════════════════════

Day 1:
Employee enters expense: Cleaning = ₹5,000
  POST /expenses/station-1/expenses
  { category: 'cleaning', amount: 5000 }
  
  → ExpensesService.createExpense()
  → approvalStatus = 'pending'
  → Save to DB
  → Status shown: "⏳ Pending (awaiting manager approval)"

Day 5:
Dashboard shows:
  GET /profit/station-1/profit-summary?month=2025-03
  
  Response:
  {
    totalRevenue: 100,000
    totalCOGS: 40,000
    grossProfit: 60,000
    approvedExpenses: 10,000
    pendingExpenses: 5,000        ← Shown but not deducted
    netProfit: 50,000             ← grossProfit - approvedExpenses
  }

Day 7:
Manager approves expense:
  PATCH /expenses/exp-123/approve
  { action: 'approve' }
  
  → ExpensesService.approveExpense()
  → approvalStatus = 'approved'
  → approvedBy = 'mgr-456'
  → Save to DB
  → Status shown: "✅ Approved by manager"

Day 7 (later):
Dashboard shows updated profit:
  GET /profit/station-1/profit-summary?month=2025-03
  
  Response:
  {
    totalRevenue: 100,000
    totalCOGS: 40,000
    grossProfit: 60,000
    approvedExpenses: 15,000      ← Now includes ₹5000
    pendingExpenses: 0             ← Was moved to approved
    netProfit: 45,000              ← Updated: 60000 - 15000
  }

Day 31:
Monthly Report:
  GET /profit/station-1/profit-summary?month=2025-03
  
  Shows:
  - Net Profit: ₹45,000
  - Breakdown by Fuel: Petrol ₹20k, Diesel ₹25k
  - Breakdown by Expense: Salary ₹10k, Cleaning ₹5k
  - All expense statuses: ✅ Approved for inclusion
```

---

## Key Architecture Decision: Why Pending Expenses Don't Affect Profit

**Q: Why show pending expenses separately instead of including them?**

**A: Transparency + Accuracy**

```
Scenario:
Manager sees dashboard with:
- Net Profit: ₹45,000
- Pending Expenses: ₹5,000

Manager knows:
"If I approve all pending, net profit becomes ₹40,000"

This allows:
✓ Conservative profit planning
✓ Visibility into uncertain costs
✓ Accurate reporting (approved ≠ "maybe")
✓ Clear decision-making (approve or reject?)
```

---

## Module Communication Map

```
┌──────────────────────────────────────────────────────────┐
│                    REST API Endpoints                    │
│                                                           │
│  POST /readings        POST /expenses       GET /profit  │
└────────┬───────────────────┬────────────────────┬────────┘
         │                   │                    │
         ▼                   ▼                    ▼
    ┌─────────┐         ┌──────────┐        ┌───────────┐
    │ Readings│         │ Expenses │        │Profitability│
    │ Service │         │ Service  │        │  Service   │
    └────┬────┘         └────┬─────┘        └──────┬─────┘
         │ Uses               │ Uses                │ Uses
         │ NozzleReading      │ Expense            │ Expense
         │ DailyTransaction   │ ExpenseCategory    │ NozzleReading
         │                    │                    │ (for revenue/COGS)
         └────────────────────┴────────────────────┘
                  Shared Database
```

---

## Summary: All Requirements Covered

| Requirement | Module | Key Service | Key Endpoint | Status |
|-------------|--------|------------|--------------|--------|
| Req #1: Employee attribution | Readings | `readingsService.createReading()` | `POST /readings/:stationId/readings` | ✅ Complete |
| Req #2: Payment sub-types | Payments | `paymentMethodsService.validatePaymentSubBreakdown()` | `GET /payments/methods` | ✅ Complete |
| Req #3a: Expense tracking | Expenses | `expensesService.createExpense()` | `POST /expenses/:stationId/expenses` | ✅ Complete |
| Req #3b: Approval workflow | Expenses | `expensesService.approveExpense()` | `PATCH /expenses/:id/approve` | ✅ Complete |
| Req #3c: Net profit | Reports | `profitabilityService.getMonthlySummary()` | `GET /profit/:stationId/profit-summary` | ✅ Complete |

---

## What's Ready Now

✅ All services feature-complete  
✅ All controllers HTTP-ready  
✅ All DTOs type-safe  
✅ All tests passing (mock-based)  
✅ All documentation comprehensive  

🔲 **Next**: Route wiring (connect controllers → Express routes)

See: [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md)

