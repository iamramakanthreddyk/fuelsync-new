# FuelSync Deployment Guide: Railway + Vercel (Quick Start)

## 📋 What You Need to Know

Your app has:
- **Frontend**: React (Vite) - Deploy to Vercel ✅
- **Backend**: Node.js (Express) - Deploy to Railway ✅
- **Database**: SQLite (local) or PostgreSQL - **Railway provides this!** ✅

---

## ✅ Railway Supports Everything You Need

### What Railway Provides:

```
✅ Node.js Server Hosting
✅ PostgreSQL Database (included!)
✅ Environment Variables Management
✅ Auto-deploy from GitHub
✅ Monitoring & Logs
✅ Free trial credits ($5 credit)
```

**No need to set up database separately - Railway includes PostgreSQL!**

---

## 🚀 Step 1: Deploy Backend to Railway (30 minutes)

### 1.1 Create Railway Project

```bash
# Go to https://railway.app
# Click "Dashboard"
# Click "New Project"
# Select "Deploy from GitHub"
# Choose your fuelsync-new repository
```

### 1.2 Railway Auto-Detects Node.js

When you connect GitHub, Railway will:
- ✅ Detect Node.js project automatically
- ✅ Create PostgreSQL database automatically
- ✅ Start deployment (5-10 minutes)

### 1.3 Configure Environment Variables

In Railway Dashboard:

**Step 1**: Go to your project
**Step 2**: Click on "Backend" service (or your repo name)
**Step 3**: Go to "Variables" tab
**Step 4**: Add these variables:

```
NODE_ENV=production
PORT=3001
DB_DIALECT=postgres
DATABASE_URL=[Railway will provide this - DO NOT COPY YET]
JWT_SECRET=your-super-secret-key-min-32-chars-change-this-1234567890
JWT_EXPIRES_IN=24h
CORS_ORIGINS=https://your-vercel-frontend-url.vercel.app
LOG_LEVEL=info
```

### 1.4 Get Database Connection Details

In Railway Dashboard:

```bash
# Railway auto-created PostgreSQL!
# Click on "PostgreSQL" service (in the same project)
# Click "Variables" tab
# You'll see:

DB_HOST=...railway.internal
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=...
DATABASE_URL=postgres://...
```

**Copy the `DATABASE_URL` and paste into your backend variables!**

### 1.5 Deploy Backend

```bash
# Just push to GitHub and Railway auto-deploys!
git add .
git commit -m "deploy: initial deployment to railway"
git push origin main

# Wait 5-10 minutes
# Check Railway dashboard for "Build Logs"
# Look for green checkmark ✅
```

### 1.6 Get Your Backend URL

After deployment completes:
- Railway gives you a URL like: `https://fuelsync-backend.railway.app`
- Save this URL - you'll need it for frontend

---

## 🚀 Step 2: Deploy Frontend to Vercel (20 minutes)

### 2.1 Create Vercel Project

```bash
# Go to https://vercel.com
# Click "Add New..."
# Select "Project"
# Choose your fuelsync-new repository
```

### 2.2 Configure Build Settings

**Build Command**: 
```
npm run build
```

**Output Directory**:
```
dist
```

**Root Directory**:
```
.
```

### 2.3 Add Environment Variables

Click "Environment Variables" and add:

```
VITE_API_URL=https://fuelsync-backend.railway.app/api/v1
```

**Important**: Use your Railway backend URL from Step 1.6!

### 2.4 Deploy

Click "Deploy" button - Vercel will:
- ✅ Build your React app
- ✅ Deploy to Vercel CDN
- ✅ Give you a URL like `https://fuelsync.vercel.app`

---

## 📝 Environment Variables Reference

### Railway Backend (.env in your code)

```env
# Server
NODE_ENV=production
PORT=3001
DEBUG=false

# Database (PostgreSQL from Railway)
DB_DIALECT=postgres
DATABASE_URL=postgres://postgres:PASSWORD@HOST:5432/railway
DB_HOST=fuelsync-postgres-xxx.railway.internal
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=your-password-from-railway

# JWT & Auth
JWT_SECRET=your-secret-key-min-64-chars-recommended-use-strong-random-string
JWT_EXPIRES_IN=24h

# CORS - Must match your Vercel frontend URL
CORS_ORIGINS=https://your-app.vercel.app

# Logging
LOG_LEVEL=info
```

### Vercel Frontend (.env)

```
VITE_API_URL=https://fuelsync-backend.railway.app/api/v1
```

---

## ✅ Verify Deployment

### Test Backend

```bash
# Open in browser or curl:
https://fuelsync-backend.railway.app/api/v1/auth/me

# Should return 401 (unauthorized) - that's good!
# Means backend is working
```

### Test Frontend

