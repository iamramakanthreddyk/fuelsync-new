# FuelSync System Diagrams

## 1. Complete Architecture Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      BROWSER USER                               │
│                  https://fuelsync-new.vercel.app                │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                        User Action
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    FRONTEND (VERCEL)                            │
│                   React + Tailwind + Vite                       │
│                                                                 │
│  .env says: VITE_API_URL=https://...up.railway.app/api/v1    │
│                                                                 │
│  src/lib/api-client.ts reads this URL and                      │
│  makes ALL requests using it                                   │
│                                                                 │
│  Example: GET /api/v1/stations becomes:                        │
│  GET https://...up.railway.app/api/v1/stations                │
└──────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
                      (Single Backend URL)
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND (RAILWAY)                            │
│              Node.js + Express + Docker                         │
│                                                                 │
│  Dockerfile runs on startup:                                   │
│  1. npm run db:migrate                                         │
│  2. node src/server.js                                         │
│                                                                 │
│  Routes:                                                        │
│  - GET /health                                                 │
│  - POST /api/v1/auth/login                                     │
│  - GET /api/v1/stations                                        │
│  - POST /api/v1/readings                                       │
│  - ... more endpoints                                          │
│                                                                 │
│  Each route:                                                    │
│  1. Validates JWT token                                        │
│  2. Queries database                                           │
│  3. Returns JSON response                                      │
└──────────────────────────────────────────────────────────────────┘
                              ↓ PostgreSQL
                        (Migrations run)
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│               DATABASE (RAILWAY POSTGRES)                       │
│                                                                 │
│  Tables created by migrations:                                 │
│  - plans (id, name, price)                                     │
│  - users (id, email, password, role)                           │
│  - stations (id, name, owner_id)                               │
│  - pumps (id, station_id, name)                                │
│  - nozzles (id, pump_id, fuel_type)                            │
│  - nozzle_readings (id, nozzle_id, liters, timestamp)          │
│  - creditors (id, station_id, name)                            │
│  - credit_transactions (id, creditor_id, amount)               │
│  - ... more tables                                             │
│                                                                 │
│  All data persists here across server restarts                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend → Backend Communication

```
FRONTEND                              BACKEND                    DATABASE
─────────────────────────────────────────────────────────────────────────

User clicks "List Stations"
    ↓
apiClient.get('/stations')
    ↓
Uses VITE_API_URL + '/stations'
    ↓
Makes HTTP GET request
    ↓
                                 Receives GET /api/v1/stations
                                 ↓
                                 Middleware validates JWT
                                 ↓
                                 Route handler processes
                                 ↓
                                 Queries database
                                 ↓
                                            SELECT * FROM stations WHERE owner_id = ?
                                            ↓
                                            Returns [station1, station2, ...]
                                 ↓
                                 Formats response
                                 ↓
Returns JSON: {success: true, data: [...]}
    ↓
Frontend receives response
    ↓
Updates React state
    ↓
Component re-renders
    ↓
User sees list of stations in UI

Total time: ~200ms
```

---

## 3. Authentication Flow

```
USER INTERFACE                FRONTEND                        BACKEND
──────────────────────────────────────────────────────────────────────

User enters email and password
    ↓
Clicks "Login" button
    ↓
                            onClick handler triggers
                            ↓
                            Collects email + password
                            ↓
                            apiClient.post('/auth/login', {
                              email: 'admin@fuelsync.com',
                              password: 'admin123'
                            })
                            ↓
                            Sends HTTP POST request to:
                            https://...up.railway.app/api/v1/auth/login
                                                        ↓
                                                        Receives POST /auth/login
                                                        ↓
                                                        Finds user by email in DB
                                                        ↓
                                                        Compares password hash
                                                        ↓
                                                        Generates JWT token
                                                        ↓
                                                        Returns: {
                                                          success: true,
                                                          token: "eyJhbGc...",
                                                          user: { id, name, role }
                                                        }
                            ↓
                            Receives response
                            ↓
                            Stores token in localStorage
                            ↓
                            Sets Authorization header:
                            "Bearer eyJhbGc..."
                            ↓
                            Redirects to /dashboard
                                                        ↓
                            Now for ALL requests, includes:
                            Authorization: Bearer eyJhbGc...
                                                        ↓
                                                        Backend validates token
                                                        ↓
                                                        Extracts user info from token
                                                        ↓
                                                        Allows access to protected resources

User sees dashboard
```

---

## 4. Database Schema Relationships

```
plans
  ↓ (1:many)
    users (owner, manager, employee)
      ↓ (1:many)
        stations
          ↓ (1:many)
            pumps
              ↓ (1:many)
                nozzles (diesel, petrol, premium)
                  ↓ (1:many)
                    nozzle_readings (timestamp, liters, amount)

stations
  ↓ (1:many)
    creditors
      ↓ (1:many)
        credit_transactions (amount, timestamp)

stations
  ↓ (1:many)
    expenses

stations
  ↓ (1:many)
    shifts
