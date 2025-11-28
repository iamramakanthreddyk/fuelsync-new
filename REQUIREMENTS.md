# FuelSync - Requirements Document

## 📋 Problem Statement

Fuel station owners need a simple, reliable system to:
1. **Track daily fuel sales** accurately from nozzle meter readings
2. **Detect theft/losses** by comparing expected sales vs cash received
3. **Get visibility** into business performance through analytics

### Constraints (Real-World Reality)
- Stations are **already running** - cannot start from zero readings
- Nozzle meters are **cumulative** - only move forward
- **No tank level meters** - cannot track actual tank inventory
- **Backdated entries** must be allowed for flexibility
- Must be **simple for employees** - just enter current reading

---

## 🏗️ System Architecture

### Physical Setup
```
Station (Fuel Station)
  └── Pumps (Physical pump machines, e.g., 4 per station)
        └── Nozzles (Dispensing hoses, e.g., 2-4 per pump)
              └── Properties:
                    - Fuel Type (petrol/diesel)
                    - Meter Reading (cumulative, forward-only)
                    - Status (active/repair/inactive)
```

### Example Configuration
```
Downtown Fuel Station
├── Pump 1 (Active)
│   ├── Nozzle 1: Petrol (Reading: 45,230)
│   └── Nozzle 2: Diesel (Reading: 32,100)
├── Pump 2 (Active)
│   ├── Nozzle 1: Petrol (Reading: 38,500)
│   └── Nozzle 2: Diesel (Reading: 28,900)
├── Pump 3 (Under Repair)
│   ├── Nozzle 1: Petrol (Reading: 22,000) [Inactive]
│   └── Nozzle 2: Diesel (Reading: 18,500) [Inactive]
└── Pump 4 (Active)
    ├── Nozzle 1: Petrol (Reading: 51,200)
    └── Nozzle 2: Diesel (Reading: 44,800)
```

---

## 🔄 Core Workflow

### Employee Daily Flow
```
1. Employee opens app, selects date (can be backdated)
2. Selects Pump → Nozzle
3. System shows: Previous Reading (e.g., 1000)
4. Employee enters: Current Reading (e.g., 1500)
5. System validates: Current > Previous (forward only)
6. System calculates:
   - Litres Sold = 1500 - 1000 = 500L
   - Uses fuel price at selected date
   - Sale Value = 500L × ₹100 = ₹50,000
7. Employee enters payment received:
   - Cash: ₹30,000
   - Online: Auto-calculated = ₹20,000
8. Entry saved, available for reports
```

### Payment Entry Logic
| Input | Calculation |
|-------|-------------|
| Only reading (no payment entered) | 100% Cash assumed |
| Cash amount entered | Online = Total - Cash |
| Online amount entered | Cash = Total - Online |
| Both entered | Validate: Cash + Online = Total |

---

## 👥 User Roles & Permissions

### Role Hierarchy
```
super_admin (Platform Admin)
    └── owner (Station Owner)
        └── manager (Station Manager)
            └── employee (Pump Attendant)
```

### Permissions Matrix

| Feature | Employee | Manager | Owner | Super Admin |
|---------|----------|---------|-------|-------------|
| Enter nozzle readings | ✅ | ✅ | ✅ | ✅ |
| Enter payments (cash/online) | ✅ | ✅ | ✅ | ✅ |
| View own entries | ✅ | ✅ | ✅ | ✅ |
| View previous reading | ✅ | ✅ | ✅ | ✅ |
| View all station entries | ❌ | ✅ | ✅ | ✅ |
| View station dashboard | ❌ | ✅ | ✅ | ✅ |
| View analytics | ❌ | Basic | Full | Full |
| Export reports | ❌ | ❌ | ✅ | ✅ |
| Manage pumps/nozzles | ❌ | ❌ | ✅ | ✅ |
| Manage employees | ❌ | ❌ | ✅ | ✅ |
| Update fuel prices | ❌ | ✅ | ✅ | ✅ |
| Manage stations | ❌ | ❌ | Own only | All |
| Manage plans | ❌ | ❌ | ❌ | ✅ |

---

## 📊 Feature Specification

### Phase 1: MVP (Core Features)

#### 1. Nozzle Reading Entry
- **Input:** Date, Pump, Nozzle, Current Reading
- **Display:** Previous reading, Calculated litres, Sale value
- **Validation:** 
  - Reading must be >= previous reading
  - Date cannot be future
  - Backdated limit based on plan

#### 2. Payment Entry
- **Input:** Cash received (optional), Online received (optional)
- **Auto-calculation:** Missing value = Total - Entered value
- **Default:** If nothing entered, assume 100% cash

#### 3. Fuel Price Management
- **Set price** per fuel type per station
- **Maintain history** for accurate backdated calculations
- **Effective date** for each price change

#### 4. Pump/Nozzle Configuration
- **Create/Edit pumps** with name and status
- **Create/Edit nozzles** with fuel type and status
- **Status options:** Active, Repair, Inactive

#### 5. Basic Dashboard (Manager/Owner)
- Today's total sales (litres & value)
- Per-pump breakdown
- Cash vs Online split
- Pumps/nozzles under repair

### Phase 2: Analytics & Reports

#### 6. Analytics API
- Daily/weekly/monthly sales trends
- Pump-wise performance comparison
- Fuel type breakdown (petrol vs diesel)
- Cash vs Online trends
- Best/worst performing days

#### 7. Exportable Reports
- Daily sales report (CSV/Excel)
- Monthly summary report
- Pump-wise detailed report
- Date range selection

#### 8. Repair Tracking
- Mark pump/nozzle under repair with date
- Track repair history
- Exclude from daily totals while in repair

### Phase 3: Future Enhancements

