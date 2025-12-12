# Visual Guide: Multi-Day Reports with Price Changes

## The Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRICE CHANGES ACROSS DAYS                    │
└─────────────────────────────────────────────────────────────────┘

FuelPrice Table (Historical Records)
═══════════════════════════════════
  Date        Price    Status
  Dec 1       ₹95/L    Effective
  Dec 2       ₹100/L   Effective (price increased)
  Dec 3       ₹105/L   Effective (price increased)

                          ↓ ↓ ↓

Reading Creation (Capture Historical Price)
════════════════════════════════════════════
  
  Day 1: User enters 100L
  ├─ System asks: "What's the price on Dec 1?"
  ├─ Queries FuelPrice table
  ├─ Finds: ₹95/L
  └─ Stores reading with pricePerLitre = 95

  Day 2: User enters 150L
  ├─ System asks: "What's the price on Dec 2?"
  ├─ Queries FuelPrice table
  ├─ Finds: ₹100/L
  └─ Stores reading with pricePerLitre = 100

  Day 3: User enters 120L
  ├─ System asks: "What's the price on Dec 3?"
  ├─ Queries FuelPrice table
  ├─ Finds: ₹105/L
  └─ Stores reading with pricePerLitre = 105

                          ↓ ↓ ↓

NozzleReading Table (Historical Readings with Their Prices)
═════════════════════════════════════════════════════════════

Reading 1:  100L @ ₹95/L stored
Reading 2:  150L @ ₹100/L stored
Reading 3:  120L @ ₹105/L stored

                          ↓ ↓ ↓

Report Generation (Use Stored Prices)
══════════════════════════════════════

User requests: Sales for Dec 1-3

System calculates:
  Query: SELECT SUM(litres_sold * price_per_litre)
  Calculation:
    (100 × 95) + (150 × 100) + (120 × 105)
    = 9,500 + 15,000 + 12,600
    = 37,100 ✓

Result: ₹37,100
  └─ Correct! Uses historical prices for each day.
```

---

## Wrong Way vs Right Way

```
┌─────────────────────────────────────────────────────────────────┐
│                        WRONG APPROACH                           │
└─────────────────────────────────────────────────────────────────┘

What NOT to do:
  1. Use current price (₹105) for all days
  2. Calculate: 370L × ₹105 = ₹38,850 ❌ WRONG

  or

  1. Use average price: (95+100+105)/3 = ₹100
  2. Calculate: 370L × ₹100 = ₹37,000 ❌ WRONG

  or

  1. Sum up total_amount fields
  2. But these are payment amounts, not sale values ❌ WRONG


┌─────────────────────────────────────────────────────────────────┐
│                        RIGHT APPROACH                           │
└─────────────────────────────────────────────────────────────────┘

What TO do:
  1. Each reading stores its historical price
  2. Calculate: SUM(litres_sold * price_per_litre)
  3. = (100×95) + (150×100) + (120×105)
  4. = ₹37,100 ✓ CORRECT

Key: Each reading remembers what price was on its date.
```

---

## Timeline Visualization

```
TIMELINE: FuelPrice Changes

Dec 1           Dec 2           Dec 3
  |               |               |
  v               v               v

₹95/L ──────┐  ₹100/L ──────┐  ₹105/L ──────┐
 Entry1      |   Entry2      |   Entry3      |
             |               |               |
    ┌────────┴───────┬───────┴───────┬───────┴────────┐
    |                |               |                |
  100L             150L             120L
  read             read             read
    |                |               |
    v                v               v
 ₹95/L → ₹9,500   ₹100/L → ₹15,000  ₹105/L → ₹12,600
    |                |               |
    └────────────────┴───────────────┘
              |
              v
         Report Query:
         SUM(litres × price)
         = ₹37,100 ✓
```

---

## Database Structure

```
╔═══════════════════════════════════════════════════════════════╗
║                    FUEL PRICE TABLE                           ║
║  (Historical prices - append-only)                            ║
╠═════════════┬──────────┬──────┬─────────────────┬────────────╣
║ id          │ station  │ fuel │ price           │ effective  ║
╠═════════════╼──────────┼──────┼─────────────────┼────────────╣
║ FP-001      │ ST-1     │ Pet  │ 95.00          │ 2025-12-01 ║
║ FP-002      │ ST-1     │ Pet  │ 100.00         │ 2025-12-02 ║  ← New entry added
║ FP-003      │ ST-1     │ Pet  │ 105.00         │ 2025-12-03 ║  ← New entry added
╚═════════════╧══════════╧══════╧═════════════════╧════════════╝

                           ↓
                           ↓
                           ↓

