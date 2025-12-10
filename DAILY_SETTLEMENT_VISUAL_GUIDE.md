# Daily Settlement - Visual Diagrams

## Settlement Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DAILY SETTLEMENT PROCESS                      │
└─────────────────────────────────────────────────────────────────┘

                        STAGE 1: READING ENTRY
                        
                          EMPLOYEE
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
              Meter shows      System knows
              500 liters       Last: 400
                    │           │
                    └──────┬────┘
                           ▼
                    CALCULATE:
                  ┌────────────────┐
                  │ Litres = 500-400│ = 100
                  │ Price per L = ₹100 │
                  │ Sale Value = 100×100│ = ₹10,000
                  └────────────────┘
                           │
                           ▼
                    DATABASE: nozzle_readings
                  ┌──────────────────────┐
                  │ reading_value: 500   │
                  │ previous_reading: 400│
                  │ litres_sold: 100     │
                  │ total_amount: 10000  │
                  │ cash_amount: 10000   │
                  │ settlement_id: NULL  │◄─── UNLINKED
                  └──────────────────────┘
                           │
                           ▼

                      STAGE 2: REVIEW
                        
                        MANAGER OPENS
                      SETTLEMENT PAGE
                           │
          ┌────────────────┴────────────────┐
          ▼                                  ▼
      UNLINKED                            LINKED
    (not settled)                      (already settled)
          │                                  │
          ├─ Nozzle 1                       ├─ Nozzle X
          │  Opening: 400 ◄─────────────┬──┤ Opening: 200
          │  Closing:  500              │   │ Closing:  300
          │  Litres:   100              │   │ Litres:   100
          │  Sale:   ₹10,000           │   │ Sale:   ₹10,000
          │  [✓] Select                │   │ (Finalized)
          │                             │   │
          ├─ Nozzle 2                   │   └─ Nozzle Y
          │  Opening: 300               │      Opening: 100
          │  Closing:  400              │      Closing:  200
          │  Litres:   100              │      Litres:   100
          │  Sale:   ₹10,000           │      Sale:   ₹10,000
          │  [✓] Select                │      (Finalized)
          │                             │
          └─ Nozzle 3                   │
             Opening: 200               │
             Closing:  300              │
             Litres:   100              │
             Sale:   ₹10,000           │
             [✓] Select                │
                                        │
    Unlinked Total: ₹30,000 ◄──────────┤
    Linked Total:   ₹20,000 ◄──────────┘
                           │
                           ▼

                   STAGE 3: SETTLE
                        
                      SELECT + CONFIRM
                  ┌──────────────────────┐
                  │ Selected: 3 readings │
                  │ Expected Cash: ₹30,000
                  │                      │
                  │ Actual Cash Count:   │
                  │ [     29,850     ]   │
                  │                      │
                  │ Variance: -150       │
                  │ (Short by ₹150)      │
                  │                      │
                  │ [Submit Settlement]  │
                  └──────────────────────┘
                           │
                           ▼
                      BACKEND:
                  ┌──────────────────────┐
                  │ Create Settlement    │
                  │ id: settle-xyz       │
                  │ date: 2025-12-10     │
                  │ expected_cash: 30000 │
                  │ actual_cash: 29850   │
                  │ variance: 150        │
                  │ recorded_by: mgr-123 │
                  │ is_final: true       │
                  └──────────────────────┘
                           │
                           ▼
                  UPDATE nozzle_readings:
                  ┌──────────────────────┐
                  │ SET settlement_id=   │
                  │     settle-xyz       │
                  │ WHERE id IN          │
                  │ (nozzle-1,           │
                  │  nozzle-2,           │
                  │  nozzle-3)           │
                  └──────────────────────┘
                           │
                           ▼

                      STAGE 4: RESULT
                        
                      REFRESH PAGE
                           │
          ┌────────────────┴────────────────┐
          ▼                                  ▼
      UNLINKED                            LINKED
    (not settled)                      (already settled)
          │                                  │
          │ (empty - all settled)            ├─ Nozzle 1
          │                                  │ Opening: 400
          Unlinked Total: ₹0                 │ Closing: 500
                                             │ Settled 2025-12-10
                                             │
                                             ├─ Nozzle 2
                                             │ Opening: 300
                                             │ Closing: 400
                                             │ Settled 2025-12-10
                                             │
                                             ├─ Nozzle 3
                                             │ Opening: 200
                                             │ Closing: 300
                                             │ Settled 2025-12-10
                                             │
                    Linked Total: ₹50,000 ◄──┘
