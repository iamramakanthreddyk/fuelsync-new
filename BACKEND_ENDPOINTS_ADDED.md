# Backend API Endpoints - Daily Settlement & Quick Entry

## Summary of Changes

Added missing backend endpoints to support the frontend's Quick Entry and Daily Settlement features.

### Fix Applied (Phase 13)
- **Fixed Sequelize Association Bug**: `getDailySales()` method now includes Nozzle association with proper alias (`as: 'nozzle'`)
  - Error was: "Nozzle is associated to NozzleReading using an alias. You must use the 'as' keyword..."
  - Fix: Added `as: 'nozzle'` to the include statement matching NozzleReading model association definition
  - File: `backend/src/controllers/stationController.js`, line ~837

## New Endpoints

### 1. Daily Sales Endpoint
**GET `/stations/:stationId/daily-sales?date=YYYY-MM-DD`**
- Get daily sales summary for a specific station
- Returns total liters, sale value, breakdown by fuel type, and reading details
- Used by: DailySettlement, QuickDataEntryEnhanced

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2025-12-04",
    "stationId": "af55cdf8-f40c-420a-bc15-ea55967b1995",
    "stationName": "Main Station",
    "totalSaleValue": 15234.50,
    "totalLiters": 152.34,
    "readingsCount": 8,
    "byFuelType": {
      "petrol": { "liters": 100.2, "value": 10020 },
      "diesel": { "liters": 52.14, "value": 5214.50 }
    },
    "expectedCash": 15234.50,
    "paymentSplit": { "cash": 0, "online": 0, "credit": 0 },
    "readings": [...]
  }
}
```

### 2. Record Settlement Endpoint
**POST `/stations/:stationId/settlements`**
- Record daily settlement with cash reconciliation
- Requires: manager or owner role
- Parameters:
  - `date` (optional): Settlement date, defaults to today
  - `actualCash`: Physical cash counted
  - `expectedCash`: Expected cash from readings
  - `variance`: Difference between actual and expected
  - `notes`: Settlement notes for variance explanation

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "settlement_...",
    "stationId": "af55cdf8-f40c-420a-bc15-ea55967b1995",
    "date": "2025-12-04",
    "actualCash": 15200,
    "expectedCash": 15234.50,
    "variance": -34.50,
    "notes": "Safe deposit made earlier",
    "recordedBy": "user_id",
    "recordedAt": "2025-12-04T22:00:00.000Z",
    "status": "recorded"
  }
}
```

### 3. Get Settlements Endpoint
**GET `/stations/:stationId/settlements?limit=5`**
- Get settlement history for a station
- Requires: manager or owner role
- Parameters:
  - `limit` (optional): Number of recent settlements to fetch, default 5

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "settlement_...",
      "date": "2025-12-04",
      "actualCash": 15200,
      "expectedCash": 15234.50,
      "variance": -34.50,
      "status": "settled"
    }
  ]
}
```

### 4. Daily Sales Report Endpoint
**GET `/reports/daily-sales?date=YYYY-MM-DD&stationId=STATION_ID`**
- Get daily sales analytics across stations
- Requires: manager or owner role
- Parameters:
  - `date` (optional): Report date, defaults to today
  - `stationId` (optional): Filter to specific station

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "stationId": "af55cdf8-f40c-420a-bc15-ea55967b1995",
      "stationName": "Main Station",
      "date": "2025-12-04",
      "totalSaleValue": 15234.50,
      "totalLiters": 152.34,
      "readingsCount": 8,
      "byFuelType": {
        "petrol": { "value": 10020, "liters": 100.2, "count": 5 },
        "diesel": { "value": 5214.50, "liters": 52.14, "count": 3 }
      }
    }
  ]
}
```

## Modified Files

### Backend Controllers
1. **`backend/src/controllers/stationController.js`**
   - Added `getDailySales()` - Get daily sales summary
   - Added `recordSettlement()` - Record settlement
   - Added `getSettlements()` - Get settlement history

2. **`backend/src/controllers/reportController.js`**
   - Added `getDailySalesReport()` - Get daily sales analytics

### Backend Routes
1. **`backend/src/routes/stations.js`**
   - Added route: GET `/:stationId/daily-sales`
   - Added route: POST `/:stationId/settlements`
   - Added route: GET `/:stationId/settlements`

2. **`backend/src/routes/reports.js`**
   - Added route: GET `/daily-sales`

## Existing Endpoints Used

### Credits (Already Implemented)
- **GET** `/stations/:stationId/creditors` - Get creditors for a station
- **POST** `/stations/:stationId/credits` - Record credit sale with creditor binding

### Readings
- **POST** `/readings` - Save nozzle readings with sale calculations

### Prices
- **GET** `/stations/:stationId/prices` - Get fuel prices
- **POST** `/stations/:stationId/prices` - Set fuel prices

## Frontend Integration

### QuickDataEntryEnhanced.tsx
- Uses: `/stations/{id}/creditors` - Fetch creditors for credit selection
- Uses: `/stations/{id}/prices` - Fetch current fuel prices
- Uses: `POST /readings` - Save readings with payment allocation
- Uses: `POST /stations/{id}/credits` - Record credit transaction

### DailySettlement.tsx
- Uses: `GET /stations/{id}/daily-sales` - Get today's sales summary
- Uses: `POST /stations/{id}/settlements` - Record settlement
- Uses: `GET /stations/{id}/settlements` - Get previous settlements

### DailySalesReport.tsx
- Uses: `GET /reports/daily-sales?date=...` - Get analytics data

### SettlementStationSelector.tsx
- Uses: `GET /reports/daily-sales?date=...` - Get sales summary for all stations

## Authentication & Authorization

All endpoints require:
- ✅ Authentication (`authenticate` middleware)
- ✅ Authorization via role-based access control:
  - `getDailySales`: All authenticated users can view their station's data
  - `recordSettlement`: Requires manager or owner role
  - `getSettlements`: Requires manager or owner role
  - `getDailySalesReport`: Requires manager or owner role

## Error Handling

### Graceful Fallbacks
- If `settlements` endpoint doesn't exist, API returns empty array
- If `daily-sales` endpoint returns no data, returns template structure with zero values
- All errors include proper HTTP status codes and error messages

## Future Improvements

1. **Create Settlements Table** - Persist settlement records in database
2. **Payment Split Tracking** - Store cash/online/credit breakdown per settlement
3. **Variance Analysis** - Track and report cash discrepancies
4. **Settlement Approval Workflow** - Approval required before finalizing
5. **Audit Trail** - Track who settled and when
6. **Settlement Disputes** - Flag and resolve discrepancies

## Testing Checklist

- [ ] Quick Entry saves readings with fuel price validation
- [ ] Quick Entry creates credit transactions with creditor binding
- [ ] Daily Settlement retrieves today's sales
- [ ] Daily Settlement records variance with notes
- [ ] Daily Reports shows analytics by fuel type and station
- [ ] Settlement selector shows today's summary for each station
- [ ] Credit limit validation prevents over-crediting
- [ ] Role-based access control enforced
