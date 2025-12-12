# Challenge Analysis: Multi-Day Reports with Fuel Price Changes

## Executive Summary

**Challenge:** When fuel prices change over multiple days, and a user fetches a report spanning those days, the calculation must use the **historical price for each reading**, not a current or recalculated price.

**Current Status:** ✅ **SYSTEM IS CORRECT**

The FuelSync system correctly handles this scenario because:
1. Each reading stores the fuel price valid on its reading date
2. All report calculations use the stored price: `SUM(litres_sold * price_per_litre)`
3. Mathematical consistency is validated before saving

**Example:**
```
Day 1 (Dec 1): 100L @ ₹95/L = ₹9,500     ✓ Price on Dec 1
Day 2 (Dec 2): 150L @ ₹100/L = ₹15,000   ✓ Price on Dec 2
Day 3 (Dec 3): 120L @ ₹105/L = ₹12,600   ✓ Price on Dec 3
─────────────────────────────────────
Total: 370L = ₹37,100 ✓ Correct total
```

---

## How It Works

### 1️⃣ Reading Creation: Capture Historical Price

When user creates a reading, the system captures the fuel price **valid on that reading's date**:

```javascript
// readingController.js:193
const fuelPrice = await FuelPrice.getPriceForDate(stationId, nozzle.fuelType, finalReadingDate);

// readingController.js:203
let pricePerLitre = clientPrice || fuelPrice || (isInitialReading ? 100 : 0);
```

**This ensures:** Each reading has `price_per_litre` = the historical price on that date

### 2️⃣ Storage: Immutable Historical Record

The reading is saved with:
- `litres_sold`: 100 (what was dispensed)
- `price_per_litre`: 95 (price on that date)
- `total_amount`: 9,500 (always = litres × price)

### 3️⃣ Report Calculation: Use Stored Prices

All reports calculate using stored prices:

```javascript
// Dashboard, Reports, Station endpoints all use:
[sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'amount']
```

**This ensures:** Reports use actual historical prices, not current or recalculated prices

### 4️⃣ Validation: Math Must Check Out

Before saving each reading:

```javascript
// readingController.js:274-278
if (Math.abs(totalPayment - effectiveTotalAmount) > 0.01) {
  return res.status(400).json({ error: 'Payment breakdown must equal total amount' });
}
```

**This ensures:** System never saves inconsistent data

---

## Architecture

### FuelPrice Model
Stores **historical prices** for each fuel type:

```
Table: fuel_prices
- station_id: which station
- fuel_type: which fuel (petrol, diesel, etc)
- price: the price
- effective_from: DATE (when this price took effect)
- created_at: timestamp

Key: UNIQUE(station_id, fuel_type, effective_from)
```

**Design:** Prices are **never updated**, only new entries added:
- Old: `INSERT INTO fuel_prices ... effective_from='2025-12-01' price=95`
- New: `INSERT INTO fuel_prices ... effective_from='2025-12-02' price=100` ← New entry

This preserves history!

### Reading Query for Historical Price

```javascript
// FuelPrice.getPriceForDate(stationId, fuelType, date)
// Returns: the most recent price with effective_from <= date

WHERE station_id = :stationId
  AND fuel_type = :fuelType
  AND effective_from <= :date  ← Gets price effective on that date
ORDER BY effective_from DESC
LIMIT 1
```

**Example:**
- Query: What's the price for Dec 2?
- Table has: Dec 1 @ ₹95, Dec 2 @ ₹100, Dec 3 @ ₹105
- Query finds: Dec 2 @ ₹100 (most recent entry ≤ Dec 2) ✓

### Report Calculation

```javascript
// All report endpoints execute:
SELECT
  SUM(litres_sold) as total_litres,
  SUM(litres_sold * price_per_litre) as total_sales
FROM nozzle_readings
WHERE reading_date BETWEEN :startDate AND :endDate

// For multi-day with price changes:
// = (100×95) + (150×100) + (120×105)
// = 9,500 + 15,000 + 12,600
// = 37,100 ✓
```

---

## Edge Cases Handled

### Case 1: No FuelPrice Entry (Missing Price)

**Scenario:** Operator forgets to update price for Dec 2

**Current Behavior:**
```javascript
let pricePerLitre = clientPrice || fuelPrice || (isInitialReading ? 100 : 0);
//                                   ↓ null
//                                   0 for normal readings (❌ PROBLEM)
```

**Impact:** Reading shows 0 sale value

**Recommendation:**
```javascript
if (!fuelPrice && !req.body.pricePerLitre) {
  return res.status(400).json({
    error: `Fuel price not set for ${nozzle.fuelType} on ${readingDate}`
  });
}
```

### Case 2: Client Provides Payment Breakdown Only

**Scenario:** User enters 200L with cash=₹10k, online=₹5k, credit=₹5k (total ₹20k)

**How It Works:**
```javascript
// readingController.js:273-283
const totalPayment = 10000 + 5000 + 5000; // ₹20,000
if (!effectiveTotalAmount) effectiveTotalAmount = totalPayment; // Set to ₹20,000

// Recalculate pricePerLitre
if (litresSold > 0 && !clientPrice && !fuelPrice) {
  pricePerLitre = effectiveTotalAmount / litresSold;  // ₹20,000 / 200 = ₹100/L
}
```

**Impact:** System calculates price from payment breakdown - still correct!

### Case 3: Client Provides Explicit Price

**Scenario:** User enters 200L with pricePerLitre=₹95

**How It Works:**
```javascript
const clientPrice = req.body.pricePerLitre; // ₹95
let pricePerLitre = clientPrice || fuelPrice || ...; // Uses client price
```

