# Module Architecture Guide

## Overview
This document describes the modular architecture of the FuelSync platform, organized around three user requirements and a reporting framework.

## Directory Structure

```
backend/src/modules/
├── index.js                          # Central module exports
├── API_DOCUMENTATION.md              # Complete API reference
├── ARCHITECTURE.md                   # This file
│
├── readings/                         # Req #1: Employee Attribution
│   ├── index.js                      # Module exports
│   ├── readings.service.js           # Business logic
│   ├── readings.controller.js        # HTTP handlers
│   ├── readings.service.spec.js      # Unit tests
│   └── dto/
│       └── create-reading.dto.ts     # TypeScript interfaces
│
├── payments/                         # Req #2: Online Payment Sub-Types
│   ├── index.js                      # Module exports
│   ├── payment-methods.service.js    # Payment methods & validation
│   ├── payment-methods.controller.js # HTTP handlers
│   ├── payment-methods.service.spec.js  # Unit tests
│   └── dto/
│       └── payment-method.dto.ts     # Payment type definitions
│
├── expenses/                         # Req #3: Expense Tracking
│   ├── index.js                      # Module exports
│   ├── expenses.service.js           # CRUD & approval logic
│   ├── expenses.controller.js        # HTTP handlers
│   ├── expense-categories.service.js # Category management
│   ├── expenses.service.spec.js      # Unit tests
│   └── dto/
│       └── create-expense.dto.ts     # Expense DTOs
│
└── reports/                          # Req #3: Profitability Reports
    ├── index.js                      # Module exports
    ├── profitability.service.js      # Net profit calculations
    ├── profitability.controller.js   # HTTP handlers
    ├── profitability.service.spec.js # Unit tests
    └── dto/
        └── profitability.dto.ts      # Report DTOs
```

## Module Responsibilities

### 1. Readings Module (Req #1: Employee Attribution)

**Purpose**: Handle quick reading entry with optional employee attribution for manager/owner workflow

**Service: `ReadingsService`**
- `createReading(data, userId, userRole)`: Create reading with optional assignedEmployeeId
- `listReadings(filter)`: Query readings with employee filtering
- `getEmployeeReadings(employeeId, stationId, dateRange)`: Get readings for an employee
- `getAttributionStats(stationId, month)`: Analytics on self-entry vs on-behalf

**Key Data Model**:
```javascript
{
  id: UUID,
  enteredBy: UUID,              // Who logged in and entered
  assignedEmployeeId: UUID,     // Req #1: Who this reading belongs to (NULL = self-entry)
  readingDate: DATEONLY,
  litresSold: DECIMAL,
  fuelType: STRING,
  paymentSubBreakdown: JSONB    // Req #2: Detailed breakdown
}
```

**Use Case**: Manager enters reading for employee who forgot, system shows "entered on behalf of" + attribution stats

---

### 2. Payments Module (Req #2: Online Payment Sub-Types)

**Purpose**: Manage payment methods and validate detailed online payment breakdowns (UPI, Card, Oil Company)

**Service: `PaymentMethodsService`**
- `getAvailablePaymentMethods()`: Returns all menus and subtypes
- `validatePaymentSubBreakdown(breakdown, totalAmount)`: Validates sub-type amounts
- `deriveSimpleBreakdown(paymentSubBreakdown)`: Converts detail → simple (cash/online/credit)
- `getUpiLabel()`, `getCardLabel()`, `getOilCompanyLabel()`: Label lookups

**Supported Sub-Types**:
```
UPI (7 types): GPay, PhonePe, Paytm, Amazon Pay, CRED, BHIM, Other
Card (2): Debit Card, Credit Card
Oil Company (6): HP Pay, IOCL, BPCL SmartFleet, Essar Fleet, Reliance Fleet, Other
```

**Data Structure**:
```javascript
paymentSubBreakdown = {
  cash: 5000,
  upi: { gpay: 1200, phonepe: 800, paytm: 300, ... },
  card: { debit_card: 500, credit_card: 300 },
  oil_company: { hp_pay: 1000, iocl_card: 500, ... },
  credit: 500
}
```

**Use Case**: Daily sale entry captures exact breakdown of ₹5000 UPI as 600 GPay + 2300 PhonePe + 1100 Paytm + ..., not just "upi: 5000"

---

### 3. Expenses Module (Req #3: Expense Tracking & Approval)

**Purpose**: Track daily/monthly operational expenses with approval workflow for manager/owner review

