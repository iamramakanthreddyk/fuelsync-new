
# FuelSync API Endpoints

## Overview
Complete API documentation for the FuelSync multi-tenant fuel station management system.

## Base Configuration
- **Project ID**: untzkhbbsowpkmwrxdws
- **Base URL**: https://untzkhbbsowpkmwrxdws.supabase.co/functions/v1
- **Authentication**: Not required for these endpoints (verify_jwt = false)

## 📊 Dashboard Management API

### Base Endpoint: `/dashboard-api`

#### GET /dashboard-api/summary
Get comprehensive dashboard summary with key metrics and alerts.

**Query Parameters:**
- `stationId` (required): Station ID

**Response:**
```json
{
  "success": true,
  "data": {
    "total_sales_today": 15000.50,
    "total_tender_today": 14850.25,
    "fuel_prices": {
      "PETROL": 102.50,
      "DIESEL": 89.75,
      "CNG": 95.20,
      "EV": 12.50
    },
    "pending_closure_count": 0,
    "variance": -150.25,
    "alerts": [
      {
        "id": "variance_alert",
        "type": "warning",
        "message": "Sales-Collections variance: ₹150.25",
        "severity": "medium",
        "tags": ["finance", "reconciliation"]
      },
      {
        "id": "missing_readings",
        "type": "warning", 
        "message": "No readings in last 4 hours",
        "severity": "high",
        "tags": ["operations", "readings"]
      }
    ]
  }
}
```

#### GET /dashboard-api/sales-trend
Get sales trend data for chart visualization.

**Query Parameters:**
- `stationId` (required): Station ID
- `days` (optional): Number of days to fetch (default: 7)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-06-07",
      "sales": 12500.75,
      "tender": 12300.50,
      "day_name": "Mon"
    },
    {
      "date": "2024-06-08", 
      "sales": 13200.25,
      "tender": 13100.00,
      "day_name": "Tue"
    }
  ]
}
```

### Alert Types and Severity Levels

#### Alert Types:
- `warning`: Important issues requiring attention
- `info`: Informational notifications
- `error`: Critical system errors

#### Severity Levels:
- `low`: Minor issues, can be addressed later
- `medium`: Moderate priority issues
- `high`: High priority issues requiring immediate attention

#### Common Alert IDs:
- `variance_alert`: Sales vs tender variance exceeds threshold
- `pending_settlement` (aka `pending_closure`): Daily settlement not completed
- `missing_readings`: No fuel readings in specified timeframe
- `load_error`: System error loading dashboard data

## 🔧 Pump Management API

### Base Endpoint: `/pumps-api`

#### GET /pumps-api
Get all pumps for a station with nozzle information.

**Query Parameters:**
- `stationId` (required): Station ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "station_id": 1,
      "pump_sno": "P001",
      "name": "Pump 1 - Main Entry",
      "status": "active",
      "location": "Front - Left",
      "installation_date": "2024-01-15",
      "created_by": 2,
      "nozzles": [
        {
          "id": 1,
          "nozzle_number": 1,
          "fuel_type": "PETROL",
          "status": "active",
          "max_flow_rate": 35.0
        }
      ]
    }
  ]
}
```

#### GET /pumps-api/:id
Get detailed pump information with sales summary.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "pump_sno": "P001",
    "name": "Pump 1 - Main Entry",
    "status": "active",
    "nozzles": [...],
    "salesSummary": {
      "totalSales": 15000.50,
      "totalLitres": 150.75,
      "transactionCount": 12,
      "byFuelType": {
        "PETROL": 10000.25,
        "DIESEL": 5000.25
      }
    }
  }
}
```

#### POST /pumps-api
Create a new pump.

**Request Body:**
```json
{
  "stationId": 1,
  "pump_sno": "P003",
  "name": "Pump 3 - Side Entry",
  "location": "Side - Right",
  "status": "active",
  "created_by": 2
}
```

#### POST /pumps-api/:pumpId/nozzles
Add a nozzle to a pump.

**Request Body:**
```json
{
  "fuel_type": "DIESEL",
  "nozzle_number": 3,
  "max_flow_rate": 40.0,
  "status": "active"
}
```

#### DELETE /pumps-api/:id
Delete a pump (cascades to nozzles).

## 🧾 Sales Management API

### Base Endpoint: `/sales-api`

#### GET /sales-api
Get sales for a station with filters.

**Query Parameters:**
- `stationId` (required): Station ID
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter
- `limit` (optional): Number of records (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "station_id": 1,
      "pump_id": 1,
      "nozzle_id": 1,
      "delta_volume_l": 25.750,
      "price_per_litre": 102.50,
      "total_amount": 2639.375,
      "shift": "morning",
      "fuel_type": "PETROL",
      "entered_by": 3,
      "is_manual_entry": true,
      "created_at": "2024-06-12T06:00:00Z",
      "pumps": { "pump_sno": "P001", "name": "Pump 1 - Main Entry" },
      "nozzles": { "nozzle_number": 1, "fuel_type": "PETROL" },
      "users": { "name": "Ravi Singh" }
    }
  ]
}
```