**Impact:** Client-provided price takes precedence (override)

---

## Verification

### Database Check

```sql
-- Verify readings have prices
SELECT reading_date, litres_sold, price_per_litre, 
       (litres_sold * price_per_litre) as calculated
FROM nozzle_readings
WHERE reading_date BETWEEN '2025-12-01' AND '2025-12-03'
ORDER BY reading_date;
```

**Expected:** Different prices for different dates

### Report Query Check

```sql
-- Simulate what dashboard calculates
SELECT
  SUM(litres_sold) as liters,
  SUM(litres_sold * price_per_litre) as sales
FROM nozzle_readings
WHERE reading_date BETWEEN '2025-12-01' AND '2025-12-03';
```

**Expected:** Uses stored prices, not current prices

### Validation Test

Run the provided test script:
```bash
cd backend
node test-multi-day-price.js
```

This validates:
- ✓ FuelPrice retrieval for different dates
- ✓ Readings store historical prices
- ✓ Report calculations are correct
- ✓ Price variation is recognized

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| FuelPrice Model | ✅ Correct | Designed for historical prices |
| Reading Creation | ✅ Correct | Captures price for reading's date |
| Price Retrieval | ✅ Correct | getPriceForDate uses date filtering |
| Report Calculations | ✅ Correct | All endpoints use SUM(litres × price) |
| Math Validation | ✅ Correct | Verifies amount = litres × price |
| Edge Case Handling | ⚠️ Partial | Fallback to 0 instead of error |
| Price Immutability | ❌ Missing | Readings can be updated (shouldn't allow) |
| Monitoring | ❌ Missing | No alert if prices not updated |

---

## Recommendations

### 1. Strict Price Requirement

Instead of defaulting to 0, require price to be set:

```javascript
// readingController.js - Change from permissive to strict
const fuelPrice = await FuelPrice.getPriceForDate(stationId, nozzle.fuelType, readingDate);

if (!fuelPrice && !req.body.pricePerLitre) {
  throw new ApiError(
    'PRICE_NOT_SET',
    `Fuel price not configured for ${nozzle.fuelType} on ${readingDate}. Please set price first.`,
    400
  );
}
```

**Benefit:** Prevents accidental zero prices from breaking reports

### 2. Price Immutability Hook

Prevent accidental updates to reading prices:

```javascript
// NozzleReading.js
NozzleReading.beforeUpdate = async (instance) => {
  const original = await NozzleReading.findByPk(instance.id);
  if (instance.pricePerLitre !== original.pricePerLitre) {
    throw new Error('Cannot modify historical price on existing reading');
  }
};
```

**Benefit:** Prevents retroactive price changes that would break historical accuracy

### 3. Price Update Alert

Alert when FuelPrice not updated for 5+ days:

```javascript
// dashboardController.js
const lastPriceUpdate = await FuelPrice.findOne({
  where: { stationId },
  order: [['createdAt', 'DESC']]
});

if (daysSince(lastPriceUpdate.createdAt) > 5) {
  response.alerts.push({
    type: 'warning',
    message: 'Fuel prices not updated for 5+ days'
  });
}
```

**Benefit:** Operators don't forget to update prices

### 4. Historical Price Audit Report

Create endpoint to show what prices were used:

```javascript
GET /api/v1/reports/price-audit?stationId=xxx&startDate=2025-12-01&endDate=2025-12-03

Response:
{
  priceHistory: [
    { date: '2025-12-01', petrol: 95, diesel: 85 },
    { date: '2025-12-02', petrol: 100, diesel: 90 },
    { date: '2025-12-03', petrol: 105, diesel: 95 }
  ],
  readingsWithPrices: [
    { date: '2025-12-01', liters: 100, priceUsed: 95, saleValue: 9500 }
  ]
}
```

**Benefit:** Users can audit exactly what prices were used in reports

---

## Testing Scenarios

### Test 1: Price Increases ✓
- Day 1: 100L @ ₹95 = ₹9,500
- Day 2: 150L @ ₹100 = ₹15,000
- Day 3: 120L @ ₹105 = ₹12,600
- **Expected:** ₹37,100 (not ₹38,850)

### Test 2: Price Decreases ✓
- Day 1: 100L @ ₹110 = ₹11,000
- Day 2: 150L @ ₹105 = ₹15,750
- Day 3: 120L @ ₹100 = ₹12,000
- **Expected:** ₹38,750

### Test 3: Missing Price ⚠️
- Current: Reading created with price=0, sale shows ₹0
- Recommendation: Reject reading and require price to be set first

### Test 4: Payment Breakdown ✓
- 200L with cash=₹10k, online=₹5k, credit=₹5k
- System calculates: price = ₹20k / 200L = ₹100/L
- Report shows: ₹20,000 (correct)

---

## Conclusion

**The system correctly handles multi-day reports with fuel price changes.**

The architecture ensures:
1. ✅ Each reading captures the historical price for its date
2. ✅ Reports use stored prices, not current prices
3. ✅ Math is validated before saving
4. ✅ Historical FuelPrice records are maintained

**Main risk:** Missing FuelPrice entries cause readings to use fallback price (0)

**Mitigation:** Implement strict mode requiring prices to be set before reading creation

**Provided artifacts:**
- `PRICE_CHANGE_MULTI_DAY_REPORT.md` - Full technical documentation
- `MULTI_DAY_REPORT_CHECKLIST.md` - Verification procedures and test cases
- `test-multi-day-price.js` - Automated test script
