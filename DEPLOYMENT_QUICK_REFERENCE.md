# 📱 Deployment Quick Reference Card

## Your 3 Questions Answered

### Q1: What to do?
**A: Follow DEPLOY_NOW.md - 30 minutes**

### Q2: Does Railway support database?
**A: YES! Auto-creates PostgreSQL for you ✅**

### Q3: What about my code?
**A: No changes needed! Deploy as-is ✅**

---

## 🎯 Your Next 30 Minutes

```
15 min: Deploy Backend to Railway
10 min: Deploy Frontend to Vercel
 5 min: Connect them
──────────────────────
30 min: LIVE! 🚀
```

---

## 📋 Railway Backend Checklist

```
☐ railway.app → Dashboard
☐ "+ New Project"
☐ "Deploy from GitHub"
☐ Select fuelsync-new
☐ Wait for auto-detection (5 min)
☐ Set environment variables:
  ☐ NODE_ENV = production
  ☐ JWT_SECRET = (generate)
  ☐ CORS_ORIGINS = (Vercel URL)
  ☐ DATABASE_URL = (copy from PostgreSQL)
☐ Deployment successful (green ✅)
☐ Copy your backend URL
```

---

## 📋 Vercel Frontend Checklist

```
☐ vercel.com → Dashboard
☐ "Add New" → "Project"
☐ Select fuelsync-new
☐ Verify settings:
  ☐ Build: npm run build
  ☐ Output: dist
  ☐ Framework: Vite
☐ Add environment variable:
  ☐ VITE_API_URL = (Railway backend URL)/api/v1
☐ Deploy
☐ Deployment successful (green ✅)
☐ Copy your frontend URL
```

---

## 📋 Connect Them Checklist

```
☐ Go to Railway Backend service
☐ Set CORS_ORIGINS = (your Vercel URL)
☐ Redeploy backend
☐ Wait 2 minutes
☐ Check for green ✅
☐ All connected!
```

---

## 🧪 Testing Checklist

```
☐ Backend responds:
  curl https://YOUR-BACKEND/api/v1/auth/me
  
☐ Frontend loads:
  https://YOUR-FRONTEND/

☐ Can login:
  Email: admin@fuelsync.com
  Password: admin123

☐ Dashboard shows data ✅
```

---

## 🚨 If Something Goes Wrong

| Issue | Fix |
|-------|-----|
| Backend won't start | Check Railway logs, verify env vars |
| CORS error | Set CORS_ORIGINS to Vercel URL |
| Frontend blank | Check Vercel logs, verify VITE_API_URL |
| Can't login | Check backend DATABASE_URL is set |

---

## 💡 Key URLs

```
Railway Dashboard:
https://railway.app/dashboard

Vercel Dashboard:
https://vercel.com/dashboard

Your Live URLs (after deploy):
Frontend: https://your-app.vercel.app
Backend:  https://your-backend.railway.app
```

---

## 🔑 Important Environment Variables

### Railway Backend

```
NODE_ENV=production
PORT=3001
DB_DIALECT=postgres
DATABASE_URL=[copy from PostgreSQL service]
JWT_SECRET=[generate random 64 char]
JWT_EXPIRES_IN=24h
CORS_ORIGINS=[your Vercel URL]
```

### Vercel Frontend

```
VITE_API_URL=[your Railway URL]/api/v1
```

---

## 💰 Cost Summary

| Service | Cost |
|---------|------|
| Railway Backend | $5/month |
| Railway PostgreSQL | $10/month |
| Vercel Frontend | Free |
| **Monthly Total** | **$15/month** |
| **First Month** | **$10** (Railway credit) |

---

## 📖 Documents

| Document | Purpose | Time |
|----------|---------|------|
| DEPLOY_NOW.md | Follow this! | 30 min |
| DEPLOYMENT_VISUAL_GUIDE.md | Diagrams | 5 min |
| DEPLOYMENT_RAILWAY_VERCEL.md | Details | 30 min |
| DEPLOYMENT_CONFIG.md | Config files | 5 min |
| DEPLOYMENT_SUMMARY.md | Q&A | 10 min |

---

## ⚡ Quick Commands

```bash
# Deploy backend (just push to GitHub)
git push origin main

# Railway auto-deploys in 5-10 min
# Vercel auto-deploys in 1-2 min

# To redeploy manually:
# Go to service in dashboard
# Click "..." menu
# Select "Redeploy"
```

---

## 🎉 Success Looks Like

```
✅ Frontend loads at https://app-xxxx.vercel.app
✅ Can see FuelSync login page
✅ Can login with admin@fuelsync.com / admin123
✅ Dashboard shows data
✅ No console errors
✅ API responding (check Network tab)

YOU'RE DEPLOYED! 🚀
```

---

## 🎯 NEXT STEPS

1. **Open**: DEPLOY_NOW.md
2. **Follow**: Step 1 (Railway)
3. **Follow**: Step 2 (Vercel)
4. **Follow**: Step 3 (Connect)
5. **Test**: Everything works ✅
6. **Celebrate**: 🎉

---

**Start now with DEPLOY_NOW.md!**

You'll be live in 30 minutes! ⏱️

