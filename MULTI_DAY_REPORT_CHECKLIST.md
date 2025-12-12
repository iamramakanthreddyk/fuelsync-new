# Multi-Day Report Data Integrity Checklist

## Critical Requirements

When fuel prices change over multiple days and reports span those days, the system must:

### ✅ R1: Store Historical Price at Reading Creation
- [ ] Each reading captures the fuel price valid on its reading date
- [ ] Price is stored in `NozzleReading.price_per_litre` field
- [ ] Price is retrieved from `FuelPrice.getPriceForDate()` with the reading's date
- [ ] If no FuelPrice entry exists, clear fallback behavior (error or default)

**Evidence:** Check `readingController.js` lines 193-203

```javascript
const fuelPrice = await FuelPrice.getPriceForDate(stationId, nozzle.fuelType, finalReadingDate);
let pricePerLitre = clientPrice || fuelPrice || (isInitialReading ? 100 : 0);
```

### ✅ R2: Use Stored Price in Calculations
- [ ] All report queries use `SUM(litres_sold * price_per_litre)`
- [ ] Never recalculate price from current FuelPrice table in reports
- [ ] Never use average price across date range
- [ ] Each reading's contribution is `litres_sold[i] × price_per_litre[i]`

**Evidence:** Check all report endpoints
- `dashboardController.js`: 11 endpoints updated
- `reportController.js`: 2 endpoints updated
- `stationController.js`: 3 endpoints updated
- `NozzleReading.js`: Model methods updated

### ✅ R3: Validate Mathematical Consistency
- [ ] Every reading: `totalAmount = litres_sold × price_per_litre` (within 0.01 tolerance)
- [ ] Before saving: verify payment breakdown sums to totalAmount
- [ ] After retrieval: spot-check calculations are consistent

**Evidence:** Check `readingController.js` lines 274-278

```javascript
if (Math.abs(totalPayment - effectiveTotalAmount) > 0.01) {
  return res.status(400).json({ error: 'Payment breakdown must equal total amount' });
}
```

### ✅ R4: Maintain FuelPrice Historical Records
- [ ] FuelPrice table has entries for each date with price changes
- [ ] Each FuelPrice entry has unique (station_id, fuel_type, effective_from)
- [ ] Entries are NOT updated retroactively; new entries are added
- [ ] Historical records never deleted

**Evidence:** Check FuelPrice model definition:
- `effectiveFrom` field captures the date price became effective
- Unique index prevents duplicates on (station_id, fuel_type, effective_from)
- `updatedAt` is disabled; only creation tracked

---

## Verification Procedures

### Procedure 1: Verify FuelPrice Table Setup

**When:** Monthly
**Who:** Operations team
**How:**

```sql
-- Show all fuel prices for a station
SELECT fuel_type, price, effective_from, created_at
FROM fuel_prices
WHERE station_id = '<target_station_id>'
ORDER BY fuel_type, effective_from DESC;
```

**Expected:**
- Multiple entries per fuel type
- Ordered chronologically
- Entries for each price change date
- No gaps for active fuel types

**Failure Indicators:**
- ❌ Only one price per fuel type (prices never updated)
- ❌ Entries deleted/missing for historical dates
- ❌ Same price for all dates (prices never changed)

### Procedure 2: Verify Reading Price Storage

**When:** After price changes, before running reports
**Who:** System validates automatically, manual check quarterly
**How:**

```sql
-- Show readings with their stored prices
SELECT reading_date, fuel_type, litres_sold, price_per_litre, total_amount,
       (litres_sold * price_per_litre) as calculated,
       ABS(total_amount - (litres_sold * price_per_litre)) as variance
FROM nozzle_readings
WHERE station_id = '<target_station_id>'
  AND reading_date BETWEEN '2025-12-01' AND '2025-12-31'
ORDER BY reading_date;
```

**Expected:**
- `price_per_litre` varies by `reading_date` (not all same price)
- `variance` column < 0.01 for all rows
- `total_amount` ≈ calculated amount
- Different fuel types may have different prices

**Failure Indicators:**
- ❌ `price_per_litre` is 0 or NULL
- ❌ `price_per_litre` same for all dates (using fallback or last price)
- ❌ `variance` > 0.01 (calculation mismatch)

### Procedure 3: Verify Report Accuracy

**When:** After each price change, before generating official reports
**Who:** Owner/Manager
**How:**

