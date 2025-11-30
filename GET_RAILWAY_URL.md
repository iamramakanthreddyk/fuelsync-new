# 🔗 How to Get Your Railway Backend URL

## Quick Steps

### 1. Go to Railway Dashboard
- Visit: https://railway.app/dashboard
- Login with your Railway account

### 2. Click Your Project
- Find `fuelsync-new` project
- Click to open it

### 3. Find Backend Service URL

**Method A: Services Tab (Easiest)**
```
1. Click "Services" tab at top
2. Click "Backend" service
3. Look for "Public Domain" section
4. Copy the URL (looks like: https://fuelsync-backend-xxxx.railway.app)
```

**Method B: Deployments Tab**
```
1. Click "Deployments" tab
2. Find latest green ✅ deployment
3. Click it
4. Look for "Public Domain" or "URL" field
5. Copy the full URL
```

**Method C: Settings Tab**
```
1. Click Backend service
2. Click "Settings" tab
3. Scroll to "Domain"
4. Copy the public domain URL
```

---

## What It Looks Like

```
Your Railway URL will be something like:
https://fuelsync-backend-production-abc123.railway.app

You'll use this for:
✅ Testing backend: curl https://fuelsync-backend-xxxx.railway.app/api/v1/auth/me
✅ Vercel VITE_API_URL: https://fuelsync-backend-xxxx.railway.app/api/v1
✅ Sharing with team
```

---

## Test It Works

```bash
# Copy your URL and run:
curl https://YOUR-BACKEND-URL/api/v1/auth/me

# Should return (401 is OK):
{
  "success": false,
  "error": "Unauthorized"
}

# If you see that ✅ = Backend is running!
```

---

## If You Don't See a URL Yet

**Backend still building?**
```
1. Go to Railway Dashboard
2. Click Backend service
3. Look at "Deployments" tab
4. Is there a green ✅?
   - YES = Building complete, URL should be visible
   - NO = Still building, wait 5-10 minutes
```

**Build failed?**
```
1. Click latest deployment (red ❌)
2. Click "View Logs"
3. Look for error message
4. Common: "Cannot find module 'express'"
   - FIX: Check railway.json has buildCommand: "cd backend && npm install"
   - Push fix to GitHub
```

---

## Complete URL Format

Your backend URL is:
```
https://YOUR-BACKEND-DOMAIN.railway.app/api/v1
```

Examples:
- ✅ https://fuelsync-backend-prod-1234.railway.app/api/v1
- ✅ https://fuelsync-app-xyz.railway.app/api/v1

---

## Where to Use This URL

1. **Test locally:**
   ```bash
   curl https://YOUR-URL/api/v1/auth/me
   ```

2. **In Vercel (VITE_API_URL):**
   ```
   https://YOUR-URL/api/v1
   ```

3. **Share with team:**
   ```
   Backend is live at: https://YOUR-URL
   ```

---

## 📋 Checklist

```
☐ Logged into Railway dashboard
☐ Found fuelsync-new project
☐ Clicked Backend service
☐ Found "Public Domain" section
☐ Copied the full URL
☐ Tested with curl command
☐ Saved URL for Vercel setup
```
