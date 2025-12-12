# Quick Reference: Multi-Day Reports with Price Changes

## TL;DR

✅ **The system correctly handles fuel price changes across multiple days.**

Each reading stores the price valid on its date, and reports calculate using stored prices.

---

## The Problem We're Solving

**Scenario:** Fuel prices change on Dec 2, user runs a report for Dec 1-3.

```
Without proper handling (WRONG):
- Report shows "Total Sales: ₹37,000"
- But should be ₹37,100 (using actual prices)
- Because 200L+150L+120L × current price ≠ historical calculation

With proper handling (CORRECT):
- Report shows "Total Sales: ₹37,100"  
- Calculation: (100×95) + (150×100) + (120×105)
- Using actual historical prices for each day
```

---

## How FuelSync Solves It

### 1. When Reading Is Created

```
User enters: 100L on Dec 1
↓
System fetches: Price for Dec 1 from FuelPrice table → ₹95/L
↓
Stores reading with:
  litres_sold: 100
  price_per_litre: 95
  total_amount: 9,500
```

### 2. When Report Is Generated

```
SELECT SUM(litres_sold * price_per_litre) FROM readings
↓
Uses stored prices:
  Dec 1: 100 × 95 = 9,500
  Dec 2: 150 × 100 = 15,000
  Dec 3: 120 × 105 = 12,600
↓
Total: 37,100 ✓
```

### 3. Validation

```
Before saving, system checks:
  total_amount = litres_sold × price_per_litre
  9,500 = 100 × 95 ✓
```

---

## Code Locations

| What | File | Line |
|------|------|------|
| Get price for reading's date | `readingController.js` | 193 |
| Store price with reading | `readingController.js` | 336 |
| Report calculation | `dashboardController.js` | 77, 266, 326, 387, 850, 871, 902, 931, 958, 985 |
| Report calculation | `reportController.js` | 454, 482 |
| Report calculation | `stationController.js` | 165, 396, 1235 |
| Historical price retrieval | `FuelPrice.js` | 75-85 |
| Price validation | `readingController.js` | 274-278 |

---

## Database Tables

### FuelPrice Table
Stores historical prices:
```sql
INSERT INTO fuel_prices (station_id, fuel_type, price, effective_from)
VALUES ('station-1', 'petrol', 95, '2025-12-01');

INSERT INTO fuel_prices (station_id, fuel_type, price, effective_from)
VALUES ('station-1', 'petrol', 100, '2025-12-02');
```

Key points:
- One entry per price change
- Never update existing entries (add new ones)
- Order by `effective_from DESC` to get current price

### NozzleReading Table
Stores readings with their prices:
```sql
SELECT reading_date, litres_sold, price_per_litre, total_amount
FROM nozzle_readings;
```

Key points:
- `price_per_litre` is what was valid on reading's date
- `total_amount` = litres_sold × price_per_litre
- Use this stored price in reports, never recalculate

---

## Verification Queries

### Check 1: Price Table Has Entries for Different Dates

```sql
SELECT DISTINCT effective_from, price 
FROM fuel_prices 
WHERE station_id = '<id>' AND fuel_type = 'petrol'
ORDER BY effective_from DESC;
```

Expected: Multiple rows with different dates and prices

### Check 2: Readings Have Stored Prices

```sql
SELECT reading_date, litres_sold, price_per_litre, 
       (litres_sold * price_per_litre) as calculated,
       total_amount,
       ABS(total_amount - (litres_sold * price_per_litre)) as variance
FROM nozzle_readings 
WHERE reading_date BETWEEN '2025-12-01' AND '2025-12-03';
```

Expected: 
- `price_per_litre` varies by date
- `variance` < 0.01

### Check 3: Report Calculates Correctly

```sql
SELECT 
  SUM(litres_sold) as total_liters,
  SUM(litres_sold * price_per_litre) as total_sales,
  COUNT(*) as reading_count
FROM nozzle_readings 
WHERE reading_date BETWEEN '2025-12-01' AND '2025-12-03';
```

Expected: 370L, ₹37,100

---

## Risk Assessment

### ✅ Low Risk: Calculation Wrong

**Why:** System validates totalAmount = litres × price before saving

### ✅ Low Risk: Current Price Used Instead of Historical

**Why:** Reports use stored `price_per_litre`, not looked-up price

