# 🎰 FuelSync Quick Reference Card

## 3-Part System

| Part | Technology | Location | Purpose |
|------|-----------|----------|---------|
| **Frontend** | React + Vite | `/src` | User interface |
| **Backend** | Node.js + Express | `/backend` | API server |
| **Database** | PostgreSQL | Railway Postgres | Data storage |

---

## Single Backend URL (All API calls use this)

```
Frontend reads:  import.meta.env.VITE_API_URL
Defined in:     .env files (not code!)
Development:    http://localhost:3001/api/v1
Production:     https://fuelsync-new-production.up.railway.app/api/v1
```

**All API calls go through**: `/src/lib/api-client.ts`

---

## Environment Variables

### Frontend (.env / .env.local)
```env
VITE_API_URL=http://localhost:3001/api/v1  # Dev
# VITE_API_URL=https://fuelsync-new-production.up.railway.app/api/v1  # Prod
```

### Backend (/backend/.env)
```env
NODE_ENV=development
PORT=3001
DB_DIALECT=sqlite
```

### Railway (Dashboard - Set These)
```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
CORS_ORIGINS=https://fuelsync-new.vercel.app,http://localhost:5173
DATABASE_URL=<auto-provided by PostgreSQL service>
```

---

## Startup Order

### Local Development
```bash
# Terminal 1: Backend
cd backend
npm run dev              # Starts on http://localhost:3001

# Terminal 2: Frontend
npm run dev              # Starts on http://localhost:5173
# Automatically uses VITE_API_URL=http://localhost:3001/api/v1
```

### Production (Railway)
```
Docker Container Starts
    ↓
npm run db:migrate      # Creates/updates database schema
    ↓
node src/server.js      # Starts API server
    ↓
Ready for requests
```

---

## Key API Endpoints

```
GET  /health                                    Health check
POST /api/v1/auth/login                        Login
POST /api/v1/auth/register                     Register
GET  /api/v1/stations                          List stations
POST /api/v1/stations                          Create station
GET  /api/v1/pumps                             List pumps
POST /api/v1/readings                          Record reading
GET  /api/v1/creditors                         List creditors
POST /api/v1/payments                          Process payment
```

---

## Database Migrations (Auto-run)

```
1. 20251202114000-baseline-schema.js          Creates all tables
2. 20251203120000-add-reading-approval.js      Adds approval fields
3. 20251204150000-add-credit-payment-fields.js Adds payment fields
```

Each runs once. Sequelize tracks in `SequelizeMeta` table.

---

## File to Know (Most Important!)

| File | What It Does |
|------|-------------|
| `/src/lib/api-client.ts` | **All API communication (single point!)** |
| `/backend/src/server.js` | Backend entry point |
| `/backend/Dockerfile` | Container definition |
| `/railway.json` | Railway deployment config |
| `.env` | Frontend dev environment |
| `/backend/.env` | Backend dev environment |

---

## How to Deploy

```powershell
# 1. Commit changes
git add -A
git commit -m "your message"
git push origin main

# 2. Railway auto-deploys backend
# 3. Vercel auto-deploys frontend (if changed)
# 4. Monitor Railway logs for errors
```

---

## Test After Deploy

```bash
# 1. Health check
curl https://fuelsync-new-production.up.railway.app/health

# 2. In browser console
fetch('https://fuelsync-new-production.up.railway.app/api/v1/plans')
  .then(r => r.json())
  .then(console.log)

# 3. Login test
curl -X POST https://fuelsync-new-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fuelsync.com","password":"admin123"}'
```

---

## Daily/Monthly/Yearly Report Requirements

### What Needs to Show (Example: End of Day / Month / Year)

```
INCOME & RECEIVABLES REPORT

Period: December 2025 (or specific date range)
Station: XYZ Station

═══════════════════════════════════════════════════════
SUMMARY METRICS
═══════════════════════════════════════════════════════

Total Liters Sold:        5,250 L
├─ Diesel:                3,000 L  (57%)
├─ Petrol:                2,000 L  (38%)
└─ Other:                   250 L  (5%)

═══════════════════════════════════════════════════════
INCOME BREAKDOWN
═══════════════════════════════════════════════════════

Calculated Sale Value:    ₹5,42,500 (sum of all readings)
├─ Diesel: 3,000 L × ₹95/L = ₹2,85,000
├─ Petrol: 2,000 L × 98/L  = ₹1,96,000
└─ Other:    250 L × ₹84/L = ₹21,000

Cash Received:            ₹3,50,000 (42% of sales)
Online Received:          ₹1,20,000 (22% of sales)
Credit Given (Pending):   ₹1,72,500 (36% of sales - still pending)
                          ────────────
TOTAL ACCOUNTED FOR:      ₹5,42,500 ✓ (Matches calculated sale value)

═══════════════════════════════════════════════════════
DAILY SETTLEMENT (Cash Reconciliation)
═══════════════════════════════════════════════════════

Expected Cash (from readings):    ₹3,50,000
Actual Cash Counted:              ₹3,49,500
Variance:                         -₹500 (shortfall 0.14%)
Status:                           ✅ OK

═══════════════════════════════════════════════════════
RECEIVABLES STATUS (What's Pending)
═══════════════════════════════════════════════════════

Online Payments Pending:
  - Awaiting gateway confirmation: ₹1,20,000
  - Status: ✅ Usually clears next day

Credit Sales Pending:
  ├─ ABC Transport: ₹80,000 (Due: Dec 30)
  ├─ XYZ Logistics: ₹45,000 (Due: Jan 15)
  ├─ Local Delivery: ₹25,000 (OVERDUE - Due: Dec 5)
  └─ Small Business: ₹22,500 (Due: Jan 10)
  TOTAL CREDIT PENDING: ₹1,72,500

Aging Analysis:
  - Current (0-30 days): ₹1,50,000 (87%)
  - Overdue (31-60 days): ₹15,000 (9%)
  - Very Overdue (>60 days): ₹7,500 (4%)

═══════════════════════════════════════════════════════
SETTLEMENT WITH CREDITORS (Payments Received from Credit Sales)
═══════════════════════════════════════════════════════

Track payments when creditors pay their dues:
  
  ABC Transport:
    Original Credit: ₹80,000 (Dec 1)
    Payment Received: ₹50,000 (Dec 15)
    Balance Outstanding: ₹30,000
    Status: Partially Settled

  XYZ Logistics:
    Original Credit: ₹45,000 (Dec 5)
    Payment Received: ₹0 (Still pending)
    Balance Outstanding: ₹45,000
    Status: Awaiting Settlement

═══════════════════════════════════════════════════════
INCOME STATEMENT (Month-End / Year-End Summary)
═══════════════════════════════════════════════════════

Total Sales Generated:         ₹5,42,500
Less: Credit Sales (pending):  -₹1,72,500
ACTUAL CASH INCOME:            ₹3,70,000

OR

Total Sales Generated:         ₹5,42,500
Less: Credit Sales (pending):  -₹1,72,500
Less: Settlement Variance:     -₹500
NET INCOME (Cash Basis):       ₹3,69,500

```

