# 🚀 FuelSync Deployment Checklist

## Pre-Deployment (Local)

### Code Quality
- [ ] Run backend tests: `cd backend && npm test`
- [ ] Check for console errors in frontend
- [ ] Verify no hardcoded URLs or credentials in code

### Database
- [ ] All migrations exist in `/backend/migrations/`
- [ ] Migrations are in correct chronological order
- [ ] Can run locally: `cd backend && npm run db:migrate`

### Configuration
- [ ] `.env.local` exists with correct `VITE_API_URL`
- [ ] `.env` in backend has development settings
- [ ] No `.env` files committed to git (only examples)

### Docker
- [ ] Dockerfile exists: `/backend/Dockerfile`
- [ ] Can build locally: `docker build -t fuelsync-backend -f backend/Dockerfile backend/`
- [ ] .dockerignore exists: `/backend/.dockerignore`

---

## Git Push

```powershell
cd "c:\Users\r.kowdampalli\OneDrive - Accenture\Documents\fuel-sync\fuelsync-new"

# Check status
git status

# Add all changes
git add -A

# Commit with descriptive message
git commit -m "feat: Update deployment configuration

- Switch to custom Dockerfile for Railway
- Fix migration execution in production
- Update environment variable documentation
- Add comprehensive deployment guides"

# Push to main
git push origin main
```

---

## Railway Configuration

### Backend Service Setup

1. **Connect GitHub Repository**
   - Go to railway.app dashboard
   - Click "New Service" → "GitHub Repo"
   - Select: `iamramakanthreddyk/fuelsync-new`
   - Confirm deployment from `main` branch

2. **Add PostgreSQL Service**
   - Click "New Service" → "Database" → "PostgreSQL"
   - This creates a PostgreSQL instance
   - Railway auto-provides `DATABASE_URL`

3. **Link Services**
   - In Railway dashboard, link PostgreSQL to the app
   - Ensures `DATABASE_URL` is available to backend

4. **Set Environment Variables**
   - Go to backend service settings
   - Add variables (Railway auto-provides `DATABASE_URL`):

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Activates production config |
| `PORT` | `3001` | Internal port (exposed via HTTPS) |
| `JWT_SECRET` | `<generate below>` | Must be 64+ chars |
| `CORS_ORIGINS` | `https://fuelsync-new.vercel.app,http://localhost:5173` | Allowed frontend URLs |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

5. **Deployment Settings**
   - Root directory: `/backend` (so migrations run from backend dir)
   - OR ensure railway.json has correct paths

6. **Trigger Deploy**
   - Push to main branch triggers automatic deploy
   - OR manually redeploy from Railway dashboard

---

## Monitor Deployment

### Watch Build Logs
1. Go to Railway dashboard
2. Select backend service
3. Click "Deployments" → latest deployment
4. Watch "Build Logs" for:
   - ✓ Dependencies installed
   - ✓ Image built successfully
   - ✓ Container starting

### Watch Runtime Logs
1. Click "Runtime Logs" for:
   - ✓ "🚀 [SERVER] Node process starting..."
   - ✓ "Sequelize CLI Loaded configuration"
   - ✓ Migrations: "== XXXXX-migration: migrating ===" → "✔ Sequelize CLI completed"
   - ✓ "Server listening on port 3001"

### Example Success Output
```
🚀 [SERVER] Node process starting...
> sequelize-cli db:migrate
Sequelize CLI [Node: 20.19.5, CLI: 6.6.3, ORM: 6.37.7]
Loaded configuration file "config/config.js".
Using environment "production".
== 20251202114000-baseline-schema: migrating =======
== 20251202114000-baseline-schema: migrated (X.XXXs)
== 20251203120000-add-reading-approval: migrating =======
== 20251203120000-add-reading-approval: migrated (X.XXXs)
== 20251204150000-add-credit-payment-fields: migrating =======
== 20251204150000-add-credit-payment-fields: migrated (X.XXXs)

✓ [MODELS] Database sync successful
🌍 [CORS] Enabled origins: https://fuelsync-new.vercel.app,http://localhost:5173
✓ [SERVER] Server listening on port 3001
```

---

## Verify Backend is Running

### Check Health Endpoint
```powershell
# Get the Railway app URL (format: https://xxx.up.railway.app)
$BACKEND_URL = "https://fuelsync-new-production.up.railway.app"

# Test health check
curl "$BACKEND_URL/health" | ConvertFrom-Json

# Expected response:
# { "status": "ok", "timestamp": "2025-12-07T...", "version": "2.0.0" }
```

### Check in Browser
```
https://fuelsync-new-production.up.railway.app/health
```
Should show: `{"status":"ok","timestamp":"2025-12-07T...","version":"2.0.0"}`

---

## Frontend Configuration

### Update Frontend to Use Railway Backend

