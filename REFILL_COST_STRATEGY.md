# Refill Cost Per Litre - Implementation Strategy

## Current State Analysis

Your codebase has **TWO separate cost systems**:

### 1. **Prices Module** (Already in Use)
- **Purpose**: Station-wide fuel pricing for settlements/reports
- **Storage**: `fuel_prices` table (historical, per-date, per-fuelType)
- **Usage**: 
  - NozzleReadings fetch price from here to calculate `total_amount`
  - Reports use these stored prices for revenue calculations
  - Prevents price-change-over-time audit issues
- **Access**: Managers only can set prices

### 2. **Refill costPerLitre** (New in Tank Refills)
- **Purpose**: Cost paid to supplier for each fuel delivery
- **Storage**: `tank_refills.cost_per_litre` field
- **Needed for**: Profitability tracking on fuel purchases

## The Problem: They Serve Different Purposes

| Aspect | Prices Module | Refill Cost |
|--------|--------------|------------|
| **What it is** | Selling price to customers | Buying price from supplier |
| **Who manages** | Manager (per station, per day) | Manager (per refill event) |
| **Historical tracking** | Yes (versioned by date) | Yes (tied to refill record) |
| **Used for** | Settlement, sales reports, revenue | Purchase analysis, profit margin |
| **Changes over time** | Frequently (market changes) | Less frequent (supplier contracts) |

---

## ✅ RECOMMENDED SOLUTION: Keep Both (Non-Messy Approach)

**They are NOT duplicates—they track different things.**

### What to Do:

1. **Keep Prices Module as-is** (manage selling prices to customers)
   - Stays in Prices page/component
   - Used for settlements & reports
   - One entry per fuel type per date

2. **Keep costPerLitre in Refill Dialog** (manage buying costs)
   - Optional but recommended field
   - Stored with each refill
   - Used for cost analysis

3. **No Duplication**: Auto-fill costPerLitre from Prices? **NO**
   - `cost_per_litre` should be **what you PAID the supplier**
   - `price_per_litre` should be **what you CHARGE customers**
   - They're different numbers!

### Code Organization (Non-Messy):

```
Prices Module (Existing)
├── Managers set selling prices: GET/POST /stations/:id/prices
├── Used by: NozzleReadings, Reports
└── Shows: Sale value calculations

Refill Dialog (New)
├── Managers enter buying costs: costPerLitre field
├── Optional but tracked
└── Shows: Supplier expense analysis
```

---

## Implementation Checklist

- [ ] Keep costPerLitre field in refill dialog (already exists)
- [ ] Make it **optional** (nullable in DB if not always available)
- [ ] Add validation: `costPerLitre` ≤ current `pricePerLitre` (profit check)
- [ ] Update UI label: **"Cost per Litre (what you paid supplier)"**
- [ ] Add a cost analysis page (future) showing:
  - Total spent on refills
  - Avg cost per fuel type
  - Margin vs selling price

### Why This Works:

✅ No code duplication  
✅ Prices module unchanged  
✅ Clear business separation  
✅ Audit trail for both numbers  
✅ Room to add cost reports later  

---

## Do NOT Do This:

❌ Remove costPerLitre from refills (you lose buying cost data)  
❌ Auto-fill refill cost from Prices (they're different numbers)  
❌ Merge both into one field (confused business logic)  
❌ Create a third cost system (code gets messy)  

---

## Questions for You:

1. Do you always know the supplier cost when recording a refill?
2. Or should costPerLitre be optional?
3. Do you need cost analysis reports later?

If you answer "YES" to #3, I can help add a Costs/Purchases reporting page.
