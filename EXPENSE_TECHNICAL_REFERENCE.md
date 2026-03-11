# Expense Approval System - Technical Reference

## Architecture Overview

```
Frontend (React)
    ↓
API Routes
    ├─ POST /stations/:stationId/expenses (CREATE)
    ├─ PATCH /expenses/:id/approve (APPROVE 1)
    ├─ PATCH /stations/:stationId/expenses/bulk-approve (BULK)
    └─ GET /stations/:stationId/expenses (LIST)
    ↓
Backend Controllers
    ├─ expenseController.createExpense()
    ├─ expenseController.approveExpense()
    ├─ expenseController.bulkApproveExpenses()
    └─ expenseController.getExpenses()
    ↓
Database (SQLite/Postgres)
    └─ expenses table
```

---

## Database Schema

```javascript
// Expense Model
{
  id: UUID,
  stationId: UUID,
  
  // Basic Info
  category: VARCHAR (salary|rent|electricity|...)
  description: VARCHAR,
  amount: DECIMAL,
  paymentMethod: VARCHAR (cash|online|card),
  
  // Timing
  expenseDate: DATE,
  expenseMonth: VARCHAR (YYYY-MM),
  frequency: VARCHAR (one_time|daily|weekly|monthly),
  
  // Approval Status
  approvalStatus: VARCHAR (pending|approved|auto_approved|rejected),
  approvedBy: UUID (FK → users.id),
  approvedAt: TIMESTAMP,
  
  // Who Entered It
  createdBy: UUID (FK → users.id),
  enteredBy: UUID (FK → users.id),
  
  // Metadata
  receiptNumber: VARCHAR,
  tags: JSON,
  notes: TEXT,
  
  // Timestamps
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
}
```

---

## API Endpoints

### 1. CREATE Expense
```
POST /api/v1/stations/:stationId/expenses
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  category: "supplies",           // Required
  description: "Cleaning items",  // Required
  amount: 1700,                   // Required (₹)
  expenseDate: "2026-03-10",      // Optional (defaults to today)
  paymentMethod: "cash",          // Optional
  frequency: "one_time",          // Optional (defaults by category)
  receiptNumber: "INV-123",       // Optional
  tags: ["urgent", "vendor-abc"], // Optional
  notes: "For station cleaning"   // Optional
}

Response:
{
  success: true,
  data: {
    id: "uuid-123",
    stationId: "station-1",
    category: "supplies",
    description: "Cleaning items",
    amount: 1700,
    approvalStatus: "pending" | "auto_approved",
    // ...
    enteredByUser: { id, name, role, email },
    createdAt: "2026-03-10T15:00:00Z"
  }
}

Status Determined By:
* Manager/Owner/Super_Admin → approvalStatus: "auto_approved"
* Employee → approvalStatus: "pending"
```

### 2. APPROVE Individual Expense
```
PATCH /api/v1/expenses/:id/approve
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  action: "approve" | "reject",
  notes: "Looks good" // Optional
}

Response:
{
  success: true,
  data: {
    id: "uuid-123",
    approvalStatus: "approved" | "rejected",
    approvedBy: "user-uuid",
    approvedAt: "2026-03-11T09:00:00Z"
  },
  message: "Expense approved successfully"
}

Permission: Manager/Owner/Super_Admin only
```

### 3. BULK APPROVE Expenses ⭐ NEW
```
PATCH /api/v1/stations/:stationId/expenses/bulk-approve
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  approvalMode: "safe" | "all",
  skipExpenseIds: ["id1", "id2"] // Optional
}

Response:
{
  success: true,
  data: {
    approved: 3,
    skipped: 2,
    total: 5,
    approvalMode: "safe",
    skippedDetails: [
      {
        id: "uuid-456",
        reason: "High-risk: ₹15,000 (equipment)",
        amount: 15000,
        category: "equipment_purchase"
      },
      {
        id: "uuid-789",
        reason: "High-risk: ₹50,000 (salary)",
        amount: 50000,
        category: "salary"
      }
    ]
  },
  message: "Bulk approved 3 expense(s). 2 skipped for manual review."
}

Permission: Manager/Owner/Super_Admin only

Modes:
* safe: Auto-approves ≤₹10k OR category in [cleaning, supplies, maintenance]
* all: Approves everything (⚠️ returns approved count only)
```

