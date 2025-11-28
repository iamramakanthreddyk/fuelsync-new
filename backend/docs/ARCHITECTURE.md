# FuelSync Backend Architecture

## Overview

FuelSync is a fuel station management system designed for Indian gas stations. It tracks nozzle readings, manages credit customers, tracks expenses, and provides profit/loss analytics.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FUELSYNC ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Mobile    │    │    Web      │    │   Admin     │                 │
│  │    App      │    │   Portal    │    │   Panel     │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                  │                         │
│         └──────────────────┼──────────────────┘                         │
│                            │                                            │
│                            ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      API GATEWAY (Express)                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
│  │  │  Auth    │  │  Rate    │  │  CORS    │  │  Helmet  │        │   │
│  │  │Middleware│  │ Limiter  │  │          │  │ Security │        │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                            │                                            │
│                            ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         ROUTE LAYER                              │   │
│  │  /auth  /users  /stations  /readings  /dashboard  /credits      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                            │                                            │
│                            ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      CONTROLLER LAYER                            │   │
│  │  Business logic, validation, response formatting                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                            │                                            │
│                            ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        MODEL LAYER                               │   │
│  │  Sequelize ORM - PostgreSQL                                      │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │  User  │ │Station │ │ Pump   │ │ Nozzle │ │Reading │        │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │Creditor│ │CreditTx│ │Expense │ │  COG   │ │  Plan  │        │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                            │                                            │
│                            ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       PostgreSQL                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
backend/
├── src/                          # Source code (main application)
│   ├── app.js                    # Express app configuration
│   ├── server.js                 # Entry point, starts server
│   │
│   ├── config/
│   │   ├── constants.js          # All configurable constants
│   │   └── database.js           # Database configuration
│   │
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication & role verification
│   │   └── stationAccess.js      # Station ownership verification
│   │
│   ├── models/
│   │   ├── index.js              # Model registry, associations, sync
│   │   ├── Plan.js               # Subscription plans
│   │   ├── User.js               # User accounts (all roles)
│   │   ├── Station.js            # Fuel stations
│   │   ├── Pump.js               # Pump machines
│   │   ├── Nozzle.js             # Fuel nozzles
│   │   ├── FuelPrice.js          # Price history
│   │   ├── NozzleReading.js      # Core sales data
│   │   ├── Creditor.js           # Credit customers
│   │   ├── CreditTransaction.js  # Credit sales & settlements
│   │   ├── Expense.js            # Daily expenses
│   │   └── CostOfGoods.js        # Monthly fuel purchase costs
│   │
│   ├── controllers/
│   │   ├── authController.js     # Login, register, token refresh
│   │   ├── userController.js     # User CRUD
│   │   ├── stationController.js  # Station, pump, nozzle management
│   │   ├── readingController.js  # Nozzle reading entry
│   │   ├── dashboardController.js# Analytics & reports
│   │   ├── creditController.js   # Credit management
│   │   └── expenseController.js  # Expense & P/L tracking
│   │
│   └── routes/
│       ├── auth.js
│       ├── users.js
│       ├── stations.js
│       ├── readings.js
│       ├── dashboard.js
│       ├── credits.js
│       └── expenses.js
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # This file
│   ├── ACCESS_RULES.md           # Role permissions matrix
│   ├── API_REFERENCE.md          # Complete API documentation
│   └── EXPANSION_GUIDE.md        # How to add new features
│
├── database/                     # SQL reference files
├── scripts/                      # Utility scripts
│   └── cleanup.js                # Move old files to _deprecated
│
├── _deprecated/                  # Old code (safe to delete)
│
├── package.json
├── .env                          # Environment configuration
├── .env.example                  # Environment template
├── README.md
└── REQUIREMENTS.md               # Business requirements
```

---

## Core Concepts

### 1. Multi-Tenant Architecture

The system supports multiple station owners, each with multiple stations:

```
SUPER_ADMIN (Platform)
    │
    ├── OWNER A (Plan: Premium)
    │   ├── Station 1
    │   │   ├── Manager
    │   │   └── Employees
    │   └── Station 2
    │       ├── Manager
    │       └── Employees
    │
    └── OWNER B (Plan: Basic)
        └── Station 3
            └── Employees
```

### 2. Role Hierarchy

```javascript
const ROLE_HIERARCHY = {
  'employee': 1,    // Can enter readings
  'manager': 2,     // + prices, creditors, expenses
  'owner': 3,       // + P&L, cost of goods, create stations
  'super_admin': 4  // + create owners, see all data
};
```

### 3. Station Access Pattern

```javascript
// For OWNER: Access via ownership
SELECT * FROM stations WHERE owner_id = :userId

