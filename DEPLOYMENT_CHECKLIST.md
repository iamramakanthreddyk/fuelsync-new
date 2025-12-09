git status
git add -A
git commit -m "feat: Update deployment configuration
git push origin main
git add .
git commit -m "feat: Update API URL for production Railway backend"
git push origin main
DEPLOYMENT_CHECKLIST.md moved to `docs/deploy/DEPLOYMENT_CHECKLIST.md`.
Please open `docs/deploy/DEPLOYMENT_CHECKLIST.md` for the deployment checklist and instructions.

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

