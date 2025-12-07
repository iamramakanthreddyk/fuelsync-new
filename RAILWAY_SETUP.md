# Railway Environment Configuration Guide

## Overview
This document explains exactly what environment variables need to be set in Railway for FuelSync to run correctly.

---

## Railway Dashboard Setup

### Step 1: PostgreSQL Service
1. In Railway dashboard, click "New Service" → Select "PostgreSQL"
2. This automatically creates:
   - Service name: `postgres`
   - Provides: `DATABASE_URL` environment variable
   - Format: `postgresql://user:password@host:port/database`

### Step 2: Application Variables
In Railway dashboard for your app, set these variables:

```
NODE_ENV=production
PORT=3001
JWT_SECRET=<generate a secure 64-char random string>
CORS_ORIGINS=https://fuelsync-new.vercel.app,http://localhost:5173
```

**Do NOT set** `DATABASE_URL` - Railway provides it automatically when PostgreSQL service is linked.

---

## Environment Variables Explained

### DATABASE CONNECTION (Automatic)
```
DATABASE_URL = postgresql://user:password@host:5432/railway
```
- ✓ Set automatically by Railway PostgreSQL service
- ✓ No need to configure manually
- ✓ Config file reads this: `config/config.js` line 24

### APPLICATION
```
NODE_ENV=production
```
- Tells app to use production database dialect (postgres)
- Enables optimizations and security features

```
PORT=3001
```
- Internal container port
- Railway exposes this on HTTPS automatically

### SECURITY
```
JWT_SECRET=<64-character random string>
```
Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### CORS (Cross-Origin Resource Sharing)
```
CORS_ORIGINS=https://fuelsync-new.vercel.app,http://localhost:5173
```
- Frontend URLs that can access the backend API
- Comma-separated list
- Update with your actual Vercel URL

---

## Dockerfile Execution Flow

When Railway deploys:

```
1. Docker builds image
   - Installs Node.js dependencies
   - Sets up environment

2. Docker runs container
   - Sets NODE_ENV=production
   - Loads DATABASE_URL from Railway Postgres
   - Executes: npm run db:migrate
     → Sequelize runs all migrations
     → Creates schema: plans, users, stations, pumps, nozzles, etc.
   - Executes: node src/server.js
     → Server starts on port 3001
     → Ready to accept requests

3. Railway monitoring
   - Health check endpoint: GET /health
   - If health fails 3 times in 30s → restart container
```

---

## Database Migrations - Automatic

When the backend starts, migrations run automatically:

```javascript
// From backend/Dockerfile
CMD ["sh", "-c", "npm run db:migrate && node src/server.js"]
```

This command:
1. Runs `npm run db:migrate` → Uses Sequelize CLI
2. Reads migrations from `/backend/migrations/`
3. Executes in order by filename:
   - `20251202114000-baseline-schema.js` → Creates all tables
   - `20251203120000-add-reading-approval.js` → Adds approval fields
   - `20251204150000-add-credit-payment-fields.js` → Adds payment fields
4. Updates `SequelizeMeta` table to track completed migrations
5. Starts server

---

## No Manual Setup Required For:

✓ Database creation - Migrations handle it
✓ Table creation - Migrations handle it
✓ Initial data - Seed scripts can populate
✓ Port binding - Dockerfile sets it
✓ Connection pooling - Sequelize handles it

---

## Current Status

### ✅ Ready
- Dockerfile configured correctly
- railway.json uses dockerfile builder
- Config file handles DATABASE_URL
- Migrations exist and are ordered
- CORS configured in .env.production.example

### ⏳ Needs Action
- Push code to GitHub
- Deploy to Railway
- Monitor build and migration logs
- Update frontend VITE_API_URL

---

## Testing After Deployment

### 1. Health Check
```bash
curl https://<your-railway-app>.up.railway.app/health
```
Response:
```json
{ "status": "ok", "timestamp": "2025-12-07T...", "version": "2.0.0" }
```

### 2. Login Test
```bash
curl -X POST https://<your-railway-app>.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fuelsync.com","password":"admin123"}'
```

### 3. Get Stations
```bash
curl https://<your-railway-app>.up.railway.app/api/v1/stations \
  -H "Authorization: Bearer <your-token>"
```

---

## Troubleshooting

### Migrations fail with "relation does not exist"
**Cause**: PostgreSQL is empty, baseline migration hasn't run
**Solution**: 
- Check Railway build logs
- Verify DATABASE_URL is set
- Redeploy with `npm run db:migrate` in CMD

### App can't connect to database
**Cause**: DATABASE_URL format wrong or PostgreSQL service not linked
**Solution**:
- Ensure PostgreSQL service is added in Railway project
- DATABASE_URL should start with `postgresql://`
- Check Railway logs for connection errors

### CORS error from frontend
**Cause**: Frontend URL not in CORS_ORIGINS
**Solution**:
- Update CORS_ORIGINS with your Vercel frontend URL
- Restart Railway app
- Clear browser cache and try again

### Health check fails
**Cause**: Server crash or migration error
**Solution**:
- Check Railway logs for error messages
- Verify all environment variables are set
- Check DATABASE_URL is valid

---

## Files to Know

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Container configuration - runs migrations + server |
| `backend/config/config.js` | Database config - reads DATABASE_URL for production |
| `backend/migrations/` | Schema definitions - creates all tables |
| `railway.json` | Railway deployment config - uses dockerfile builder |
| `backend/.env.production.example` | Example production variables |

---

## Quick Checklist Before Deploying

- [ ] Push latest code to GitHub
- [ ] PostgreSQL service added in Railway project
- [ ] Environment variables set:
  - [ ] NODE_ENV=production
  - [ ] PORT=3001
  - [ ] JWT_SECRET=<64-char random>
  - [ ] CORS_ORIGINS=<your URLs>
- [ ] DATABASE_URL auto-injected by Railway (no manual entry needed)
- [ ] Frontend VITE_API_URL updated to Railway backend
- [ ] Trigger deployment
- [ ] Monitor build and migration logs
- [ ] Test /health endpoint

