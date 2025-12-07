# FuelSync Implementation Guide: Step-by-Step

## Getting Started with Multiple Environments

### Step 1: Environment Variables Setup

Create three environment files in your `backend/` directory:

#### `backend/.env.local` (Development - Your Computer)
```env
# Server
NODE_ENV=development
PORT=3001
DEBUG=true

# Database (Local SQLite or PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fuelsync_dev
DB_USER=postgres
DB_PASSWORD=your_local_password
DB_DIALECT=postgres

# JWT
JWT_SECRET=dev-secret-key-this-is-just-for-development-change-in-production
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGINS=http://localhost:8080,http://localhost:3000

# Features
ENABLE_RECEIPT_PARSING=false
ENABLE_FILE_UPLOAD=false
```

#### `backend/.env.testing` (Testing - Railway Staging Server)
```env
# Server
NODE_ENV=testing
PORT=3001

# Database (Will be Railway PostgreSQL)
DB_HOST=your-railway-testing-db-host.railway.internal
DB_PORT=5432
DB_NAME=fuelsync_testing
DB_USER=postgres
DB_PASSWORD=your_railway_password
DB_DIALECT=postgres

# JWT
JWT_SECRET=testing-secret-key-min-32-chars-required-for-safety
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGINS=https://fuelsync-testing.vercel.app,http://localhost:8080

# Features
ENABLE_RECEIPT_PARSING=false
ENABLE_FILE_UPLOAD=true

# Test Configuration
ALLOWED_TEST_USERS=testuser@fuelsync-demo.app,admin@fuelsync-demo.app
DATABASE_RESET_ENABLED=true

# Logging
LOG_LEVEL=info
```

#### `backend/.env.production` (Production - Real Users)
```env
# Server
NODE_ENV=production
PORT=3001
DEBUG=false

# Database (Will be Railway PostgreSQL - Production)
DB_HOST=your-railway-prod-db-host.railway.internal
DB_PORT=5432
DB_NAME=fuelsync_production
DB_USER=postgres_prod
DB_PASSWORD=your_secure_railway_password_64_chars_min
DB_DIALECT=postgres

# JWT
JWT_SECRET=production-secret-key-min-64-chars-required-use-strong-random-key
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=https://fuelsync.app,https://www.fuelsync.app

# Features
ENABLE_RECEIPT_PARSING=false
ENABLE_FILE_UPLOAD=true

# Security
DATABASE_RESET_ENABLED=false
ALLOW_USER_DELETION=false

# Logging
LOG_LEVEL=warn
LOG_TO_FILE=true

# Backups
ENABLE_BACKUPS=true
BACKUP_SCHEDULE=0 2 * * *
```

---

### Step 2: Update package.json with Environment-Aware Scripts

**`backend/package.json`:**
```json
{
  "scripts": {
    "start": "NODE_ENV=production node src/server.js",
    "dev": "NODE_ENV=development nodemon src/server.js",
    "dev:testing": "NODE_ENV=testing nodemon src/server.js",
    
    "db:sync": "NODE_ENV=development node -e \"require('./src/models').syncDatabase({ alter: true })\"",
    "db:sync:testing": "NODE_ENV=testing node -e \"require('./src/models').syncDatabase({ alter: true })\"",

    "seed": "node scripts/seedEssentials.js",

    "db:reset": "NODE_ENV=development node -e \"require('./src/models').syncDatabase({ force: true })\"",
    "db:reset:testing": "NODE_ENV=testing node -e \"require('./src/models').syncDatabase({ force: true })\"",
    
    "test": "jest",
    "test:watch": "jest --watch",
    "test:integration": "jest tests/integration --detectOpenHandles"
  }
}
```

---

### Step 3: Create a Git Workflow

```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# Make changes, then commit
git add .
git commit -m "feat: description of your changes"
git push origin feature/your-feature-name

# Create Pull Request to develop branch
# After PR approval → Auto-deploys to testing environment

# When ready for production
# Create PR from develop → main
# After approval → Auto-deploys to production
```

**Key Branches:**
- `main` - Production (locked, requires PR review)
- `staging` - Testing environment (auto-deploys)
- `develop` - Development (where features merge)
- `feature/*` - Feature branches (merge to develop)

---

### Step 4: Local Development Workflow

```bash
# Terminal 1: Start Backend (Development)
cd backend
npm install
npm run dev
# Server runs on http://localhost:3001
# Using local database
```

