# Sample Readings Feature Implementation Guide

**Date:** January 25, 2026  
**Status:** ✅ Fully Implemented

---

## Overview

The **Sample Readings** feature allows employees to record test/quality-check readings that don't represent actual fuel sales. These readings:
- ✅ Keep meter continuity (reading value moves forward)
- ❌ Don't deduct fuel from tank levels
- ❌ Don't affect sales totals or profit calculations
- 📊 Are tracked separately for owner visibility

---

## What Changed

### 1. Database Migration
**File:** `backend/migrations/20260125-add-is-sample-to-nozzle-readings.js`

Added new column to `nozzle_readings` table:
```sql
ALTER TABLE nozzle_readings ADD COLUMN is_sample BOOLEAN DEFAULT false;
CREATE INDEX idx_nozzle_readings_sample 
  ON nozzle_readings(station_id, reading_date, is_sample);
```

**Purpose:** Mark readings as samples for easy filtering

---

### 2. Backend Model Changes
**File:** `backend/src/models/NozzleReading.js`

**Added field:**
```javascript
isSample: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
  field: 'is_sample',
  comment: 'If true: meter moved but fuel returned to tank. Excluded from sales calculations.'
}
```

**Modified hooks:**
- `afterCreate` hook: Skip tank deduction if `isSample = true`
- `afterUpdate` hook: Skip tank adjustment if `isSample = true`

---

### 3. Backend Controller
**File:** `backend/src/controllers/readingController.js`

**Changes:**
- Accept `isSample` / `is_sample` parameter from frontend
- Pass `isSample` flag to reading creation
- Log when sample readings are processed

```javascript
const finalIsSample = isSample !== undefined ? isSample : is_sample || false;

// When creating reading:
reading = await NozzleReading.create({
  // ... other fields
  isSample: finalIsSample
});
```

---

### 4. Sales Query Updates
**File:** `backend/src/controllers/salesController.js`

**Change:** Filter out sample readings from sales totals
```javascript
// Only get readings with actual sales (but include initial readings that represent sales)
where.litresSold = { [Op.gt]: 0 };

// EXCLUDE sample readings from sales (isSample = false only)
where.isSample = false;
```

---

### 5. New Report Endpoint
**File:** `backend/src/controllers/reportController.js`

**New method:** `getSampleReadingsReport()`

**Endpoint:** `GET /api/v1/reports/sample-readings`

**Query Parameters:**
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD
- `stationId` (optional): Filter by station

**Response Format:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "dateRange": { "startDate": "2026-01-20", "endDate": "2026-01-25" },
      "totalSampleReadings": 15,
      "stationsIncluded": [
        { "id": "uuid", "name": "Main Station", "code": "ST001" }
      ]
    },
    "details": [
      {
        "date": "2026-01-25",
        "totalSamples": 3,
        "byNozzle": {
          "Pump 1 - Nozzle 1 (Petrol)": 2,
          "Pump 2 - Nozzle 3 (Diesel)": 1
        },
        "readings": [
          {
            "id": "uuid",
            "readingDate": "2026-01-25",
            "readingValue": 5000.50,
            "litresSold": 50.00,
            "nozzleNumber": "1",
            "fuelType": "Petrol",
            "pumpName": "Pump 1",
            "enteredBy": "John Doe",
            "enteredAt": "2026-01-25T10:30:00Z",
            "notes": "Daily quality check"
          }
        ]
      }
    ]
  }
}
```

---

### 6. Route Registration
**File:** `backend/src/routes/reports.js`

**Added route:**
```javascript
router.get('/sample-readings', 
  enforceLegacyManager, 
  requireMinRole('manager'), 
  reportController.getSampleReadingsReport
);
```

---

### 7. Frontend Form Update
**File:** `src/pages/DataEntry.tsx`

**Added:**
1. Interface field for sample readings:
```typescript
interface ManualEntryData {
  station_id: string;
  nozzle_id: string;
  cumulative_vol: number;
  reading_date: string;
  reading_time: string;
  is_sample?: boolean;  // NEW
}
```

2. **Checkbox in form** with helpful description:
```tsx
<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
  <div className="flex items-start gap-3">
    <Checkbox
      id="is-sample"
      checked={watchManual('is_sample') || false}
      onCheckedChange={(checked) => setManualValue('is_sample', !!checked)}
    />
    <div className="flex-1">
      <Label htmlFor="is-sample" className="text-sm font-medium text-blue-900 cursor-pointer">
        ✓ This is a sample/test reading
      </Label>
      <p className="text-xs text-blue-700 mt-1">
        Check this if fuel was tested and returned to the tank (quality check, repair check, etc.).
        Sample readings don't affect sales totals or tank levels.
      </p>
    </div>
  </div>
