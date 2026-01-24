# Tank Level Management - Complete Visual Guide

## 📊 Quick Overview

```
DATABASE                    API ENDPOINTS              UI/WORKFLOW
═══════════════════════════════════════════════════════════════════════

Station (1)
   ↓ has many
   ├── Tank (1+ per station)         GET  /tanks?stationId=...
   │   ├── currentLevel              GET  /tanks/:id
   │   ├── capacity                  PUT  /tanks/:id
   │   ├── fuelType                  POST /tanks/:id/calibrate
   │   └── name                       POST /tanks/:id/refill
   │
   ├── TankRefill (many per tank)    GET  /tanks/:id/refills
   │   ├── litres                    POST /tanks/:id/refill
   │   ├── refillDate                PUT  /refills/:id
   │   ├── costPerLitre              DELETE /refills/:id
   │   └── supplierName
   │
   └── Nozzle (many per station)
       └── [FUTURE: Direct pump→tank mapping]
```

---

## 🏗️ Database Structure

### 1️⃣ **STATION TABLE** (Parent)
```sql
stations
├── id (UUID, PK)
├── name (VARCHAR)
├── location (VARCHAR)
├── ownerId (UUID, FK → users.id)
├── isActive (BOOLEAN)
└── createdAt, updatedAt
```

**Purpose:** Represents a fuel station/location. One station can have multiple tanks.

---

### 2️⃣ **TANK TABLE** (Core)
```sql
tanks
├── id (UUID, PK)
├── stationId (UUID, FK → stations.id) ⭐ LINKS TO STATION
│
├── 📍 IDENTIFICATION
│   ├── name (VARCHAR) - Optional ("Main Tank", "Tank A")
│   ├── fuelType (VARCHAR) - "petrol", "diesel", "kerosene" etc.
│   └── tankNumber (INT) - Sequence number
│
├── 📏 CAPACITY & LEVELS
│   ├── capacity (DECIMAL) - Max capacity in litres
│   ├── currentLevel (DECIMAL) - Current estimated level
│   └── [FEATURE] lastDipReading (DECIMAL) - Physical dip reading
│
├── ⚠️ THRESHOLDS (for warnings)
│   ├── lowLevelWarning (DECIMAL) - Alert in litres
│   ├── criticalLevelWarning (DECIMAL) - Critical alert in litres
│   ├── lowLevelPercent (DECIMAL) - Alert at X% of capacity
│   └── criticalLevelPercent (DECIMAL) - Critical at X% of capacity
│
├── 🔧 CONFIGURATION
│   ├── trackingMode (VARCHAR) - "disabled", "warning", "strict"
│   ├── allowNegative (BOOLEAN) - Allow negative levels?
│   └── notes (TEXT) - Additional info
│
├── 📅 TRACKING
│   ├── lastDipDate (DATE) - When last calibrated
│   ├── isActive (BOOLEAN) - Soft delete
│   ├── createdAt (TIMESTAMP)
│   └── updatedAt (TIMESTAMP)
```

**Purpose:** Represents a fuel tank at a station. Stores current level and configuration.

