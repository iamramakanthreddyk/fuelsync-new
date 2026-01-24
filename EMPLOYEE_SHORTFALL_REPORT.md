# Employee Shortfall Report Feature

## Overview
The new "Shortfall" tab in the Reports section tracks cash shortfalls by employee, showing the owner which employees are responsible for variance at month-end.

## Frontend Implementation

### Location
- **File**: `src/pages/owner/Reports.tsx`
- **Component**: `EmployeeShortfallReport`
- **Tab**: "Shortfall" tab in the Reports page

### Features
1. **Summary Statistics**
   - Total shortfall amount for selected period
   - Number of employees affected
   - Average shortfall per employee
   - Employee with highest shortfall

2. **Employee Breakdown Table**
   - Employee name
   - Total shortfall amount (₹)
   - Days with shortfall
   - Average shortfall per day
   - Settlement count

3. **Date Range Filtering**
   - Uses same date range as other reports
   - Default: Current month (1st to today)

## Backend Requirements

### New API Endpoint Required
```
GET /stations/:stationId/employee-shortfalls
```

### Query Parameters
```
startDate: YYYY-MM-DD
endDate: YYYY-MM-DD
```

### Expected Response Format
```json
[
  {
    "employeeName": "John Doe",
    "totalShortfall": 2500.50,
    "daysWithShortfall": 5,
    "averagePerDay": 500.10,
    "settlementsCount": 8
  },
  {
    "employeeName": "Jane Smith",
    "totalShortfall": 1200.00,
    "daysWithShortfall": 3,
    "averagePerDay": 400.00,
    "settlementsCount": 6
  }
]
```

## Data Collection Flow

### Settlement Submission (DailySettlement.tsx)
When a settlement is submitted, the system now collects:

1. **Employee Shortfalls Object** (sent to backend):
```javascript
employeeShortfalls: {
  "employee_id_or_name": {
    employeeName: "John Doe",
    shortfall: 2500.00,      // proportional share of total shortfall
    count: 5                   // number of readings from this employee
  }
}
```

2. **Calculation Logic**:
   - Only tracked if `actualCash < expectedCash`
   - Shortfall = `expectedCash - actualCash`
   - Distributed proportionally based on number of readings per employee
   - Example: If John has 5 of 10 readings, he gets 50% of the shortfall

### Backend Processing Required
The backend should:

1. **Store Settlement Shortfall Data**:
   - Table: `settlement_shortfalls` or add to `settlements` table
   - Fields: `settlementId`, `employeeId`, `employeeName`, `shortfallAmount`, `settlementDate`

2. **Aggregate Data** (for `/employee-shortfalls` endpoint):
   - Group shortfalls by employee for date range
   - Calculate:
     - `totalShortfall`: Sum of all shortfall amounts
     - `daysWithShortfall`: Count of unique dates with shortfalls
     - `averagePerDay`: `totalShortfall / daysWithShortfall`
     - `settlementsCount`: Count of settlements where employee had shortfall

3. **Query Implementation**:
```sql
SELECT 
  COALESCE(e.name, ss.employee_name) as employeeName,
  SUM(ss.shortfall_amount) as totalShortfall,
  COUNT(DISTINCT DATE(s.date)) as daysWithShortfall,
  SUM(ss.shortfall_amount) / COUNT(DISTINCT DATE(s.date)) as averagePerDay,
  COUNT(DISTINCT s.id) as settlementsCount
FROM settlement_shortfalls ss
JOIN settlements s ON ss.settlement_id = s.id
LEFT JOIN employees e ON ss.employee_id = e.id
WHERE s.station_id = ? 
  AND DATE(s.date) >= ? 
  AND DATE(s.date) <= ?
GROUP BY ss.employee_id, ss.employee_name
ORDER BY totalShortfall DESC;
```

## Frontend-Backend Integration

### Settlement Submission (Enhanced)
The DailySettlement component now sends:
```javascript
{
  date: "2026-01-24",
  stationId: "station-123",
  expectedCash: 5000,
  actualCash: 4500,
  online: 1000,
  credit: 500,
  readingIds: ["read-1", "read-2", ...],
  isFinal: true,
  employeeShortfalls: {
    "emp-1": { employeeName: "John", shortfall: 250, count: 5 },
    "emp-2": { employeeName: "Jane", shortfall: 250, count: 5 }
  }
}
```

### Endpoint Response Flow
1. Frontend requests: `/stations/:stationId/employee-shortfalls?startDate=2026-01-01&endDate=2026-01-24`
2. Backend aggregates shortfall data from `settlement_shortfalls` table
3. Returns formatted employee breakdown
4. Frontend renders table with sorting by total shortfall (highest first)

## Current Frontend State

✅ **Complete**:
- UI/UX for Shortfall tab
- Data collection from settlement submissions
- Query parameter handling
- Responsive table display with sorting
- Summary statistics calculation

⏳ **Pending**:
- Backend API endpoint implementation
- Database schema for `settlement_shortfalls`
- Backend aggregation query
- Integration with settlements endpoint

## Testing Checklist

1. **No Data State**:
   - "No shortfalls recorded" message displays correctly

2. **With Data**:
   - Employees listed in order (highest shortfall first)
   - Statistics calculate correctly
   - Days with shortfall counts unique dates only
   - Average per day = total shortfall / days with shortfall

3. **Date Range Filtering**:
   - Changing date range updates data
   - Respects both startDate and endDate parameters

4. **Mobile Responsive**:
   - Table scrolls horizontally on mobile
   - Summary cards stack vertically
   - Badge text readable on all screen sizes

## Future Enhancements

1. **Charts**:
   - Bar chart of shortfall by employee
   - Trend line of shortfall over time per employee

2. **Actions**:
   - Click employee name to see their settlement history
   - Download CSV/PDF report
   - Alert if employee exceeds shortfall threshold

3. **Thresholds**:
   - Configurable warning levels
   - Email alerts for high shortfalls
   - Performance tracking dashboard

## Related Files

- `src/pages/owner/DailySettlement.tsx`: Settlement submission with shortfall data
- `src/pages/owner/Reports.tsx`: Report display
- Backend: Settlement endpoint that processes `employeeShortfalls`
- Backend: New `employee-shortfalls` aggregation endpoint