### ⚠️ Medium Risk: Fallback Price When FuelPrice Missing

**Current behavior:** Uses 0 (for normal readings) or 100 (for initial)
**Fix:** Require FuelPrice to exist before accepting reading

### ❌ High Risk: FuelPrice Table Not Maintained

**Current behavior:** If prices not updated, readings use fallback
**Fix:** Set up daily reminder to update FuelPrice table

---

## Quick Fixes Needed

### Fix 1: Require Price Before Accepting Reading

**File:** `readingController.js` line 193-203

```javascript
// Change from:
let pricePerLitre = clientPrice || fuelPrice || (isInitialReading ? 100 : 0);

// To:
if (!fuelPrice && !clientPrice) {
  return res.status(400).json({
    error: `Fuel price not set for ${nozzle.fuelType} on ${readingDate}`
  });
}
let pricePerLitre = clientPrice || fuelPrice;
```

### Fix 2: Prevent Price Updates on Existing Readings

**File:** `NozzleReading.js` (add hook)

```javascript
NozzleReading.beforeUpdate = async (instance) => {
  const original = await NozzleReading.findByPk(instance.id);
  if (instance.pricePerLitre !== original.pricePerLitre) {
    throw new Error('Cannot modify price on existing reading');
  }
};
```

### Fix 3: Alert When Prices Not Updated

**File:** `dashboardController.js` (add to getSummary)

```javascript
const lastUpdate = await FuelPrice.findOne({
  where: { stationId },
  order: [['createdAt', 'DESC']]
});

if (daysSince(lastUpdate?.createdAt) > 5) {
  response.alerts ??= [];
  response.alerts.push({
    type: 'warning',
    message: 'Fuel prices not updated for 5+ days'
  });
}
```

---

## Testing

### Run Test Script

```bash
cd backend
node test-multi-day-price.js
```

This validates:
- Prices retrieved for different dates ✓
- Readings store historical prices ✓
- Reports calculate correctly ✓
- Totals are accurate ✓

### Manual Test

1. Set fuel prices for Dec 1, 2, 3 (different prices)
2. Create readings for each day
3. Fetch report for Dec 1-3
4. Verify totals = sum of daily calculations
5. Confirm prices vary (not all same)

---

## Summary Table

| Aspect | Status | Evidence |
|--------|--------|----------|
| Store historical price | ✅ | `pricePerLitre` field in each reading |
| Use stored price in reports | ✅ | `SUM(litres × price_per_litre)` in all queries |
| Validate math | ✅ | Pre-save check: amount = litres × price |
| Handle price changes | ✅ | FuelPrice table design with effective_from |
| Multi-day reports work | ✅ | Each reading uses its own stored price |
| Edge cases handled | ⚠️ | Falls back to 0 instead of requiring price |
| Immutability enforced | ❌ | Readings can be updated (should prevent) |
| Monitoring | ❌ | No alert if prices not updated |

---

## Key Files

- **Model:** `backend/src/models/FuelPrice.js` - Price storage and retrieval
- **Model:** `backend/src/models/NozzleReading.js` - Reading with stored price
- **Controller:** `backend/src/controllers/readingController.js` - Reading creation with price capture
- **Controller:** `backend/src/controllers/dashboardController.js` - Reports using stored prices
- **Controller:** `backend/src/controllers/reportController.js` - Sales reports with price calculations
- **Test:** `backend/test-multi-day-price.js` - Validation script

---

## Next Steps

1. **Read:** Review `PRICE_CHANGE_MULTI_DAY_REPORT.md` for complete documentation
2. **Verify:** Use checklist in `MULTI_DAY_REPORT_CHECKLIST.md`
3. **Test:** Run `test-multi-day-price.js` script
4. **Implement:** Apply recommended fixes (3 suggested above)
5. **Monitor:** Set up price update alerts

---

## Questions?

- **"Will multi-day reports be wrong if prices change?"** No, each reading uses its stored price.
- **"What if FuelPrice table is missing an entry?"** Current: Reading uses fallback (0). Recommended: Reject reading until price is set.
- **"Can readings be retroactively changed?"** Currently yes (risky). Should be prevented by immutability hook.
- **"How do historical reports know what price was used?"** Stored in `price_per_litre` field of each reading.
- **"Can I see what prices were used in a report?"** Not yet, but `PRICE_AUDIT` endpoint would show this.