### 4. LIST Expenses
```
GET /api/v1/stations/:stationId/expenses
  ?approvalStatus=pending
  &startDate=2026-03-01
  &endDate=2026-03-31
  &category=supplies
  &frequency=one_time
  &page=1
  &limit=50

Response:
{
  success: true,
  data: [
    {
      id: "uuid-123",
      category: "supplies",
      amount: 1700,
      approvalStatus: "pending",
      enteredByUser: { id, name, role },
      approvedByUser: null | { id, name, role }
    },
    // ...
  ],
  summary: {
    approvedTotal: 50000,
    pendingTotal: 1700,
    total: 50000, // backward compat
    byFrequency: [
      { frequency: "monthly", total: 30000, count: 3 },
      { frequency: "one_time", total: 20000, count: 2 }
    ],
    byCategory: [
      { category: "salary", label: "Salary", total: 25000 },
      { category: "supplies", label: "Supplies", total: 8300 }
    ]
  },
  pagination: {
    page: 1,
    limit: 50,
    total: 25,
    pages: 1
  }
}
```

---

## Code Flow: Create Expense

### Frontend (`src/pages/Expenses.tsx`)
```javascript
const mutation = useMutation({
  mutationFn: (data) =>
    apiClient.post(`/stations/${stationId}/expenses`, data),
  onSuccess: () => {
    toast.success('Expense recorded successfully');
    // Invalidate queries to refresh pending list
    queryClient.invalidateQueries({ 
      queryKey: ['expenses-pending', stationId] 
    });
    queryClient.invalidateQueries({ 
      queryKey: ['expense-summary', stationId] 
    });
  }
});

// User submits form
mutation.mutate({
  category: 'supplies',
  description: 'Cleaning items',
  amount: 1700,
  expenseDate: '2026-03-10',
  paymentMethod: 'cash',
  frequency: 'one_time',
  // ...
});
```

### Backend (`backend/src/controllers/expenseController.js`)
```javascript
const createExpense = async (req, res) => {
  const { stationId } = req.params;
  const { 
    category, description, amount, 
    expenseDate, paymentMethod, frequency, tags 
  } = req.body;

  // Role-based approval determination
  const role = req.user?.role || 'employee';
  const approvalStatus = 
    ['manager', 'owner', 'super_admin'].includes(role)
      ? EXPENSE_APPROVAL_STATUS.AUTO_APPROVED  // Instant ✅
      : EXPENSE_APPROVAL_STATUS.PENDING;        // Waiting ⏳

  // Create expense
  const expense = await Expense.create({
    stationId,
    category,
    description,
    amount,
    expenseDate: expenseDate || new Date().toISOString().split('T')[0],
    paymentMethod,
    frequency: frequency || EXPENSE_CATEGORY_FREQUENCY_MAP[category],
    tags: tags || null,
    createdBy: req.user.id,
    enteredBy: req.user.id,
    approvalStatus,
    // If manager: auto-approve
    approvedBy: approvalStatus === AUTO_APPROVED ? req.user.id : null,
    approvedAt: approvalStatus === AUTO_APPROVED ? new Date() : null
  });

  // Log to audit trail
  await logAudit({
    userId: req.user.id,
    action: 'CREATE',
    entityType: 'Expense',
    entityId: expense.id,
    // ...
  });

  res.json({ success: true, data: expense });
};
```

---

## Code Flow: Bulk Approve