// For MANAGER/EMPLOYEE: Access via assignment
SELECT * FROM stations WHERE id = :userStationId
```

---

## Data Flow

### Reading Entry Flow

```
Employee opens app
        │
        ▼
GET /readings/form/:nozzleId
        │ Returns: previousReading, currentPrice, nozzle info
        ▼
Employee enters current reading
        │
        ▼
POST /readings
        │ Calculates: litresSold = current - previous
        │ Calculates: amount = litres × price
        │ Payment split: cash + online + credit = total
        ▼
If credit sale → Create CreditTransaction
        │ Update Creditor.currentBalance
        ▼
Update Nozzle.lastReading
        │
        ▼
Reading saved ✓
```

### Credit Flow

```
Manager adds Creditor
        │
        ▼
Employee makes credit sale
        │ POST /stations/:id/credits
        ▼
CreditTransaction created (type: 'credit')
        │ Creditor.currentBalance += amount
        ▼
Owner views outstanding
        │ GET /stations/:id/credit-summary
        ▼
Creditor pays
        │ POST /stations/:id/creditors/:id/settle
        ▼
CreditTransaction created (type: 'settlement')
        │ Creditor.currentBalance -= amount
        ▼
Balance updated ✓
```

### Profit/Loss Calculation

```
GET /stations/:id/profit-loss?month=2025-11

Revenue:
  + Total Sales (from NozzleReading.totalAmount)
  
Cash Received:
  + Cash Amount (from NozzleReading.cashAmount)
  + Online Amount (from NozzleReading.onlineAmount)
  + Credit Settlements (from CreditTransaction type='settlement')

Costs:
  - Cost of Goods (from CostOfGoods.totalCost)
  - Expenses (from Expense.amount)

Profit:
  = Revenue - Cost of Goods - Expenses
```

---

## Key Design Decisions

### 1. Denormalized Fields for Performance

```javascript
// NozzleReading has denormalized fields
{
  nozzleId: UUID,
  pumpId: UUID,      // Denormalized from Nozzle
  stationId: UUID,   // Denormalized from Pump
  fuelType: STRING   // Denormalized from Nozzle
}
```
**Why?** Dashboard queries aggregate by pump/station/fuel without JOINs.

### 2. Expandable Constants

```javascript
// src/config/constants.js
const FUEL_TYPES = {
  PETROL: 'petrol',
  DIESEL: 'diesel',
  // Add new fuel type here:
  LPG: 'lpg'
};
```
**Why?** Single source of truth, easy to add new types.

### 3. Soft Deletes

```javascript
// Users are never hard-deleted
user.isActive = false;
```
**Why?** Preserve audit trail, readings still reference user.

### 4. Plan-Based Limits

```javascript
// Checked at resource creation
if (stationCount >= plan.maxStations) {
  throw new Error('Plan limit reached');
}
```
**Why?** SaaS monetization, feature gating.

---

## Security Measures

| Layer | Protection |
|-------|------------|
| Network | Helmet security headers, CORS |
| Rate | 100 requests / 15 min per IP |
| Auth | JWT with 24h expiry |
| Password | bcrypt with 12 rounds |
| Access | Role middleware on every route |
| Data | Station ownership verification |

---

## Database Schema Summary

```sql
-- Core hierarchy
plans (subscription tiers)
users (all roles, stationId for staff)
stations (ownerId links to owner user)
pumps (stationId)
nozzles (pumpId)
fuel_prices (stationId, fuelType)

-- Transactions
nozzle_readings (core sales data)
creditors (credit customers per station)
credit_transactions (credit sales & settlements)
expenses (daily expenses per station)
cost_of_goods (monthly fuel costs per station)
```

---

## API Response Format

All endpoints return consistent format:

```javascript
// Success
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}

// Error
{
  "success": false,
  "error": "Error message",
  "details": ["Optional array of details"]
}

// Paginated
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## Environment Variables

```env
# Server
NODE_ENV=development|production
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fuelsync
DB_USER=postgres
DB_PASSWORD=secret

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Getting Started

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Start development server
npm run dev
# Server auto-creates tables and seeds default data

# 4. Default login
# Email: admin@fuelsync.com
# Password: admin123
```

---

## Next Steps

See:
- `ACCESS_RULES.md` - Complete permissions matrix
- `API_REFERENCE.md` - All endpoints with examples
- `EXPANSION_GUIDE.md` - How to add new features
