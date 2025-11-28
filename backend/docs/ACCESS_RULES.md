# FuelSync Access Rules & Permissions

## Role Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     SUPER_ADMIN                              │
│   Platform administrator - manages all owners & stations     │
├─────────────────────────────────────────────────────────────┤
│                        OWNER                                 │
│   Business owner - owns multiple stations                    │
├─────────────────────────────────────────────────────────────┤
│                       MANAGER                                │
│   Station manager - assigned to ONE station                  │
├─────────────────────────────────────────────────────────────┤
│                      EMPLOYEE                                │
│   Fuel attendant - assigned to ONE station                   │
└─────────────────────────────────────────────────────────────┘
```

## User Creation Matrix

| Creator      | Can Create        | Notes                                    |
|--------------|-------------------|------------------------------------------|
| super_admin  | owner             | Creates business owners for the platform |
| owner        | manager, employee | For their owned stations only            |
| manager      | employee          | For their assigned station only          |
| employee     | nobody            | Cannot create users                      |

## Station Access Rules

### Who Can Access What Stations?

| Role         | Stations Accessible                                |
|--------------|----------------------------------------------------|
| super_admin  | ALL stations                                       |
| owner        | Only stations where `station.ownerId = user.id`    |
| manager      | Only station where `user.stationId = station.id`   |
| employee     | Only station where `user.stationId = station.id`   |

### Key Relationship Differences

```
OWNER:
- Does NOT have stationId (can own multiple stations)
- Owns stations via Station.ownerId → User.id
- Has planId for subscription limits

