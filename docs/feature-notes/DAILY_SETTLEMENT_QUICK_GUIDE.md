# Daily Settlement - Quick Reference Guide

## 🎯 What Was Confusing?

### 1. **Reading Entry** (Employee)
**Old Confusion:** "What's the difference between opening and closing?"
**Clear Answer:** 
- **Opening** = meter reading BEFORE today
- **Closing** = meter reading you enter NOW
- **Litres Sold** = Closing - Opening

### 2. **Reading Review** (Manager)
**Old Problem:** Numbers didn't match, showing zeros and nulls
**Now Fixed:** All data shows correctly from database
- Opening reading: `previousReading` ✅
- Closing reading: `readingValue` ✅
- Sale value: `totalAmount` ✅
- Who recorded: `enteredByUser` ✅

### 3. **Settlement** (Manager/Owner)
**Old Confusion:** "What's unlinked vs linked?"
**Clear Answer:**
- **Unlinked** = readings not yet assigned to a settlement (ready to be settled)
- **Linked** = readings already assigned to a settlement (finalized)

---

## 📊 Daily Settlement Step-by-Step

### Step 1: Employee Enters Reading
```
┌──────────────────────────────────────────┐
│ Pump shows: 500 liters                   │
│ System knows: Last reading was 400        │
│ Employee enters: 500                     │
│ System calculates:                       │
│   Litres = 500 - 400 = 100              │
│   Price = ₹100 per liter                │
│   Sale = 100 × ₹100 = ₹10,000           │
└──────────────────────────────────────────┘
```

### Step 2: Manager Reviews Readings
```
┌──────────────────────────────────────────┐
│ Unlinked Readings (not yet settled):     │
│ ┌────────────────────────────────────┐  │
│ │ Nozzle 1 - Petrol                 │  │
│ │ Opening: 400 ← was here           │  │
│ │ Closing: 500 ← is here now        │  │
│ │ Litres: 100                       │  │
│ │ Sale: ₹10,000                     │  │
│ │ Recorded by: John Doe at 2:30 PM │  │
│ │ [✓] Select                        │  │
│ └────────────────────────────────────┘  │
│ Total: ₹10,000 cash                     │
└──────────────────────────────────────────┘
```

### Step 3: Manager Creates Settlement
```
┌──────────────────────────────────────────┐
│ SETTLEMENT FORM                          │
├──────────────────────────────────────────┤
│ Selected: 3 readings                     │
│ Expected Cash: ₹30,000 (from readings)   │
│                                          │
│ Actual Cash Collected: 29,850            │
│ Variance: -150 (short by ₹150)          │
│                                          │
│ [✓] Mark as Final                       │
│ [ Submit Settlement ]                    │
└──────────────────────────────────────────┘
```

### Step 4: Backend Links Readings
```
Database Update:
UPDATE nozzle_readings
SET settlement_id = 'settlement-xyz'
WHERE id IN (reading-1, reading-2, reading-3)

Results:
- Readings now "Linked" 
- Cannot select again
- Show settlement details
```

---

## 🔑 Key Definitions

| Term | Means | Example |
|------|-------|---------|
| **Opening Reading** | Meter value at start of settlement period | 400 liters |
| **Closing Reading** | Meter value at end (what you enter) | 500 liters |
| **Litres Sold** | Difference (closing - opening) | 100 liters |
| **Sale Value** | Revenue (litres × price) | 100 × ₹100 = ₹10,000 |
| **Expected Cash** | What should be in till (from readings) | ₹10,000 |
| **Actual Cash** | What's really in till (counted) | ₹9,850 |
| **Variance** | Difference (expected - actual) | -₹150 (short) |
| **Unlinked** | Not yet in a settlement | 5 readings |
| **Linked** | Already assigned to settlement | 2 readings |

---

## 🔄 Data Flow Visualization

