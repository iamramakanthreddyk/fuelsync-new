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

