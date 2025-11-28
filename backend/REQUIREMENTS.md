# FuelSync Requirements Document

## Problem Statement

Indian fuel station owners need a simple, reliable way to track **nozzle readings**, manage **credit sales**, and understand their **profit/loss**. The main pain points are:

1. **Manual calculation errors** - Calculating litres sold and sale amounts by hand
2. **Theft detection** - Identifying discrepancies between expected and actual sales
3. **Credit tracking** - Many customers (transporters, companies) buy fuel on credit
4. **Expense management** - No clear view of daily expenses and profitability
5. **Payment tracking** - Separating cash, UPI, card, and credit payments
6. **No historical data** - Paper records are hard to analyze

## Solution: Digital Station Management

Replace paper logbooks with a mobile-friendly web app:
- Employee enters nozzle reading → system auto-calculates sales
- Manager can add creditors and record credit sales
- Owner can track expenses, enter cost of goods, view profit/loss
- Dashboard shows real-time analytics

---

## Core Concepts

### Nozzle Reading Flow

```
PREVIOUS READING: 12345.67 (from last entry)
CURRENT READING:  12400.50 (entered by employee)
─────────────────────────────────────────
LITRES SOLD:      54.83 (auto-calculated)
FUEL PRICE:       ₹95.50 (from station settings)
SALE AMOUNT:      ₹5,236.27 (auto-calculated)

PAYMENT BREAKDOWN:
  CASH:           ₹3,500.00 (entered)
  UPI:            ₹1,000.00 (entered)
  CREDIT:         ₹736.27 (selected creditor)
```

### Credit System Flow

```
1. Manager adds CREDITOR (e.g., "ABC Transporters")
   - Name, contact, credit limit

2. During sale, employee selects creditor
   - 10L diesel on credit to "ABC Transporters"
   - Uses today's price (₹95.50)
   - Amount: ₹955 added to creditor balance

3. Owner views outstanding credits
   - ABC Transporters: ₹25,000 outstanding

4. When creditor pays, owner records SETTLEMENT
   - Settlement: ₹20,000 received
   - New balance: ₹5,000
```

### Profit/Loss Calculation

```
MONTHLY PROFIT/LOSS REPORT
══════════════════════════════════════════

REVENUE
  Total Sales:           ₹15,00,000
  Cash Received:         ₹10,00,000
  Online (UPI/Card):     ₹3,50,000
  Credit Settlements:    ₹1,00,000
  Total Received:        ₹14,50,000

CREDITS
  Given This Month:      ₹80,000
  Total Outstanding:     ₹1,50,000

COSTS
  Cost of Goods:         ₹13,50,000 (owner enters at month end)
  Expenses:              ₹75,000
    - Salary: ₹45,000
    - Electricity: ₹15,000
    - Maintenance: ₹10,000
    - Misc: ₹5,000

PROFIT
  Gross Profit:          ₹1,50,000
  Net Profit:            ₹75,000
  Profit Margin:         5%
```

---

## User Roles

### Super Admin
- System administrator
- Manage all stations and users
- Configure plans and limits
- Access all data across platform

### Owner
- Owns one or more fuel stations
- Create/manage stations
- Add pumps, nozzles, set fuel prices
- Add employees and managers
- View all analytics and nozzle-wise sales
- Manage creditors and settlements
- Enter cost of goods and view profit/loss
- Export data

### Manager
- Assigned to one station
- Set/update fuel prices
- Add creditors and record credit sales
- Enter daily expenses
- View station analytics
- Edit/delete readings

### Employee
- Assigned to one station
- Enter nozzle readings only
- Can select creditor during sale (if credit)
- View own entries
- Cannot delete entries

---

## Features by Priority

### P0: Must Have (MVP)
- [x] User login (email/password)
- [x] Create station with pumps and nozzles
- [x] Set fuel prices (by manager/owner)
- [x] Enter nozzle readings
- [x] Auto-calculate sales
- [x] Payment split (cash/online/credit)
- [x] View daily readings

