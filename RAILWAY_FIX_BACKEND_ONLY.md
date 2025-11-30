# 🚨 Railway Deployment Fix - Backend Only

## Your Issue

Railway is treating your project as **frontend (Vite)** instead of **backend (Node.js)**.

**Error message:**
```
↳ Detected Node
↳ Using bun package manager
↳ Deploying as vite static site  ❌ WRONG!
```

**Should be:**
```
↳ Detected Node
↳ Deploying as Node.js backend ✅ CORRECT!
```

---

## 🎯 Solution: Deploy Backend Only to Railway

### Step 1: Delete Your Current Railway Deployment

1. Go to Railway Dashboard
2. Click your project
3. Click "Settings"
4. Click "Danger Zone"
5. Click "Delete Project"
6. Type the project name to confirm

---

### Step 2: Create NEW Railway Project - Backend Only

1. Go to https://railway.app/dashboard
2. Click "+ New Project"
3. Click "Deploy from GitHub"
4. Select your repo: `fuelsync-new`
5. **IMPORTANT**: When prompted, select the **SUBDIRECTORY**: `backend`

```
This tells Railway: "Deploy ONLY the backend folder"
```

---

### Step 3: Wait for Auto-Detection

Railway will now detect:
- ✅ Node.js backend (not Vite!)
- ✅ Create PostgreSQL database
- ✅ Setup environment variables

---

### Step 4: Configure Environment Variables

Once Railway creates the project:

**1. Go to Backend Service → Variables**

Add these:
```
NODE_ENV=production
PORT=3001
DB_DIALECT=postgres
JWT_SECRET=[generate 64-char random string]
JWT_EXPIRES_IN=24h
LOG_LEVEL=info
```

**2. Go to PostgreSQL Service → Variables**

Copy the `DATABASE_URL`

**3. Go to Backend Service → Variables**

Add:
```
DATABASE_URL=[paste what you copied]
```

---

### Step 5: Deploy

Railway auto-deploys. Wait 5-10 minutes for:
- ✅ Backend to build
- ✅ Database to initialize
- ✅ Green checkmark to appear

---

## Alternative: Create `railway.json` for Root Deployment

If you want to deploy from root directory, create this file:

**File: `railway.json`**

```json
{
  "build": {
    "builder": "nixpacks",
    "buildCommand": "cd backend && npm install && npm run db:sync"
  },
  "deploy": {
    "startCommand": "cd backend && npm start",
    "sleepApplication": false,
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 3
  }
}
```

Then:
1. Commit and push: `git push origin main`
2. Railway will see this config
3. Will deploy backend correctly

---

## ✅ After Deployment Works

You'll have:
- ✅ Backend running: `https://backend-xxxx.railway.app`
- ✅ PostgreSQL database created
- ✅ Environment variables configured
- ✅ API responding

Test it:
```bash
curl https://backend-xxxx.railway.app/api/v1/auth/me
# Should return auth error (good sign!)
```

---

## 🎯 Your Next Steps

### Option 1: Fastest (Delete & Recreate)
1. Delete current Railway project
2. Create NEW project with `backend` subdirectory
3. Wait 10 minutes
4. Done!

### Option 2: Use Config File
1. Create `railway.json` in project root
2. Commit: `git add railway.json && git commit -m "config: add railway deployment"`
3. Push: `git push origin main`
4. Railway auto-redeploys with correct config
5. Wait 10 minutes
6. Done!

**I recommend Option 1** (delete & recreate) - cleaner start.

---

## 🚨 After Backend is Working

Then deploy frontend:
1. Go to Vercel
2. Create NEW project from same repo
3. Vercel will auto-detect Vite
4. Should work correctly

---

## 📞 Need Help?

Check these documents:
- `DEPLOY_NOW.md` - Step by step (but skip Vite issue)
- `DEPLOYMENT_RAILWAY_VERCEL.md` - Detailed troubleshooting
- `DEPLOYMENT_QUICK_REFERENCE.md` - Quick lookup

---

**Try Option 1 now - delete and recreate with `backend` subdirectory!**

Let me know if you need the railway.json file created for you.

