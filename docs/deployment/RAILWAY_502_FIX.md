# 502 Bad Gateway Fix for Railway Deployment

## Root Cause Analysis

### The Problem
When you hit `https://fuelsync-new-production.up.railway.app/api/v1/auth/login`, you get a **502 Bad Gateway**. This happens because:

1. **Missing Environment Variable**: `JWT_SECRET` is NOT set in Railway
2. **Silent Crash**: When login request reaches `/api/v1/auth/login`, the controller calls `generateToken()` 
3. `generateToken()` calls `getJwtSecret()` which throws an error
4. This throws an UNHANDLED error, crashing the Node process
5. Railway's proxy returns 502 since the backend crashed

### Why Other Endpoints Work
- `/health` endpoint returns OK (no JWT needed)
- Base URL works (just static responses)
- But ANY endpoint requiring JWT or making server requests fails

---

## Solution

### Step 1: Check Current Railway Environment Variables

Go to Railway Dashboard → Your Project → Variables (in Settings)

**Look for these keys:**
- ❌ `JWT_SECRET` - MISSING (this is the problem!)
- ✓ `DATABASE_URL` - Should exist
- ✓ `NODE_ENV` - Should be `production`

### Step 2: Add Missing Environment Variables to Railway

In Railway Dashboard, add these to your environment variables:

```
JWT_SECRET=your-very-long-random-secret-key-at-least-32-characters-please
JWT_EXPIRATION=24h
NODE_ENV=production
PORT=3001
```

**For JWT_SECRET, use something like:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
```

Or generate one with:
```bash
# On Windows PowerShell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -Count 64 | ForEach-Object { [char](33 + (Get-Random -Maximum 93)) } | Join-String)))
```

### Step 3: Verify the Fix

After adding JWT_SECRET to Railway:

1. Go to Railway Dashboard
2. Click "Deploy" or wait for automatic redeploy
3. Watch the deployment logs - should complete successfully
4. Test the endpoint:

```bash
curl -X POST https://fuelsync-new-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fuelsync.com","password":"password123"}'
```

**Expected responses:**
- ✅ 200 OK with token → JWT_SECRET is working
- ❌ 401 Invalid email or password → Login failed but endpoint is working
- ❌ 502 Bad Gateway → JWT_SECRET still missing

---

## Why This Happens

### Current Flow (BROKEN - No JWT_SECRET)

```
POST /api/v1/auth/login
  ↓
authController.login()
  ↓
generateToken(user.id, user.role)
  ↓
getJwtSecret() - THROWS ERROR!
  ↓
No catch handler → Process crashes → Railway returns 502
```

### Fixed Flow (After Setting JWT_SECRET)

```
POST /api/v1/auth/login
  ↓
authController.login()
  ↓
generateToken(user.id, user.role)
  ↓
getJwtSecret() - Returns JWT_SECRET from environment ✅
  ↓
Token generated successfully
  ↓
Return 200 with token
```

---

## Code Locations Affected

The issue is in: `backend/src/controllers/authController.js`

```javascript
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;  // ← UNDEFINED in Railway!
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set');
  }
  return secret;
};
```

And: `backend/src/middleware/auth.js`

```javascript
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;  // ← UNDEFINED in Railway!
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.');
  }
  return secret;
};
```

---

## Railway Environment Variables Checklist

- [ ] `JWT_SECRET` - Set to a strong random string (32+ characters)
- [ ] `DATABASE_URL` - PostgreSQL connection URL (auto-added by Railway)
- [ ] `NODE_ENV` - Set to `production`
- [ ] `PORT` - Set to `3001` (Railway default)
- [ ] `CORS_ORIGINS` - Set to your frontend URL (e.g., `https://fuelsync-new.vercel.app`)

---

## Testing the Fix

### Test 1: Health Check (Should Always Work)
```bash
curl https://fuelsync-new-production.up.railway.app/health
# Expected: {"status":"ok","timestamp":"...","version":"2.0.0"}
```

### Test 2: Login with Wrong Credentials (JWT Should Work)
```bash
curl -X POST https://fuelsync-new-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'
# Expected: 401 Unauthorized (server didn't crash)
```

### Test 3: Login with Correct Credentials
```bash
curl -X POST https://fuelsync-new-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fuelsync.com","password":"adminPassword123"}'
# Expected: 200 OK with token
```

If any of these return 502, JWT_SECRET is still not set correctly.

---

## Additional Notes

- The server STARTS OK even without JWT_SECRET
- The crash happens when a request comes in that needs JWT
- This is a "lazy loading" problem - the error only happens at runtime
- Once JWT_SECRET is set, it should work immediately (no restart needed if Railway auto-deploys)

---

## Summary

**The Issue**: JWT_SECRET missing from Railway environment
**The Fix**: Add JWT_SECRET to Railway Variables
**The Result**: 502 errors will become proper 200/401 responses

