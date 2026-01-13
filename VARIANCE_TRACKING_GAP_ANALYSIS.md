# Variance Tracking Gap Analysis

## Executive Summary

**Current State:** Variance is being **RECORDED** but NOT being **AGGREGATED or ANALYZED** at monthly/yearly levels for owner visibility.

The system stores variance on each daily settlement, but there's no mechanism for the owner to:
1. ✅ See today's variance (IMPLEMENTED)
2. ❌ See cumulative variance for the month (GAP)
3. ❌ See cumulative variance for the year (GAP)
4. ❌ See variance trends over time (GAP)
5. ❌ Get alerts when variance exceeds thresholds (GAP)
6. ❌ Export variance reports by period (GAP)
7. ❌ Analyze root causes of variance patterns (GAP)

---

## Current Variance Implementation

### 1. **Data Storage** ✅
**Location:** `backend/src/models/Settlement.js`

```javascript
variance: {
  type: DataTypes.DECIMAL(12,2)
},
varianceOnline: {
  type: DataTypes.DECIMAL(12,2),
  defaultValue: 0
},
varianceCredit: {
  type: DataTypes.DECIMAL(12,2),
  defaultValue: 0
}
```

**Status:** Settlement model stores:
- `variance` - Cash variance (expectedCash - actualCash)
- `varianceOnline` - Online payment variance
- `varianceCredit` - Credit payment variance
- `status` - ENUM('recorded', 'approved', 'disputed')
- `notes` - TEXT field for variance explanation

### 2. **Data Recording** ✅
**Location:** `backend/src/controllers/stationController.js` → `recordSettlement()`

Variance is calculated on backend:
```
variance = expectedCash - actualCash
```

**Safety Feature:** Backend always recalculates to prevent frontend tampering.

### 3. **Daily View** ✅
**Location:** `src/pages/owner/DailySettlement.tsx`

Shows variance for each daily settlement:
- Line 620-622: Displays variance with color coding (orange if ≥0, red if <0)
- Line 761-773: "Variance Analysis" section showing cash, online, and credit variances

**Example from your data:**
- Settlement 1: 1 reading (CNG), variance data included
- Settlement 2: 4 readings (petrol, diesel), variance data included

### 4. **Settlement Retrieval** ⚠️ **Partial**
**Location:** `backend/src/controllers/stationController.js` → `getSettlements()`

**What's Done:**
- Retrieves all settlements for a station
- Includes variance analysis with percentage calculation
- Flags variance status (OK, REVIEW, INVESTIGATE)
- Groups by date and flags duplicates

**What's Missing:**
- No date range filtering (gets ALL settlements, unlimited)
- No aggregation by month/year
- No threshold-based alerting
- No trend analysis or comparison

---

## Identified Gaps

### **GAP 1: No Monthly Variance Aggregation** 🔴
**Problem:**
- Owner cannot see "Total variance for January 2026"
- Cannot see "Average daily variance trend"
- Cannot compare January variance vs December variance

**Data Available:** All daily settlements are stored in DB
**What's Needed:** Aggregation endpoint + UI view

**Impact:** Owner has no visibility into monthly cash discrepancies

---

### **GAP 2: No Yearly Variance Reporting** 🔴
**Problem:**
- Owner cannot see annual variance summary
- Cannot identify seasonal patterns
- Cannot make year-end financial adjustments

**Data Available:** All historical settlements in DB
**What's Needed:** Year-to-date dashboard + export functionality

**Impact:** End-of-year accounting becomes manual/incomplete

---

### **GAP 3: No Variance Trend Analysis** 🔴
**Problem:**
- Owner cannot see if variance is improving or worsening
- Cannot identify root causes (e.g., employee change → variance spike)
- Cannot correlate variance with business events

**Data Available:** Daily variance history exists
**What's Needed:** Time-series chart + correlation analysis

**Impact:** Cannot identify patterns or systemic issues

---

### **GAP 4: No Variance Alert System** 🔴
**Problem:**
- No notifications when variance exceeds threshold
- Owner only discovers large variances manually
- No early warning for fraud or errors

**Data Available:** Backend already calculates threshold (3% investigate, 1% review)
**What's Needed:** Alert trigger + notification system

**Impact:** Delayed detection of cash handling issues

---

### **GAP 5: Missing Variance Context** 🟡
**Problem:**
- Variance shown without context (is ₹500 variance big or small?)
- No correlation with sales volume
- No comparison to industry standards

