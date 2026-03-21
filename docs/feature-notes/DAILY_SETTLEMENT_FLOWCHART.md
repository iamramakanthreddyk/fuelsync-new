# Daily Settlement Flow - Complete Guide

## Overview
Daily Settlement is the process where a station owner reconciles meter readings against actual cash collected to identify discrepancies (variance).

---

## 1. READING ENTRY (Employee/Manager)

### What Happens
An employee enters the **closing reading** (current meter value) for each nozzle at end of shift.

### UI Flow: Quick Data Entry Enhanced

```
┌─────────────────────────────────────────────────────────┐
│  1. Select Date & Station                               │
│  2. Enter Reading for Each Nozzle                        │
│     - Displays: Nozzle #, Fuel Type                      │
│     - Shows: Last Reading (opening reading)              │
│     - Input: NEW Meter Reading (closing reading)         │
│     - Calc: Litres = New Reading - Last Reading         │
│     - Calc: Sale Value = Litres × Fuel Price            │
│  3. Allocate Payment (Cash/Online/Credit)               │
│  4. Submit All Readings                                  │
└─────────────────────────────────────────────────────────┘
```

### Backend: POST /readings

**Input:**
```json
{
  "nozzleId": "uuid",
  "readingValue": 500,           // NEW meter reading (closing)
  "readingDate": "2025-12-10",
  "cashAmount": 10000,
  "onlineAmount": 0,
  "creditAmount": 0
}
```

**Calculation (Backend):**
- `previousReading`: Last recorded reading for this nozzle
- `litresSold`: `readingValue` - `previousReading`
- `pricePerLitre`: Fetched from FuelPrice table
- `totalAmount`: `litresSold` × `pricePerLitre`

**Database Saved (nozzle_readings):**
```
id: uuid
nozzle_id: uuid
reading_date: "2025-12-10"
reading_value: 500              ← Closing Reading
previous_reading: 400           ← Opening Reading (auto-fetched)
litres_sold: 100
price_per_litre: 100
total_amount: 10000             ← Calculated Sale Value
cash_amount: 10000
online_amount: 0
credit_amount: 0
settlement_id: NULL             ← Not linked to settlement yet
```

---

## 2. READINGS REVIEW (Before Settlement)

### GET /stations/:stationId/readings-for-settlement

Returns readings grouped into **Unlinked** and **Linked** categories.

**Unlinked:** Not yet assigned to any settlement (ready to be settled)
**Linked:** Already assigned to a settlement (already finalized)

### Response Structure
```json
{
  "success": true,
  "data": {
    "date": "2025-12-10",
    "stationId": "uuid",
    "unlinked": {
      "count": 1,
      "readings": [
        {
          "id": "reading-id",
          "nozzleNumber": 1,
          "fuelType": "petrol",
          "openingReading": 400,        ← previous_reading
          "closingReading": 500,        ← reading_value
          "litresSold": 100,
          "saleValue": 10000,           ← total_amount
          "cashAmount": 10000,
          "onlineAmount": 0,
          "creditAmount": 0,
          "recordedBy": {
            "id": "user-id",
            "name": "John Doe"
          },
          "recordedAt": "2025-12-10T14:30:00Z",  ← createdAt
          "settlementId": null,
          "linkedSettlement": null
        }
      ],
      "totals": {
        "cash": 10000,
        "online": 0,
        "credit": 0,
        "litres": 100,
        "value": 10000
      }
    },
    "linked": {
      "count": 2,
      "readings": [
        {
          "id": "reading-id-2",
          "openingReading": 300,
          "closingReading": 400,
          "litresSold": 100,
          "saleValue": 10000,
          "cashAmount": 10000,
          "onlineAmount": 0,
          "creditAmount": 0,
          "recordedBy": {...},
          "recordedAt": "2025-12-10T13:00:00Z",
          "settlementId": "settlement-id",
          "linkedSettlement": {
            "id": "settlement-id",
            "date": "2025-12-10",
            "isFinal": true
          }
        }
      ]
    },
    "allReadingsCount": 3
  }
}
```

