# FuelSync Database Schema Documentation

## Overview

The FuelSync database is designed with a multi-tenant architecture supporting fuel station management with three main user roles: Super Admins, Owners, and Employees.

## Superadmin Capabilities

Super administrators have system-wide access and can:
- Create owner users and their stations
- Manage all users across all stations
- Activate/deactivate stations and users
- Assign/reassign pumps and nozzles between stations
- View cross-station analytics and reports
- Manage subscription plans and billing

## Core Tables

### 1. Users
Stores all system users with role-based access.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password TEXT NOT NULL,
  role user_role NOT NULL, -- 'superadmin', 'owner', 'employee'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Relationships:**
- Super admins have no station restrictions
- Owners manage stations via `stations.owner_id`
- Employees are linked via `user_stations` table

### 2. User-Station Assignments
Many-to-many relationship for employee station assignments.

```sql
CREATE TABLE user_stations (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  station_id INTEGER REFERENCES stations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, station_id)
);
```

### 3. Stations
Fuel stations owned by users with owner role.

```sql
CREATE TABLE stations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand station_brand NOT NULL, -- 'IOCL', 'BPCL', 'HPCL'
  address TEXT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_plan_id INTEGER REFERENCES plans(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Pump Assignments
Tracks pump assignment history for superadmin management.

```sql
CREATE TABLE pump_assignments (
  id SERIAL PRIMARY KEY,
  pump_id INTEGER REFERENCES pumps(id) ON DELETE CASCADE,
  station_id INTEGER REFERENCES stations(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now()
);
```

### 5. Nozzle Assignments
Tracks nozzle assignment history for superadmin management.

```sql
CREATE TABLE nozzle_assignments (
  id SERIAL PRIMARY KEY,
  nozzle_id INTEGER REFERENCES nozzles(id) ON DELETE CASCADE,
  station_id INTEGER REFERENCES stations(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now()
);
```

### 6. Station Plans
Subscription plan assignments and history.

```sql
CREATE TABLE station_plans (
  id SERIAL PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_paid BOOLEAN DEFAULT FALSE,
  notes TEXT
);
```

### 7. Plans
Subscription plans that define feature limits.

```sql
CREATE TABLE plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price_monthly NUMERIC(10, 2),
  max_pumps INT,
  max_nozzles INT,
  max_employees INT,
  max_manual_monthly INT,
  allow_manual_entry BOOLEAN DEFAULT TRUE,
  edit_fuel_type BOOLEAN DEFAULT TRUE,
  export_reports BOOLEAN DEFAULT FALSE,
  features JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Default Plans:**
- **Free**: ₹0/month, 2 pumps, 4 nozzles, 2 employees
- **Basic**: ₹999/month, 5 pumps, 10 nozzles, 5 employees
- **Premium**: ₹2999/month, 20 pumps, 50 nozzles, 20 employees

### 8. Station_Plans
Tracks subscription history for stations.

```sql
CREATE TABLE station_plans (
  station_id INT REFERENCES stations(id) ON DELETE CASCADE,
  plan_id INT REFERENCES plans(id),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  is_paid BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (station_id, effective_from)
);
```

### 9. Pumps
Fuel dispensers at each station.

```sql
CREATE TABLE pumps (
  id SERIAL PRIMARY KEY,
  station_id INT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  pump_sno TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (station_id, pump_sno)
);
```

### 10. Nozzles
Individual fuel nozzles on each pump.

```sql
CREATE TABLE nozzles (
  id SERIAL PRIMARY KEY,
  pump_id INT NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
  nozzle_number INT NOT NULL,
  fuel_type fuel_type NOT NULL, -- 'PETROL', 'DIESEL', 'CNG', 'EV'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pump_id, nozzle_number)
);
```

### 11. Manual Readings (Updated Schema)
Fuel meter readings captured via manual entry (cumulative meter values saved per nozzle).

```sql
CREATE TABLE manual_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id INT NOT NULL REFERENCES stations(id),
  nozzle_id INT NOT NULL REFERENCES nozzles(id),
  pump_sno TEXT,
  reading_date DATE NOT NULL,
  reading_time TIME,
  cumulative_vol NUMERIC(12,2) NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (nozzle_id, reading_date, reading_time)
);
```

**Notes:**
- This project no longer uses OCR processing. All readings are entered manually or via direct device integration. Remove references to `ocr_json`, `reading_source`, and OCR API endpoints.

### 12. Fuel_Prices
Current fuel pricing at each station.

```sql
CREATE TABLE fuel_prices (
  id SERIAL PRIMARY KEY,
  station_id INT REFERENCES stations(id),
  fuel_type fuel_type NOT NULL,
  price_per_litre NUMERIC(8,3) NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 13. Sales
Calculated sales data based on reading differences.

```sql
CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  station_id INT REFERENCES stations(id),
  nozzle_id INT REFERENCES nozzles(id),
  reading_id INT REFERENCES manual_readings(id),
  delta_volume_l NUMERIC(12,2),
  price_per_litre NUMERIC(8,3),
  total_amount NUMERIC(14,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 14. Tender_Entries
Cash/card collections and payments.

```sql
CREATE TABLE tender_entries (
  id SERIAL PRIMARY KEY,
  station_id INT REFERENCES stations(id),
  entry_date DATE NOT NULL,
  type tender_type, -- 'cash', 'card', 'upi', 'credit'
  payer TEXT,
  amount NUMERIC(14,2) CHECK (amount >= 0),
  user_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 15. Daily_Closure
End-of-day reconciliation.

```sql
CREATE TABLE daily_closure (
  station_id INT REFERENCES stations(id),
  date DATE NOT NULL,
  sales_total NUMERIC(14,2),
  tender_total NUMERIC(14,2),
  difference NUMERIC(14,2),
  closed_by INT REFERENCES users(id),
  closed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (station_id, date)
);
```

### 16. Plan_Usage
Monthly usage tracking for plan limits.

```sql
CREATE TABLE plan_usage (
  station_id INT REFERENCES stations(id),
  month DATE,
  manual_readings_count INT DEFAULT 0,
  pumps_used INT DEFAULT 0,
  nozzles_used INT DEFAULT 0,
  employees_count INT DEFAULT 0,
  PRIMARY KEY (station_id, month)
);
```

### 17. User Activity Log

Table tracks user events for analytics or compliance.

```sql
CREATE TABLE user_activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  station_id INTEGER REFERENCES stations(id),
  activity_type TEXT NOT NULL,
  details JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- **Description**: Tracks each user action. Useful for auditing/dashboard.
- **Columns**:
  - `user_id`: User performing action
  - `station_id`: Optional, where action occurred (if relevant)
  - `activity_type`: Short string describing the type of event (e.g. "dashboard_view")
  - `details`: Arbitrary JSON for extra data
  - `occurred_at`: When the action was logged

## Custom Types (Enums)

```sql
CREATE TYPE user_role AS ENUM ('superadmin', 'owner', 'employee');
CREATE TYPE station_brand AS ENUM ('IOCL', 'BPCL', 'HPCL');
CREATE TYPE fuel_type AS ENUM ('PETROL', 'DIESEL', 'CNG', 'EV');
-- Reading source enum removed; only manual readings are supported.
CREATE TYPE tender_type AS ENUM ('cash', 'card', 'upi', 'credit');
```

## API Endpoints

### Manual Reading API
**Endpoint:** `POST /functions/v1/manual-reading`
- **Content-Type:** `application/json`
- **Body:**
```json
{
  "station_id": 1,
  "nozzle_id": 1,
  "cumulative_vol": 12345.678,
  "reading_date": "2023-12-15",
  "reading_time": "14:30"
}
```
- **Response:** JSON with success status and saved reading data

## Business Rules & Constraints

### User Role Constraints
1. **Superadmin**: No station_id (system-wide access)
2. **Owner**: No station_id (owns stations via stations.owner_id)
3. **Employee**: Must have station_id (tied to specific station)

### Data Access Rules
1. **Superadmin**: Access to all data
2. **Owner**: Access only to owned stations and their data
3. **Employee**: Access only to assigned station data

### Reading Flow
1. **Manual Flow**: Form input or device integration → Validate → Insert single record into `manual_readings`
2. Historical and sales calculations are derived from cumulative meter differences between readings

### Referential Integrity
- Stations must have valid owner (owner role user)
- Employees must be assigned to valid station
-- Readings must reference valid station and nozzle
- Sales calculations based on reading deltas

## Indexes for Performance

```sql
-- User access patterns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_station_id ON users(station_id);
CREATE INDEX idx_users_role_station ON users(role, station_id);

-- Station ownership
CREATE INDEX idx_stations_owner ON stations(owner_id);

-- Data filtering by station
CREATE INDEX idx_pumps_station ON pumps(station_id);
CREATE INDEX idx_nozzles_pump ON nozzles(pump_id);
CREATE INDEX idx_manual_readings_station_date ON manual_readings(station_id, reading_date);
CREATE INDEX idx_manual_readings_nozzle_date ON manual_readings(nozzle_id, reading_date);
CREATE INDEX idx_manual_readings_pump_sno ON manual_readings(pump_sno);
CREATE INDEX idx_sales_station_date ON sales(station_id, created_at);
CREATE INDEX idx_tender_entries_station_date ON tender_entries(station_id, entry_date);
CREATE INDEX idx_fuel_prices_station_fuel ON fuel_prices(station_id, fuel_type, valid_from);
```

This schema supports the complete multi-tenant fuel station management system with proper data isolation, role-based access control, and dual OCR/manual reading capabilities.

## Superadmin API Endpoints

### User Management
- `POST /superadmin-owners` - Create owner + station
- `GET /superadmin-users` - List all users with filters
- `PUT /superadmin-actions/users/{id}/activate` - Toggle user status

### Station Management
- `GET /superadmin-stations` - List all stations with filters
- `POST /superadmin-stations` - Create station
- `PUT /superadmin-actions/stations/{id}/deactivate` - Toggle station status
- `PUT /superadmin-actions/stations/{id}/plan` - Update subscription plan

### Equipment Management
- `PUT /superadmin-actions/pumps/{id}/assign` - Reassign pump
- `PUT /superadmin-actions/nozzles/{id}/assign` - Reassign nozzle

### Analytics
- `GET /superadmin-analytics` - Cross-station analytics and reports

## Access Control

### Role-Based Permissions

1. **Superadmin**:
   - Full system access
   - Can create/modify any user or station
   - Cross-station analytics
   - Equipment reassignment
   - Plan management

2. **Owner**:
   - Access to owned stations only
   - Can create employees for their stations
   - Station-specific analytics
   - Pump/nozzle management within their stations

3. **Employee**:
   - Access to assigned station(s) only
   - Data entry and basic operations
   - No user management capabilities

### Data Isolation

- All data queries automatically filter by station_id for owners/employees
- Superadmin queries can access all stations using `stationId=all` parameter
- Cross-station operations require superadmin role verification

## Security Features

1. **JWT Authentication**: All API endpoints require valid JWT tokens
2. **Role Verification**: Each endpoint verifies user role before processing
3. **Audit Logging**: Critical operations are logged for compliance
4. **Data Encryption**: Sensitive data encrypted at rest and in transit
5. **Rate Limiting**: API endpoints have built-in rate limiting

This schema supports the complete multi-tenant fuel station management system with proper data isolation, role-based access control, and comprehensive superadmin capabilities.