```

---

## State Transition Diagram

```
┌────────────────────────────────────────────────────────────────┐
│            READING STATE TRANSITIONS                            │
└────────────────────────────────────────────────────────────────┘

           ┌──────────────────┐
           │  READING CREATED │
           │  settlement_id   │
           │     = NULL       │ ◄─── Employee enters meter
           └────────┬─────────┘
                    │
         Settlement not linked
                    │
                    ▼
           ┌──────────────────┐
           │     UNLINKED     │ ◄─── Can be selected
           │    (For Review)  │      for settlement
           └────────┬─────────┘
                    │
         Manager selects +
         creates settlement
                    │
                    ▼
           ┌──────────────────┐
           │     LINKED       │ ◄─── Now part of
           │settlement_id =   │      settlement
           │  settle-xyz      │
           └────────┬─────────┘
                    │
        Cannot select again
        (already settled)
                    │
                    ▼
           ┌──────────────────┐
           │   FINALIZED      │ ◄─── In final report
           │    (in reports)  │      Locked
           └──────────────────┘
                    
           Legend: Vertical movement = Process flow
                   Arrows = Status change
```

---

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE SCHEMA                             │
└─────────────────────────────────────────────────────────────────┘

    PUMPS                      NOZZLES
      │                            │
      │ 1──────────N               │
      │                            │
      │                    ┌───────┴────────┐
      │                    │                │
      │                    ▼ 1              ▼ N
      │              NOZZLE_READINGS
      │              ┌──────────────────────┐
      │              │ id                   │
      │              │ nozzle_id ────→ Nozzle
      │              │ reading_date         │
      │              │ reading_value ◄──┐   │
      │              │ previous_reading   │  │ User enters
      │              │ litres_sold (calc)│  │ this
      │              │ total_amount       │  │
      │              │ cash_amount        │  │
      │              │ online_amount      │  │
      │              │ credit_amount      │  │
      │              │ settlement_id ─────┐ │
      │              │ entered_by ───→ User│
      │              │ created_at         │ │
      │              └────────┬───────────┘ │
      │                       │   Links to  │
      │                       │   Settlement
      │                       │
      │                       ▼ N
      │              ┌──────────────────────┐
      │              │ SETTLEMENTS          │
      │              ├──────────────────────┤
      │              │ id                   │
      │              │ station_id           │
      │              │ date                 │
      │              │ expected_cash        │
      │              │ actual_cash          │
      │              │ variance (calc)      │
      │              │ employee_cash        │
      │              │ employee_online      │
      │              │ employee_credit      │
      │              │ online               │
      │              │ credit               │
      │              │ variance_online      │
      │              │ variance_credit      │
      │              │ recorded_by → User   │
      │              │ recorded_at          │
      │              │ is_final             │
      │              │ finalized_at         │
      │              └──────────────────────┘

    Relationship: 1 Settlement connects to N Readings
                  (via nozzle_readings.settlement_id)
```

---