---

## Settlement: Your Questions Answered

### Q1: What happens when settlement is done?
**→ IMMEDIATELY PERSISTED to database** (survives crashes)

```javascript
recordSettlement() creates Settlement record via Sequelize transaction:
- expectedCash: 45000
- actualCash: 44750
- variance: CALCULATED ON BACKEND
- All amounts stored as DECIMAL(12,2) - exact, no rounding
```

### Q2: How is it persisted?
**→ Via atomic database transaction**

```javascript
const t = await sequelize.transaction();
const record = await Settlement.create({...}, { transaction: t });
await t.commit();  // ← Committed to DB with full ACID compliance
```

### Q3: What happens to amounts?
**→ Stored exactly, variance auto-calculated**

```
Stored in settlements table:
expectedCash: 45000.00   ← from readings
actualCash:   44750.00   ← manager counted
variance:     250.00     ← BACKEND CALCULATED (not from frontend)
online:       15000.00   ← reference
credit:       12000.00   ← reference
```

### Q4: What happens to variance?
**→ Calculated server-side, stored, flagged for investigation**

```
Calculation: variance = expectedCash - actualCash
Analysis:    if abs(variance) > 3% of expectedCash → INVESTIGATE
Stored:      permanently in DB for audit trail
Available:   in settlement history with analysis
```

### Q5: How is this viewed later?
**→ Via APIs with history and analysis**

```
GET /stations/:id/settlements?limit=5
Returns: Settlement records with varianceAnalysis
         { percentage, status, interpretation }

GET /stations/:id/settlement-vs-sales?date=2025-12-09
Returns: Side-by-side comparison of sales vs settlement
```

### Q6: Settlement vs Sales - What's the difference?
**→ Two complementary things:**

```
SALES = Revenue (what was SOLD)
  - Definition: Total ₹ from fuel sold
  - Basis: System calculates from readings
  - Purpose: Revenue accounting
  Example: ₹46,375 total fuel sold

SETTLEMENT = Cash Control (what CASH we have)
  - Definition: Physical count vs expected
  - Basis: Manager counts + system verifies
  - Purpose: Cash audit trail
  Example: Expected ₹30,550, counted ₹30,400, variance ₹150

TOGETHER:
  ✓ Complete visibility (what sold + what cash we have)
  ✓ Audit trail (permanent records)
  ✓ Discrepancy detection (shortfalls indicate issues)
```

---

## Troubleshooting


| Issue | Check |
|-------|-------|
| Frontend can't reach backend | `VITE_API_URL` in .env, CORS in Railway |
| Migrations fail | DATABASE_URL set, PostgreSQL running |
| Login fails | Check seeds ran, user exists in DB |
| Health check 500 | Check Railway runtime logs |
| CORS error | `CORS_ORIGINS` includes your frontend URL |

---

## Architecture in One Picture

```
User Browser
    ↓
Frontend (Vercel)
    ↓ VITE_API_URL
Backend API (Railway)
    ↓ DATABASE_URL
PostgreSQL (Railway)
```

**One URL changes everything**: Update `VITE_API_URL` and all requests go to new backend.

---

## Remember

✅ Frontend = UI (what user sees)
✅ Backend = Logic (what server does)
✅ Database = Storage (where data lives)

❌ Don't hardcode URLs in components
❌ Don't bypass backend to access DB
❌ Don't store secrets in code


---

## NEW API: Comprehensive Income & Receivables Report

**Endpoint:** GET /api/v1/dashboard/income-receivables

**Query Parameters:**
- stationId (required) UUID
- startDate (optional) YYYY-MM-DD
- endDate (optional) YYYY-MM-DD

**Returns - 5 Required Report Sections:**

1. summaryMetrics - Total liters, sale value, fuel breakdown
2. incomeBreakdown - Cash, Online, Credit breakdown
3. settlements - Daily settlements with variance analysis
4. receivables - Credit aging (current/overdue)
5. creditorSettlements - Track payments from creditors
6. incomeStatement - Net cash income

**Database Tables Supporting This:**
- Settlement (expectedCash, actualCash, variance)
- NozzleReading (paymentMethod: cash/online/credit)
- CreditTransaction (type: credit/settlement)
- Creditor (currentBalance, creditPeriodDays, aging buckets)