#### POST /sales-api/manual
Create a manual sale entry for manual data entry workflows.

**Request Body:**
```json
{
  "stationId": 1,
  "pumpId": 1,
  "nozzleId": 1,
  "litres": 25.750,
  "fuelType": "PETROL",
  "pricePerLitre": 102.50,
  "shift": "morning",
  "enteredBy": 3
}
```

#### GET /sales-api/daily-summary
Get daily sales vs tender summary for reconciliation.

**Query Parameters:**
- `stationId` (required): Station ID
- `date` (optional): Date in YYYY-MM-DD format (default: today)

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2024-06-12",
    "salesTotal": 6245.375,
    "tenderTotal": 5939.375,
    "difference": -306.00,
    "salesByFuel": {
      "PETROL": 2639.375,
      "DIESEL": 3606.00
    },
    "tenderByType": {
      "cash": 3439.375,
      "card": 1500.00,
      "upi": 1000.00,
      "credit": 0
    },
    "totalTransactions": 2,
    "totalLitres": 65.750
  }
}
```

## 🔧 Nozzle Management API

### Base Endpoint: `/nozzles-api`

#### PUT /nozzles-api/:id
Update nozzle properties.

**Request Body:**
```json
{
  "fuel_type": "DIESEL",
  "status": "inactive",
  "max_flow_rate": 45.0
}
```

#### DELETE /nozzles-api/:id
Delete a nozzle.

## Data Types & Enums

### User Roles
- `superadmin`: System-wide access
- `owner`: Owns stations, manages employees
- `employee`: Assigned to specific station

### Fuel Types
- `PETROL`: Petrol/Gasoline
- `DIESEL`: Diesel fuel
- `CNG`: Compressed Natural Gas
- `EV`: Electric Vehicle charging

### Pump/Nozzle Status
- `active`: Operational
- `inactive`: Temporarily disabled
- `maintenance`: Under maintenance

### Shifts
- `morning`: 6:00 AM - 2:00 PM
- `afternoon`: 2:00 PM - 10:00 PM
- `night`: 10:00 PM - 6:00 AM

### Tender Types
- `cash`: Cash payment
- `card`: Debit/Credit card
- `upi`: UPI payment
- `credit`: Credit sale

### Station Brands
- `IOCL`: Indian Oil Corporation Limited
- `BPCL`: Bharat Petroleum Corporation Limited
- `HPCL`: Hindustan Petroleum Corporation Limited

## Error Responses

All endpoints return errors in this format:
```json
{
  "success": false,
  "error": "Error message description"
}
```

## Database Schema Relationships

### Core Relationships:
1. **Users → Stations**: Owners linked via `stations.owner_id`, employees via `users.station_id`
2. **Stations → Pumps**: One-to-many via `pumps.station_id`
3. **Pumps → Nozzles**: One-to-many via `nozzles.pump_id`
4. **Sales**: References station, pump, nozzle, and user
5. **Tender Entries**: Station-specific daily collections
6. **Readings**: Raw meter readings from pumps (manual or device-entered)

### Business Rules:
- Owners: No `station_id`, own stations via `stations.owner_id`
- Employees: Must have `station_id`
- Superadmins: No station restrictions
- Plans: Apply at station level, not user level
- Sales: Calculated automatically or entered manually
- Settlements (Daily Closure): Reconciles sales vs tender collections

## Authentication
These endpoints currently have `verify_jwt = false` for testing. In production:
1. Enable JWT verification
2. Implement role-based access control
3. Station-level data isolation
4. User permission validation

## Rate Limiting
- Consider implementing rate limiting per IP/user
- Monitor for abuse patterns
- Log all API calls for auditing

## Deployment Notes
Edge functions are automatically deployed when code changes.
Check function logs at: https://supabase.com/dashboard/project/untzkhbbsowpkmwrxdws/functions