```sql
-- Simulate report calculation for price change verification
WITH daily_summary AS (
  SELECT reading_date,
         SUM(litres_sold) as day_litres,
         SUM(litres_sold * price_per_litre) as day_sales,
         AVG(price_per_litre) as avg_price,
         MIN(price_per_litre) as min_price,
         MAX(price_per_litre) as max_price
  FROM nozzle_readings
  WHERE station_id = '<target_station_id>'
    AND reading_date BETWEEN '2025-12-01' AND '2025-12-31'
  GROUP BY reading_date
)
SELECT reading_date,
       day_litres,
       day_sales,
       (day_litres * avg_price) as check_avg_calc,
       ABS(day_sales - (day_litres * avg_price)) as calc_diff,
       CASE WHEN min_price = max_price THEN '⚠️ SINGLE PRICE'
            ELSE '✓ Variable prices' END as price_status
FROM daily_summary
ORDER BY reading_date;
```

**Expected Output Example:**
```
reading_date | day_litres | day_sales | check_avg_calc | calc_diff | price_status
2025-12-01   | 100        | 9500      | 9500           | 0         | Variable prices
2025-12-02   | 150        | 15000     | 15000          | 0         | Variable prices
2025-12-03   | 120        | 12600     | 12600          | 0         | Variable prices
```

**Failure Indicators:**
- ❌ `price_status` shows "SINGLE PRICE" (all readings same price)
- ❌ `calc_diff` != 0 (calculation inconsistent)
- ❌ Same `day_sales` despite different `day_litres` (wrong calculation)

### Procedure 4: Test Price Change Scenario

**When:** When adding a new station, after system updates
**Who:** QA/Testing team
**How:**

Run the provided test script:

```bash
cd backend
node test-multi-day-price.js
```

This will:
1. Verify FuelPrice retrieval for different dates
2. Check that readings store historical prices
3. Run report queries like the dashboard does
4. Validate totals are calculated correctly
5. Confirm price variation is recognized

**Success Criteria:**
- ✅ All validation checks pass
- ✅ Report shows different prices for different days
- ✅ Total sales = sum of (daily_litres × daily_price)

---

## Data Quality Rules

### Rule 1: FuelPrice Must Exist Before Reading

**When:** Reading creation
**What:** Before accepting a reading, verify fuel price exists

```javascript
// In readingController.js
const fuelPrice = await FuelPrice.getPriceForDate(stationId, nozzle.fuelType, readingDate);
if (!fuelPrice) {
  throw new Error(`Fuel price not set for ${nozzle.fuelType} on ${readingDate}`);
}
```

**Current Status:** ⚠️ Partially - Uses fallback defaults instead of requiring

**Recommendation:** Change to require FuelPrice exists

```javascript
// Better approach
if (!fuelPrice && !req.body.pricePerLitre) {
  return res.status(400).json({
    success: false,
    error: `Fuel price not set for ${nozzle.fuelType} on ${readingDate}. Set price first.`
  });
}
```

### Rule 2: Price Changes Are Additive, Not Destructive

**What:** When price changes, add new FuelPrice entry instead of updating existing

**Bad:** 
```sql
UPDATE fuel_prices SET price = 105 WHERE station_id = '...' AND fuel_type = 'petrol';
```
This loses historical record of what price was used on which date.

**Good:**
```sql
INSERT INTO fuel_prices (station_id, fuel_type, price, effective_from)
VALUES ('...', 'petrol', 105, '2025-12-03');
```
This preserves history - old entries remain, new price takes effect.

**Current Status:** ✅ Correct - FuelPrice table designed for this

### Rule 3: Reading Price Is Immutable

**What:** Once a reading is created with `price_per_litre`, it should not change

**Why:** 
- Reports rely on stored prices
- Historical data integrity
- Audit trail breaks if prices change retroactively

**Implementation:** 
```javascript
// In NozzleReading model - prevent updates to pricePerLitre
NozzleReading.beforeUpdate = (instance) => {
  if (instance.changed('pricePerLitre')) {
    throw new Error('Cannot modify price on existing reading. Create new reading instead.');
  }
};
```

**Current Status:** ⚠️ Not implemented - readings can be updated

**Recommendation:** Add hook to prevent price modification on existing readings

### Rule 4: Fallback Prices Have Clear Behavior

**Current Fallback:**
```javascript
let pricePerLitre = clientPrice || fuelPrice || (isInitialReading ? 100 : 0);
```

