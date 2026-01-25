# Station Filtering Test Guide

## Problem Fixed
Analytics/Reports endpoints were showing data from ALL user's stations instead of respecting the `stationId` query parameter.

## Root Cause
The `getStationFilter()` helper function didn't accept an optional `stationId` parameter to filter to a specific station.

## Solution Applied

### 1. Updated `getStationFilter()` Function (Line 18-45)
- Added `requestedStationId = null` parameter
- For owners: Validates that they own the requested station before filtering
- Returns `{ stationId: requestedStationId }` if owner has access
- Returns `null` if owner doesn't own the requested station (prevents unauthorized access)

### 2. Updated 4 Key Dashboard Endpoints

#### 4.1 `getNozzleBreakdown()` (Line 213-223)
- Now extracts `stationId` from query params
- Passes to `getStationFilter(user, stationId)`
- **Impact**: Nozzle breakdown now respects station selection

#### 4.2 `getDailySummary()` (Line 324-335)
- Now extracts `stationId` from query params
- Passes to `getStationFilter(user, stationId)`
- **Impact**: Daily totals now per-station

#### 4.3 `getFuelBreakdown()` (Line 420-430)
- Now extracts `stationId` from query params
- Passes to `getStationFilter(user, stationId)`
- **Impact**: Fuel type breakdown now per-station

#### 4.4 `getPumpPerformance()` (Line 513-523)
- Now extracts `stationId` from query params
- Passes to `getStationFilter(user, stationId)`
- **Impact**: Pump performance now per-station

#### 4.5 `getFinancialOverview()` (Line 647-657)
- Now extracts `stationId` from query params
- Passes to `getStationFilter(user, stationId)`
- **Impact**: Financial metrics now per-station

### 3. Already Supporting stationId
- `getSummary()` - Already had custom stationId handling
- `getOwnerAnalytics()` - Already accepted stationId parameter
- `getIncomeReceivablesReport()` - Already required stationId
- `getOwnerStats()` - Doesn't use getStationFilter (owner-specific aggregation)

## Testing Procedure

### Prerequisites
- Create a test owner with 2+ stations (e.g., "Station A" and "Station B")
- Create some nozzle readings in both stations
- Ensure readings have different values to verify filtering

### Test 1: Nozzle Breakdown with Station Filter
```bash
GET /api/v1/dashboard/nozzle-breakdown?stationId=1&startDate=2024-01-01&endDate=2024-12-31
```
**Expected**: Only nozzles from Station 1 should appear
**Before Fix**: Both stations' nozzles would appear

### Test 2: Daily Summary with Station Filter
```bash
GET /api/v1/dashboard/daily-summary?stationId=2&startDate=2024-01-01&endDate=2024-12-31
```
**Expected**: Only Station 2's daily data
**Before Fix**: Would show aggregated data from all stations

### Test 3: Fuel Breakdown with Station Filter
```bash
GET /api/v1/dashboard/fuel-breakdown?stationId=1&startDate=2024-01-01&endDate=2024-12-31
```
**Expected**: Only fuel types from Station 1
**Before Fix**: Mixed fuel data from all stations

### Test 4: Pump Performance with Station Filter
```bash
GET /api/v1/dashboard/pump-performance?stationId=1&startDate=2024-01-01&endDate=2024-12-31
```
**Expected**: Only pumps from Station 1
**Before Fix**: Would show all pumps

### Test 5: Financial Overview with Station Filter
```bash
GET /api/v1/dashboard/financial-overview?stationId=2&month=2024-01
```
**Expected**: Financial metrics for Station 2 only
**Before Fix**: Aggregated data from all stations

### Test 6: Security - Owner Can't Access Other Owner's Station
```bash
# If Owner A tries to access Station owned by Owner B:
GET /api/v1/dashboard/nozzle-breakdown?stationId=<owner_b_station>&startDate=2024-01-01&endDate=2024-12-31
```
**Expected**: 403 error or empty data (getStationFilter returns null)
**Security**: Prevents unauthorized station data access

### Test 7: Super Admin Can Access Any Station
```bash
# Super admin accessing any station:
GET /api/v1/dashboard/nozzle-breakdown?stationId=<any_station>&startDate=2024-01-01&endDate=2024-12-31
```
**Expected**: Data for requested station only
**Result**: Super admin has unrestricted access

## Verification Steps

1. **Code Review**:
   - ✅ getStationFilter() has stationId parameter with validation
   - ✅ getNozzleBreakdown() extracts and passes stationId
   - ✅ getDailySummary() extracts and passes stationId
   - ✅ getFuelBreakdown() extracts and passes stationId
   - ✅ getPumpPerformance() extracts and passes stationId
   - ✅ getFinancialOverview() extracts and passes stationId

2. **Runtime Testing**:
   - [ ] Test each endpoint with single station (should return only that station's data)
   - [ ] Test each endpoint without stationId (should return all user's stations)
   - [ ] Test security (owner accessing other station should fail)
   - [ ] Test super admin (should access any station)

## Files Modified
- `backend/src/controllers/dashboardController.js`:
  - getStationFilter() function
  - getNozzleBreakdown() endpoint
  - getDailySummary() endpoint
  - getFuelBreakdown() endpoint
  - getPumpPerformance() endpoint
  - getFinancialOverview() endpoint

## Sample Request/Response

### Before Fix
```json
// Request: GET /api/v1/dashboard/nozzle-breakdown?stationId=1
// Response: Nozzles from BOTH Station 1 AND Station 2
{
  "success": true,
  "data": {
    "nozzles": [
      { "nozzleNumber": "1", "station": "Station 1", "sales": 150.50 },
      { "nozzleNumber": "2", "station": "Station 1", "sales": 200.00 },
      { "nozzleNumber": "1", "station": "Station 2", "sales": 100.00 },  // <-- WRONG
      { "nozzleNumber": "2", "station": "Station 2", "sales": 120.00 }   // <-- WRONG
    ]
  }
}
```

### After Fix
```json
// Request: GET /api/v1/dashboard/nozzle-breakdown?stationId=1
// Response: Only nozzles from Station 1
{
  "success": true,
  "data": {
    "nozzles": [
      { "nozzleNumber": "1", "station": "Station 1", "sales": 150.50 },
      { "nozzleNumber": "2", "station": "Station 1", "sales": 200.00 }
    ]
  }
}
```

## Next Steps
1. Test each endpoint with the test procedures above
2. Verify UI correctly filters analytics when station is selected
3. Check reportController endpoints (they may have same issue)
4. Update documentation/API specs if needed