MANAGER/EMPLOYEE:
- Has stationId (assigned to one station)
- Does NOT have planId
- Created by owner or above
```

---

## Endpoint Permissions

### Authentication (`/api/v1/auth`)

| Endpoint        | Method | Roles                    | Notes                   |
|-----------------|--------|--------------------------|-------------------------|
| `/login`        | POST   | Public                   | Email + password        |
| `/me`           | GET    | All authenticated        | Get current user        |
| `/logout`       | POST   | All authenticated        | Invalidate token        |

### Users (`/api/v1/users`)

| Endpoint              | Method | Roles                    | Notes                           |
|-----------------------|--------|--------------------------|--------------------------------|
| `/`                   | GET    | All authenticated        | Filtered by role permissions   |
| `/:id`                | GET    | All authenticated        | Must have access to user       |
| `/`                   | POST   | manager+                 | Create user (role rules apply) |
| `/:id`                | PUT    | manager+                 | Update user (access rules)     |
| `/:id`                | DELETE | manager+                 | Deactivate user                |
| `/:id/reset-password` | POST   | All authenticated        | Own password or managed users  |

### Stations (`/api/v1/stations`)

| Endpoint                        | Method | Roles              | Notes                     |
|---------------------------------|--------|---------------------|---------------------------|
| `/`                             | GET    | All authenticated   | Filtered by ownership     |
| `/`                             | POST   | owner, super_admin  | Create new station        |
| `/:id`                          | GET    | All authenticated   | Must have access          |
| `/:id`                          | PUT    | owner, super_admin  | Update station            |
| `/:stationId/staff`             | GET    | All authenticated   | Station staff list        |
| `/:stationId/pumps`             | GET    | All authenticated   | List pumps                |
| `/:stationId/pumps`             | POST   | owner, super_admin  | Create pump               |
| `/pumps/:pumpId/nozzles`        | GET    | All authenticated   | List nozzles              |
| `/pumps/:pumpId/nozzles`        | POST   | owner, super_admin  | Create nozzle             |
| `/:stationId/prices`            | GET    | All authenticated   | Get fuel prices           |
| `/:stationId/prices`            | POST   | manager+            | Set fuel price            |

### Readings (`/api/v1/readings`)

| Endpoint                  | Method | Roles              | Notes                           |
|---------------------------|--------|--------------------|---------------------------------|
| `/form/:nozzleId`         | GET    | employee+          | Get form data for reading entry |
| `/`                       | POST   | employee+          | Submit nozzle reading           |
| `/daily/:date`            | GET    | employee+          | Get readings for a date         |
| `/:id`                    | GET    | employee+          | Get single reading              |
| `/:id/payment`            | PUT    | manager+           | Update payment breakdown        |
| `/:id`                    | DELETE | manager+           | Delete reading                  |

### Credits (`/api/v1/stations/:stationId/...`)

| Endpoint                        | Method | Roles              | Notes                     |
|---------------------------------|--------|---------------------|---------------------------|
| `/creditors`                    | GET    | All authenticated   | List creditors            |
| `/creditors`                    | POST   | manager+            | Add creditor              |
| `/creditors/:id`                | GET    | All authenticated   | Get creditor details      |
| `/creditors/:id`                | PUT    | manager+            | Update creditor           |
| `/credits`                      | POST   | All authenticated   | Record credit sale        |
| `/creditors/:id/settle`         | POST   | owner, super_admin  | Record settlement         |
| `/credit-transactions`          | GET    | All authenticated   | List transactions         |
| `/credit-summary`               | GET    | All authenticated   | Dashboard summary         |

### Expenses (`/api/v1/stations/:stationId/...`)

| Endpoint            | Method | Roles              | Notes                     |
|---------------------|--------|---------------------|---------------------------|
| `/expense-categories` | GET  | All authenticated   | List categories           |
| `/expenses`         | GET    | All authenticated   | List expenses             |
| `/expenses`         | POST   | manager+            | Add expense               |
| `/expenses/:id`     | PUT    | manager+            | Update expense            |
| `/expenses/:id`     | DELETE | manager+            | Delete expense            |
| `/expense-summary`  | GET    | All authenticated   | Summary by category       |
| `/cost-of-goods`    | GET    | owner, super_admin  | Get COG                   |
| `/cost-of-goods`    | POST   | owner, super_admin  | Set COG                   |
| `/profit-loss`      | GET    | owner, super_admin  | P&L statement             |

### Dashboard (`/api/v1/dashboard`)

| Endpoint                | Method | Roles              | Notes                     |
|-------------------------|--------|---------------------|---------------------------|
| `/summary`              | GET    | All authenticated   | Today's summary           |
| `/daily`                | GET    | All authenticated   | Date range summary        |
| `/fuel-breakdown`       | GET    | All authenticated   | By fuel type              |
| `/pump-performance`     | GET    | All authenticated   | By pump                   |
| `/nozzle-breakdown`     | GET    | owner, super_admin  | By nozzle (detailed)      |
| `/financial-overview`   | GET    | owner, super_admin  | Full P&L                  |

---

## Dashboard Views by Role

### Super Admin Dashboard
- Overview of ALL stations
- Total platform metrics
- Owner list with their stations
- Can drill down to any station

### Owner Dashboard (Multi-Station)
```
┌─────────────────────────────────────────────────────────────┐
│  🏪 Select Station: [ All Stations ▼ ]                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 AGGREGATED VIEW (When "All Stations" selected)          │
│  ├─ Total Sales: ₹15,00,000                                 │
│  ├─ Total Litres: 16,000 L                                  │
│  ├─ Credit Outstanding: ₹1,50,000                           │
│  └─ Profit/Loss: ₹75,000                                    │
│                                                             │
│  📍 PER-STATION BREAKDOWN                                   │
│  ┌─────────────────┬─────────────┬──────────────┐           │
│  │ Station         │ Sales       │ Outstanding  │           │
│  ├─────────────────┼─────────────┼──────────────┤           │
│  │ Station A       │ ₹8,00,000   │ ₹80,000      │           │
│  │ Station B       │ ₹7,00,000   │ ₹70,000      │           │
│  └─────────────────┴─────────────┴──────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Manager Dashboard
- Single station view only
- Today's sales & readings
- Creditor balances for their station
- Expense tracking for their station
- NO profit/loss view (owner-only)

### Employee Dashboard
- Simple reading entry view
- Today's readings they entered
- Station pump/nozzle status
- NO financial data

---

## Creditor vs Employee: Can They Overlap?

**Current Design: NO OVERLAP ENFORCEMENT**

The system does NOT prevent a person from being both:
- An employee at station
- A creditor at the same or different station

**Why?**
- In Indian gas stations, employees sometimes buy fuel on credit
- Family businesses where owner's relatives are both employees and creditors