### Frontend (`src/pages/Expenses.tsx`)
```javascript
const bulkApproveMutation = useMutation({
  mutationFn: ({ mode }) =>
    apiClient.patch(
      `/stations/${stationId}/expenses/bulk-approve`,
      { approvalMode: mode }
    ),
  onSuccess: (data) => {
    toast.success(
      `Approved ${data?.data?.approved} expense(s)`
    );
    if (data?.data?.skipped > 0) {
      toast.info(
        `${data.data.skipped} expense(s) skipped - review manually`
      );
    }
    // Refresh queries
    queryClient.invalidateQueries({ 
      queryKey: ['expenses-pending', stationId] 
    });
    queryClient.invalidateQueries({ 
      queryKey: ['expense-summary', stationId] 
    });
  }
});

// User clicks "Safe Auto-Approve"
<Button
  onClick={() => bulkApproveMutation.mutate({ mode: 'safe' })}
>
  Safe Auto-Approve
</Button>
```

### Backend (`backend/src/controllers/expenseController.js`)
```javascript
const bulkApproveExpenses = async (req, res) => {
  const { stationId } = req.params;
  const { approvalMode = 'safe', skipExpenseIds = [] } = req.body;

  // Get pending expenses
  const pending = await Expense.findAll({
    where: {
      stationId,
      approvalStatus: 'pending',
      id: { [Op.notIn]: skipExpenseIds }
    }
  });

  let approved = [];
  let skipped = [];

  if (approvalMode === 'safe') {
    // Smart filtering
    const SAFE_CATEGORIES = ['cleaning', 'supplies', 'maintenance'];
    const SAFE_LIMIT = 10000;

    for (const expense of pending) {
      const isSafe = 
        expense.amount <= SAFE_LIMIT ||
        SAFE_CATEGORIES.includes(expense.category);

      if (isSafe) {
        approved.push(expense);
      } else {
        skipped.push({
          id: expense.id,
          reason: `High-risk: ₹${expense.amount} (${expense.category})`,
          amount: expense.amount,
          category: expense.category
        });
      }
    }
  } else {
    // Approve all
    approved = pending;
  }

  // Update approved expenses
  for (const expense of approved) {
    expense.approvalStatus = 'approved';
    expense.approvedBy = req.user.id;
    expense.approvedAt = new Date();
    await expense.save();

    // Log each approval
    await logAudit({
      userId: req.user.id,
      action: 'BULK_APPROVE',
      entityType: 'Expense',
      entityId: expense.id,
      // ...
    });
  }

  res.json({
    success: true,
    data: {
      approved: approved.length,
      skipped: skipped.length,
      total: pending.length,
      approvalMode,
      skippedDetails: skipped
    },
    message: `Bulk approved ${approved.length} expense(s)...`
  });
};
```

---

## Safe Mode Logic

```javascript
const SAFE_LIMIT = 10000;
const SAFE_CATEGORIES = ['cleaning', 'supplies', 'maintenance'];

function isSafeExpense(expense) {
  const byAmount = expense.amount <= SAFE_LIMIT;
  const byCategory = SAFE_CATEGORIES.includes(expense.category);
  
  return byAmount || byCategory;
  // APPROVED if: ≤₹10k OR safe category
  // SKIPPED if: >₹10k AND not safe category
}

// Examples:
isSafeExpense({ amount: 800, category: 'other' })
  → TRUE (amount ≤ 10k)

isSafeExpense({ amount: 2500, category: 'supplies' })
  → TRUE (both safe)

isSafeExpense({ amount: 15000, category: 'supplies' })
  → FALSE (amount > 10k, even though safe category)
  
isSafeExpense({ amount: 50000, category: 'salary' })
  → FALSE (both unsafe)

isSafeExpense({ amount: 5000, category: 'cleaning' })
  → TRUE (both safe)
```

---

## Status Constants

