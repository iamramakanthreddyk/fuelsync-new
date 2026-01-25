# Sample Readings Exclusion Strategy

## Overview
Sample readings (marked with `isSample: true`) are now completely excluded from all analytics, dashboards, settlements, and reports. They are used exclusively for quality testing and verification.

## Changes Made

### 1. Transaction Controller (`backend/src/controllers/transactionController.js`)
**Change:** Sample readings no longer create transactions

- **Line 15:** Added `isSample` parameter to `createComputedReading()` function
- **Line 84:** Persisted `isSample` flag in payload
- **Line 420:** Extract `is_sample` from request and pass to `createComputedReading()`
- **Lines 177-182:** For `/api/v1/transactions`: Returns 400 error if all readings are samples
- **Lines 463-467:** For `/api/v1/transactions/quick-entry`: Records sample readings but returns 201 with message "Sample readings recorded. No transaction created"

**Result:** 
- Sample readings are recorded in database with `transactionId: null`
- No DailyTransaction is created
- No settlement impact

---

### 2. Dashboard Controller (`backend/src/controllers/dashboardController.js`)
**Change:** All 17 dashboard queries exclude sample readings

**Line 11:** Added helper constant:
```javascript
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };
```

**Updated Endpoints:**
- `getSummary` - Today's dashboard summary
- `getDailySummary` - Pump statistics
- `getPumpPerformance` - Date range nozzle readings
- `getFuelBreakdown` - Fuel type breakdown
- `getFinancialOverview` - Sales result (findOne)
- `getOwnerStats` - Today and month sales data
- `getOwnerAnalytics` - Current/previous period, sales by station, by fuel type, daily trends, top stations
- `getIncomeReceivablesReport` - All readings for period

**Impact:**
- Dashboard shows only real sales
- Settlements only calculate from non-sample readings
- Analytics exclude test data

---

### 3. Report Controller (`backend/src/controllers/reportController.js`)
**Change:** All reports exclude sample readings except for dedicated sample statistics

**Line 9:** Added helper constant:
```javascript
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };
```

**Updated Endpoints:**
- `getSalesReports` - Sales data (2 queries)
- `getShiftReports` - Pump and nozzle breakdowns (2 queries)
- `getDailySalesReport` - Fuel type breakdown (1 query)

**New Endpoint:** `/api/v1/reports/sample-statistics` (Line 720+)
Shows testing frequency and patterns:
- Total samples per day
- Samples per nozzle
- Testing frequency by user/employee
- Last sample date per nozzle
- Testing coverage percentage

**Existing Endpoint:** `/api/v1/reports/sample-readings` 
Already filters for `isSample: true` - shows all sample readings with full details

---

### 4. Routes (`backend/src/routes/reports.js`)
**Added:** New route for sample statistics
```javascript
router.get('/sample-statistics', enforceLegacyManager, requireMinRole('manager'), reportController.getSampleStatistics);
```

---

## API Endpoints Summary

### Regular Endpoints (Exclude Samples)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/analytics/summary` | GET | Today's sales summary |
| `/api/v1/analytics/daily` | GET | Daily summary |
| `/api/v1/analytics/fuel-breakdown` | GET | Fuel type breakdown |
| `/api/v1/analytics/pump-performance` | GET | Pump metrics |
| `/api/v1/analytics/nozzle-breakdown` | GET | Nozzle metrics |
| `/api/v1/analytics/financial` | GET | Financial overview |
| `/api/v1/analytics/owner/stats` | GET | Owner statistics |
| `/api/v1/analytics/owner/analytics` | GET | Owner analytics |
| `/api/v1/analytics/income-receivables` | GET | Income/receivables report |
| `/api/v1/reports/sales` | GET | Sales reports |
| `/api/v1/reports/shift-reports` | GET | Shift reports |
| `/api/v1/reports/daily-sales` | GET | Daily sales report |

### Sample-Specific Endpoints (Include/Show Only Samples)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/reports/sample-readings` | GET | Detailed list of all sample readings ✅ |
| `/api/v1/reports/sample-statistics` | GET | Testing frequency & patterns ✅ **NEW** |

---

## Transaction Behavior

### POST `/api/v1/transactions` (readingIds based)
```
Input: All readings marked with is_sample: true
Response: 400 Error
{
  "error": "Sample readings cannot create transactions. Only use sample readings for testing/verification."
}
```

### POST `/api/v1/transactions/quick-entry`
```
Input: All readings marked with is_sample: true
Response: 201 Success (but no transaction created)
{
  "message": "Sample readings recorded. No transaction created.",
  "data": { "createdReadings": [...] },
  "transactionId": null
}
```

---

## Data Integrity

✅ **Verified:**
- Sample readings stored with `isSample: true`
- No transaction created → no settlement impact
- Dashboard/analytics queries use `EXCLUDE_SAMPLE_READINGS`
- All 17 dashboard queries updated
- All report queries updated
- Sample-specific APIs (2) include sample readings

---

## Testing Recommendations

1. **Add sample readings** with `is_sample: true`
   - Verify they're recorded in DB
   - Verify no transaction is created
   - Verify no settlement includes them
   
2. **Check dashboard** after sample entry
   - Should NOT show in sales totals
   - Should NOT affect settlement calculations
   
3. **Check sample statistics endpoint**
   - Should show frequency of tests
   - Should show per-nozzle testing patterns
   - Should show which users performed tests

4. **Mixed readings test**
   - Some sample, some real → Should fail with error

---

## Files Modified
1. `backend/src/controllers/transactionController.js` - Added sample handling
2. `backend/src/controllers/dashboardController.js` - Added filter to 17 queries
3. `backend/src/controllers/reportController.js` - Added filter + new statistics endpoint
4. `backend/src/routes/reports.js` - Added sample-statistics route
