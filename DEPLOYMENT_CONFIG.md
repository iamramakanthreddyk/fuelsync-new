# Railway + Vercel Configuration Files

## Add These Files to Your Repository

---

## File 1: `backend/.env.example` (if not exists)

Create this in your backend directory for others to know what env vars are needed:

```env
# Server Configuration
NODE_ENV=production
PORT=3001
DEBUG=false

# Database (PostgreSQL from Railway)
DB_DIALECT=postgres
DATABASE_URL=postgres://postgres:password@localhost:5432/fuelsync

# JWT Configuration
JWT_SECRET=your-super-secret-key-change-this-in-production-min-64-chars
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGINS=http://localhost:8080,https://your-frontend-url.vercel.app

# Logging
LOG_LEVEL=info

# Azure Services (optional for production)
AZURE_STORAGE_CONNECTION_STRING=
AZURE_COMPUTER_VISION_ENDPOINT=
AZURE_COMPUTER_VISION_KEY=

# Features
ENABLE_OCR=false
ENABLE_FILE_UPLOAD=false
```

---

## File 2: `.env.local` (For Your Local Development)

Create this in your project root directory for local testing:

```env
# Frontend (Vite)
VITE_API_URL=http://localhost:3001/api/v1
```

---

## File 3: `package.json` - Ensure This Exists (Backend)

Your backend/package.json should have:

```json
{
  "name": "fuelsync-backend",
  "version": "2.0.0",
  "description": "FuelSync Backend API",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "db:sync": "node -e \"require('./src/models').syncDatabase({ alter: true }).then(() => process.exit(0))\"",
    "seed": "node scripts/seedEssentials.js",
    "test": "jest",
    "test:integration": "jest tests/integration --detectOpenHandles"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "pg": "^8.11.3",
    "sequelize": "^6.35.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3"
  }
}
```

---

## File 4: `vercel.json` (Frontend Deployment Config)

Create this in your project root (same level as package.json):

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_URL": "@vite-api-url"
  },
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

---

## File 5: `railway.json` (Backend Deployment Config)

Create this in your `backend/` directory:

```json
{
  "build": {
    "builder": "nixpacks",
    "buildCommand": "npm install && npm run db:sync"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "npm start",
    "sleepApplication": false,
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 3,
    "healthchecks": {
      "enabled": true,
      "endpoint": "/api/v1/health"
    }
  }
}
```

---

## File 6: `.gitignore` - Ensure These Are Ignored

Make sure your `.gitignore` has:

```
# Environment variables
.env
.env.local
.env.*.local

# Dependencies
node_modules/
package-lock.json
npm-debug.log

# Build outputs
dist/
build/
.next/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Data
data/
*.db
*.sqlite

# Logs
logs/
*.log
```

**Never commit `.env` files with real secrets!**

---

## Setup Instructions

### Step 1: Add Environment Files

**In your backend directory:**
```bash
cd backend
cp .env.example .env.local
# Edit .env.local with your local database settings
```

### Step 2: Create Vercel Config

In your project root:
```bash
# Create vercel.json
cat > vercel.json << 'EOF'
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "outputDirectory": "dist"
}
EOF
```

### Step 3: Create Railway Config

In your backend directory:
```bash
cd backend
# Create railway.json (use the config above)
```

### Step 4: Commit & Push

```bash
git add .env.example vercel.json backend/railway.json
git commit -m "config: add deployment configurations"
git push origin main
```

---

## Environment Variables to Set in Railway Dashboard

### Backend Service Variables (in Railway):

| Variable | Example Value | Notes |
|----------|--------------|-------|
| `NODE_ENV` | `production` | Required |
| `PORT` | `3001` | Default port |
| `DB_DIALECT` | `postgres` | Must be postgres |
| `DATABASE_URL` | `postgres://user:pass@host:5432/db` | From PostgreSQL service |
| `JWT_SECRET` | `(64-char random string)` | **CHANGE THIS** |
| `JWT_EXPIRES_IN` | `24h` | Token expiry |
| `CORS_ORIGINS` | `https://app.vercel.app` | Your frontend URL |
| `LOG_LEVEL` | `info` | Production logging |

### Frontend Environment Variables (in Vercel):

| Variable | Example Value |
|----------|--------------|
| `VITE_API_URL` | `https://backend-xxxx.railway.app/api/v1` |

---

## Railway Setup Checklist

- [ ] Create Railway project
- [ ] Connect GitHub repository
- [ ] PostgreSQL service auto-created
- [ ] Backend environment variables set
- [ ] DATABASE_URL from PostgreSQL → Backend
- [ ] Deployment successful (green ✅)
- [ ] Get backend URL

---

## Vercel Setup Checklist

- [ ] Create Vercel project
- [ ] Connect GitHub repository
- [ ] Framework: Vite (auto-detected)
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Add VITE_API_URL environment variable
- [ ] Deployment successful (green ✅)
- [ ] Get frontend URL

---

## Verify Deployment

### Test Backend Health

```bash
# Replace with your Railway backend URL
curl https://YOUR-BACKEND-URL/api/v1/health

# Or in browser:
https://YOUR-BACKEND-URL/api/v1/auth/me
```

### Test Frontend Load

```bash
# Should load without errors
https://YOUR-FRONTEND-URL
```

### Test API Connection

```bash
# In browser console (F12):
fetch('https://YOUR-BACKEND-URL/api/v1/stations')
  .then(r => r.json())
  .then(d => console.log(d))
```

---

## Troubleshooting Deployment

### Railway Won't Start

**Check:**
1. Build logs in Railway dashboard
2. DATABASE_URL is set
3. JWT_SECRET is set
4. Node version compatible

**Fix:**
```bash
# Redeploy manually in Railway dashboard
# Or push a new commit: git push origin main
```

### Vercel Build Fails

**Check:**
1. Build logs in Vercel dashboard
2. npm run build works locally
3. All dependencies in package.json

**Fix:**
```bash
# Verify locally
npm run build
npm run preview

# Then redeploy
```

### CORS Errors

**Check:**
1. Frontend URL matches CORS_ORIGINS in backend
2. Backend redeployed after CORS change

**Fix:**
```bash
# In Railway: Set CORS_ORIGINS to exact frontend URL
# Then redeploy backend
```

---

## Next Steps

1. ✅ Add these files to your repository
2. ✅ Commit and push to GitHub
3. ✅ Deploy to Railway & Vercel (see DEPLOY_NOW.md)
4. ✅ Test everything is working
5. ✅ Set up three environments (dev/test/prod)

---

**Ready to deploy? Follow DEPLOY_NOW.md next!**