**Option 1: Environment Variable (Recommended)**

Create `.env.production.local`:
```env
VITE_API_URL=https://fuelsync-new-production.up.railway.app/api/v1
```

**Option 2: Update .env**
```env
# .env
VITE_API_URL=https://fuelsync-new-production.up.railway.app/api/v1
```

**Option 3: Vercel Dashboard**
1. Go to Vercel project settings
2. Add environment variable: `VITE_API_URL`
3. Set value: `https://fuelsync-new-production.up.railway.app/api/v1`
4. Apply to "Production"

### Deploy Frontend
```powershell
# Commit the change
git add .
git commit -m "feat: Update API URL for production Railway backend"
git push origin main

# Vercel automatically deploys
```

---

## End-to-End Testing

### 1. Test Backend Health
```bash
curl https://fuelsync-new-production.up.railway.app/health
```
✓ Should return: `{"status":"ok",...}`

### 2. Test Frontend Loads
```
https://fuelsync-new.vercel.app
```
✓ Should show login page without errors

### 3. Test API Connection
In browser console:
```javascript
fetch('https://fuelsync-new-production.up.railway.app/api/v1/plans')
  .then(r => r.json())
  .then(console.log)
```
✓ Should return list of plans

### 4. Test Login
```bash
curl -X POST https://fuelsync-new-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fuelsync.com","password":"admin123"}'
```
✓ Should return `{ success: true, token: "..." }`

### 5. Test in Frontend UI
1. Go to https://fuelsync-new.vercel.app
2. Login with: `admin@fuelsync.com` / `admin123`
3. Should see dashboard (database data should load)

---

## Troubleshooting Deployment

### Issue: Build Fails
**Check:**
- [ ] Dockerfile syntax correct
- [ ] All dependencies in package.json
- [ ] Node version compatible (20.x LTS)

**Fix:**
```bash
docker build -t fuelsync -f backend/Dockerfile backend/
```

### Issue: Migrations Fail
**Check:**
- [ ] DATABASE_URL is set in Railway
- [ ] PostgreSQL service is running
- [ ] All migration files present in `/backend/migrations/`

**Fix in Railway:**
1. Redeploy
2. Check runtime logs for migration error
3. Verify PostgreSQL connection

### Issue: Health Check Fails
**Check:**
- [ ] /health endpoint implemented (it is)
- [ ] Server is actually listening on port 3001
- [ ] No error during startup

**Fix:**
```bash
# Check logs for errors
# Railway → Deployments → Runtime Logs
```

### Issue: Frontend Can't Reach Backend
**Check:**
- [ ] CORS_ORIGINS includes frontend URL
- [ ] VITE_API_URL is correct in frontend
- [ ] Backend is actually running

**Fix:**
1. Update CORS_ORIGINS in Railway
2. Clear browser cache
3. Check network tab for actual error

### Issue: Database Connection Error
**Check:**
- [ ] DATABASE_URL format: `postgresql://user:pass@host:port/db`
- [ ] PostgreSQL service running
- [ ] Credentials correct

**Fix:**
1. Check Railway PostgreSQL service status
2. Verify DATABASE_URL in Railway environment
3. Redeploy backend

---

## Rollback Plan

If deployment fails:

1. **Keep Previous Version**
   - Railway keeps old deployments
   - Click "Deployments" → select previous version → "Redeploy"

2. **Local Fix & Redeploy**
   ```bash
   # Fix code locally
   git commit -m "fix: issue description"
   git push origin main
   # Railway auto-deploys
   ```

3. **Manual Rollback**
   - Go to Railway deployments
   - Select working previous deployment
   - Click "Redeploy"

---

## Post-Deployment

### Monitor Logs
- Check Railway logs daily for errors
- Monitor /health endpoint uptime

### Update Documentation
- Update README with deployed URLs
- Document any environment-specific issues

### Performance Monitoring
- Monitor response times
- Monitor database query performance
- Monitor error rates

---

## Success Criteria

✅ All of these should be true:

- [ ] Backend deployed to Railway
- [ ] Migrations ran successfully (logs show "migrated")
- [ ] /health endpoint returns 200 OK
- [ ] Frontend can load data from backend
- [ ] Login works with seed user (admin@fuelsync.com)
- [ ] Can see stations/pumps/readings in UI
- [ ] No CORS errors in browser console
- [ ] No 404 or 500 errors in production

---

## Quick Reference URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Backend Health | https://fuelsync-new-production.up.railway.app/health | Verify server running |
| Backend API | https://fuelsync-new-production.up.railway.app/api/v1 | All API endpoints |
| Frontend | https://fuelsync-new.vercel.app | User interface |
| Railway Dashboard | https://railway.app | Manage deployment |
| Vercel Dashboard | https://vercel.com | Manage frontend |