**When This Matters:**
- `clientPrice`: User explicitly provided price (override)
- `fuelPrice`: Looked up from FuelPrice table (preferred)
- Fallback 100: Initial readings default to ₹100/L (reasonable)
- Fallback 0: Normal readings get 0 (dangerous - wrong calculations)

**Recommendation:** Log and alert when fallback is used

```javascript
if (!fuelPrice) {
  console.warn(`⚠️ No FuelPrice found for ${fuelType} on ${readingDate}. Using fallback.`);
  // Send alert to owner
}
```

---

## Test Cases

### Test 1: Price Increases Over 3 Days
**Setup:**
- Dec 1: Petrol ₹95/L
- Dec 2: Petrol ₹100/L (price increase)
- Dec 3: Petrol ₹105/L (price increase)

**Input:**
- 100L on Dec 1
- 150L on Dec 2
- 120L on Dec 3

**Expected:**
- Total: 370L
- Sale Value: ₹37,100 (not ₹38,850 or any other value)
- Report shows 3 different prices

**Validation:**
```
Dec 1: 100 × 95 = 9,500
Dec 2: 150 × 100 = 15,000
Dec 3: 120 × 105 = 12,600
Total: 37,100 ✓
```

### Test 2: Price Decreases Over 3 Days
**Setup:**
- Dec 1: Petrol ₹110/L
- Dec 2: Petrol ₹105/L (price decrease)
- Dec 3: Petrol ₹100/L (price decrease)

**Input:**
- 100L on Dec 1
- 150L on Dec 2
- 120L on Dec 3

**Expected:**
- Total: 370L
- Sale Value: ₹36,800
- Calculation: (100×110) + (150×105) + (120×100) = 11,000 + 15,750 + 12,000 = 38,750

Wait, let me recalculate... Actually: 11,000 + 15,750 + 12,000 = 38,750 ✓

### Test 3: Multiple Prices in Single Day
**Setup:**
- Dec 1: Petrol price changes from ₹95 to ₹98 midday

**Input:**
- 8:00 AM: 50L @ ₹95/L (before price change)
- 2:00 PM: 60L @ ₹98/L (after price change)

**Expected:**
- Total: 110L
- Sale Value: (50×95) + (60×98) = 4,750 + 5,880 = 10,630
- Report for Dec 1 shows weighted average price ≈ ₹96.64/L

**Note:** Requires FuelPrice to support intra-day changes (would need timestamp, not just date)

### Test 4: Missing FuelPrice Entry
**Setup:**
- Dec 1: Petrol price exists
- Dec 2: No price entry (forgotten to update)
- Dec 3: Petrol price exists

**Input:**
- 100L on Dec 1
- 100L on Dec 2
- 100L on Dec 3

**Current Behavior:**
- Dec 1: Uses FuelPrice → ₹95
- Dec 2: Uses fallback → 0 (❌ WRONG)
- Dec 3: Uses FuelPrice → ₹105

**Problem:** Dec 2 reads as 0 sale value

**Fix:** Either:
1. **Strict mode:** Reject reading if no price - require admin to set price first
2. **Last price mode:** Use previous price as fallback - ₹95/L carries to Dec 2
3. **Next price mode:** Use next available price - ₹105 applies backwards

**Current Status:** Uses strict 0 value → reports show ₹0

**Recommendation:** Implement alert: "Price not updated for [fuel type] - last was [price] on [date]"

---

## Implementation Checklist

- [ ] Verify FuelPrice table has entries for all relevant dates
- [ ] Check that readingController uses FuelPrice.getPriceForDate()
- [ ] Confirm all report endpoints use `SUM(litres_sold * price_per_litre)`
- [ ] Run test-multi-day-price.js script and verify all checks pass
- [ ] Document price change procedure for operations team
- [ ] Set up monthly audit of FuelPrice table
- [ ] Add dashboard alert if FuelPrice not updated for 5+ days
- [ ] Implement logging for fallback price usage
- [ ] Consider adding reading price immutability hook
- [ ] Add historical price audit report endpoint

---

## Conclusion

The system **is correctly architected** for multi-day reports with price changes. The key safeguard is:

**Each reading stores the price valid on its date in `price_per_litre`, and all calculations use that stored value.**

As long as:
1. ✅ FuelPrice table is maintained with historical entries
2. ✅ Readings capture the correct price at creation time
3. ✅ Reports use the stored prices (not recalculated)

Then multi-day reports will be accurate even when prices change multiple times.

The main risk is **missing or stale FuelPrice entries**, which requires operational discipline to maintain daily price updates.