#### 9. Payment Gateway Integration
- PhonePe/Google Pay API integration
- Auto-capture online payments
- Reconciliation with manual entries

#### 10. Mobile App
- Simple employee interface
- Offline capability with sync
- Camera for photo proof (optional)

---

## 🎚️ Plan-Based Limits (SaaS Model)

| Feature | Free | Basic | Premium |
|---------|------|-------|---------|
| Stations | 1 | 3 | Unlimited |
| Pumps per station | 2 | 6 | Unlimited |
| Nozzles per pump | 4 | 8 | Unlimited |
| Employees | 2 | 10 | Unlimited |
| Backdated entry (days) | 3 | 7 | 30 |
| Analytics history | 7 days | 30 days | 1 year |
| Export reports | ❌ | Daily only | Full |
| API access | ❌ | ❌ | ✅ |
| Priority support | ❌ | ❌ | ✅ |
| Price (INR/month) | ₹0 | ₹499 | ₹1,999 |

---

## ⚠️ Edge Cases

| Scenario | Handling |
|----------|----------|
| **New station onboarding** | First entry for each nozzle is "initial reading" - no sale calculated |
| **Pump under repair** | Mark status, hide from employee entry, exclude from totals |
| **Nozzle under repair** | Mark status, don't allow readings until reactivated |
| **Backdated entry** | Use fuel price that was valid on that date |
| **Reading < previous** | Reject with error "Meter reading must be greater than previous" |
| **Reading = previous** | Allow (0 litres sold - pump wasn't used) |
| **Multiple entries same day** | Allow all, calculate incremental sales for each |
| **Meter rollover (99999 → 0)** | Special "meter reset" entry with manual override |
| **Price changed mid-day** | Use price valid at time of reading entry |
| **Employee enters wrong reading** | Manager can edit within same day |

---

## 🗄️ Database Schema (Simplified)

### Tables Required
1. **plans** - Subscription plans with limits
2. **stations** - Fuel stations
3. **users** - All user accounts with roles
4. **pumps** - Physical pump machines
5. **nozzles** - Fuel dispensing nozzles
6. **fuel_prices** - Historical fuel prices
7. **nozzle_readings** - Meter readings with calculations
8. **daily_summaries** - Aggregated daily data (optional, for performance)

### NOT Needed (Removed)
- ❌ uploads (no image upload)
- ❌ ocr_readings (no OCR)
- ❌ fuel_tanks (no tank tracking)
- ❌ fuel_deliveries (no delivery tracking)
- ❌ daily_closures (simplified to daily_summaries)

---

## 🔌 API Endpoints (Core)

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - Owner registration
- `POST /auth/logout` - Logout
- `GET /auth/me` - Current user info

### Stations
- `GET /stations` - List stations (role-filtered)
- `POST /stations` - Create station (owner)
- `GET /stations/:id` - Station details
- `PUT /stations/:id` - Update station
- `DELETE /stations/:id` - Deactivate station

### Pumps & Nozzles
- `GET /stations/:stationId/pumps` - List pumps
- `POST /stations/:stationId/pumps` - Create pump
- `PUT /pumps/:id` - Update pump (including status)
- `GET /pumps/:pumpId/nozzles` - List nozzles
- `POST /pumps/:pumpId/nozzles` - Create nozzle
- `PUT /nozzles/:id` - Update nozzle

### Readings & Sales
- `GET /readings` - List readings (with filters)
- `POST /readings` - Enter new reading (core feature)
- `GET /readings/latest/:nozzleId` - Get previous reading
- `PUT /readings/:id` - Edit reading (same day only)

### Fuel Prices
- `GET /prices` - Current prices for station
- `POST /prices` - Set new price (creates history)
- `GET /prices/history` - Price history

### Dashboard & Analytics
- `GET /dashboard/summary` - Today's summary
- `GET /analytics/trends` - Sales trends
- `GET /analytics/pumps` - Pump performance
- `GET /reports/daily` - Daily report data
- `GET /reports/export` - Export as CSV

---

## 📱 UI Views (Simplified)

### Employee View
```
┌─────────────────────────────────┐
│  Enter Nozzle Reading           │
├─────────────────────────────────┤
│  Date: [Today ▼]                │
│  Pump: [Pump 1 ▼]               │
│  Nozzle: [Nozzle 1 - Petrol ▼]  │
├─────────────────────────────────┤
│  Previous Reading: 1,000        │
│  Current Reading: [_______]     │
├─────────────────────────────────┤
│  Litres Sold: 500               │
│  Rate: ₹100/L                   │
│  Total Value: ₹50,000           │
├─────────────────────────────────┤
│  Cash Received: [_______]       │
│  Online Payment: ₹20,000        │
├─────────────────────────────────┤
│  [Submit Reading]               │
└─────────────────────────────────┘
```

### Manager Dashboard
```
┌─────────────────────────────────┐
│  Today's Summary                │
├─────────────────────────────────┤
│  Total Sales: ₹2,50,000         │
│  Total Litres: 2,500L           │
│  Cash: ₹1,80,000 | Online: ₹70k │
├─────────────────────────────────┤
│  Pump 1: ₹80,000  ████████      │
│  Pump 2: ₹65,000  ██████        │
│  Pump 3: ⚠️ Under Repair        │
│  Pump 4: ₹55,000  █████         │
└─────────────────────────────────┘
```

---

## ✅ Success Criteria

1. Employee can enter reading in < 30 seconds
2. Sales calculation is 100% accurate
3. Cash vs expected mismatch is immediately visible
4. Reports can be exported for accounting
5. System works on slow mobile networks
6. Backdated entries don't break calculations

---

*Document Version: 1.0*
*Last Updated: November 2024*