```bash
# Terminal 2: Start Frontend (Development)
cd ../
npm install
npm run dev
# Frontend runs on http://localhost:8080
# Connected to http://localhost:3001
```

**Essential Data Setup:**
```bash
# Reset local database and seed with essential data
cd backend
npm run db:reset        # Clears all data
npm run seed            # Seeds only essential data (plans + super admin)

# Default super admin login:
# Email: admin@fuelsync.com
# Password: admin123
```

---

### Step 5: Deploying to Testing Environment (Railway)

#### 5.1 Sign Up & Create Project on Railway

```bash
# 1. Go to https://railway.app
# 2. Sign up with GitHub
# 3. Create new project
# 4. Connect your GitHub repository
# 5. Configure environment variables (copy from .env.testing)
```

#### 5.2 Deploy Backend to Railway

**`backend/railway.json` (Railway Configuration):**
```json
{
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 5
  }
}
```

**Steps:**
1. Push code to GitHub
2. Railway auto-detects Node.js project
3. Sets up PostgreSQL automatically
4. Deploys backend on: `https://fuelsync-testing-backend.railway.app`

#### 5.3 Deploy Frontend to Vercel

```bash
# 1. Go to https://vercel.com
# 2. Sign up / Sign in with GitHub
# 3. Import your repository
# 4. Configure build settings:
Build Command: npm run build
Output Directory: dist

# 5. Set environment variables:
VITE_API_URL=https://fuelsync-testing-backend.railway.app

# 6. Deploy → Frontend on: https://fuelsync-testing.vercel.app
```

---

### Step 6: Create Test User Account

```bash
# In testing environment, create this user:

Email: testuser@fuelsync-demo.app
Password: TestUser123!
Role: Pump Owner
Plan: Premium (for full feature testing)
Station: Demo Station
```

**Procedure:**
```bash
# 1. Go to https://fuelsync-testing.vercel.app
# 2. Click "Register"
# 3. Create account with above credentials
# 4. Login with test user
# 5. Create test station, pumps, nozzles
# 6. Test receipt upload, sales tracking, etc.

# Data stays in testing DB ✓
# Production never affected ✓
# Can reset anytime ✓
```

---

### Step 7: Database Backup & Reset Procedures

#### Backup Strategy

```bash
# Railway automatically backs up daily
# Retention: 7 days (free tier)
# Manual backup:

# Export from Railway CLI
railway data export

# Or use Railway dashboard:
# Dashboard → Settings → Backup & Restore
```

#### Reset Procedures

**For Development (Local):**
```bash
# ⚠️ CAREFUL: This deletes all local data
cd backend
npm run db:reset        # Force reset
npm run seed            # Re-seed essential data
npm run dev             # Restart server
```

**For Testing (Railway):**
```bash
# Via Railway Dashboard:
# 1. Go to Railway Dashboard
# 2. Select fuelsync-testing project
# 3. Go to PostgreSQL plugin
# 4. Click "Backup" to create manual backup
# 5. Click "Delete Data" to reset
# 6. Go to Backend service
# 7. Trigger redeploy: git push origin staging
```

**For Production (DO NOT RESET):**
```bash
# Never use db:reset in production!
# If data recovery needed:
# 1. Contact Railway support
# 2. Request restore from backup
# 3. Verify data before release
```

---

## Test Data Management

### Creating Test Data

```javascript
// Create test user via API
POST http://localhost:3001/api/v1/auth/register
{
  "email": "testuser@fuelsync-demo.app",
  "password": "TestUser123!",
  "firstName": "Test",
  "lastName": "User",
  "role": "pump_owner"
}

// Response:
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "email": "testuser@fuelsync-demo.app",
    "role": "pump_owner",
    "plan": "basic"
  }
}
```

### Tagging Test Data

```sql
-- In testing environment, mark as test data:
UPDATE users 
SET is_test_user = true, created_for_testing = true
WHERE email LIKE '%@fuelsync-demo.app%';

-- Later, easily reset test data:
DELETE FROM nozzle_readings WHERE user_id IN (
  SELECT id FROM users WHERE is_test_user = true
);
```

### Automated Test Data Cleanup