```javascript
// File: backend/src/config/constants.js
const EXPENSE_APPROVAL_STATUS = {
  PENDING: 'pending',          // Waiting for approval
  APPROVED: 'approved',        // Manually approved by manager
  AUTO_APPROVED: 'auto_approved', // Auto-approved (manager entry)
  REJECTED: 'rejected'         // Rejected by manager
};

// Counting Rules
const COUNTED_IN_REPORTS = [
  'approved',
  'auto_approved'
];

const NOT_COUNTED = [
  'pending',
  'rejected'
];
```

---

## Database Queries

### Get Pending Expenses
```SQL
SELECT * FROM expenses
WHERE station_id = ? 
  AND approval_status = 'pending'
ORDER BY created_at DESC;
```

### Get Approved Total (for summary)
```SQL
SELECT SUM(amount) as total
FROM expenses
WHERE station_id = ? 
  AND approval_status IN ('approved', 'auto_approved')
  AND DATE(expense_date) = ?;
```

### Bulk Approve Query
```SQL
UPDATE expenses
SET approval_status = 'approved',
    approved_by = ?,
    approved_at = NOW()
WHERE station_id = ? 
  AND approval_status = 'pending'
  AND id NOT IN (?)
  AND (amount <= 10000 
       OR category IN ('cleaning', 'supplies', 'maintenance'));
```

---

## Error Handling

### Invalid Approval Action
```javascript
if (!['approve', 'reject'].includes(action)) {
  return res.status(400).json({
    success: false,
    error: { message: "action must be 'approve' or 'reject'" }
  });
}
```

### Already Processed
```javascript
if (expense.approvalStatus !== 'pending') {
  return res.status(400).json({
    success: false,
    error: { 
      message: `Expense is already ${expense.approvalStatus}` 
    }
  });
}
```

### Permission Denied
```javascript
// Middleware blocks unauthorized access
if (!['manager', 'owner', 'super_admin'].includes(req.user?.role)) {
  return res.status(403).json({
    success: false,
    error: { message: 'Insufficient permissions' }
  });
}
```

---

## Logging & Audit Trail

Every approval is logged:
```javascript
await logAudit({
  userId: req.user.id,
  userEmail: req.user.email,
  userRole: req.user.role,
  stationId: expense.stationId,
  action: 'APPROVE', // or 'BULK_APPROVE', 'REJECT'
  entityType: 'Expense',
  entityId: expense.id,
  oldValues: { approvalStatus: 'pending' },
  newValues: { 
    approvalStatus: 'approved',
    approvedBy: req.user.id 
  },
  category: 'finance',
  severity: 'info',
  description: `Approved: ${expense.description} (₹${expense.amount})`
});
```

---

## Testing Checklist

- [ ] **Create Expense Tests**
  - [ ] Employee creates → pending
  - [ ] Manager creates → auto_approved
  - [ ] Owner creates → auto_approved
  
- [ ] **Approve Individual Tests**
  - [ ] Manager can approve pending
  - [ ] Manager can reject pending
  - [ ] Cannot approve non-pending
  - [ ] Cannot approve as employee
  
- [ ] **Bulk Approve Tests**
  - [ ] Safe mode skips high-risk
  - [ ] Safe mode approves safe
  - [ ] All mode approves everything
  - [ ] Requires confirmation
  
- [ ] **Query Tests**
  - [ ] List pending only
  - [ ] Summary calculations correct
  - [ ] No double-counting
  
- [ ] **Audit Trail Tests**
  - [ ] Every action logged
  - [ ] Correct timestamps
  - [ ] User info recorded

---

## Performance Considerations

- **Indexes:** expense_status, station_id, expense_date
- **Pagination:** Default limit=50 to prevent large data loads
- **Queries:** Use findAndCountAll() for pagination
- **Bulk Operations:** Process in batches for large lists

---

## Security Considerations

✅ **Authentication:** All routes require Bearer token
✅ **Authorization:** Role-based access control on approval routes
✅ **Validation:** Category whitelist, amount validation
✅ **Audit Trail:** All actions logged with user info
✅ **Immutability:** Approvals are final (no edits)

---

**Last Updated:** March 11, 2026  
**Technical Reference v1.0**
