# Railway Environment Variables Setup Guide

## Issue
Your backend is crashing in Railway because required environment variables are not set:
- ❌ `JWT_SECRET` - missing (causes auth middleware to fail)
- ❌ `DATABASE_URL` - missing or not connected to PostgreSQL service

## Solution: Set Variables in Railway Dashboard

### Step 1: Open Railway Dashboard
1. Go to https://railway.app/dashboard
2. Select your FuelSync project
3. Click on your "backend" service

### Step 2: Add Environment Variables

Click on the "Variables" tab and add these variables:

#### Critical Variables (Required)
```
JWT_SECRET=<generate-a-64-char-hex-string>
NODE_ENV=production
PORT=3001
```

**To generate JWT_SECRET**, run in terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Database Connection
Railway PostgreSQL should automatically provide `DATABASE_URL`, but verify:
1. Go to your PostgreSQL service in Railway
2. Copy the connection string from the "Connect" tab
3. Add it as `DATABASE_URL` in your backend service variables

Or if you have a Railway PostgreSQL plugin, it should auto-inject.

#### Optional But Recommended
```
CORS_ORIGINS=https://your-vercel-app.vercel.app,https://backend-railway-url.up.railway.app
RATE_LIMIT_MAX=100
ADMIN_EMAIL=admin@fuelsync.com
ADMIN_PASSWORD=<secure-password>
```

### Step 3: Redeploy
1. After setting variables, trigger a new deployment:
   - Either push a commit to main
   - Or click "Trigger Deploy" in Railway dashboard

### Step 4: Verify in Logs
Check deployment logs to see:
```
✓ [DATABASE] Starting initialization sequence...
🔌 [DATABASE] Connecting to database...
   ✅ Connection successful
⚙️  [MIGRATIONS] Running pending migrations...
   ✅ Migrations executed successfully
🎉 [SCHEMA] Schema verification complete
🌍 [SERVER] Starting Express server...
🔥 FuelSync API Server STARTED
```

## Troubleshooting

### Still seeing "JWT_SECRET not set"
- Verify it's saved in Railway Variables tab
- Check spelling exactly: `JWT_SECRET` (case-sensitive)
- Trigger a new deployment

### Still seeing "relation users does not exist"
- Means migrations didn't run
- Check if `DATABASE_URL` is correctly set to PostgreSQL
- Look for migration errors in deployment logs
- The init.js will try db.sync() as fallback

### Database connection refused
- Verify PostgreSQL service is running in Railway
- Check DATABASE_URL format (should be postgresql://...)
- Ensure backend service has PostgreSQL in "Plugins" or linked

## What Happens on Startup

1. **Init.js runs automatically** - validates DB connection, runs migrations
2. **Migrations execute** - creates all required tables (users, stations, pumps, etc.)
3. **Schema verified** - confirms all tables exist
4. **Seed data** - initializes plans if DB is empty
5. **Server starts** - listens on PORT 3001

All with detailed logging for debugging!

## Quick Testing

Once deployed, test with:
```bash
# Health check
curl https://your-backend.up.railway.app/health

# Login (creates JWT token)
curl -X POST https://your-backend.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fuelsync.com","password":"your_admin_password"}'

# Get stations (requires valid JWT)
curl -H "Authorization: Bearer <your-jwt-token>" \
  https://your-backend.up.railway.app/api/v1/stations
```

## Reference

See `.env.production.example` for all available environment variables and their descriptions.
