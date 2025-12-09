````markdown
ARCHITECTURE_OVERVIEW moved to `docs/architecture/ARCHITECTURE_OVERVIEW.md` to consolidate documentation.
Please use the `docs/` folder for authoritative, organized docs.

**Frontend Entry Point** (`/src/lib/api-client.ts`):
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // ... rest of config
});

export default apiClient;
```

... (content migrated)

````
Architecture overview moved from root. Original content migrated.

See `docs/architecture/DIAGRAMS.md` and `docs/architecture/SHARED_CODE_FLOW_MAP.md` for visuals and flow maps.
# 🎯 FuelSync Architecture & Component Overview

## At a Glance

FuelSync is a **three-tier system**:

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (Vercel)                                       │
│ React App - User Interface                             │
│ Port: 80/443 (HTTPS)                                   │
│ Environment: VITE_API_URL points to backend             │
└─────────────────────────────────────────────────────────┘
                         ↕ HTTPS
            (Single Backend URL)
                         ↕
┌─────────────────────────────────────────────────────────┐
│ BACKEND (Railway - Docker)                             │
│ Node.js/Express API Server                             │
│ Port: 3001 (internal), HTTPS (external)                │
│ Endpoints: /api/v1/* and /health                       │
└─────────────────────────────────────────────────────────┘
                         ↕ PostgreSQL
            (Automatic migrations)
                         ↕
┌─────────────────────────────────────────────────────────┐
│ DATABASE (Railway PostgreSQL)                          │
│ Schema created via migrations                          │
│ Tables: users, stations, pumps, nozzles, readings, etc │
└─────────────────────────────────────────────────────────┘
```

---

## What Each Part Does

### 1️⃣ FRONTEND - React App (Vercel)

**Location**: `/src` (TypeScript + React + Tailwind)

**Responsibilities**:
- Display user interface
- Handle user input (login, forms, buttons)
- Make API calls to backend
- Format and display data

**Key Files**:
- `/src/main.tsx` - Entry point
- `/src/lib/api-client.ts` - Handles all backend communication
- `/src/core/constants/api.constants.ts` - API configuration
- `/src/pages/` - Page components
- `/src/components/` - Reusable UI components

**Environment Variables**:
```env
# Development
VITE_API_URL=http://localhost:3001/api/v1

# Production (Railway)
VITE_API_URL=https://fuelsync-new-production.up.railway.app/api/v1
```

**How It Works**:
```
User enters email/password
    ↓
Frontend calls: POST /api/v1/auth/login
    ↓
Backend returns: { token: "jwt-token-here" }
    ↓
Frontend stores token in localStorage
    ↓
Frontend includes token in Authorization header
    ↓
All subsequent requests use: Authorization: Bearer <token>
    ↓
Backend validates token, returns data
    ↓
Frontend displays data to user
```

---

### 2️⃣ BACKEND - Node.js API (Railway)

**Location**: `/backend` (Node.js + Express + Sequelize)

**Responsibilities**:
- Authenticate users (JWT tokens)
- Validate incoming data
- Execute business logic
- Query database
- Return JSON responses

**Key Files**:
- `/backend/src/server.js` - Entry point
- `/backend/src/app.js` - Express app setup
- `/backend/routes/` - API route definitions
- `/backend/models/` - Database models (Sequelize ORM)
- `/backend/migrations/` - Schema versioning

**Key Endpoints**:
```
GET  /health                          Health check
POST /api/v1/auth/login              User login
POST /api/v1/auth/register           User registration
GET  /api/v1/stations                List stations
POST /api/v1/stations                Create station
GET  /api/v1/pumps                   List pumps
POST /api/v1/readings                Record reading
... and more
```

**How It Works**:
```
Request arrives from frontend with JWT token
    ↓
Express middleware validates JWT
    ↓
Route handler processes request
    ↓
Sequelize ORM executes database query
    ↓
Database returns data
    ↓
Backend formats response
    ↓
Returns JSON to frontend
```

**Startup Process**:
```
1. Docker container starts
2. npm run db:migrate
   → Sequelize CLI runs migrations
   → Baseline migration creates tables
   → Add-approval migration adds fields
   → Add-credit migration adds fields
3. node src/server.js
   → Server starts listening on port 3001
   → Ready to accept requests
```

---

### 3️⃣ DATABASE - PostgreSQL (Railway)

**Location**: Managed by Railway (no local files)

**Responsibilities**:
- Store all application data
- Enforce data integrity
- Provide data to backend

**Key Tables** (created by migrations):
```
- plans              [plan_id, name, price, features]
- users              [user_id, email, password, role, station_id]
- stations           [station_id, name, owner_id, plan_id]
- pumps              [pump_id, station_id, name]
- nozzles            [nozzle_id, pump_id, fuel_type]
- nozzle_readings    [reading_id, nozzle_id, liters, amount, timestamp]
- creditors          [creditor_id, station_id, name]
- credit_transactions[transaction_id, creditor_id, amount]
- ... and more
```

**Connection String**:
```
DATABASE_URL=postgresql://user:password@host:5432/database
```
- Automatically provided by Railway
- Backend reads from `process.env.DATABASE_URL`
- Config file: `/backend/config/config.js`

---

## 🔗 Critical: Single Backend API URL

### The Problem We're Solving
❌ **Bad**: Hardcoding API URLs in multiple places
```
src/components/LoginForm.tsx: "http://localhost:3001"
src/hooks/useStations.ts: "http://prod-server:3001"
src/utils/api.ts: "https://api.example.com"
```
→ When changing servers, must edit 10+ files
→ Easy to miss, causes bugs
→ Production and dev URLs mixed

✅ **Good**: Single environment variable
```env
VITE_API_URL=https://fuelsync-new-production.up.railway.app/api/v1
```
→ All code uses `import.meta.env.VITE_API_URL`
→ Change once, everywhere uses new URL
→ Different .env files for dev/prod

### Implementation
