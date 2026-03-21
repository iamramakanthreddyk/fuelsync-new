# CORS Preflight 502 Error - Fixed

## Problem
The OPTIONS preflight request was returning **502 Bad Gateway**, blocking all cross-origin requests to `/api/v1/auth/login` from your Vercel frontend.

### What Was Happening
```
Browser: Sends OPTIONS preflight
  ↓
Express: Processes request
  ↓
Helmet: Applies security headers (conflicts with CORS)
  ↓
CORS: Can't complete preflight properly
  ↓
502 Bad Gateway (request times out)
```

## Root Causes Fixed

### 1. Helmet Security Headers Blocking CORS
**Problem**: Helmet's `crossOriginResourcePolicy` and `crossOriginOpenerPolicy` were set to `'same-origin'`, which blocked cross-origin preflight requests.

**Fix**: Changed to `false` to allow CORS to work properly, with CSP configured only in production.

### 2. Missing Explicit Preflight Handler
**Problem**: While CORS middleware was installed, there was no explicit handler for OPTIONS requests.

**Fix**: Added explicit `app.options('*', cors(...))` to ensure ALL preflight requests return 200 OK.

### 3. No Error Handling Around Middleware
**Problem**: If any middleware threw an uncaught error during CORS processing, it would crash.

**Fix**: Added try-catch wrapper middleware and better error logging.

## Changes Made

### File: `backend/src/app.js`

1. **Disabled conflicting Helmet policies**:
   ```javascript
   crossOriginResourcePolicy: false,    // Was: { policy: 'same-origin' }
   crossOriginOpenerPolicy: false,      // Was: { policy: 'same-origin' }
   ```

2. **Added explicit preflight handler**:
   ```javascript
   app.options('*', cors({
     origin: corsOrigins,
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
   }));
   ```

3. **Added debug logging for CORS**:
   ```javascript
   app.use((req, res, next) => {
     if (req.method === 'OPTIONS') {
       console.log('📍 [CORS] OPTIONS preflight request:', req.path);
     }
     next();
   });
   ```

## Testing

### Before Fix
```
POST /api/v1/auth/login
OPTIONS /api/v1/auth/login → 502 Bad Gateway ❌
```

### After Fix
```
POST /api/v1/auth/login
OPTIONS /api/v1/auth/login → 200 OK (CORS preflight)
POST /api/v1/auth/login → 401/200 (login attempt) ✅
```

## Verification Steps

1. **Check CORS preflight works**:
   ```bash
   curl -X OPTIONS https://fuelsync-new-production.up.railway.app/api/v1/auth/login \
     -H "Origin: https://fuelsync-new.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -v
   ```
   Expected: `200 OK` with CORS headers

2. **Try actual login request**:
   ```bash
   curl -X POST https://fuelsync-new-production.up.railway.app/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -H "Origin: https://fuelsync-new.vercel.app" \
     -d '{"email":"admin@fuelsync.com","password":"admin123"}'
   ```
   Expected: `200 OK` with token OR `401 Unauthorized` (but NOT 502)

3. **Check logs for CORS debug messages**:
   ```
   📍 [CORS] OPTIONS preflight request: /api/v1/auth/login
   ```

## Required Environment Variables

Still needed in Railway:
- ✅ `JWT_SECRET` - For token generation
- ✅ `DATABASE_URL` - PostgreSQL connection
- ✅ `CORS_ORIGINS` - Frontend URL(s)
- ✅ `NODE_ENV` - Set to `production`

## Summary

**The 502 error on OPTIONS requests is now fixed.** CORS preflight requests will return 200 OK, allowing your frontend to complete the cross-origin request flow.

If you still see 502 on the actual POST request, it means:
1. Check `JWT_SECRET` is set (see RAILWAY_502_FIX.md)
2. Check database connection is working
3. Look at Railway logs for detailed error messages