╔═══════════════════════════════════════════════════════════════╗
║                  NOZZLE READING TABLE                         ║
║  (Readings with captured historical prices)                   ║
╠═════════════┬──────┬──────┬──────────┬─────────┬────────────╣
║ id          │ date │ litr │ price_used│ amount  │ fuel_type ║
╠═════════════╼──────┼──────┼──────────┼─────────┼────────────╣
║ NR-001      │ 1-12 │ 100  │ 95.00    │ 9500.00 │ petrol    ║  ← Uses price from FP-001
║ NR-002      │ 2-12 │ 150  │ 100.00   │ 15000.00│ petrol    ║  ← Uses price from FP-002
║ NR-003      │ 3-12 │ 120  │ 105.00   │ 12600.00│ petrol    ║  ← Uses price from FP-003
╚═════════════╧══════╧══════╧══════════╧═════════╧════════════╝
```

---

## Query Execution

```
┌─────────────────────────────────────────────────────────────┐
│ User requests: Dashboard for Dec 1-3                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ SQL Query Executes:                                         │
│                                                             │
│ SELECT SUM(litres_sold * price_per_litre) as total_sales   │
│ FROM nozzle_readings                                        │
│ WHERE station_id = 'ST-1'                                  │
│   AND reading_date BETWEEN '2025-12-01' AND '2025-12-03'   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Row by Row Calculation:                                     │
│                                                             │
│ Row 1: litres_sold=100, price_per_litre=95                 │
│        → 100 × 95 = 9,500                                  │
│                                                             │
│ Row 2: litres_sold=150, price_per_litre=100                │
│        → 150 × 100 = 15,000                                │
│                                                             │
│ Row 3: litres_sold=120, price_per_litre=105                │
│        → 120 × 105 = 12,600                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Sum All Rows:                                               │
│                                                             │
│ 9,500 + 15,000 + 12,600 = 37,100                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Dashboard Shows: Total Sales = ₹37,100 ✓                   │
│                                                             │
│ Correct! Each day's sales calculated with its own price.   │
└─────────────────────────────────────────────────────────────┘
```

---

## Edge Case: What If Price Not Updated?

```
Scenario: Operator forgets to update price on Dec 2

FuelPrice Table:
┌──────────────┬────────────┐
│ Date         │ Price      │
├──────────────┼────────────┤
│ 2025-12-01   │ ₹95/L      │
│ 2025-12-03   │ ₹105/L     │
└──────────────┴────────────┘
           ↑
        Missing Dec 2!

User enters reading on Dec 2:
  System asks: "What's price on Dec 2?"
  Searches FuelPrice table
  Finds: No entry for Dec 2!
  Falls back to: 0 or ₹100 default ⚠️

NozzleReading shows:
  Dec 2: 150L @ ₹0 = ₹0 ❌ WRONG

Report shows: ₹9,500 + ₹0 + ₹12,600 = ₹22,100 ❌ WRONG

FIX: Require price to be set before accepting readings
```

---

## Validation Loop

```
User enters reading
        ↓
Is litres_sold provided? → Yes
        ↓
Is price_per_litre provided? → No
        ↓
Look up price in FuelPrice table
        ↓
Found? → Yes
        ↓
Calculate: totalAmount = litres_sold × price_per_litre
        ↓
Validate: totalAmount ≈ payment breakdown
        ↓
Matches? → Yes
        ↓
✓ Save reading with stored price
        ↓
Reading saved with:
  - litres_sold: 100
  - price_per_litre: 95 ← This is immutable now
  - total_amount: 9,500

---

User generates report
        ↓
Query: SUM(litres_sold * price_per_litre) for date range
        ↓
✓ Report shows correct total
   (each reading contributes litres × its stored price)
```

---

## Key Takeaway

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  "Each reading is a time capsule."                          │
│                                                             │
│  It captures not just:                                      │
│    - How many liters were dispensed                         │
│                                                             │
│  But also:                                                  │
│    - What the price was on that day                         │
│                                                             │
│  When the report runs, it doesn't ask "What's the price     │
│  now?" It asks "What was the price on that day?" and        │
│  uses the stored answer.                                    │
│                                                             │
│  This is why multi-day reports work correctly even when     │
│  prices change multiple times.                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Flow Diagram

```
User Action: Create Reading
        │
        ├─ Receive: nozzleId, readingValue, readingDate
        │
        ├─ Calculate: litres_sold = readingValue - previousReadingValue
        │
        ├─ Query FuelPrice
        │    └─ SELECT price FROM fuel_prices
        │        WHERE station_id = ? 
        │          AND fuel_type = ?
        │          AND effective_from <= readingDate
        │        ORDER BY effective_from DESC LIMIT 1
        │
        ├─ Set: pricePerLitre = result.price ← HISTORICAL PRICE CAPTURED
        │
        ├─ Calculate: totalAmount = litres_sold × pricePerLitre
        │
        ├─ Validate: Ensure payment breakdown matches totalAmount
        │
        └─ Create reading with:
             ├─ litres_sold
             ├─ pricePerLitre ← Stored for historical records
             └─ totalAmount

User Action: Generate Report
        │
        ├─ Receive: station, dateRange
        │
        ├─ Query readings:
        │    SELECT SUM(litres_sold * pricePerLitre) ← Uses STORED prices
        │    FROM readings
        │    WHERE readingDate BETWEEN start AND end
        │
        └─ Return: Accurate total using historical prices
```

---

## Summary

```
Multi-Day Reports with Changing Prices

┌──────────────────┬───────────────────────────────────────┐
│ When Price       │ System Behavior                       │
│ Changes          │                                       │
├──────────────────┼───────────────────────────────────────┤
│ Dec 1: ₹95/L     │ Reading stores ₹95                   │
│ Dec 2: ₹100/L    │ Reading stores ₹100                  │
│ Dec 3: ₹105/L    │ Reading stores ₹105                  │
│                  │                                       │
│ Report runs      │ Calculates:                           │
│ for Dec 1-3      │ (100×95) + (150×100) + (120×105)    │
│                  │ = ₹37,100 ✓                          │
└──────────────────┴───────────────────────────────────────┘
```
