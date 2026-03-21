DIAGRAMS.md moved to `docs/architecture/DIAGRAMS.md` to consolidate documentation.
This file moved to `docs/architecture/DIAGRAMS.md` as part of documentation consolidation.
Please open `docs/architecture/DIAGRAMS.md` to see the architecture visuals and diagrams.
```

---

## 5. Migration Execution Timeline

```
Docker Container Starts
    ↓
Node process initializes
    ↓
Loads environment variables from Railway
    ↓ DATABASE_URL loaded
Sequelize connects to PostgreSQL
    ↓
Dockerfile CMD executes: npm run db:migrate
    ↓
Sequelize CLI reads config/config.js
    ↓
Uses DATABASE_URL from environment
    ↓
Reads migrations/ folder:
  - 20251202114000-baseline-schema.js
  - 20251203120000-add-reading-approval.js
  - 20251204150000-add-credit-payment-fields.js
    ↓
Checks SequelizeMeta table for completed migrations
    ↓
┌─ Baseline Migration (if not yet run)
│  ├─ CREATE TABLE plans (...)
│  ├─ CREATE TABLE users (...)
│  ├─ CREATE TABLE stations (...)
│  ├─ CREATE TABLE pumps (...)
│  ├─ ... (all tables)
│  └─ Update SequelizeMeta
├─ Add Reading Approval Migration (if not yet run)
│  ├─ ALTER TABLE nozzle_readings ADD COLUMN approval_status
│  └─ Update SequelizeMeta
└─ Add Credit Payment Migration (if not yet run)
   ├─ ALTER TABLE credit_transactions ADD COLUMN payment_method
   └─ Update SequelizeMeta
    ↓
All migrations completed ✓
    ↓
Dockerfile CMD continues: node src/server.js
    ↓
Server starts listening on port 3001
    ↓
Container ready for requests
```

---

## 6. Request to Response Timeline

```
TIME    USER SIDE                   BACKEND SIDE              DB SIDE
────    ────────────────────        ────────────────────      ────────

00ms    Click button
01ms    apiClient.post(...)
02ms    HTTP request sent ─────→
                                    Request received
                                    Parse body
03ms                                Validate JWT
04ms                                Route matching
05ms                                Handler execution
06ms                                Build query
07ms                                Execute query ─────→
                                                          Query received
                                                          Execute SQL
08ms                                                      Return rows
09ms                    ←───────── Result received
10ms                                Format response
11ms    Response received
12ms    Parse JSON
13ms    Update state
14ms    Component re-renders
15ms    User sees update

Total: 15ms
```

---

## 7. Environment Variable Flow

```
DEVELOPMENT SETUP
────────────────

.env file (committed to git):
  VITE_API_URL=http://localhost:3001/api/v1

.env.local file (in .gitignore):
  VITE_API_URL=http://localhost:3001/api/v1  (local override)

npm run dev
    ↓
Vite reads .env and .env.local
    ↓
Frontend loads with VITE_API_URL=http://localhost:3001/api/v1
    ↓
All apiClient requests use this URL
    ↓
/src/lib/api-client.ts uses import.meta.env.VITE_API_URL


PRODUCTION SETUP (RAILWAY)
─────────────────────────

Dockerfile in backend/ (committed to git)
    ↓
Railway builds Docker image
    ↓
Railway runs container with environment variables:
    NODE_ENV=production
    DATABASE_URL=postgresql://...
    JWT_SECRET=...
    CORS_ORIGINS=...
    ↓
npm run db:migrate runs
    ↓
node src/server.js runs
    ↓
Backend listening


Vercel deployment (frontend)
    ↓
Build reads .env files
    ↓
Or: Vercel dashboard sets environment variable
    VITE_API_URL=https://...up.railway.app/api/v1
    ↓
Frontend deployed with correct API URL
    ↓
All users accessing https://fuelsync-new.vercel.app
    ↓
All API calls go to https://...up.railway.app/api/v1
```

---

## 8. Error Scenarios

```
SCENARIO 1: Login with wrong password
──────────────────────────────────────

Frontend → POST /auth/login { email, wrong_password }
    ↓
Backend: User found ✓
    ↓
Backend: Password compare fails ✗
    ↓
Backend returns: { success: false, error: "Invalid credentials" }
    ↓
Frontend: Catch error
    ↓
Frontend: Show error message
    ↓
User sees: "Invalid email or password"
    ↓
No token stored
    ↓
User can retry


SCENARIO 2: Expired JWT token
─────────────────────────────

Frontend → GET /stations (with old token)
    ↓
Backend: Middleware validates JWT
    ↓
Backend: Token signature invalid/expired
    ↓
Backend returns: 401 Unauthorized
    ↓
Frontend: Intercor catches 401
    ↓
Frontend: Clear localStorage
    ↓
Frontend: Redirect to login
    ↓
User must login again


SCENARIO 3: CORS error
──────────────────────

Frontend (https://vercel.app) → POST /api/v1/...
    ↓
Backend: Receives request
    ↓
Backend: Checks Origin header
    ↓
Backend: Origin not in CORS_ORIGINS
    ↓
Backend: Rejects request
    ↓
Browser: Blocks response (CORS policy)
    ↓
Frontend: Network error
    ↓
User sees: Network error (cannot reach API)


FIX: Add Origin to CORS_ORIGINS in Railway env vars
```

---

## 9. File → Execution Path

```
USER CHANGE
    ↓
Edit /src/components/LoginForm.tsx
    ↓
Save file
    ↓ (Vite watches)
Hot Module Replacement (HMR)
    ↓
Component reloads in browser
    ↓
User sees changes immediately
    ↓ (on localhost)


OR: Backend change
    ↓
Edit /backend/routes/stations.js
    ↓
Save file
    ↓ (Nodemon watches)
Server restarts
    ↓
Frontend automatically reconnects
    ↓ (axios retry logic)
User sees updated functionality


OR: Database change
    ↓
Create new migration file:
/backend/migrations/20251207-new-feature.js
    ↓
Add to git
    ↓
Push to main
    ↓
Railway webhook triggers
    ↓
Docker builds
    ↓
npm run db:migrate runs
    ↓
New migration executes
    ↓
Database schema updated
    ↓
Backend runs with new schema
```

---

## 10. Single Backend URL Impact

```
WITH HARDCODED URLs (❌ OLD WAY)
─────────────────────────────

src/components/LoginForm.tsx:
  const response = await fetch('http://localhost:3001/auth/login')

src/hooks/useStations.ts:
  const response = await fetch('http://prod-server:3001/stations')

src/pages/Dashboard.tsx:
  const response = await fetch('https://api.example.com/data')

src/utils/api.ts:
  const response = await fetch('http://backend:3001/...')

Need to deploy?
  → Find and update all 4+ hardcoded URLs
  → Easy to miss one
  → Different URLs in prod vs dev
  → Errors like "Cannot reach http://localhost:3001" in production


WITH ENVIRONMENT VARIABLE (✅ NEW WAY)
──────────────────────────────────────

src/lib/api-client.ts:
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'
  // All requests use this ONE URL

.env file:
  VITE_API_URL=http://localhost:3001/api/v1

.env.local file:
  VITE_API_URL=http://localhost:3001/api/v1  (local override)

Need to deploy?
  → Update ONE .env file
  → All requests automatically use new URL
  → Works for all components
  → Clear what URL is being used
```