```
EMPLOYEE ENTERS READING
│
├─ Meter: 500
├─ Last: 400 (auto-fetch)
├─ Calc: 100 liters
├─ Calc: ₹10,000 sale
│
▼
DATABASE: nozzle_readings
├─ previousReading: 400
├─ readingValue: 500
├─ litresSold: 100
├─ totalAmount: 10000
├─ cashAmount: 10000
├─ enteredByUser: john_doe
├─ createdAt: 2025-12-10T14:30:00Z
├─ settlementId: NULL ← Not linked yet
│
▼
MANAGER REVIEWS
├─ Shows as "Unlinked"
├─ Displays all fields correctly
├─ Can select for settlement
│
▼
MANAGER SETTLES
├─ Selects reading
├─ Enters actual cash: 9850
├─ Creates settlement
├─ Backend updates: settlementId = 'settlement-xyz'
│
▼
DATABASE: nozzle_readings (updated)
├─ settlementId: 'settlement-xyz' ← Now linked
│
DATABASE: settlements (new)
├─ date: 2025-12-10
├─ expectedCash: 10000
├─ actualCash: 9850
├─ variance: 150 ← calculated
├─ recordedBy: manager_user
├─ isFinal: true
│
▼
NEXT VIEW
├─ Shows as "Linked"
├─ Cannot select again
├─ Shows settlement details
```

---

## ✅ Response Example (Correct)

```json
GET /stations/xyz/readings-for-settlement?date=2025-12-10

{
  "unlinked": {
    "count": 1,
    "readings": [{
      "id": "read-1",
      "openingReading": 400,        ✅ previousReading
      "closingReading": 500,        ✅ readingValue  
      "litresSold": 100,
      "saleValue": 10000,           ✅ totalAmount
      "recordedBy": {               ✅ enteredByUser
        "name": "John Doe"
      },
      "recordedAt": "2025-12-10T14:30:00Z",  ✅ createdAt
      "settlementId": null
    }],
    "totals": {
      "cash": 10000,
      "value": 10000
    }
  },
  "linked": {
    "count": 2,
    "readings": [...previously settled readings...],
    "totals": {
      "cash": 20000,
      "value": 20000
    }
  }
}
```

---

## 🚨 Common Issues & Solutions

### Issue: "Opening/Closing readings are 0"
**Cause:** API reading wrong database field
**Solution:** ✅ FIXED - now reads `previousReading` and `readingValue`

### Issue: "Sale value is 0"
**Cause:** API reading non-existent field
**Solution:** ✅ FIXED - now reads `totalAmount`

### Issue: "Who recorded this is blank"
**Cause:** Wrong association name
**Solution:** ✅ FIXED - now uses `enteredByUser`

### Issue: "When was it recorded is blank"
**Cause:** Reading wrong field
**Solution:** ✅ FIXED - now uses `createdAt`

### Issue: "No totals for linked readings"
**Cause:** Not calculating totals for linked section
**Solution:** ✅ FIXED - now calculates and returns linked totals

---

## 📱 UI Components Involved

### Reading Entry
- `QuickDataEntryEnhanced.tsx`
- Shows: Last reading, current meter, calculated litres & sale value
- User enters: Meter reading, payment allocation

### Reading Review
- `DailySettlement.tsx` (reading selection section)
- Shows: Unlinked & linked readings with user/timestamp info
- Manager: Selects readings to settle

### Settlement
- `DailySettlement.tsx` (settlement form)
- Shows: Expected vs actual cash, variance
- Manager: Enters actual amounts, creates settlement

### Settlement History
- `DailySettlement.tsx` (previous settlements section)
- Shows: Recent settlement records and status
- View: When settled, by whom, variance

---

## 🔐 Security Notes

1. **Variance is calculated on backend** - Frontend cannot manipulate
2. **Only one final settlement per date** - Previous final auto-unmarked
3. **Readings immutable after settlement** - Cannot edit settled readings
4. **Only manager+ can settle** - Access control enforced
5. **All operations logged** - Audit trail maintained

---

## 💾 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/readings` | Employee enters reading |
| GET | `/stations/:id/readings-for-settlement` | Get readings for settlement |
| POST | `/stations/:id/settlements` | Manager creates settlement |
| GET | `/stations/:id/settlements` | View settlement history |

---

## 🧪 Quick Test

1. **Enter reading:** Go to Quick Data Entry, enter meter value
2. **Check display:** Go to Daily Settlement, select date
3. **Verify readings:** Should show non-zero opening/closing/sale values
4. **Select readings:** Click checkboxes to select
5. **Create settlement:** Enter actual cash, click submit
6. **Verify link:** Readings should move to "Linked" section

---

## 📚 Related Documentation

- `DAILY_SETTLEMENT_FLOWCHART.md` - Complete flow diagram
- `DAILY_SETTLEMENT_FIXES.md` - Technical changes made
- `DAILY_SETTLEMENT_BEFORE_AFTER.md` - Before/after comparisons
