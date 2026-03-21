ARCHITECTURE_OVERVIEW moved to `docs/architecture/ARCHITECTURE_OVERVIEW.md` to consolidate documentation.
Please use the `docs/` folder for authoritative, organized docs.

**Frontend Entry Point** (`/src/lib/api-client.ts`):
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // ... rest of config
});

export default apiClient;
```

**All API calls use this client**:
```typescript
// Every component uses the same client
const { data } = await apiClient.get('/stations');
```

**Environment Variables** (not code):
```env
# .env (development)
VITE_API_URL=http://localhost:3001/api/v1

# .env.local (local dev)
VITE_API_URL=http://localhost:3001/api/v1

# .env.production.local (for Vercel)
VITE_API_URL=https://fuelsync-new-production.up.railway.app/api/v1
```

**How to Change Servers**:
1. Update ONE environment variable
2. Rebuild/redeploy
3. All API calls use new URL automatically

---

## 📊 Data Flow Example: Login

### Happy Path
```
User → Login Page
    ↓
User enters: admin@fuelsync.com / admin123
    ↓
Frontend: POST /api/v1/auth/login
  Body: { email: "admin@fuelsync.com", password: "admin123" }
    ↓
Backend receives request
  ↓ Middleware validates JSON
  ↓ Route handler processes
  ↓ Checks email exists in database
  ↓ Compares password hash
  ↓ If match, generates JWT token
    ↓
Backend: Return 200 OK
  Response: { success: true, token: "eyJhbGc...", user: { id, email, role } }
    ↓
Frontend stores token in localStorage
    ↓
Frontend sets Authorization header for future requests
    ↓
Redirects to dashboard
    ↓
Frontend: GET /api/v1/stations
  Header: Authorization: Bearer eyJhbGc...
    ↓
Backend middleware verifies JWT
    ↓
Backend queries database for user's stations
    ↓
Backend: Return 200 OK
  Response: { success: true, data: [station1, station2, ...] }
    ↓
Frontend displays stations to user
```

### Error Path (Invalid Password)
```
User → Login Page
    ↓
User enters: admin@fuelsync.com / wrongpassword
    ↓
Frontend: POST /api/v1/auth/login
    ↓
Backend finds user
    ↓
Compares password hash → MISMATCH
    ↓
Backend: Return 401 Unauthorized
  Response: { success: false, error: "Invalid credentials" }
    ↓
Frontend shows error message: "Invalid email or password"
    ↓
User stays on login page and can try again
```

---

## 🚀 Deployment Flow

### Step 1: Code Change
```
Developer → Edit code locally
    ↓
git commit
git push origin main
```

### Step 2: GitHub Receives Push
```
GitHub → Webhook to Railway
```

### Step 3: Railway Build
```
Railway pulls latest code
    ↓
Builds Docker image from backend/Dockerfile:
  - installs dependencies (npm install)
  - copies source code
  - creates final image
    ↓
Pushes image to Railway registry
```

### Step 4: Railway Deploy
```
Railway starts new container:
    ↓
npm run db:migrate
  - Sequelize CLI reads migrations
  - Compares with SequelizeMeta table
  - Runs new migrations (creates tables/fields)
  - Updates SequelizeMeta
    ↓
node src/server.js
  - Express app starts
  - Loads environment variables
  - Binds to port 3001
  - Logs: "Server listening on port 3001"
    ↓
Health check passes
    ↓
Request routing enabled
    ↓
Container is live
```

### Step 5: Requests Flow
```
User at https://fuelsync-new.vercel.app
    ↓
Clicks something that needs data
    ↓
Frontend makes request to VITE_API_URL
    ↓
Railway load balancer receives request
    ↓
Forwards to backend container
    ↓
Express routes request
    ↓
Database query executes
    ↓
Response sent back to frontend
    ↓
User sees updated data
```

---

## 🎯 Clear Differentiation

### Frontend Handles
✓ User interface (buttons, forms, lists)
✓ User interactions (clicks, inputs, navigation)
✓ Display and formatting (cards, tables, charts)
✓ Local state (form data, UI toggles)
✓ Making HTTP requests

### Backend Handles
✓ Database queries (SELECT, INSERT, UPDATE)
✓ Authentication (validating tokens, passwords)
✓ Business logic (calculations, validations)
✓ Data transformation
✓ Error handling and logging

### Database Handles
✓ Storing data persistently
✓ Data integrity (unique emails, valid IDs)
✓ Performance (indexing)
✓ Relationships (user → station → pump)

**Never Mix Concerns**:
```
❌ Frontend directly accesses database
❌ Frontend contains business logic
❌ Backend stores data in memory (lost on restart)
❌ Database contains UI logic
```

---

## 📁 File Structure Summary

```
fuelsync-new/
│
├── src/                          # FRONTEND
│   ├── main.tsx                 # Entry point
│   ├── lib/api-client.ts        # API communication (single point)
│   ├── pages/                   # Page components
│   ├── components/              # Reusable UI components
│   └── hooks/                   # React hooks for data fetching
│
├── backend/                      # BACKEND
│   ├── src/
│   │   ├── server.js            # Entry point
│   │   ├── app.js               # Express app setup
│   │   └── routes/              # API endpoints
│   ├── models/                  # Sequelize ORM models
│   ├── migrations/              # Schema versioning
│   ├── config/config.js         # Database connections
│   ├── Dockerfile               # Container definition
│   └── package.json             # Dependencies
│
├── .env                         # Frontend dev environment
├── .env.local                   # Local override (not in git)
├── railway.json                 # Railway deployment config
└── DEPLOYMENT_*.md              # Documentation files
```

---

## 🔄 Change Workflow

### To Add a New Feature
1. **Database Schema** → Add migration in `/backend/migrations/`
2. **Backend API** → Add model in `/backend/models/`, route in `/backend/routes/`
3. **Frontend UI** → Add component in `/src/components/`, page in `/src/pages/`
4. **Frontend API Call** → Use `apiClient` from `/src/lib/api-client.ts`

### To Deploy Changes
1. Test locally (frontend + backend)
2. Commit code
3. Push to main branch
4. Railway auto-deploys backend
5. Vercel auto-deploys frontend
6. Done!

---

## ✅ Complete Checklist

- [ ] Understand frontend loads from VITE_API_URL
- [ ] Understand backend is stateless (all data in DB)
- [ ] Understand migrations run on deployment
- [ ] Know single API URL is in `/src/lib/api-client.ts`
- [ ] Know to change .env files, not code
- [ ] Know backend and frontend are separate deployments
- [ ] Know DATABASE_URL is auto-provided by Railway
- [ ] Ready to deploy!