## API Response Structure Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│           API RESPONSE STRUCTURE                                 │
└─────────────────────────────────────────────────────────────────┘

    /readings-for-settlement Response
    {
      success: true
      data: {
        date: "2025-12-10"
        stationId: "uuid"
        
        ┌─ Unlinked (Ready to Settle)
        unlinked: {
          count: 1
          readings: [              ┌─ Each Reading
            {                       │
              id: "uuid"            │ Maps to Database:
              nozzleNumber: 1       │ ├─ nozzle_number
              fuelType: "petrol"    │ ├─ fuel_type
              openingReading: 400   │ ├─ previous_reading ✅
              closingReading: 500   │ ├─ reading_value ✅
              litresSold: 100       │ ├─ litres_sold
              saleValue: 10000      │ ├─ total_amount ✅
              cashAmount: 10000     │ ├─ cash_amount
              onlineAmount: 0       │ ├─ online_amount
              creditAmount: 0       │ ├─ credit_amount
              recordedBy: {         │ ├─ enteredByUser ✅
                id: "user-id"       │ │  ├─ id
                name: "John Doe"    │ │  └─ name
              }                     │ │
              recordedAt: "..."     │ ├─ createdAt ✅
              settlementId: null    │ └─ settlement_id
              linkedSettlement: null│
            }                       │
          ]                         │
          totals: {                 └─ Sum of Readings
            cash: 10000
            online: 0
            credit: 0
            litres: 100
            value: 10000
          }
        }
        
        ┌─ Linked (Already Settled)
        linked: {
          count: 2
          readings: [
            {
              ... same structure as above
              settlementId: "settle-id"  ← Not null
              linkedSettlement: {        ← Shows which settlement
                id: "settle-id"
                date: "2025-12-10"
                isFinal: true
              }
            }
          ]
          totals: {
            cash: 20000
            online: 0
            credit: 0
            litres: 200
            value: 20000
          }
        }
        
        allReadingsCount: 3
      }
    }
```

---

## Field Mapping Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                   FIELD MAPPING GUIDE                            │
└─────────────────────────────────────────────────────────────────┘

    API RESPONSE ─────────────► DATABASE FIELD
    ─────────────────────────────────────────────────────────────
    
    openingReading ──────────► previous_reading
                              └─ Last meter reading before today
    
    closingReading ──────────► reading_value
                              └─ Current meter reading (user enters)
    
    litresSold ─────────────► litres_sold
                              └─ Calculated: closing - opening
    
    saleValue ──────────────► total_amount
                              └─ Calculated: litres × price/litre
    
    cashAmount ─────────────► cash_amount
                              └─ Employee reported cash
    
    onlineAmount ───────────► online_amount
                              └─ Employee reported digital payment
    
    creditAmount ───────────► credit_amount
                              └─ Employee reported credit sale
    
    recordedBy ──────────────► enteredByUser (relation)
                              └─ User.id + User.name
    
    recordedAt ──────────────► createdAt (timestamp)
                              └─ When reading was recorded
    
    settlementId ────────────► settlement_id
                              └─ Links to Settlement record
    
    linkedSettlement ───────► settlement (relation)
                              └─ Settlement.id + date + isFinal
```

---

## Variance Calculation Visual

```
┌─────────────────────────────────────────────────────────────────┐
│                   VARIANCE CALCULATION                           │
└─────────────────────────────────────────────────────────────────┘

    STEP 1: Employee Reports Sales
    ┌────────────────┐
    │ Nozzle 1: ₹10K │
    │ Nozzle 2: ₹10K │
    │ Nozzle 3: ₹10K │
    └────────┬───────┘
             │
             ▼
    Expected Cash = ₹30,000  ◄─── From reading reports
    
    
    STEP 2: Manager Counts Physical Cash
    ┌─────────────────────────┐
    │ Opening Balance: ₹5,000  │
    │ + Sales Today: ₹30,000  │
    │ = Total Available: ₹35K │
    │                         │
    │ Expenses Paid: ₹5,150   │
    │ = Should Have: ₹29,850  │
    │                         │
    │ Actually Counted: ₹29,850
    └────────┬────────────────┘
             │
             ▼
    Actual Cash = ₹29,850  ◄─── Physically counted
    
    
    STEP 3: Backend Calculates Variance
    ┌──────────────────────────────────┐
    │ Variance = Expected - Actual      │
    │ Variance = ₹30,000 - ₹29,850      │
    │ Variance = -₹150 (SHORT)          │
    │                                  │
    │ ✅ Calculated on Backend Only     │
    │ ✅ Frontend CANNOT manipulate     │
    │ ✅ Stored in Database             │
    └──────────────────────────────────┘
    
    
    INTERPRETATION:
    
    Variance = 0          ✅ Perfect match
    Variance > 0 (Short)  ⚠️ Missing cash
    Variance < 0 (Extra)  ✅ Extra cash (possibly tips)
    Variance > 1000       🔴 Alert - investigate
```

