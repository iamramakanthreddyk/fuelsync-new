# Employee Shortfall API Specification

## Overview
This document defines the recommended API response structure for the employee shortfall reporting endpoint to provide rich, actionable data to the frontend.

## Endpoint
```
GET /api/v1/stations/:stationId/employee-shortfalls
```

## Query Parameters
- `startDate` (string, required): ISO date format (YYYY-MM-DD) - report period start
- `endDate` (string, required): ISO date format (YYYY-MM-DD) - report period end

## Response Format (Recommended)

### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "employeeName": "John Doe",
      "employeeId": "EMP001",
      "totalShortfall": 5000.50,
      "daysWithShortfall": 5,
      "averagePerDay": 1000.10,
      "settlementsCount": 3,
      "lastShortfallDate": "2026-01-24",
      "shortfallDates": [
        "2026-01-20",
        "2026-01-21",
        "2026-01-23",
        "2026-01-24"
      ],
      "settlementHistory": [
        {
          "date": "2026-01-22",
          "settlementAmount": 1500.00,
          "shortfallAmountAtTime": 2500.00
        },
        {
          "date": "2026-01-23",
          "settlementAmount": 2000.00,
          "shortfallAmountAtTime": 1500.00
        }
      ]
    },
    {
      "employeeName": "Jane Smith",
      "employeeId": "EMP002",
      "totalShortfall": 2300.75,
      "daysWithShortfall": 2,
      "averagePerDay": 1150.38,
      "settlementsCount": 1,
      "lastShortfallDate": "2026-01-24",
      "shortfallDates": [
        "2026-01-23",
        "2026-01-24"
      ],
      "settlementHistory": [
        {
          "date": "2026-01-24",
          "settlementAmount": 2300.75,
          "shortfallAmountAtTime": 2300.75
        }
      ]
    }
  ],
  "summary": {
    "totalShortfall": 7301.25,
    "employeesAffected": 2,
    "totalDaysWithShortfall": 7,
    "dateRange": {
      "startDate": "2026-01-20",
      "endDate": "2026-01-24"
    },
    "generatedAt": "2026-01-24T10:30:00Z"
  }
}
```

## Field Descriptions

### Employee Shortfall Record
| Field | Type | Description |
|-------|------|-------------|
| `employeeName` | string | Name of the employee |
| `employeeId` | string | Unique employee identifier |
| `totalShortfall` | number | Total cash shortage amount (₹) |
| `daysWithShortfall` | number | Count of days with shortfall |
| `averagePerDay` | number | Average shortfall per day (₹) |
| `settlementsCount` | number | Number of settlement transactions |
| `lastShortfallDate` | string | ISO date (YYYY-MM-DD) of most recent shortfall |
| `shortfallDates` | array | All dates when shortfall occurred (ISO format) |
| `settlementHistory` | array | Detailed settlement records |

### Settlement History Record
| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Settlement date (ISO format) |
| `settlementAmount` | number | Amount settled (₹) |
| `shortfallAmountAtTime` | number | Outstanding shortfall at time of settlement (₹) |

### Summary Object
| Field | Type | Description |
|-------|------|-------------|
| `totalShortfall` | number | Total shortfall across all employees |
| `employeesAffected` | number | Count of employees with shortfall |
| `totalDaysWithShortfall` | number | Total days across all employees |
| `dateRange` | object | Query period used |
| `generatedAt` | string | Timestamp when report was generated |

## Implementation Notes

### Data Aggregation Strategy
1. **Per-Day Grouping**: Group all shortfall entries by employee and date
2. **Settlement Tracking**: Link settlements to shortfall periods to show resolution
3. **Date Array**: Maintain array of shortfall dates for timeline visualization potential
4. **Performance**: For large datasets, consider pagination or date range limitations

### SQL Query Pattern
```sql
SELECT 
  e.name as employeeName,
  e.id as employeeId,
  COALESCE(SUM(s.amount), 0) as totalShortfall,
  COUNT(DISTINCT s.date) as daysWithShortfall,
  COALESCE(SUM(s.amount), 0) / COUNT(DISTINCT s.date) as averagePerDay,
  COUNT(DISTINCT SET.id) as settlementsCount,
  MAX(s.date) as lastShortfallDate,
  ARRAY_AGG(DISTINCT s.date ORDER BY s.date DESC) as shortfallDates
FROM employees e
LEFT JOIN shortfalls s ON e.id = s.employee_id 
  AND s.date BETWEEN $1 AND $2
LEFT JOIN settlements SET ON e.id = SET.employee_id 
  AND SET.date BETWEEN $1 AND $2
WHERE e.station_id = $3
GROUP BY e.id, e.name
HAVING SUM(s.amount) > 0
ORDER BY totalShortfall DESC;
```

## Error Responses

### 404 Not Found
```json
{
  "success": false,
  "error": "Station not found",
  "code": "STATION_NOT_FOUND"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid date range",
  "code": "INVALID_DATE_RANGE",
  "details": "startDate must be before endDate"
}
```

### 500 Server Error
```json
{
  "success": false,
  "error": "Failed to fetch shortfall data",
  "code": "INTERNAL_ERROR"
}
```

## Performance Considerations

1. **Indexing**: Create indexes on:
   - `shortfalls(employee_id, date, station_id)`
   - `settlements(employee_id, date, station_id)`

2. **Caching**: Cache results for date ranges already computed (24-hour TTL)

3. **Pagination**: For stations with 100+ employees, implement pagination:
   ```
   GET /api/v1/stations/:stationId/employee-shortfalls?page=1&limit=50
   ```

4. **Filtering**: Support filtering by employee:
   ```
   GET /api/v1/stations/:stationId/employee-shortfalls?employeeId=EMP001
   ```

## Frontend Usage

The frontend now expects this enriched data structure:

```typescript
interface EmployeeShortfallData {
  employeeName: string;
  totalShortfall: number;
  daysWithShortfall: number;
  averagePerDay: number;
  settlementsCount: number;
  shortfallDates?: string[]; // For timeline visualization
  lastShortfallDate?: string; // Most recent shortfall date
}
```

### Display Features Enabled
- **Last Shortfall Date Column**: Shows when most recent shortfall occurred
- **Timeline Analysis**: Can track shortfall frequency patterns
- **Settlement Tracking**: Can correlate settlements with shortfalls
- **Trend Analysis**: Can identify recurring issues by employee

## Migration Path

### Phase 1 (Current - Minimal)
Return basic fields only for immediate display:
```json
{
  "data": [
    {
      "employeeName": "...",
      "totalShortfall": 0,
      "daysWithShortfall": 0,
      "averagePerDay": 0,
      "settlementsCount": 0,
      "lastShortfallDate": "2026-01-24"
    }
  ]
}
```

### Phase 2 (Enhanced)
Add date arrays and settlement history for detailed analysis:
```json
{
  "data": [
    {
      "...": "...",
      "shortfallDates": ["2026-01-20", "2026-01-21"],
      "settlementHistory": [...]
    }
  ],
  "summary": {...}
}
```

### Phase 3 (Advanced)
Add pagination, filtering, and caching for large datasets.

## Testing

Test with sample data:
```bash
curl "http://localhost:3000/api/v1/stations/station-001/employee-shortfalls?startDate=2026-01-01&endDate=2026-01-31"
```

Expected response time: < 500ms for 50 employees
