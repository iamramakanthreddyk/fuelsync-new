# Backend Implementation: Employee Shortfall Tracking

## What Was Implemented

### 1. Database Schema Update
**File**: `backend/src/models/Settlement.js`
- Added `employeeShortfalls` JSON column to Settlement model
- Stores employee-wise shortfall data: `{empId: {employeeName, shortfall, count}}`
- Supports tracking which employee caused how much shortfall

### 2. Migration File
**File**: `backend/migrations/add-employee-shortfalls-to-settlements.js`
- Adds `employee_shortfalls` column to `settlements` table
- Run: `npx sequelize-cli db:migrate`

### 3. Updated Settlement Controller
**File**: `backend/src/controllers/stationController.js`
- `recordSettlement()` function enhanced:
  - Now accepts `employeeShortfalls` from frontend
  - Stores employee shortfall data in settlement record
- New function `getEmployeeShortfalls()`:
  - Endpoint: `GET /stations/:stationId/employee-shortfalls`
  - Parameters: `startDate`, `endDate` (YYYY-MM-DD format)
  - Aggregates employee-wise shortfalls from settlements
  - Returns: Array of employees with total/avg shortfall metrics

### 4. New API Endpoint
**Route**: `backend/src/routes/stations.js`
```
GET /api/v1/stations/:stationId/employee-shortfalls?startDate=2026-01-01&endDate=2026-01-31
```

### 5. Response Format
```json
{
  "success": true,
  "data": [
    {
      "employeeName": "John Doe",
      "totalShortfall": 2500.50,
      "daysWithShortfall": 5,
      "averagePerDay": 500.10,
      "settlementsCount": 8
    }
  ],
  "metadata": {
    "stationId": "...",
    "dateRange": { "startDate": "2026-01-01", "endDate": "2026-01-31" },
    "totalEmployeesAffected": 1,
    "totalShortfallAmount": 2500.50
  }
}
```

## Setup Steps

### 1. Run Migration
```bash
cd backend
npx sequelize-cli db:migrate
```

This creates the `employee_shortfalls` column in the `settlements` table.

### 2. Restart Backend
```bash
npm start
# or if using nodemon: npm run dev
```

### 3. Verify Endpoint Works
```bash
curl "http://localhost:3001/api/v1/stations/your-station-id/employee-shortfalls?startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response: 200 OK with employee shortfall data

## How It Works

### Data Flow

1. **Settlement Submission** (DailySettlement.tsx)
   - Frontend calculates employee-wise shortfalls
   - Sends `employeeShortfalls` object with settlement

2. **Backend Processing** (recordSettlement)
   - Stores `employeeShortfalls` JSON in database
   - Keeps track of which employee caused each shortfall

3. **Data Retrieval** (getEmployeeShortfalls)
   - Queries all settlements in date range
   - Aggregates shortfalls by employee
   - Calculates metrics (total, average, days affected)
   - Returns sorted by highest shortfall

4. **Frontend Display** (Reports.tsx)
   - Fetches from new endpoint
   - Displays in "Shortfall" tab
   - Shows employee-wise breakdown

## Example Flow

### 1. Settlement with Shortfall
Owner submits settlement with:
- Expected Cash: ₹5000 (from employee readings)
- Actual Cash: ₹4500 (physical count)
- Shortfall: ₹500

The readings came from:
- John Doe: 5 readings (50% responsibility)
- Jane Smith: 5 readings (50% responsibility)

### 2. Frontend Calculates
```javascript
employeeShortfalls: {
  "john-doe": { employeeName: "John Doe", shortfall: 250, count: 5 },
  "jane-smith": { employeeName: "Jane Smith", shortfall: 250, count: 5 }
}
```

### 3. Backend Stores
Settlement record saves:
```json
{
  "employee_shortfalls": {
    "john-doe": { "employeeName": "John Doe", "shortfall": 250, "count": 5 },
    "jane-smith": { "employeeName": "Jane Smith", "shortfall": 250, "count": 5 }
  }
}
```

### 4. End of Month Report
Owner checks Reports → Shortfall tab:
- Total Shortfall: ₹5000
- John Doe: ₹2500 (10 days × ₹250/day)
- Jane Smith: ₹2500 (10 days × ₹250/day)

## Testing

### Test File
`backend/test-employee-shortfalls.js`

Run:
```bash
cd backend
node test-employee-shortfalls.js
```

This tests:
1. Endpoint connectivity
2. Response format
3. Data aggregation
4. Employee breakdown calculations

## Troubleshooting

### Endpoint Returns 404
- Check migration ran: `npx sequelize-cli db:migrate`
- Restart backend after migration
- Verify route added to stations.js

### No Data Returned
- Check that settlements were created with `employeeShortfalls` data
- Verify date range includes dates with settlements
- Check station ID is correct

### Wrong Calculations
- Verify `employeeShortfalls` is sent from frontend with correct structure
- Check settlement `date` format (YYYY-MM-DD)
- Review aggregation logic in `getEmployeeShortfalls`

## Frontend Integration

The frontend (Reports.tsx) now:
1. ✅ Shows "Shortfall" tab
2. ✅ Calls new endpoint automatically
3. ✅ Displays employee-wise breakdown
4. ✅ Shows summary statistics
5. ✅ Gracefully handles missing endpoint (404)

No additional frontend changes needed - everything is already implemented!

## Database Considerations

### Index Recommendation
For better query performance on large datasets:
```sql
CREATE INDEX idx_settlements_station_date 
ON settlements(station_id, date);
```

### Data Size
- `employee_shortfalls` JSON is typically < 1KB per settlement
- Monthly data for 5 employees ≈ 150KB storage
- No significant performance impact expected

## Security
- ✅ Requires `manager` role minimum
- ✅ Station access control enforced
- ✅ Date range filtering prevents excessive data exposure
- ✅ No sensitive employee information exposed (name + shortfall only)