---

## Unlinked vs Linked Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    SETTLEMENT TIMELINE                           │
└─────────────────────────────────────────────────────────────────┘

    DAY 1 (Morning)
    ┌──────────────────────────────────────────────────────────┐
    │ READING ENTRIES                                          │
    │ 9:00 AM:  Pump 1: 100 L  ──┐                           │
    │ 9:30 AM:  Pump 2: 100 L  ──┤─► All UNLINKED           │
    │ 2:00 PM:  Pump 3: 100 L  ──┘   (not settled)          │
    │                                                         │
    │ Total Expected: ₹30,000                               │
    └────────────────┬─────────────────────────────────────┘
                     │
                     ▼
    DAY 1 (Evening - Settlement #1)
    ┌──────────────────────────────────────────────────────────┐
    │ SETTLEMENT CREATED                                       │
    │ 5:00 PM: Manager reviews & settles readings #1, #2      │
    │                                                          │
    │ Expected: ₹20,000 (2 readings)                          │
    │ Actual: ₹20,050 (counted)                               │
    │ Variance: -₹50 (extra)                                   │
    │                                                          │
    │ ✅ isFinal: true                                         │
    │ ✅ Link readings #1 & #2 to this settlement             │
    │                                                          │
    │ Result:  UNLINKED: 1 reading (₹10K)                    │
    │          LINKED: 2 readings (₹20K)                      │
    └────────────────┬─────────────────────────────────────┘
                     │
                     ▼
    DAY 1 (Late Evening - Settlement #2)
    ┌──────────────────────────────────────────────────────────┐
    │ ANOTHER SETTLEMENT CREATED (e.g., evening shift)         │
    │ 8:00 PM: Manager settles remaining reading #3            │
    │                                                          │
    │ Expected: ₹10,000 (1 reading)                           │
    │ Actual: ₹9,800 (counted)                                │
    │ Variance: +₹200 (short)                                  │
    │                                                          │
    │ ✅ isFinal: true                                         │
    │ ✅ Auto-unfinalize previous final settlement            │
    │ ✅ Link reading #3 to this settlement                    │
    │                                                          │
    │ Result:  UNLINKED: 0 readings                           │
    │          LINKED: 3 readings (₹30K)                      │
    │          FINAL SETTLEMENT: #2                            │
    │          (Settlement #1 is now isFinal: false)          │
    └────────────────┬─────────────────────────────────────┘
                     │
                     ▼
    DAY 2 (Morning - Next Day's Settlement)
    ┌──────────────────────────────────────────────────────────┐
    │ NEW READINGS FROM NEW DAY                                │
    │ 9:00 AM:  Pump 1: 150 L  ──┐                           │
    │ 10:00 AM: Pump 2: 150 L  ──┤─► New UNLINKED            │
    │ 2:00 PM:  Pump 3: 150 L  ──┘   readings                │
    │                                                          │
    │ Previous Settlements History:                            │
    │ ├─ Settlement #2: Final (from yesterday 8 PM)           │
    │ └─ Settlement #1: Not Final (auto-replaced)             │
    │                                                          │
    │ Ready for new settlement with today's readings          │
    └──────────────────────────────────────────────────────────┘
```

---

## Summary

- **Unlinked** = Not yet in a settlement (can be selected)
- **Linked** = Already in a settlement (finalized)
- **Final** = The "official" settlement for that date
- **Variance** = Expected cash - actual cash (backend calculated)
- **Safe** = Backend controls calculations, prevents manipulation