### P1: Important
- [x] Dashboard summary (today's totals)
- [x] Role-based access control
- [x] Creditor management
- [x] Credit sales tracking
- [x] Settlement recording
- [x] Daily expense entry
- [x] Nozzle-wise analytics
- [x] Pump-wise analytics
- [x] Fuel-wise breakdown

### P2: Nice to Have
- [x] Profit/loss statement
- [x] Cost of goods entry
- [x] Financial overview
- [ ] Export to CSV/Excel
- [ ] Multiple stations per owner
- [ ] Backdated entries (within limits)

### P3: Future
- [ ] Tank level tracking (dip readings)
- [ ] Fuel delivery tracking
- [ ] Variance alerts
- [ ] Mobile app (React Native)
- [ ] SMS notifications

---

## Data Model

### Plans
```
id, name, description
maxStations, maxPumpsPerStation, maxNozzlesPerPump
maxEmployees, maxCreditors
backdatedDays, analyticsDays
canExport, canTrackExpenses, canTrackCredits, canViewProfitLoss
priceMonthly, priceYearly
features (JSONB - extensible)
```

### Stations
```
id, ownerId, planId, name
address (JSONB: street, city, state, pincode)
contact (JSONB: phone, email)
settings (JSONB: timezone, currency, etc.)
isActive, createdAt
```

### Users
```
id, stationId (nullable for super_admin/owner), planId
email, password (hashed), name, role
phone, isActive, createdAt
planExpiresAt, gracePeriodEndsAt (for downgrades)
```

### Pumps
```
id, stationId, pumpNumber, name, location
status (active/inactive/maintenance)
```

### Nozzles
```
id, pumpId, stationId (denormalized), nozzleNumber, label
fuelType (petrol/diesel/premium_petrol/premium_diesel/cng/lpg)
status, initialReading, lastReading, lastReadingDate
```

### FuelPrices
```
id, stationId, fuelType, price, validFrom
```

### NozzleReadings (Core Table)
```
id, nozzleId, stationId, pumpId (denormalized), enteredBy
readingDate, readingValue, previousReading
litresSold, pricePerLitre, totalAmount
paymentBreakdown (JSONB: {cash: X, upi: Y, card: Z, credit: W})
cashAmount, onlineAmount, creditAmount
creditorId (if credit sale), fuelType (denormalized)
isInitialReading, notes
```

### Creditors
```
id, stationId, name, contactPerson, phone, email, address
businessName, gstNumber
creditLimit, currentBalance
isActive, notes, createdBy
```

### CreditTransactions
```
id, stationId, creditorId
transactionType (credit/settlement)
fuelType, litres, pricePerLitre, amount
transactionDate, vehicleNumber, referenceNumber
nozzleReadingId (if linked to a reading)
notes, enteredBy
```

### Expenses
```
id, stationId
category (salary/electricity/rent/maintenance/supplies/taxes/insurance/transportation/miscellaneous)
description, amount, expenseDate, expenseMonth
receiptNumber, paymentMethod
notes, enteredBy
```

### CostOfGoods
```
id, stationId, month (YYYY-MM)
fuelType, litresPurchased, totalCost, avgCostPerLitre
supplierName, invoiceNumbers (JSONB array)
notes, enteredBy
```

---

## API Endpoints

### Authentication
```
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/auth/refresh
```

### Readings (Core)
```
GET  /api/v1/readings/form/:nozzleId    # Get form data
POST /api/v1/readings                    # Submit reading
GET  /api/v1/readings/daily/:date        # Daily readings
PUT  /api/v1/readings/:id/payment        # Update payment
DELETE /api/v1/readings/:id              # Delete (manager+)
```

### Dashboard
```
GET /api/v1/dashboard/summary            # Today's totals
GET /api/v1/dashboard/daily              # Date range
GET /api/v1/dashboard/fuel-breakdown     # By fuel type
GET /api/v1/dashboard/pump-performance   # By pump
GET /api/v1/dashboard/nozzle-breakdown   # By nozzle (owner+)
GET /api/v1/dashboard/financial-overview # Revenue/costs/profit (owner+)
```

### Credits
```
GET  /api/v1/stations/:id/creditors      # List creditors
POST /api/v1/stations/:id/creditors      # Add creditor
GET  /api/v1/creditors/:id               # Get with transactions
PUT  /api/v1/creditors/:id               # Update creditor
POST /api/v1/stations/:id/credits        # Record credit sale
POST /api/v1/stations/:id/creditors/:id/settle  # Record settlement
GET  /api/v1/stations/:id/credit-transactions   # List transactions
GET  /api/v1/stations/:id/credit-summary        # Dashboard summary
```

### Expenses
```
GET  /api/v1/expense-categories          # List categories
GET  /api/v1/stations/:id/expenses       # List expenses
POST /api/v1/stations/:id/expenses       # Add expense
PUT  /api/v1/expenses/:id                # Update
DELETE /api/v1/expenses/:id              # Delete
GET  /api/v1/stations/:id/expense-summary # By category
GET  /api/v1/stations/:id/cost-of-goods  # Get COG
POST /api/v1/stations/:id/cost-of-goods  # Set COG
GET  /api/v1/stations/:id/profit-loss    # P/L statement
```

### Station Management
```
GET  /api/v1/stations
POST /api/v1/stations
GET  /api/v1/stations/:id
PUT  /api/v1/stations/:id
GET  /api/v1/stations/:id/pumps
POST /api/v1/stations/:id/pumps
POST /api/v1/stations/:id/pumps/:pumpId/nozzles
POST /api/v1/stations/:id/prices
```

---

## Plan Downgrade Handling

**Problem:** User with 5 pumps downgrades to Free plan (max 2 pumps). What happens?

**Solution: Soft Limits with Grace Period**

1. **On Downgrade:**
   - User gets 30-day grace period
   - All existing data remains accessible (VIEW)
   - Cannot ADD new resources over limit

2. **During Grace Period:**
   - Warning banner: "Please reduce pumps from 5 to 2"
   - Can delete pumps to comply
   - All readings continue to work

3. **After Grace Period:**
   - If still over limit: account becomes read-only
   - Must upgrade or delete excess resources
   - Data is never deleted automatically

4. **Implementation:**
   - `gracePeriodEndsAt` field on User
   - Middleware checks limit on CREATE operations
   - Dashboard shows warning if over limit

---

## Expandable Configuration

All types are defined in `src/config/constants.js` for easy expansion:

```javascript
// Add new fuel type
FUEL_TYPES: {
  PETROL: 'petrol',
  DIESEL: 'diesel',
  LPG: 'lpg',      // ← Just add here
  CNG: 'cng',
}

// Add new payment method
PAYMENT_METHODS: {
  CASH: 'cash',
  UPI: 'upi',
  CARD: 'card',
  FLEET_CARD: 'fleet_card',  // ← Just add here
}

// Add new expense category
EXPENSE_CATEGORIES: {
  SALARY: 'salary',
  ELECTRICITY: 'electricity',
  FUEL_ALLOWANCE: 'fuel_allowance',  // ← Just add here
}
```

---

## What We're NOT Doing

| Feature | Reason |
|---------|--------|
| OCR/Image Upload | Adds complexity, manual entry is simple enough |
| Tank Level Tracking | No meters on tanks - would need physical sensors |
| Automatic POS Integration | Each station has different systems |
| Real-time Sync | Over-engineering for this use case |
| Complex Shift Management | Keep it simple - just track readings |

---

## Technical Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **ORM**: Sequelize (auto-sync tables)
- **Auth**: JWT + bcrypt
- **Validation**: Joi
- **Security**: Helmet, rate limiting, CORS
- **Currency**: Indian Rupee (₹)

---

## Success Metrics

1. **Accuracy**: Sales calculated correctly 100% of time
2. **Adoption**: Employees can enter readings in < 30 seconds
3. **Visibility**: Owners can see today's sales in 1 click
4. **Credit Tracking**: All outstanding balances visible
5. **Profitability**: Monthly P/L available by 1st of next month