</div>
```

3. **Include in payload:**
```typescript
const payload = {
  stationId: data.station_id,
  nozzleId: data.nozzle_id,
  readingDate: data.reading_date,
  readingValue: data.cumulative_vol,
  readingTime: data.reading_time,
  isSample: data.is_sample || false,  // NEW
  // ... other fields
};
```

---

## How It Works

### User Flow

1. **Employee enters reading in DataEntry form**
   - Fills in: Station, Nozzle, Volume, Date, Time
   - **Checks "This is a sample/test reading"** if applicable
   - Submits reading

2. **Backend processing:**
   - Calculates `litresSold = readingValue - previousReading`
   - **Checks `isSample` flag:**
     - If `true`: Skip tank level deduction
     - If `false`: Deduct from tank (normal behavior)
   - Stores reading with `isSample = true/false`

3. **Sales reports automatically exclude samples**
   - `getSalesReports()` filters: `where.isSample = false`
   - Sample readings never appear in sales totals
   - Tank levels never affected by samples

4. **Owner can view sample readings report**
   - Dashboard shows sample readings by date
   - Grouped by nozzle
   - Shows who entered it and when
   - Count of samples per day

---

## Example Scenarios

### Scenario 1: Daily Quality Check
- **10 AM:** Employee takes 5L sample for testing
- Employee enters reading: `Pump 1, Nozzle 1, Volume 2005.5 L, Sample ✓`
- **Result:** 
  - Meter shows 2005.5 L (reading recorded)
  - Tank level stays same (5L not deducted)
  - Sales total excludes this 5L

### Scenario 2: Repair Check
- **3 PM:** Mechanic runs pump for repair check, fuel flows
- Mechanic enters reading: `Pump 2, Nozzle 3, Volume 1050 L, Sample ✓`
- **Result:**
  - Meter shows 1050 L (continuity maintained)
  - Tank stays same (fuel not counted as loss)
  - No impact on sales numbers

### Scenario 3: Normal Sale (Not a Sample)
- **12 PM:** Customer buys 40L of fuel
- Employee enters reading: `Pump 1, Nozzle 1, Volume 1040 L, Sample ☐`
- **Result:**
  - Meter shows 1040 L
  - Tank deducts 40L
  - Sales total includes ₹2000 (40L × ₹50)

---

## API Usage Examples

### Create Reading (with sample flag)

**Request:**
```bash
POST /api/v1/readings
Content-Type: application/json

{
  "stationId": "uuid-station-001",
  "nozzleId": "uuid-nozzle-001",
  "readingDate": "2026-01-25",
  "readingValue": 2005.50,
  "isSample": true,
  "pricePerLitre": 50.00,
  "totalAmount": 0,
  "litresSold": 5.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-reading-001",
    "isSample": true,
    "litresSold": 5.00,
    "totalAmount": 0,
    "message": "Sample reading recorded - tank not affected"
  }
}
```

---

### Get Sample Readings Report

**Request:**
```bash
GET /api/v1/reports/sample-readings?startDate=2026-01-20&endDate=2026-01-25&stationId=uuid-station-001
Authorization: Bearer {token}
```

**Response:** (See format above)

---

## Testing Checklist

- [ ] Create sample reading via DataEntry form
- [ ] Verify tank level unchanged after sample reading
- [ ] Verify sample readings excluded from sales total
- [ ] Verify sample readings excluded from profit calculation
- [ ] Get sample readings report via API
- [ ] Verify report groups by date and nozzle
- [ ] Verify normal (non-sample) readings work as before
- [ ] Verify sample readings maintain meter continuity
- [ ] Test with multiple samples on same day
- [ ] Test report filtering by date range

---

## Key Benefits

✅ **Accurate Tank Inventory**
- Sample readings don't artificially reduce tank levels

✅ **Correct Sales Reports**
- Sample fuel never counted as sold

✅ **Accurate Profit Calculations**
- Cost of goods matches actual sales

✅ **Transparency**
- Owner can see all quality checks taken

✅ **Meter Continuity**
- Next real sale reading continues from sample reading

✅ **Simple for Employees**
- One checkbox - easy to understand

---

## Backward Compatibility

- All existing readings have `isSample = false` (default)
- Existing logic unchanged for normal readings
- Sample reading feature is purely additive
- No breaking changes to API

---

## Files Modified/Created

### Created:
- `backend/migrations/20260125-add-is-sample-to-nozzle-readings.js`

### Modified:
- `backend/src/models/NozzleReading.js` - Added field and hook logic
- `backend/src/controllers/readingController.js` - Accept isSample parameter
- `backend/src/controllers/salesController.js` - Filter out samples from sales
- `backend/src/controllers/reportController.js` - New report endpoint
- `backend/src/routes/reports.js` - Register new route
- `src/pages/DataEntry.tsx` - Add checkbox and include in payload

---

## Future Enhancements

💡 **Dashboard Widget**
- Show count of samples taken today
- Trend of samples per week

💡 **Categorization**
- Dropdown: Quality Check, Repair Check, Testing, etc.
- Track reason for each sample

💡 **Alerts**
- Notify owner if too many samples in a day
- Potential indicator of equipment issues

💡 **Mobile App**
- Same sample feature in mobile reading entry

---

**Implementation Date:** January 25, 2026  
**Status:** ✅ Complete and Ready for Testing