**Services**:
- `ExpensesService`: CRUD, approval workflow, summaries
  - `createExpense()`: Entry auto-approved if manager/owner, pending if employee
  - `approveExpense(id, action, userId, userRole, reason)`: Manager approves/rejects
  - `listExpenses(filter)`: Query by status, category, frequency, date
  - `getExpenseSummary(stationId, period, dateOrMonth)`: Daily/monthly breakdown
  - `getTotalApprovedExpenses()`: For profit calculation
  - `getPendingExpenses()`: For transparency on reports

- `ExpenseCategoriesService`: Category definitions
  - `getCategories()`: List all (Salary, Electricity, Rent, etc.)
  - `getLabel()`: Human-readable label
  - `suggestFrequency()`: Auto-suggest frequency by category

**Approval Workflow**:
```
Employee enters expense
        ↓
approvalStatus = 'pending'
        ↓
Manager views → Approve (→ 'approved') or Reject (→ 'rejected')
        ↓
System includes in net profit only if 'approved' or 'auto_approved'
```

**Data Model**:
```javascript
{
  id: UUID,
  category: STRING,              // salary, electricity, rent, etc.
  amount: DECIMAL,
  expenseDate: DATEONLY,
  expenseMonth: STRING,          // YYYY-MM for grouping
  frequency: ENUM,               // daily, weekly, monthly, one_time
  approvalStatus: ENUM,          // pending, approved, auto_approved, rejected
  enteredBy: UUID,               // Who entered (employee)
  approvedBy: UUID,              // Who approved (manager/owner) or NULL
  approvedAt: TIMESTAMP,         // When approved/rejected
  tags: JSONB                    // Flexible categorization
}
```

---

### 4. Reports Module (Req #3: Net Profit with Expense Deduction)

**Purpose**: Calculate profitability integrating sales, COGS, and **approved expenses only**

**Service: `ProfitabilityService`**
- `getMonthlySummary(stationId, month)`: Full P&L with expense breakdown
- `getDailyProfit(stationId, date)`: Daily snapshot
- `getNetProfitTrend(stationId, startDate, endDate, period)`: Trending over range

**Calculation Core**:
```
Revenue = SUM(litresSold × pricePerLitre)
COGS = SUM(litresSold × costPrice)
Approved Expenses = SUM(expense.amount WHERE approvalStatus IN ['approved', 'auto_approved'])
Pending Expenses = SUM(expense.amount WHERE approvalStatus = 'pending')  // Info only

Gross Profit = Revenue - COGS
Net Profit = Gross Profit - Approved Expenses
Profit Margin = (Net Profit / Revenue) × 100
Profit per Litre = Net Profit / Total Litres

NOTE: Pending expenses are shown for transparency but NOT deducted from Net Profit
```

**Response Includes**:
- Summary: Revenue, COGS, Approved Expenses, Pending Expenses, Net Profit
- Breakdown: By fuel type, by expense category
- Data Completeness: # readings with cost price, % completeness

---

## Layer Architecture

### 1. DTO Layer (Request/Response Validation)
- **Location**: `modules/*/dto/*.dto.ts` (TypeScript interfaces)
- **Purpose**: Typed contracts for API requests/responses
- **Example**: `CreateExpenseDto` validates required fields, types, constraints

### 2. Service Layer (Business Logic)
- **Location**: `modules/*/service.js`
- **Purpose**: Core domain logic, database queries, validation
- **Dependency**: Models (Sequelize), other services
- **Example**: `ExpensesService.createExpense()` handles approval logic, audit logging

### 3. Controller Layer (HTTP Handlers)
- **Location**: `modules/*/controller.js`
- **Purpose**: Request parsing, calling services, response formatting
- **Dependency**: Services only
- **Example**: `ExpensesController.createExpense()` extracts stationId, userId, calls service

### 4. Test Layer (Unit Tests)
- **Location**: `modules/*/service.spec.js`
- **Purpose**: Verify business logic in isolation
- **Coverage**: Happy path, edge cases, error scenarios
- **Example**: Verify net profit calculation = revenue - cogs - approved expenses

---

## Data Flow Example: Employee Enters Expense → Manager Approves → Profit Recalculates