**Data Available:** Sales data and variance exist separately
**What's Needed:** Variance as % of daily sales, benchmarking

**Impact:** Owner cannot assess severity of variance

---

### **GAP 6: No Root Cause Tracking** 🔴
**Problem:**
- Notes field exists but not structured
- Cannot tag variance as "counting error", "fuel leak", "employee theft", etc.
- Cannot filter/analyze by root cause

**Data Available:** Notes field in Settlement model
**What's Needed:** Structured variance categorization

**Impact:** Cannot identify patterns in problem types

---

### **GAP 7: No Variance Export/Reporting** 🔴
**Problem:**
- Cannot export variance reports for auditors
- Cannot generate month-end settlement statements
- Cannot integrate with accounting software

**Data Available:** All variance data in DB
**What's Needed:** CSV/PDF export with date range filtering

**Impact:** Difficult audit trails and compliance documentation

---

### **GAP 8: No Variance Reconciliation Workflow** 🔴
**Problem:**
- Settlement status is 'recorded', 'approved', 'disputed'
- But no workflow to resolve disputed settlements
- Owner cannot mark variance as "investigated" or "resolved"

**Data Available:** Status field exists
**What's Needed:** Workflow UI to update settlement status

**Impact:** Unresolved discrepancies pile up

---

## Data Flow Analysis

### Current Flow (Daily Settlement Only):
```
Employee Records Readings → Manager Enters Actual Cash → 
System Calculates Variance → Settlement Saved → 
Variance Shown on Daily Settlement Page
❌ Stops here - no aggregation
```

### Required Flow (End-of-Month):
```
[All Daily Settlements for Jan] → 
  Aggregate variance by day/week/month → 
  Calculate metrics (total, avg, % of sales) → 
  Display in dashboard → 
  Export if needed → 
  Owner takes action
❌ Missing entire second half
```

---

## Technical Implementation Gaps

### Current UI Pages:
1. `DailySettlement.tsx` - Shows one day's settlement ✅
2. `Analytics.tsx` - Shows sales trends, NO variance section ❌
3. `Reports.tsx` - Shows sales/shift reports, NO variance section ❌
4. `OwnerDashboard.tsx` - Shows KPIs, NO variance KPI ❌

### Backend Endpoints:
1. `POST /settlements` - Records settlement ✅
2. `GET /settlements` - Gets all settlements ⚠️ (no filtering)
3. `GET /settlement-vs-sales` - Compares settlement to sales ⚠️ (not fully implemented)

### Missing Endpoints:
- `GET /settlements/by-month?month=2026-01` - Monthly aggregation
- `GET /settlements/variance-summary?startDate=&endDate=` - Date range variance
- `GET /settlements/variance-analysis` - Trend analysis
- `POST /settlements/:id/status` - Update settlement resolution status
- `GET /settlements/export` - Export with filters

---

## Your Example Data Analysis

Looking at your API response:
```json
{
  "date": "2026-01-13",
  "stationId": "f7113bb9-aa8d-4e7b-befe-c5ce9f8678ac",
  "unlinked": { "count": 0 },
  "linked": {
    "count": 5,
    "readings": [
      {
        "settlementId": "b5bc3a82-5de9-488f-b7f8-0fe71c872217",
        "linkedSettlement": { "isFinal": false }
      },
      {
        "settlementId": "469920d0-528d-4b53-abe5-12e02175dc9e",
        "linkedSettlement": { "isFinal": true }
      }
    ]
  }
}
```

**Observations:**
- 2 different settlements on same day (Jan 13)
- Settlement 1: NOT final (isFinal: false)
- Settlement 2: Final (isFinal: true)
- **Question:** If Settlement 1 is not final, why is its variance already recorded?
- **What about variance data?** Not included in readings-for-settlement endpoint

**Issue:** `GET /readings-for-settlement` doesn't return variance data, only settlement link

---

## Proposed Solution Architecture

### Phase 1: Expose Existing Variance Data (1-2 days)
```
[Backend]
- Enhance GET /settlements to accept date range filters
- Add aggregation: ?aggregate=monthly|yearly|daily
- Return structured variance metrics

[Frontend]
- Create VarianceAnalysis.tsx component
- Add variance section to Analytics page
- Create monthly/yearly variance views
```