**Field Mappings:**
- `openingReading` = `nozzle_reading.previous_reading` (last reading before today)
- `closingReading` = `nozzle_reading.reading_value` (meter reading entered today)
- `litresSold` = `closingReading - openingReading`
- `saleValue` = `nozzle_reading.total_amount` (pre-calculated)
- `recordedBy` = User who entered the reading
- `recordedAt` = When reading was entered (created_at)
- `linkedSettlement` = Settlement this reading is attached to (if any)

---

## 3. DAILY SETTLEMENT (Manager/Owner)

### UI: DailySettlement Component

**Step 1: Select Readings**
- Show all unlinked readings
- Manager selects which readings to include in this settlement
- Displays: **Expected Cash** (sum of selected readings)

**Step 2: Reconcile**
- Manager enters **Actual Cash** (physically counted)
- System calculates: **Variance** = Expected Cash - Actual Cash
- Also input: **Actual Online** and **Actual Credit**

**Step 3: Submit**
- Click "Complete Settlement"
- Backend links selected readings to new settlement record

### Backend: POST /stations/:stationId/settlements

**Input:**
```json
{
  "date": "2025-12-10",
  "expectedCash": 10000,        // From selected readings totals
  "actualCash": 9850,           // Physically counted
  "online": 0,
  "credit": 0,
  "notes": "Short by ₹150",
  "readingIds": ["reading-id-1", "reading-id-2"],  // CRITICAL: Selected readings
  "isFinal": true
}
```

**Backend Calculation:**
```javascript
variance = expectedCash - actualCash  // 10000 - 9850 = 150
// Backend recalculates to prevent frontend manipulation
```

**Database Updates:**

1. **settlements table** (new record):
```
id: settlement-id
station_id: uuid
date: "2025-12-10"
expected_cash: 10000          ← From readings
actual_cash: 9850             ← Owner input
variance: 150                 ← Auto-calculated
employee_cash: 10000          ← Sum of reading.cash_amount
employee_online: 0            ← Sum of reading.online_amount
employee_credit: 0            ← Sum of reading.credit_amount
online: 0                     ← Owner's actual online
credit: 0                     ← Owner's actual credit
variance_online: 0            ← employee_online - online
variance_credit: 0            ← employee_credit - credit
notes: "Short by ₹150"
recorded_by: user-id
recorded_at: NOW()
is_final: true
finalized_at: NOW()
```

2. **nozzle_readings table** (update):
```
UPDATE nozzle_readings
SET settlement_id = 'settlement-id'
WHERE id IN ('reading-id-1', 'reading-id-2')
```

---

## 4. AFTER SETTLEMENT

### Next Settlement Cannot Duplicate Previous
- When marking settlement as `isFinal: true`:
  - Auto-unfinalize any previous final settlements for same date
  - Only one final settlement per date/station

### Readings Status Changes
- **Before Settlement:** `settlementId = NULL` (unlinked)
- **After Settlement:** `settlementId = 'settlement-uuid'` (linked)
- **In Next Day Query:** Will show in "Linked" category

---

## 5. COMMON ISSUES & FIXES

### Issue 1: "saleValue is showing as 0"
**Root Cause:** API was reading non-existent field
**Fix:** Use `total_amount` instead of `sale_value`
**Status:** ✅ FIXED in stationController.js

### Issue 2: "recordedBy showing null"
**Root Cause:** Association name mismatch (`recordedByUser` vs `enteredByUser`)
**Fix:** Use `enteredByUser` relationship
**Status:** ✅ FIXED in stationController.js

### Issue 3: "recordedAt undefined"
**Root Cause:** Using non-existent field
**Fix:** Use `createdAt` from reading timestamp
**Status:** ✅ FIXED in stationController.js

