# Quick Fix: Database Tables & JWT_SECRET

## Issue 1: Missing Database Tables

**Why?** Tables are missing because:
1. In production, DATABASE_URL environment variable is not set
2. Without DATABASE_URL, app defaults to SQLite (doesn't work in Railway container)
3. Init.js tries to run migrations, but without DB connection, they fail silently

**Solution:** Set `DATABASE_URL` in Railway

---

## Issue 2: JWT_SECRET Missing

**Why?** You get "JWT_SECRET environment variable is not set" error because:
- JWT_SECRET is not configured in Railway environment variables
- Backend cannot start auth middleware without it

**Solution:** Add JWT_SECRET to Railway

---

## STEP-BY-STEP FIX

### Step 1: Log into Railway
Go to https://railway.app/dashboard

### Step 2: Select Your Backend Service
1. Click on your "fuelsync" project
2. Click on the "backend" service

### Step 3: Go to Variables Tab
Click the **Variables** tab (not Plugins, not Deploy, but **Variables**)

### Step 4: Add These Environment Variables

**Copy-paste these exactly:**

```
JWT_SECRET=cfc185e12f171407b59907b7c5f2314ca2e7d88c1631e209da480ed38b3d11b1
NODE_ENV=production
PORT=3001
```

**If you already have a PostgreSQL service in Railway:**
- Check if `DATABASE_URL` is already there
- If NOT, get it from your PostgreSQL service and paste it

**To get DATABASE_URL from PostgreSQL:**
1. Go to your PostgreSQL service in Railway
2. Click "Connect" tab
3. Copy the "Postgres Connection String" 
4. Paste as `DATABASE_URL` variable

### Step 5: Redeploy
Push a new commit or click "Trigger Redeploy" in Railway

### Step 6: Watch the Logs
Go to **Logs** tab and look for:

```
✓ [DATABASE] Starting initialization sequence...
🔌 [DATABASE] Connecting to database...
   ✅ Connection successful
⚙️  [MIGRATIONS] Running pending migrations...
   ✅ Migrations executed successfully
✔️  [SCHEMA] Verifying schema after migrations...
   ✅ users
   ✅ stations
   ✅ pumps
   🎉 Schema verification complete
🔥 FuelSync API Server STARTED
```

If you see this, **you're done!** Tables are created and running.

---

## What Happens After You Add These Variables

1. **Database connects** - To your PostgreSQL in Railway
2. **Migrations run** - Creates all tables (users, stations, pumps, nozzles, etc.)
3. **Schema verified** - Confirms all tables exist
4. **Server starts** - Listening on port 3001
5. **Auth works** - JWT_SECRET allows login

---

## Testing After Deploy

Once you see "FuelSync API Server STARTED" in logs:

```bash
# Test health check
curl https://your-backend-url.up.railway.app/health

# Test login (should work now)
curl -X POST https://your-backend-url.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fuelsync.com","password":"your_admin_password"}'
```

---

## Common Issues

### Still seeing "JWT_SECRET not set"
- Spelling must be EXACT: `JWT_SECRET` (uppercase, no spaces)
- Click "Save" after entering
- Trigger redeploy
- Wait 30 seconds for logs to appear

### Still seeing "relation users does not exist"
- DATABASE_URL not set or wrong format
- Verify PostgreSQL service exists in Railway
- Check Database URL starts with: `postgresql://`
- Copy exact URL from PostgreSQL Connect tab

### Deploy keeps failing
- Check all variable names are spelled correctly
- No spaces before/after values
- DATABASE_URL should have NO quotes around it

---

## Need Help?

Your JWT_SECRET is ready:
```
cfc185e12f171407b59907b7c5f2314ca2e7d88c1631e209da480ed38b3d11b1
```

Just paste it in Railway Variables as `JWT_SECRET`!