### Phase 2: Add Variance Tracking (2-3 days)
```
[Backend]
- Add root cause categorization (enum)
- Add resolution workflow
- Create variance alert service

[Frontend]
- Create variance dashboard
- Add root cause selector during settlement
- Add status update UI
```

### Phase 3: Reporting & Export (1-2 days)
```
[Backend]
- CSV/PDF export endpoint
- Scheduled report generation

[Frontend]
- Report builder UI
- Download/email functionality
```

---

## Quick Wins (Implement First)

### 1. Add Variance Section to Analytics Page
**File:** `src/pages/owner/Analytics.tsx`

Add tab for "Variance Analysis" showing:
- Monthly variance trend chart
- Total variance YTD
- Top variance days
- Comparison to previous period

**Time:** 30 mins

### 2. Create Variance Summary Endpoint
**File:** `backend/src/controllers/stationController.js`

Add new endpoint:
```javascript
GET /stations/:stationId/variance-summary?startDate=&endDate=
Returns: {
  totalVariance,
  averageDailyVariance,
  varianceCount,
  byDay: [...],
  status: 'HEALTHY' | 'INVESTIGATE'
}
```

**Time:** 20 mins

### 3. Add Variance Display to Dashboard
**File:** `src/pages/owner/OwnerDashboard.tsx`

Add KPI card:
- "Monthly Variance: ₹-2,340 (Shortfall)"
- Red/orange status indicator
- Click to view details

**Time:** 15 mins

---

## Risk Assessment

### What Happens Without Variance Tracking:
1. **Fraud Blind Spot** - Employee theft goes unnoticed for months
2. **Accounting Errors** - Year-end reconciliation becomes nightmare
3. **Audit Failure** - Auditors may flag missing variance documentation
4. **Compliance Issues** - GST, tax reporting may be inaccurate
5. **Unfixable Data** - Variance patterns disappear (no history to analyze)

### Current Risk Level: **HIGH** 🔴
- Variance is recorded but invisible at aggregate levels
- Owner has no way to detect monthly trends
- No automated alerts for large discrepancies
- No structured investigation/resolution process

---

## Implementation Roadmap

### Week 1:
- [ ] Enhance getSettlements endpoint with date range
- [ ] Add variance summary endpoint
- [ ] Create VarianceAnalysis component for Analytics page
- [ ] Add variance KPI to OwnerDashboard

### Week 2:
- [ ] Add root cause categorization to settlement form
- [ ] Implement settlement status update workflow
- [ ] Add variance alerts (email/toast)
- [ ] Create variance export functionality

### Week 3:
- [ ] Build variance trend analysis
- [ ] Add benchmarking/comparison metrics
- [ ] Create month-end variance report template
- [ ] Implement year-to-date dashboard

---

## SQL Queries for Gap Understanding

### Current Variance Data Available:
```sql
-- All settlements with variance
SELECT 
  id, 
  date, 
  expected_cash, 
  actual_cash, 
  variance,
  variance_online,
  variance_credit,
  status,
  notes
FROM settlements
WHERE station_id = 'f7113bb9-aa8d-4e7b-befe-c5ce9f8678ac'
ORDER BY date DESC;
```

### What Owner NEEDS:
```sql
-- Monthly variance summary (MISSING)
SELECT 
  DATE_TRUNC('month', date) as month,
  SUM(variance) as total_variance,
  AVG(variance) as avg_variance,
  COUNT(*) as settlement_count,
  SUM(expected_cash) as total_expected,
  ROUND(ABS(SUM(variance)) / SUM(expected_cash) * 100, 2) as variance_pct
FROM settlements
WHERE station_id = ? AND date BETWEEN ? AND ?
GROUP BY DATE_TRUNC('month', date)
ORDER BY month DESC;
```

---

## Conclusion

**Summary of Finding:**
- ✅ Variance is being **recorded** correctly
- ✅ Backend calculates variance **safely** (on server)
- ❌ Variance is **invisible** at monthly/yearly levels
- ❌ No **aggregation, analysis, or alerting**
- ❌ No **historical tracking** for pattern analysis
- ❌ No **reconciliation workflow** for resolution

**Owner Impact:** Can see today's variance but cannot answer:
- "What was our total variance last month?"
- "Are we getting better or worse?"
- "Should I investigate this variance?"
- "What's the pattern here?"

**Recommendation:** Implement Phase 1 (Quick Wins) immediately, then Phase 2-3 as resources allow. The system is unsafe without month/year-level variance visibility.