```javascript
// backend/src/middleware/testDataCleanup.js
const testDataCleanup = async (req, res, next) => {
  if (process.env.NODE_ENV === 'testing') {
    // Only run in testing environment
    const testUsers = await User.findAll({
      where: { isTestUser: true },
      order: [['createdAt', 'DESC']],
      limit: 10  // Keep only last 10 test runs
    });
    
    // Delete old test data
    for (const user of testUsers) {
      if (Date.now() - user.createdAt > 7 * 24 * 60 * 60 * 1000) {
        await user.destroy();
      }
    }
  }
  next();
};
```

---

## Continuous Development Workflow

### Your Daily Workflow

```bash
# Morning: Check test environment
1. Visit https://fuelsync-testing.vercel.app
2. Test with: testuser@fuelsync-demo.app / TestUser123!
3. Verify no data loss from previous day

# During development
1. Create feature branch: git checkout -b feature/xyz
2. Make changes locally
3. Test locally: npm run dev
4. Commit: git commit -m "feat: description"
5. Push: git push origin feature/xyz
6. Create PR → develop
7. Review code, check tests pass
8. Merge to develop → Auto-deploys to testing
9. Test on testing environment
10. Create PR develop → main (when feature complete)
11. Merge to main → Auto-deploys to production

# Evening: Monitor for issues
1. Check Railway dashboard for errors
2. Check Vercel for build status
3. Monitor database performance
```

---

## Monitoring & Alerts

### Cost Monitoring

```javascript
// Create simple cost tracker
// .github/workflows/cost-alert.yml

name: Monthly Cost Alert
on:
  schedule:
    - cron: '0 9 1 * *'  # 1st of each month at 9 AM

jobs:
  cost-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check Railway costs
        run: |
          echo "Railway Backend: $5/month"
          echo "Railway Database: $10/month"
          echo "Vercel Frontend: Free"
          echo "Total: $15/month"
          # Send email/Slack alert
```

### Performance Monitoring

```bash
# Monitor API performance
1. Railway Dashboard → Logs
2. Filter by errors or slow queries
3. Set up alerts for high CPU/memory

# Database performance
1. Railway → PostgreSQL → Metrics
2. Monitor: connections, queries, storage
3. Alert if storage > 80% capacity

# Frontend performance
1. Vercel → Analytics
2. Monitor: build size, lighthouse score
3. Alert on performance regression
```

---

## Ready for Multi-Platform?

After comfortable with three environments, you're ready for:

### Mobile App (React Native)

```bash
# Create monorepo structure
mkdir packages
cd packages

npm create expo-app shared
npm create expo-app mobile

# Share services between web and mobile
packages/shared/services/api.ts
```

### Windows App (Tauri)

```bash
# Create Tauri desktop app
npm create tauri-app

# Use same services:
packages/shared/services/api.ts
```

---

## Quick Reference: Essential Commands

```bash
# Development
npm run dev                   # Start backend (local)
npm run db:reset             # Reset local database
npm run db:seed              # Seed test data

# Testing
npm run dev:testing          # Start with testing config
npm run db:reset:testing     # Reset testing database
npm run db:seed:testing      # Seed testing database

# Production
npm start                    # Start backend (production)

# Git workflow
git checkout develop         # Start feature work
git checkout -b feature/xyz  # Create feature branch
git push origin feature/xyz  # Push to GitHub
# → Create PR → Merge → Auto-deploy to testing

# Database
npm run test                 # Run tests
npm run test:integration     # Run integration tests
npm run test:watch          # Watch mode for testing
```

---

## Troubleshooting

### Issue: Database connection fails locally
```bash
# Check PostgreSQL is running
psql -U postgres

# If not installed, use SQLite instead:
# Change DB_DIALECT=sqlite in .env.local
# Set DB_NAME=./dev.sqlite (file-based)
npm run db:sync
npm run db:seed
npm run dev
```

### Issue: Testing environment not updating
```bash
# Force redeploy on Railway
git push origin staging  # Push to staging branch
# Railway will auto-rebuild

# Or manually on Railway dashboard:
# Select service → Redeploy
```

### Issue: Test data corrupted
```bash
# Simply reset testing database:
npm run db:reset:testing
npm run db:seed:testing

# Your local and production data are untouched ✓
```

### Issue: High costs on Railway
```bash
# Check what's consuming resources
# Railway Dashboard → Metrics

# Optimize:
1. Add database indexes for slow queries
2. Archive old data (older than 6 months)
3. Compress API responses
4. Use Railway's free tier longer
5. Consider switching to Render.com if cheaper
```

---

**You're now ready to maintain FuelSync efficiently across development, testing, and production environments!**