### Issue 4: "Opening/Closing readings confusing"
**Root Cause:** Field names `openingReading`/`closingReading` weren't mapped to actual DB columns
**Fix:** Map correctly to `previousReading` and `readingValue`
**Status:** ✅ FIXED in stationController.js

---

## 6. DATA FLOW DIAGRAM

```
READING ENTRY
    │
    ├─ Employee enters: readingValue (meter reading)
    ├─ Backend fetches: previousReading (last reading)
    ├─ Calc: litresSold = readingValue - previousReading
    ├─ Fetch: pricePerLitre from FuelPrice table
    ├─ Calc: totalAmount = litresSold × pricePerLitre
    └─ Save to nozzle_readings table
                    │
                    ▼
         READINGS REVIEW (unlinked)
                    │
                    ├─ Show to Manager
                    ├─ Display: openingReading, closingReading, saleValue
                    ├─ Allow: Select which to settle
                    └─ Show: Expected totals
                            │
                            ▼
         DAILY SETTLEMENT
                    │
                    ├─ Manager enters: actualCash (physical count)
                    ├─ Backend calc: variance = expected - actual
                    ├─ Backend links: selected readings to settlement
                    └─ Update: nozzle_readings.settlement_id
                            │
                            ▼
         SETTLEMENT COMPLETE
                    │
                    ├─ Readings now "Linked"
                    ├─ Shows: Linked settlement info
                    ├─ Ready: For daily reports
                    └─ Next day: Can create new settlement
```

---

## 7. FIELD REFERENCE TABLE

| UI Label | Database Field | Table | Description |
|----------|---|---|---|
| Opening Reading | `previous_reading` | nozzle_readings | Last recorded reading for nozzle |
| Closing Reading | `reading_value` | nozzle_readings | Current meter reading entered today |
| Litres Sold | `litres_sold` | nozzle_readings | Calculated: closing - opening |
| Sale Value | `total_amount` | nozzle_readings | Calculated: litres × price/litre |
| Recorded By | `enteredByUser` (relation) | users | Person who entered reading |
| Recorded At | `createdAt` | nozzle_readings | Timestamp when reading was entered |
| Expected Cash | `cash_amount` | nozzle_readings | Employee reported cash for this reading |
| Actual Cash | `actual_cash` | settlements | Owner's physically counted cash |
| Variance | `variance` | settlements | Calculated: expected - actual |

---

## 8. TESTING CHECKLIST

- [ ] Employee enters reading with meter value
- [ ] Opening reading shows correctly (last reading)
- [ ] Closing reading shows as entered value
- [ ] Sale value calculates correctly (litres × price)
- [ ] Reading appears in "Unlinked" section
- [ ] Manager can select readings for settlement
- [ ] Settlement calculates variance correctly
- [ ] Selected readings move to "Linked" section
- [ ] Next settlement can be created
- [ ] Final settlement unmarkes previous final

---

## 9. API ENDPOINTS SUMMARY

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/readings` | Enter nozzle reading |
| GET | `/stations/:id/daily-sales` | Get daily summary |
| GET | `/stations/:id/readings-for-settlement` | Get unlinked readings |
| POST | `/stations/:id/settlements` | Record daily settlement |
| GET | `/stations/:id/settlements` | Get settlement history |

---

## 10. NEXT IMPROVEMENTS

1. **Add Real-time Validation**
   - Warn if reading is too low/high from average
   - Suggest most likely price/litre

2. **Duplicate Reading Protection**
   - Prevent same reading value twice
   - Warn if reading appears suspicious

3. **Settlement Reconciliation Report**
   - PDF download of daily settlement
   - Variance analysis trending

4. **Auto-variance Investigation**
   - Suggest reasons for variance
   - Link to pump/nozzle history

5. **Batch Reading Entry**
   - Bulk upload via CSV
   - Barcode scanner support