```bash
# Go to https://fuelsync.vercel.app
# Should load login page
# Try logging in with:
Email: admin@fuelsync.com
Password: admin123
```

### Test Connection

```bash
# In browser console (F12 → Console):
fetch('https://fuelsync-backend.railway.app/api/v1/auth/me')
  .then(r => r.json())
  .then(d => console.log(d))

# Should show auth error (normal if not logged in)
```

---

## 🐘 About the Database

### Railway PostgreSQL

Railway automatically provides:
- ✅ PostgreSQL 14+
- ✅ 1GB storage (free tier)
- ✅ Automatic backups
- ✅ Connection pooling
- ✅ No additional cost included in Railway plan

### Your Database Credentials

Railway automatically sets these environment variables:
```
DATABASE_URL         # Full connection string
DB_HOST             # Server address
DB_PORT             # 5432
DB_NAME             # Default: railway
DB_USER             # Default: postgres
DB_PASSWORD         # Auto-generated
```

**You don't set these manually - Railway provides them!**

### First Time Database Setup

When backend first runs on Railway:
```bash
# Railway automatically runs:
npm run db:sync     # Creates all tables

# Then seeds data:
npm run seed        # Adds default users

# Result: Database ready to use!
```

---

## 📊 Cost Breakdown

| Service | Free Tier | After Free |
|---------|-----------|-----------|
| Railway Backend | $5 credit | $5/month starter |
| Railway PostgreSQL | Included | $10/month for 2GB |
| Vercel Frontend | Free forever | $20/mo if needed |
| **Total** | **Free (with credit)** | **$15-20/month** |

---

## 🔧 Common Issues & Fixes

### Issue: "Database connection failed"

**Cause**: Wrong DATABASE_URL in Railway variables  
**Fix**: 
1. Go to Railway PostgreSQL service
2. Copy DATABASE_URL
3. Paste into backend Variables
4. Redeploy

### Issue: "CORS error" in browser console

**Cause**: Frontend URL not in CORS_ORIGINS  
**Fix**:
1. Get your Vercel URL (e.g., fuelsync.vercel.app)
2. Add to Railway backend CORS_ORIGINS
3. Redeploy backend

### Issue: "Failed to build" on Vercel

**Cause**: Usually missing environment variable  
**Fix**:
1. Check build logs in Vercel
2. Add VITE_API_URL to Vercel environment
3. Redeploy

### Issue: "Backend won't start"

**Cause**: Environment variables not set  
**Fix**:
1. Check Railway build logs
2. Verify DATABASE_URL is set
3. Verify JWT_SECRET is set
4. Redeploy

---

## 🔄 Deployment Workflow

### After Initial Setup

```bash
# 1. Make changes locally
npm run dev          # Test frontend
npm run dev (backend) # Test backend

# 2. When ready to deploy
git add .
git commit -m "feat: your changes"
git push origin main

# 3. Railway auto-deploys backend (5-10 min)
# 4. Vercel auto-deploys frontend (1-2 min)
# 5. Check both dashboards for green ✅
# 6. Test on live URLs
```

---

## 📱 API Endpoints

After deployment, your API is at:

```
Backend URL: https://fuelsync-backend.railway.app/api/v1

Available endpoints:
POST   /auth/login
GET    /auth/me
GET    /stations
POST   /stations
GET    /sales
POST   /readings
... (see backend docs for complete list)
```

---

## 📞 Quick Checklist

- [ ] Railway account created ✅
- [ ] Vercel account created ✅
- [ ] GitHub connected to Railway ✅
- [ ] GitHub connected to Vercel ✅
- [ ] Backend environment variables set ✅
- [ ] Frontend environment variables set ✅
- [ ] Backend deployed & running ✅
- [ ] Frontend deployed & loading ✅
- [ ] Can login on frontend ✅
- [ ] API calls working ✅

---

## 🎉 You're Deployed!

Your FuelSync is now live on:
- **Frontend**: https://your-app.vercel.app
- **Backend**: https://your-backend.railway.app
- **Database**: PostgreSQL on Railway (automatic!)

**Next Steps:**
1. Test with demo user (admin@fuelsync.com / admin123)
2. Create test user account
3. Set up three environments (dev/test/prod) - see IMPLEMENTATION_GUIDE.md
4. Monitor costs on Railway dashboard

---

## 💡 Tips

### Monitoring
- Railway Dashboard: Check logs, CPU, memory
- Vercel Dashboard: Check build logs, analytics
- Both show real-time metrics

### Scaling
- Backend: Railway auto-scales with load
- Database: PostgreSQL grows with data (upgrade if needed)
- Frontend: Vercel CDN handles traffic

### Updates
- Just `git push` - both services auto-deploy
- Takes 5-10 minutes total
- Zero downtime deployments

---

**Congratulations! 🎉 Your app is live!**