**Tracking:**
- Creditor: Identified by phone/name in `creditors` table
- Employee: Identified by email in `users` table
- No foreign key relationship between them

**If you want to prevent overlap:**
Add validation in `creditController.createCreditor`:
```javascript
// Check if phone matches an employee
const existingEmployee = await User.findOne({ 
  where: { phone: creditor.phone, stationId } 
});
if (existingEmployee) {
  // Either block or warn
}
```

---

## Plan Limits by Role

| Limit                  | Applied To | Checked By          |
|------------------------|------------|---------------------|
| `maxStations`          | Owner      | Station creation    |
| `maxPumpsPerStation`   | Station    | Pump creation       |
| `maxNozzlesPerPump`    | Pump       | Nozzle creation     |
| `maxEmployees`         | Station    | User creation       |
| `maxCreditors`         | Station    | Creditor creation   |
| `canTrackCredits`      | Plan       | Credit features     |
| `canTrackExpenses`     | Plan       | Expense features    |
| `canViewProfitLoss`    | Plan       | P&L access          |
| `canExport`            | Plan       | Export to CSV       |

---

## Security Best Practices

1. **JWT in Authorization header** - `Bearer <token>`
2. **Token expires** - 24 hours (configurable)
3. **Password hashing** - bcrypt with 12 rounds
4. **Rate limiting** - 100 requests per 15 minutes
5. **Helmet security headers** - XSS, clickjacking protection
6. **Station access middleware** - Checks ownership on every request

---

## Quick Reference: Who Can Do What?

| Action                      | Employee | Manager | Owner | Super Admin |
|-----------------------------|----------|---------|-------|-------------|
| Enter nozzle reading        | ✅       | ✅      | ✅    | ✅          |
| View own readings           | ✅       | ✅      | ✅    | ✅          |
| Edit/delete readings        | ❌       | ✅      | ✅    | ✅          |
| Set fuel prices             | ❌       | ✅      | ✅    | ✅          |
| Add creditors               | ❌       | ✅      | ✅    | ✅          |
| Record credit sale          | ✅       | ✅      | ✅    | ✅          |
| Settle credit               | ❌       | ❌      | ✅    | ✅          |
| Add expenses                | ❌       | ✅      | ✅    | ✅          |
| Enter cost of goods         | ❌       | ❌      | ✅    | ✅          |
| View profit/loss            | ❌       | ❌      | ✅    | ✅          |
| Create pumps/nozzles        | ❌       | ❌      | ✅    | ✅          |
| Add employees               | ❌       | ✅*     | ✅    | ❌**        |
| Add managers                | ❌       | ❌      | ✅    | ❌**        |
| Add owners                  | ❌       | ❌      | ❌    | ✅          |
| Create stations             | ❌       | ❌      | ✅    | ✅          |
| View all stations           | ❌       | ❌      | ❌    | ✅          |

`*` Manager can only add employees to their own station  
`**` Super admin creates owners, not direct staff

---

## Multi-Station Scenarios

### Scenario 1: Owner with 3 Stations
```
Owner: Rajesh Kumar
├── Station A (Delhi)
│   ├── Manager: Amit
│   └── Employees: Ram, Shyam
├── Station B (Gurgaon)
│   ├── Manager: Priya
│   └── Employees: Ravi
└── Station C (Noida)
    ├── Manager: Suresh
    └── Employees: Kiran, Meera

Dashboard:
- Owner sees all 3 stations
- Can view aggregated or individual metrics
- Each manager only sees their station
```

### Scenario 2: Manager Transfers
```
Amit was manager at Station A
Owner moves Amit to Station B

Action: PUT /api/v1/users/:amitId { stationId: stationBId }

Result:
- Amit can no longer see Station A data
- Amit now sees Station B data
```

### Scenario 3: Creditor at Multiple Stations
```
ABC Transporters buys fuel at both Station A and B

Current: Separate creditor records at each station
- Station A: ABC Transporters (balance: ₹50,000)
- Station B: ABC Transporters (balance: ₹30,000)

Owner sees both in respective station views
No cross-station creditor linking (by design)
```
