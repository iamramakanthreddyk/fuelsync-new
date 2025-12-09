````markdown
git commit -m "Fix: Switch to custom Dockerfile for Railway deployment"
DEPLOYMENT_SETUP_GUIDE.md moved to `docs/deploy/DEPLOYMENT_SETUP_GUIDE.md`.
Please open `docs/deploy/DEPLOYMENT_SETUP_GUIDE.md` for the deployment setup and instructions.


````
# FuelSync Deployment Setup Guide

## Quick Summary

FuelSync is a fuel station management system with:
- **Frontend**: React + Tailwind (Vercel deployment)
- **Backend**: Node.js + Express + PostgreSQL (Railway deployment)
- **Database**: PostgreSQL in production, SQLite in development

---

## 📋 What Each Component Does

### Frontend (React App)
- Location: `/src` and root files
- Role: User interface for station owners, managers, employees
- Deployment: Vercel
- Needs: Single backend API URL to connect

### Backend (Node.js API)
- Location: `/backend`
- Role: API server for data management, authentication, business logic
- Deployment: Railway with Docker
- Needs: PostgreSQL database connection (Railway Postgres)

### Database (PostgreSQL)
- Role: Data storage for users, stations, fuel prices, readings, transactions
- Deployment: Railway Postgres service
- Needs: Proper migrations to create schema

---

## 🔑 Critical: Single Backend API URL Configuration

### Where the Frontend Gets the Backend URL

**File**: `frontend/.env.local` or `vite.config.ts`

The frontend needs ONE backend API URL. This is typically set to:

```env
# Development
VITE_API_URL=http://localhost:3001

# Production (Railway)
VITE_API_URL=https://fuelsync-backend-prod.up.railway.app
```

**Never duplicate** - Always use environment variables, not hardcoded URLs in code.

### Current Backend Endpoints
- Health Check: `GET /health`
- Auth: `POST /api/v1/auth/login`, `POST /api/v1/auth/register`
- Stations: `GET/POST /api/v1/stations`
- Pumps: `GET/POST /api/v1/pumps`
- Readings: `GET/POST /api/v1/readings`
- And more... (see `/backend/routes`)

---

## 🗄️ Database Migration Flow

The backend **automatically** runs migrations on startup:

```
Docker Container Starts
    ↓
npm run db:migrate  (creates/updates schema)
    ↓
node src/server.js (starts API server)
    ↓
Ready to serve requests
```

### Migration Files (in `/backend/migrations`)
1. `20251202114000-baseline-schema.js` - Creates all tables
2. `20251203120000-add-reading-approval.js` - Adds approval fields
3. `20251204150000-add-credit-payment-fields.js` - Adds payment fields

---

## ⚠️ Current Issue: Migration Failure

### Problem
```
ERROR: relation "public.nozzle_readings" does not exist
```

### Root Cause
The production PostgreSQL database is empty. The baseline migration hasn't created the tables yet.

### Solution
1. Ensure migrations run in Docker Dockerfile
2. The Dockerfile already has this:
   ```dockerfile
   CMD ["sh", "-c", "npm run db:migrate && node src/server.js"]
   ```
3. Just push to Railway and let it deploy

---

## 🚀 Deployment Steps

### Step 1: Push Changes to GitHub
```powershell
cd "c:\Users\r.kowdampalli\OneDrive - Accenture\Documents\fuel-sync\fuelsync-new"

git add -A
git commit -m "Fix: Switch to custom Dockerfile for Railway deployment"
 git push origin main
```

### Step 2: Trigger Railway Deployment
1. Go to Railway dashboard
2. Connect your GitHub repo
3. The push triggers automatic deployment
4. Wait for: Build → Run migrations → App starts

### Step 3: Configure Frontend
Update the frontend environment to point to the backend:

**File**: `.env.local`
```env
VITE_API_URL=https://fuelsync-new-production.up.railway.app
```

Or update in `vite.config.ts` if building for production.

---

## 🛠️ Local Development

### Start Backend
```powershell
cd backend
npm install
npm run dev
```
Backend runs on `http://localhost:3001`

### Start Frontend
```powershell
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`

Both automatically connect via `.env` files.

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                    │
│                    React App (Port 80/443)              │
│            ↓ Uses VITE_API_URL environment              │
└─────────────────────────────────────────────────────────┘
                         ↓
                    HTTPS Request
                         ↓
┌─────────────────────────────────────────────────────────┐
│               Railway (Backend + DB)                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Docker Container (Node.js API)                 │   │
│  │  - Port 3001 (internally)                       │   │
│  │  - Dockerfile runs migrations                   │   │
│  │  - Connects to PostgreSQL                       │   │
│  └──────────────────────────────────────────────────┘   │
│                      ↓                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database                            │   │
│  │  - Stores all application data                  │   │
│  │  - Managed by Railway                           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist Before Deploying

- [ ] **Dockerfile exists**: `/backend/Dockerfile` ✓
- [ ] **railway.json correct**: Uses `dockerfile` builder ✓
- [ ] **Migrations exist**: All 3 migration files present ✓
- [ ] **Package.json has scripts**: `db:migrate` exists ✓
- [ ] **Database URL set**: Railway provides `DATABASE_URL` ✓
- [ ] **Environment variables**: `.env` files configured
- [ ] **Frontend API URL**: Set to Railway backend URL
- [ ] **CORS enabled**: Backend allows frontend origin

---

## 🔍 Troubleshooting

### Migration fails in Railway
→ Check Railway logs: `npm run db:migrate` output
→ Ensure DATABASE_URL is set in Railway environment
→ Verify PostgreSQL service is running

### Frontend can't reach backend
→ Check VITE_API_URL is set correctly
→ Verify backend is running (check /health endpoint)
→ Check CORS configuration in backend

### Database connection error
→ Verify DATABASE_URL format: `postgresql://user:pass@host:port/db`
→ Check PostgreSQL service health in Railway
→ Ensure credentials are correct

---

## 📝 Key Files to Know

| File | Purpose |
|------|---------|
| `/backend/Dockerfile` | Container configuration |
| `/railway.json` | Railway deployment config |
| `/backend/config/config.js` | Database connections |
| `/backend/migrations/` | Schema versioning |
| `/.env.local` | Local development config |
| `/src/main.tsx` | Frontend entry point |

---

## 🎯 Next Actions

1. ✅ Verify Dockerfile works locally
2. ✅ Confirm railway.json is correct
3. 🔄 Push to GitHub
4. 🔄 Monitor Railway deployment logs
5. 🔄 Test /health endpoint when deployed
6. 🔄 Configure frontend API URL
7. 🔄 Test end-to-end flow

---

## 📞 Support

If migrations fail:
1. Check Railway build logs
2. Verify DATABASE_URL connection
3. Run locally first to test: `npm run db:migrate`
4. Check PostgreSQL is actually running
