# API Documentation

## Module: Readings (Req #1)
**Purpose**: Handle quick reading entry with employee attribution

### Endpoints

#### POST `/api/v1/stations/:stationId/readings`
Create a new reading (supports Req #1: assignedEmployeeId)

**Request Body**:
```json
{
  "nozzleId": "uuid",
  "readingDate": "2025-03-07",
  "readingValue": 105.5,
  "previousReading": 90.0,
  "fuelType": "petrol",
  "pricePerLitre": 105,
  "totalAmount": 10500,
  "paymentMethod": "cash",
  "assignedEmployeeId": "uuid (optional) - Req #1: if set, reading belongs to this employee",
  "paymentSubBreakdown": "object (optional) - Req #2: detailed payment breakdown"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nozzleId": "uuid",
    "readingDate": "2025-03-07",
    "litresSold": 15,
    "enteredBy": "uuid",
    "assignedEmployeeId": "uuid (null if self-entry)",
    "effectiveEmployee": "uuid (assignedEmployeeId || enteredBy)",
    "wasEnteredOnBehalf": true
  }
}
```

#### GET `/api/v1/stations/:stationId/readings`
List readings with optional filtering

**Query Parameters**:
- `employeeId`: Filter readings for specific employee (assigned OR entered by)
- `startDate`: YYYY-MM-DD
- `endDate`: YYYY-MM-DD
- `limit`: Default 50, max 500
- `offset`: Pagination offset

#### GET `/api/v1/employees/:employeeId/readings?stationId=uuid`
Get readings attributed to an employee (Req #1)

#### GET `/api/v1/stations/:stationId/readings/attribution-stats?month=YYYY-MM`
Get attribution statistics (% self-entered vs on-behalf)

---

## Module: Payments (Req #2)
**Purpose**: Manage payment methods and online sub-types (UPI, Card, Oil Company)

### Endpoints

#### GET `/api/v1/payments/methods`
List all payment methods and subtypes (Req #2)

**Response**:
```json
{
  "success": true,
  "data": {
    "paymentMethods": [
      { "id": "cash", "type": "cash", "label": "Cash" },
      { "id": "upi", "type": "online", "label": "UPI" },
      { "id": "card", "type": "online", "label": "Debit / Credit Card" },
      { "id": "oil_company", "type": "online", "label": "Oil Company Card" },
      { "id": "credit", "type": "credit", "label": "Credit" }
    ],
    "subtypes": {
      "upi": {
        "category": "upi",
        "items": [
          { "id": "gpay", "label": "Google Pay" },
          { "id": "phonepe", "label": "PhonePe" },
          { "id": "paytm", "label": "Paytm" },
          { "id": "amazon_pay", "label": "Amazon Pay" },
          { "id": "cred", "label": "CRED" },
          { "id": "bhim", "label": "BHIM" },
          { "id": "other_upi", "label": "Other UPI" }
        ]
      },
      "card": {
        "category": "card",
        "items": [
          { "id": "debit_card", "label": "Debit Card" },
          { "id": "credit_card", "label": "Credit Card" }
        ]
      },
      "oil_company": {
        "category": "oil_company",
        "items": [
          { "id": "hp_pay", "label": "HP Pay" },
          { "id": "iocl_card", "label": "IOCL Card" },
          { "id": "bpcl_smartfleet", "label": "BPCL SmartFleet" },
          { "id": "essar_fleet", "label": "Essar Fleet" },
          { "id": "reliance_fleet", "label": "Reliance Fleet" },
          { "id": "other_oil_company", "label": "Other Oil Company Card" }
        ]
      }
    }
  }
}
```

#### POST `/api/v1/payments/validate-breakdown`
Validate payment sub-breakdown (Req #2)

**Request Body**:
```json
{
  "breakdown": {
    "cash": 5000,
    "upi": { "gpay": 1200, "phonepe": 800 },
    "card": { "debit_card": 500, "credit_card": 300 },
    "oil_company": { "hp_pay": 1000 },
    "credit": 500
  },
  "totalAmount": 9300
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "calculatedTotal": 9300
  }
}
```

---

## Module: Expenses (Req #3)
**Purpose**: Track daily/monthly expenses with approval workflow and net profit integration

### Endpoints

#### POST `/api/v1/stations/:stationId/expenses`
Create a new expense (Req #3)

**Request Body**:
```json
{
  "category": "salary (or electricity, rent, maintenance, etc)",
  "description": "Monthly salary for staff",
  "amount": 50000,
  "expenseDate": "2025-03-07",
  "frequency": "monthly (one_time, daily, weekly, monthly)",
  "paymentMethod": "cash (or online, card)",
  "receiptNumber": "INV-001",
  "tags": ["payroll", "march"],
  "notes": "Paid on 7th"
}
```

**Auto-Approval Logic**:
- **Employee enters**: `approvalStatus = 'pending'` (needs manager/owner approval)
- **Manager/Owner enters**: `approvalStatus = 'auto_approved'` (automatically approved)

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "category": "salary",
    "description": "Monthly salary for staff",
    "amount": 50000,
    "expenseDate": "2025-03-07",
    "frequency": "monthly",
    "approvalStatus": "auto_approved",
    "enteredBy": "uuid",
    "approvedBy": "uuid",
    "approvedAt": "2025-03-07T10:00:00Z"
  }
}
```

#### GET `/api/v1/stations/:stationId/expenses`
List expenses with filtering

**Query Parameters**:
- `approvalStatus`: pending, approved, auto_approved, rejected
- `category`: expense category
- `frequency`: daily, weekly, monthly, one_time
- `month`: YYYY-MM (for monthly summary)
- `limit`: Default 50, max 500
- `offset`: Pagination

#### PATCH `/api/v1/expenses/:id/approve`
Approve or reject a pending expense (Req #3)

**Request Body**:
```json
{
  "action": "approve or reject",
  "reason": "optional reason for rejection"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "approvalStatus": "approved",
    "approvedBy": "uuid",
    "approvedAt": "2025-03-07T10:00:00Z"
  }
}
```

#### GET `/api/v1/stations/:stationId/expense-summary?period=monthly&month=2025-03`
Get expense summary (Req #3)

**Query Parameters**:
- `period`: daily or monthly (required)
- `date`: YYYY-MM-DD (required if period=daily)
- `month`: YYYY-MM (required if period=monthly)

**Response**:
```json
{
  "success": true,
  "data": {
    "period": "monthly",
    "month": "2025-03",
    "approvedTotal": 150000,
    "pendingTotal": 10000,
    "pendingCount": 5,
    "byCategory": [
      { "category": "salary", "label": "Salary", "total": 100000, "count": 1 },
      { "category": "electricity", "label": "Electricity", "total": 30000, "count": 1 },
      { "category": "supplies", "label": "Supplies", "total": 20000, "count": 3 }
    ],
    "byFrequency": [
      { "frequency": "monthly", "total": 130000, "count": 2 },
      { "frequency": "one_time", "total": 20000, "count": 3 }
    ]
  }
}
```

#### GET `/api/v1/expenses/categories`
List expense categories and frequencies

**Response**:
```json
{
  "success": true,
  "data": {
    "categories": [
      { "id": "salary", "label": "Salary" },
      { "id": "electricity", "label": "Electricity" },
      { "id": "rent", "label": "Rent / Lease" },
      ...
    ],
    "frequencies": [
      { "id": "daily", "label": "Daily" },
      { "id": "weekly", "label": "Weekly" },
      { "id": "monthly", "label": "Monthly" },
      { "id": "one_time", "label": "One Time" }
    ]
  }
}
```

---

## Module: Reports (Req #3)
**Purpose**: Calculate net profit = Revenue - COGS - Approved Expenses

### Endpoints

#### GET `/api/v1/stations/:stationId/profit-summary?month=2025-03`
Get monthly profit summary with expense deduction (Req #3)

**Response**:
```json
{
  "success": true,
  "data": {
    "month": "2025-03",
    "summary": {
      "totalRevenue": 300000,
      "totalCostOfGoods": 120000,
      "totalExpenses": 75000,
      "pendingExpenses": 10000,
      "grossProfit": 180000,
      "netProfit": 105000,
      "profitMargin": 35.0,
      "profitPerLitre": 35.0
    },
    "breakdown": {
      "byExpenseCategory": [
        { "category": "salary", "amount": 50000 },
        { "category": "electricity", "amount": 15000 },
        { "category": "rent", "amount": 10000 }
      ]
    },
    "dataCompleteness": {
      "totalReadings": 3000,
      "readingsUsedForCalculation": 2950,
      "completenessPercentage": 98.33
    }
  }
}
```

#### GET `/api/v1/stations/:stationId/profit-daily?date=2025-03-07`
Get daily profit (Req #3)

#### GET `/api/v1/stations/:stationId/profit-trend?startDate=2025-01-01&endDate=2025-03-31&period=monthly`
Get net profit trend over period

**Query Parameters**:
- `startDate`: YYYY-MM-DD (required)
- `endDate`: YYYY-MM-DD (required)
- `period`: daily or monthly

**Response**:
```json
{
  "success": true,
  "data": {
    "period": "monthly",
    "totals": {
      "totalRevenue": 900000,
      "totalExpenses": 225000,
      "netProfit": 315000,
      "avgProfitMargin": 35.0
    },
    "trends": [
      { "date": "2025-01", "revenue": 300000, "expenses": 75000, "netProfit": 105000 },
      { "date": "2025-02", "revenue": 300000, "expenses": 75000, "netProfit": 105000 },
      { "date": "2025-03", "revenue": 300000, "expenses": 75000, "netProfit": 105000 }
    ]
  }
}
```

---

## Key Features

### Req #1: Employee Attribution
- Manager/Owner can enter reading on behalf of employee
- System tracks `enteredBy` (who entered) vs `assignedEmployeeId` (whose responsibility)
- Dashboard shows attribution stats

### Req #2: Online Payment Sub-Types
- 7 UPI types: GPay, PhonePe, Paytm, Amazon Pay, CRED, BHIM, Other
- 2 Card types: Debit Card, Credit Card
- 6 Oil Company types: HP Pay, IOCL, BPCL SmartFleet, Essar Fleet, Reliance Fleet, Other
- Breakdown is stored at transaction level and collapsed for reporting

### Req #3: Expense Tracking & Net Profit
- Employees enter expenses (pending approval) → Manager/Owner approves
- Managers/Owners auto-approve their own entries
- Expenses grouped by category, frequency, and date range
- **Net Profit = Gross Profit - Approved Expenses**
- Pending expenses shown for transparency but excluded from net profit calculation

---

## Requirements Coverage

| Requirement | Module | Status | Key Features |
|-----------|--------|--------|--------------|
| Req #1: Employee Attribution | Readings | ✅ Complete | assignedEmployeeId field, manager/owner on-behalf entry, attribution stats |
| Req #2: Online Sub-Types | Payments | ✅ Complete | UPI/Card/OilCompany breakdown, validation, detailed tracking |
| Req #3: Expense Tracking | Expenses | ✅ Complete | CRUD, approval workflow, category/frequency grouping |
| Req #3: Net Profit | Reports | ✅ Complete | Revenue - COGS - Approved Expenses, pending visibility, trending |

