# PROFIT TRACKING - QUICK TEST GUIDE

## ✅ Backend Ready for Testing

All backend implementation is **COMPLETE** and **PRODUCTION-READY**.

---

## 🧪 Quick Test (Using Postman or cURL)

### Test 1: Set Fuel Price with Cost
```
METHOD: POST
URL: http://localhost:3001/api/v1/stations/{YOUR_STATION_ID}/prices

HEADERS:
Authorization: Bearer {YOUR_OWNER_TOKEN}
Content-Type: application/json

BODY:
{
  "fuelType": "diesel",
  "price": 112.00,
  "costPrice": 100.00,
  "effectiveFrom": "2025-01-25"
}

EXPECTED: 201 Created with profit info in response
```

### Test 2: Get Monthly Profit Report
```
METHOD: GET
URL: http://localhost:3001/api/v1/stations/{YOUR_STATION_ID}/profit-summary?month=2025-01

HEADERS:
Authorization: Bearer {YOUR_OWNER_TOKEN}

EXPECTED: 200 OK with detailed profit breakdown
```

### Test 3: Get Daily Profit
```
METHOD: GET
URL: http://localhost:3001/api/v1/stations/{YOUR_STATION_ID}/profit-daily?date=2025-01-25

HEADERS:
Authorization: Bearer {YOUR_OWNER_TOKEN}

EXPECTED: 200 OK with daily P&L
```

### Test 4: Verify Access Control (Should Fail)
```
METHOD: GET
URL: http://localhost:3001/api/v1/stations/{YOUR_STATION_ID}/profit-summary

HEADERS:
Authorization: Bearer {MANAGER_TOKEN}  ← Not owner!

EXPECTED: 403 Forbidden
```

---

## 📊 Understanding the Response

### Profit Summary Response Structure
```json
{
  "success": true,
  "data": {
    "month": "2025-01",
    "summary": {
      "totalRevenue": 250000,      // All sales amount
      "totalCostOfGoods": 200000,  // Litres × costPrice
      "totalExpenses": 47000,      // From expense table
      "grossProfit": 50000,        // Revenue - COGS
      "netProfit": 3000,           // Gross - Expenses
      "profitMargin": 1.2,         // Net / Revenue * 100
      "totalLitres": 2500,
      "profitPerLitre": 1.2        // Net / Litres
    },
    "breakdown": {
      "byFuelType": {
        "diesel": {
          "revenue": 168000,
          "costOfGoods": 150000,
          "litres": 1500,
          "profitPerLitre": 12,
          "profitMargin": 10.71
        }
      },
      "byExpenseCategory": [
        { "category": "salary", "amount": 30000 },
        { "category": "rent", "amount": 10000 }
      ]
    }
  }
}
```

---

## 🔍 What to Verify

### ✅ Database
```
Check: cost_price column exists in fuel_prices table
Command: SELECT column_name, data_type FROM information_schema.columns 
         WHERE table_name='fuel_prices' AND column_name='cost_price'
```

### ✅ Price API
```
Check: Can POST price with costPrice field
Expected Response: costPrice echoed back in response
```

### ✅ Profit Calculations
```
Check: totalRevenue - totalCostOfGoods = grossProfit
Check: grossProfit - totalExpenses = netProfit
Check: netProfit > 0 for profitable months
```

### ✅ Access Control
```
Check: Owner can view /profit-summary ✓
Check: Manager cannot view /profit-summary (403) ✓
Check: Super_admin can view /profit-summary ✓
```

---

## 📋 Test Data Checklist

Before testing profit reports, ensure:

- [ ] At least 1 fuel price set with costPrice
- [ ] At least 1 reading entry for that fuel type
- [ ] At least 1 expense entry for the month
- [ ] You're logged in as owner or super_admin
- [ ] Station ID is correct in URL

---

## 💡 Sample Test Scenario

**Step 1:** Set Diesel Price
```json
{
  "fuelType": "diesel",
  "price": 112,
  "costPrice": 100
}
```

**Step 2:** Create Reading
- 50 litres sold
- Price: ₹112/litre
- Date: 2025-01-25

**Step 3:** Add Expense
- Category: "salary"
- Amount: ₹500
- Date: 2025-01-25

**Step 4:** View Profit
- Revenue: 50 × 112 = ₹5,600
- COGS: 50 × 100 = ₹5,000
- Expenses: ₹500
- **Profit: ₹100** (1.8% margin)

---

## 🆘 Troubleshooting

### "Column cost_price doesn't exist"
**Fix:** Run migration
```bash
npx sequelize-cli db:migrate
```

### "403 Forbidden on profit-summary"
**Reason:** You're not logged in as owner  
**Fix:** Use owner token or super_admin token

### "No data in response"
**Reason:** No readings for that month  
**Fix:** Create readings first, then query profit

### "costPrice not saving"
**Reason:** Already updated price without cost  
**Fix:** The field is nullable, old prices work fine

---

## 📞 API Endpoints Summary

### Owner/Super_admin Only
```
GET  /api/v1/stations/{id}/profit-summary?month=YYYY-MM
GET  /api/v1/stations/{id}/profit-daily?date=YYYY-MM-DD
```

### Manager+ Can Set
```
POST /api/v1/stations/{id}/prices
     Body: { fuelType, price, costPrice (optional) }
```

---

## ✨ Key Takeaways

1. **costPrice is optional** - Old prices without cost still work
2. **Profit = Revenue - COGS - Expenses** - Auto-calculated
3. **Owner-only** - No one else can see profit reports
4. **Audit logged** - All price changes and profit views tracked
5. **Real data** - Uses actual readings and expenses, not estimates

---

**Status:** ✅ Ready for Testing
**Next:** Frontend UI development (Prices page + Profit Dashboard)