**Key Points:**
- **One station can have multiple tanks** (e.g., 1 Petrol tank + 1 Diesel tank)
- **One tank serves ONE fuel type** (Can't have mixed fuel)
- **Each tank belongs to ONE station** (No tank sharing across stations)
- **currentLevel** = "book level" (system estimate)
- **lastDipReading** = "physical level" (actual dip measurement)

---

### 3️⃣ **TANK_REFILL TABLE** (Transaction Log)
```sql
tank_refills
├── id (UUID, PK)
├── tankId (UUID, FK → tanks.id) ⭐ LINKS TO TANK
├── stationId (UUID, FK → stations.id) - Denormalized for speed
│
├── 📦 REFILL DETAILS
│   ├── litres (DECIMAL) - Quantity added (positive)
│   │                      or adjustment (negative)
│   ├── refillDate (DATEONLY) - Actual date (can be past)
│   └── refillTime (TIME) - Optional time
│
├── 💰 COST TRACKING
│   ├── costPerLitre (DECIMAL) - Price per litre
│   ├── totalCost (DECIMAL) - Total invoice amount
│   ├── supplierName (VARCHAR) - Who supplied
│   └── invoiceNumber (VARCHAR) - Invoice reference
│
├── ✅ VERIFICATION
│   ├── isVerified (BOOLEAN) - Manager approved?
│   ├── verifiedBy (UUID, FK → users.id)
│   ├── verifiedAt (TIMESTAMP)
│   └── isBackdated (BOOLEAN) - Is this a past entry?
│
├── 📝 AUDIT TRAIL
│   ├── enteredBy (UUID, FK → users.id)
│   └── entryType (VARCHAR) - "refill", "adjustment", "correction"
│
├── 📅 META
│   ├── createdAt (TIMESTAMP)
│   └── updatedAt (TIMESTAMP)
```

**Purpose:** Audit trail of all fuel additions/adjustments to a tank.

**Key Points:**
- **When a TankRefill is created → Tank.currentLevel INCREASES**
- **When a TankRefill is deleted → Tank.currentLevel DECREASES**
- Supports **backdating** (entering past refills)
- Tracks **who entered it** and **who verified it**
- Supports **negative entries** (corrections/adjustments)

---

### 4️⃣ **RELATIONSHIPS (Entity Relationship Diagram)**

```
┌─────────────┐
│   STATION   │
│ (1 station) │
└──────┬──────┘
       │
       │ 1:N (One station → Many tanks)
       │
       ├──────────────────────────┐
       ▼                          ▼
   ┌──────────┐          ┌──────────┐
   │   TANK   │          │   TANK   │
   │ (Petrol) │          │ (Diesel) │
   └────┬─────┘          └────┬─────┘
        │                     │
        │ 1:N (Tank → Many refills)
        │                     │
        ▼                     ▼
   ┌──────────────┐      ┌──────────────┐
   │ TankRefill 1 │      │ TankRefill 1 │
   │ TankRefill 2 │      │ TankRefill 2 │
   │ TankRefill 3 │      │ TankRefill 3 │
   └──────────────┘      └──────────────┘

IMPORTANT:
- 1 Station = 1+ Tanks (can't be empty)
- 1 Tank = 1 FuelType (petrol OR diesel, not both)
- 1 Tank = Can have multiple refills (audit trail)
- 1 Tank = 0+ TankRefills (can have no refills initially)
- Multiple Tanks can have SAME FuelType (not recommended, but possible)
```

---

## 🔄 Data Flow: Database → API → UI

### **SCENARIO: Owner checks fuel levels at a station**

#### Step 1️⃣: Database Query
```sql
-- Find all tanks for a station
SELECT * FROM tanks 
WHERE stationId = 'station-123' 
  AND isActive = true
ORDER BY fuelType, name;

-- Returns:
{
  "id": "tank-petrol-1",
  "stationId": "station-123",
  "fuelType": "petrol",
  "name": "Main Tank",
  "capacity": 10000,
  "currentLevel": 5000,
  "lowLevelPercent": 20,
  "criticalLevelPercent": 10,
  "lastDipReading": 4950,
  "lastDipDate": "2025-01-24",
  "trackingMode": "warning"
}
```

#### Step 2️⃣: API Endpoint
```javascript
// GET /api/v1/tanks?stationId=station-123
// Authorization: User must have access to this station

Controller: tankController.getTanks()
  1. Check user has access to station
  2. Query all active tanks for station
  3. Call Tank.getStationTanks(stationId)
  4. For each tank, call tank.getStatus()
  5. Return with calculated status

Response:
{
  "success": true,
  "data": [
    {
      "id": "tank-petrol-1",
      "stationId": "station-123",
      "fuelType": "petrol",
      "name": "Main Tank",
      "capacity": 10000,
      "currentLevel": 5000,
      "status": {
        "status": "low",          // ← CALCULATED
        "percentageFull": 50,
        "availableCapacity": 5000,
        "isBelowReorder": false,
        "isCritical": false
      }
    }
  ]
}
```

#### Step 3️⃣: UI Display
```
┌─────────────────────────────────────┐
│  FUEL LEVELS AT "Main Station"      │
├─────────────────────────────────────┤
│                                     │
│  🔴 Petrol Tank (Main Tank)         │
│  ████████░░ 5000L / 10000L (50%)   │
│  ⚠️  Below reorder level             │
│  Last calibrated: 24 Jan 2025       │
│  Variance: -50L (0.5%)              │
│                                     │
│  🟢 Diesel Tank                     │
│  ████████████░░ 8500L / 10000L     │
│  ✓ Normal                           │
│  Last calibrated: 23 Jan 2025       │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔗 How Is Each Station Linked to Tank?

### **The Connection**

```
ANSWER: Via Foreign Key (stationId)

Tank table has column:
  stationId (UUID, FK → stations.id)

This means:
- Each Tank MUST belong to exactly ONE Station
- Each Station CAN have multiple Tanks
- When Station is deleted, all its Tanks are deleted (CASCADE)
```

### **Code Example**
```javascript
// In Tank.js model
Tank.belongsTo(Station, { 
  foreignKey: 'stationId',   // ← Column name in Tank table
  as: 'station'               // ← Alias for eager loading
});

// In Station.js model
Station.hasMany(Tank, {
  foreignKey: 'stationId',
  as: 'tanks'
});

// Usage: Query all tanks for a station
const tanks = await Tank.findAll({
  where: { stationId: 'station-123', isActive: true },
  include: [{ model: Station, as: 'station' }]
});
```

---

## 🏭 How Are Tanks Defined/Created?

### **Creation Process**

```
WHO: Manager or Owner at a station
WHAT: Create a new fuel tank

ENDPOINT: POST /api/v1/tanks/:stationId
METHOD: tankController.createTank()

REQUEST BODY:
{
  "fuelType": "petrol",              ← Required: petrol|diesel|etc
  "name": "Main Tank",               ← Optional: Display name
  "capacity": 10000,                 ← Required: Litres
  "currentLevel": 5000,              ← Required: Initial level
  "lowLevelWarning": 2000,           ← Optional: Alert threshold
  "criticalLevelWarning": 1000,      ← Optional: Critical threshold
  "lowLevelPercent": 20,             ← Optional: % of capacity
  "criticalLevelPercent": 10,        ← Optional: % of capacity
  "trackingMode": "warning",         ← Optional: disabled|warning|strict
  "notes": "Underground tank"        ← Optional: Comments
}

VALIDATION:
✓ Check if Tank for this fuelType already exists at station
  (Currently: Only 1 tank per fuel type per station)
✓ Check capacity > 0
✓ Check currentLevel <= capacity (can override)
✓ User must be manager+ role
✓ User must have access to this station

SUCCESS RESPONSE:
{
  "success": true,
  "data": {
    "id": "tank-123",
    "stationId": "station-123",
    "fuelType": "petrol",
    "name": "Main Tank",
    "capacity": 10000,
    "currentLevel": 5000,
    "status": {
      "status": "normal",
      "percentageFull": 50,
      "availableCapacity": 5000
    }
  },
  "message": "Tank created for petrol. Current level: 5000L"
}

AUDIT LOG:
{
  "action": "CREATE",
  "entityType": "Tank",
  "entityId": "tank-123",
  "description": "Created tank for petrol with capacity 10000L"
}
```

### **Key Points About Tank Creation**

```
Rule 1: One Tank Per Fuel Type Per Station
  ❌ Cannot create 2 petrol tanks at same station
  ✅ Can create 1 petrol + 1 diesel at same station

Rule 2: Tanks Are Fuel-Type Based
  Tank exists for: petrol, diesel, kerosene, etc.
  Each tank has ONLY ONE fuelType
  Cannot mix fuels in a tank

Rule 3: Multiple Tanks Per Station
  Station "A": Petrol Tank + Diesel Tank + Kerosene Tank
  Station "B": Petrol Tank + Diesel Tank
  Each is a separate Tank record in database

Rule 4: Tank Configuration
  - Can set warning thresholds (both absolute & percentage)
  - Can set tracking mode (disabled/warning/strict)
  - Can add notes for location/serial number
```

---

## ❓ How Many Stations Can A Tank Have?

### **Answer: EXACTLY 1**

```
Tank.stationId = Single Foreign Key

Mathematical Relationship:
  Tank : Station = N : 1
  
  (Many Tanks : One Station)

  1 Tank → 1 Station (Must have)
  1 Station → Many Tanks (Can have 0+)

Example:
  ┌─────────────────────┐
  │  Station "Main"     │
  │                     │
  │  - Tank (Petrol)    │
  │  - Tank (Diesel)    │
  │  - Tank (Kerosene)  │
  └─────────────────────┘
       ▲ (1 Station)
       │
       └─ Each tank points to THIS station

  Cannot do:
  ┌─────────────────────────────────────┐
  │ Tank (petrol) serves:               │
  │   - Main Station                    │
  │   - Backup Station          ❌      │
  │   - Airport Station                 │
  └─────────────────────────────────────┘
```

---

## 📋 All Tables & Relationships Summary

### **Master Table: TANKS**

| Column | Type | FK | Notes |
|--------|------|----|----|
| id | UUID | PK | Primary key |
| stationId | UUID | → stations.id | Which station owns this tank |
| fuelType | VARCHAR | - | petrol\|diesel\|etc (INDEXED) |
| name | VARCHAR | - | Optional display name |
| capacity | DECIMAL | - | Max litres |
| currentLevel | DECIMAL | - | Book level (system estimate) |
| lowLevelWarning | DECIMAL | - | Alert threshold |
| criticalLevelWarning | DECIMAL | - | Critical threshold |
| lowLevelPercent | DECIMAL | - | % of capacity for low alert |
| criticalLevelPercent | DECIMAL | - | % of capacity for critical |
| trackingMode | VARCHAR | - | disabled\|warning\|strict |
| allowNegative | BOOLEAN | - | Allow below-zero levels? |
| lastDipReading | DECIMAL | - | Physical dip measurement |
| lastDipDate | DATE | - | When last calibrated |
| notes | TEXT | - | Comments/location |
| isActive | BOOLEAN | - | Soft delete flag (INDEXED) |
| createdAt | TIMESTAMP | - | Auto-set |
| updatedAt | TIMESTAMP | - | Auto-set |

**Indexes:**
```sql
- tanks(stationId, isActive)
- tanks(fuelType, stationId)
- tanks(isActive)
```

---

### **Detail Table: TANK_REFILLS**

| Column | Type | FK | Notes |
|--------|------|----|----|
| id | UUID | PK | Primary key |
| tankId | UUID | → tanks.id | Which tank was refilled |
| stationId | UUID | → stations.id | Denormalized (faster queries) |
| litres | DECIMAL | - | Amount (+refill, -adjustment) |
| refillDate | DATEONLY | - | When refill occurred |
| refillTime | TIME | - | Specific time if known |
| costPerLitre | DECIMAL | - | Unit price |
| totalCost | DECIMAL | - | Total invoice amount |
| supplierName | VARCHAR | - | Supplier name |
| invoiceNumber | VARCHAR | - | Invoice reference |
| isVerified | BOOLEAN | - | Manager approved? |
| verifiedBy | UUID | → users.id | Who verified |
| verifiedAt | TIMESTAMP | - | When verified |
| isBackdated | BOOLEAN | - | Is this a past entry? |
| enteredBy | UUID | → users.id | Who entered it |
| entryType | VARCHAR | - | refill\|adjustment\|correction |
| createdAt | TIMESTAMP | - | Auto-set |
| updatedAt | TIMESTAMP | - | Auto-set |

**Indexes:**
```sql
- tank_refills(tankId, refillDate DESC)
- tank_refills(stationId, refillDate DESC)
- tank_refills(invoiceNumber)
```

---

### **Related Tables (For Context)**

| Table | Relationship | Purpose |
|-------|--------------|---------|
| stations | Tank.stationId → stations.id | Parent - Where tank is located |
| users | TankRefill.enteredBy → users.id | Who recorded refill |
| users | TankRefill.verifiedBy → users.id | Who verified refill |
| nozzles | [FUTURE] → tank mapping | Which pumps feed from this tank |

---

## 🔌 API Endpoints (Complete List)

### **Tank Operations**

```javascript
// GET ENDPOINTS

GET /api/v1/tanks?stationId=:stationId
  Returns: All tanks for a station
  Authorization: User with access to station
  Response: Array of Tank objects with status
  
GET /api/v1/tanks/:id
  Returns: Single tank details with refill history
  Authorization: User with access to tank's station
  Response: Tank object + last 10 refills + status

GET /api/v1/tanks/warnings
  Returns: All tanks with low/critical/empty status
  Authorization: Any authenticated user
  Response: Array of tanks with warnings

GET /api/v1/tanks/:id/refills
  Returns: Refill history for a tank
  Authorization: User with access to station
  Query params: startDate, endDate, page, limit
  Response: Paginated refill records

// POST ENDPOINTS

POST /api/v1/tanks/:stationId
  Creates: New tank
  Authorization: Manager+ at this station
  Body: { fuelType, name, capacity, currentLevel, ... }
  Response: Created tank + status

POST /api/v1/tanks/:id/refill
  Records: Fuel delivery/refill
  Authorization: Any authenticated user
  Body: { litres, refillDate, supplierName, ... }
  Response: Updated tank level + refill record
  Hooks: Tank.currentLevel automatically increases

POST /api/v1/tanks/:id/calibrate
  Updates: Tank level based on physical dip
  Authorization: Manager+
  Body: { dipReading, date }
  Response: Tank with new level + variance

// PUT ENDPOINTS

PUT /api/v1/tanks/:id
  Updates: Tank settings
  Authorization: Manager+
  Body: { name, capacity, lowLevelPercent, ... }
  Response: Updated tank

PUT /api/v1/tanks/refills/:id
  Updates: Refill record
  Authorization: User who entered it + Manager+
  Body: { litres, refillDate, supplierName, ... }
  Response: Updated refill

// DELETE ENDPOINTS

DELETE /api/v1/tanks/refills/:id
  Deletes: Refill record
  Authorization: Manager+
  Hook: Tank.currentLevel automatically decreases
  Response: Deleted refill info
```

---

## 🖥️ UI Workflows

### **Workflow 1: Owner Checking Fuel Levels**

```
1. Owner opens Dashboard
   ↓
2. System calls: GET /api/v1/tanks/warnings
   ↓
3. API returns: Tanks with low/critical levels
   ↓
4. UI displays: Color-coded tank status
   
   ┌────────────────────────────────┐
   │ FUEL LEVEL ALERTS              │
   ├────────────────────────────────┤
   │ 🔴 Main Station - Petrol       │
   │    5000L / 10000L (50%)        │
   │    Below low level threshold   │
   │                                │
   │ 🟡 Airport Station - Diesel    │
   │    1000L / 10000L (10%)        │
   │    CRITICAL - Order now!       │
   └────────────────────────────────┘
```

---

### **Workflow 2: Recording a Fuel Refill**

```
1. Manager opens "Tank Management"
   ↓
2. Selects: Station → Tank
   System calls: GET /api/v1/tanks/:id
   ↓
3. Form shows:
   - Current Level: 5000L
   - Capacity: 10000L
   - Last Refilled: 3 days ago
   ↓
4. Manager enters refill details:
   - Litres: 3000
   - Date: Today
   - Supplier: "ABC Fuel Co"
   - Invoice: INV-20250124-001
   - Cost: $3000
   ↓
5. Submits: POST /api/v1/tanks/:id/refill
   ↓
6. Backend HOOK (TankRefill.afterCreate):
   Tank.currentLevel += 3000
   (5000 + 3000 = 8000)
   ↓
7. Response shows:
   - New level: 8000L
   - Refill recorded & audited
   ↓
8. UI updates:
   - Tank bar: 5000L → 8000L
   - Refill history: Shows new entry
```

---

### **Workflow 3: Calibrating with Physical Dip**

```
1. Manager does physical tank measurement (dip stick)
   Reads: 7900L
   ↓
2. Opens tank detail page
   Shows: System says 8000L, but physical is 7900L
   Variance: -100L (1.2% discrepancy)
   ↓
3. Clicks "Calibrate with dip reading"
   ↓
4. Enters:
   - Physical reading: 7900
   - Date: Today
   ↓
5. Submits: POST /api/v1/tanks/:id/calibrate
   ↓
6. Backend updates:
   Tank.currentLevel = 7900
   Tank.lastDipReading = 7900
   Tank.lastDipDate = 2025-01-24
   ↓
7. System analyzes variance:
   Expected: 8000L (from sales - refills)
   Actual: 7900L
   Loss: -100L (Could be leak, evaporation, etc.)
   ↓
8. Response includes:
   {
     "tank": { currentLevel: 7900, ... },
     "variance": -100,
     "variancePercentage": 1.2,
     "alert": "Monitor for possible leak"
   }
   ↓
9. Creates audit log:
   "Tank calibrated: 8000L → 7900L (variance: -100L)"
```

---

### **Workflow 4: Viewing Tank History**

```
1. Manager clicks: Tank → "Refill History"
   ↓
2. System calls: GET /api/v1/tanks/:id/refills
   ↓
3. Returns: List of all refills with pagination
   
   ┌──────────────────────────────────────────┐
   │ REFILL HISTORY - Main Tank (Petrol)      │
   ├──────────────────────────────────────────┤
   │                                          │
   │ 2025-01-24 | 3000L | ABC Fuel Co       │
   │            | $3000 | INV-001            │
   │            | ✓ Verified by John         │
   │                                          │
   │ 2025-01-22 | -100L | Correction        │
   │            | $0    | Variance adjust    │
   │            | ✓ Verified by Jane         │
   │                                          │
   │ 2025-01-20 | 2500L | XYZ Petroleum     │
   │            | $2500 | INV-000            │
   │            | ✓ Verified by John         │
   │                                          │
   └──────────────────────────────────────────┘
```

---

## 🔐 Authorization Rules

### **Tank Access Control**

```
WHO CAN DO WHAT:

Employee:
  ✓ GET /tanks?stationId= (only their station)
  ✓ GET /tanks/:id (details)
  ✓ POST /tanks/:id/refill (record refill)
  ✗ PUT /tanks/:id (can't change settings)
  ✗ POST /tanks/:id/calibrate (dip readings)

Manager:
  ✓ GET /tanks?stationId= (their station(s))
  ✓ GET /tanks/:id (details)
  ✓ POST /tanks (create new tank)
  ✓ POST /tanks/:id/refill (record refill)
  ✓ PUT /tanks/:id (change settings)
  ✓ POST /tanks/:id/calibrate (dip readings)
  ✓ DELETE /tanks/refills/:id (remove refill)

Owner:
  ✓ All of above (all their stations)
  ✓ Can see dashboard warnings
  ✓ Can access across all stations

Super Admin:
  ✓ Everything (all stations)
```

---

## 📊 Example Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ COMPLETE TANK LIFECYCLE                                     │
└─────────────────────────────────────────────────────────────┘

DAY 1 - SETUP
─────────────
Manager creates tank:
  POST /api/v1/tanks/station-123
  {
    "fuelType": "petrol",
    "capacity": 10000,
    "currentLevel": 5000,        ← Initial estimate
    "name": "Main Tank"
  }
  
Database:
  tanks → Insert record
  Tank.currentLevel = 5000

UI: Shows tank at 5000L/10000L


DAY 2 - SALES (Not yet auto-tracked)
────────────────────────────────────
Employee records sales:
  Nozzle 1: 100L sold
  Nozzle 2: 150L sold
  Total: 250L

[CURRENT: Tank.currentLevel still = 5000L] ❌
[FUTURE: Would auto-decrease to 4750L]

Tank is now OUT OF SYNC with sales


DAY 2 - REFILL
──────────────
Manager records refill:
  POST /api/v1/tanks/tank-123/refill
  {
    "litres": 2000,
    "supplierName": "ABC Fuel",
    "invoiceNumber": "INV-001"
  }

Database:
  tank_refills → Insert record
  [HOOK] Tank.currentLevel += 2000
  Tank.currentLevel = 5000 + 2000 = 7000

UI: Shows tank at 7000L/10000L


DAY 3 - CALIBRATION
────────────────────
Manager does dip reading:
  Physical stick measurement: 6800L
  
Posts:
  POST /api/v1/tanks/tank-123/calibrate
  {
    "dipReading": 6800
  }

Database:
  Tank.currentLevel = 6800
  Tank.lastDipReading = 6800
  Tank.lastDipDate = 2025-01-25

System analyzes:
  Expected (book): 7000L
  Actual (physical): 6800L
  Variance: -200L (loss)
  
  Possible causes:
  - Evaporation
  - Leak
  - Data entry error
  - Incomplete refill recording

UI: Shows variance warning
Audit: Logged for review


DASHBOARD VIEW
──────────────
System shows:
┌─────────────────────────────────────┐
│ Station: Main (2025-01-25)          │
├─────────────────────────────────────┤
│ Petrol Tank                         │
│ ████████░░ 6800L / 10000L (68%)    │
│                                     │
│ Book Level: 7000L                   │
│ Physical: 6800L                     │
│ Variance: -200L (2.9%)              │
│ Status: ⚠️  Monitor closely          │
│                                     │
│ Recent Activity:                    │
│ - Calibrated: 25 Jan (6800L)       │
│ - Refilled: 24 Jan (+2000L)        │
│ - Last dip: 23 Jan (5000L)         │
└─────────────────────────────────────┘
```

---

## 🔑 Key Takeaways

### **Station → Tank Relationship**
```
✅ One Station has 1+ Tanks
✅ Each Tank belongs to ONE Station
✅ Tanks are accessed via stationId foreign key
✅ Tanks are fuel-type specific (petrol OR diesel, not mix)
```

### **Tank Lifecycle**
```
1. CREATE tank (manager)
2. REFILL tank (any user can record)
3. CALIBRATE with physical dip (manager)
4. MONITOR variance (system alerts)
5. ADJUST if needed (correction entries)
```

### **Database Hierarchy**
```
Station (Location)
  ↓
  Tank (Petrol, Diesel, etc.)
    ↓
    TankRefill (Audit trail of additions/removals)
```

### **Auto-Updates**
```
When TankRefill is created:
  ✅ Tank.currentLevel INCREASES

When TankRefill is deleted:
  ✅ Tank.currentLevel DECREASES

Manual calibration:
  ✅ Tank.currentLevel is SET to physical reading
```

---

## 📚 Related Files

- [Tank Model](backend/src/models/Tank.js) - Database model definition
- [TankRefill Model](backend/src/models/TankRefill.js) - Refill audit trail
- [Tank Controller](backend/src/controllers/tankController.js) - API logic
- [Tank Routes](backend/src/routes/tanks.js) - API endpoints
- [Tank Analysis](TANK_LEVEL_MANAGEMENT_ANALYSIS.md) - Feature roadmap
- [Type Definitions](src/core/models/tank.model.ts) - TypeScript interfaces

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-24  
**Status:** Complete & Verified