```
1. EMPLOYEE ENTRY
   POST /api/v1/stations/station-1/expenses
   Body: { category: 'cleaning', amount: 5000, expenseDate: '2025-03-07' }
   
   ↓ ExpensesController.createExpense()
   ↓ ExpensesService.createExpense(data, userId='emp-123', userRole='employee')
   → User is employee, so approvalStatus = 'pending'
   → Create Expense { approvalStatus: 'pending', enteredBy: 'emp-123' }
   ↓ Response: { id, approvalStatus: 'pending', ... }

2. DASHBOARD SHOWS PENDING
   GET /api/v1/stations/station-1/expense-summary?month=2025-03
   
   ↓ ExpensesController.getExpenseSummary()
   ↓ ExpensesService.getExpenseSummary()
   → Query: SUM(amount WHERE status='pending') = 5000
   ↓ Response: { approvedTotal: 100000, pendingTotal: 5000, pendingCount: 1 }

3. MANAGER APPROVES
   PATCH /api/v1/expenses/exp-uuid/approve
   Body: { action: 'approve' }
   
   ↓ ExpensesController.approveExpense()
   ↓ ExpensesService.approveExpense(id, 'approve', userId='mgr-456', userRole='manager')
   → Update Expense { approvalStatus: 'approved', approvedBy: 'mgr-456', approvedAt: now }
   ↓ Response: { id, approvalStatus: 'approved', approvedBy, approvedAt }

4. PROFIT RECALCULATED
   GET /api/v1/stations/station-1/profit-summary?month=2025-03
   
   ↓ ProfitabilityController.getMonthlySummary()
   ↓ ProfitabilityService.getMonthlySummary()
   → Query approved expenses: SUM(amount WHERE status in ['approved', 'auto_approved'])
     OLD: 100000 (pending not counted)
     NEW: 105000 (pending still not counted, but newly-approved 5000 now included)
   → Recalculate Net Profit
   ↓ Response: { netProfit: increased, breakdown includes new expense category }
```

---

## Integration Points

### Existing Controllers to Refactor (or use new modules side-by-side)
- `backend/src/controllers/readingController.js` → Use `ReadingsService` from module
- `backend/src/controllers/expenseController.js` → Use `ExpensesService` from module
- `backend/src/controllers/profitController.js` → Use `ProfitabilityService` from module

### Database Models (Already Exist)
- `NozzleReading` - has `assignedEmployeeId` field (Req #1)
- `DailyTransaction` - has `paymentSubBreakdown` field (Req #2)
- `Expense` - has `approvalStatus`, `frequency`, `tags` fields (Req #3)

### Routes Integration
```javascript
// readings.js
const { readingsService } = require('../modules');
router.post('/:stationId/readings', readingsController.createReading);

// expenses.js
const { expensesService } = require('../modules');
router.post('/:stationId/expenses', expensesController.createExpense);
router.patch('/:id/approve', expensesController.approveExpense);

// profit.js
const { profitabilityService } = require('../modules');
router.get('/:stationId/profit-summary', profitabilityController.getMonthlySummary);
```

---

## Testing Strategy

### Unit Tests (Service Layer)
- **Location**: `modules/*/service.spec.js`
- **Scope**: Business logic in isolation (mocked DB)
- **Coverage**: Happy path, validations, edge cases
- **Example**: `expensesService.createExpense()` with mocked Sequelize

### Integration Tests (Module-to-DB)
- **Planned**: `modules/*/service.integration.spec.js`
- **Scope**: Service + real DB (test DB)
- **Coverage**: Full flow including DB persistence

### E2E Tests (API-to-DB)
- **Planned**: `backend/tests/e2e/expenses.e2e.spec.js`
- **Scope**: Full API request → DB → response
- **Coverage**: Request parsing, validation, response formatting

---

## Extension Points

### Adding a New Expense Category
```javascript
// 1. Update constant in expense-categories.service.js
const SUGGESTED_FREQUENCY = {
  ...
  my_new_category: 'monthly'
};

// 2. Tests automatically cover new option
```

### Adding a New UPI Provider
```javascript
// 1. Update constant in payment-methods.service.js
const UPI_SUBTYPES = {
  ...
  new_upi_app: 'New UPI App'
};

// 2. Validation automatically accepts new subtype
```

### Adding Expense Approval Notification
```javascript
// 1. Extend ExpensesService.approveExpense()
await notificationService.send({
  userId: expense.enteredBy,
  message: `Your ₹${amount} expense was ${action}ed`
});

// 2. Tests can mock notificationService
```

---

## Summary

| Component | Req | Location | Responsibility |
|-----------|-----|----------|-----------------|
| Readings Service | #1 | `modules/readings/` | Employee attribution, reading creation, listing |
| Payment Methods Service | #2 | `modules/payments/` | Sub-type definitions, validation, breakdown |
| Expenses Service | #3 | `modules/expenses/` | CRUD, approval workflow, summaries |
| Profitability Service | #3 | `modules/reports/` | Net profit calculation with expense deduction |

All modules follow layered architecture: DTO → Service → Controller → Tests

