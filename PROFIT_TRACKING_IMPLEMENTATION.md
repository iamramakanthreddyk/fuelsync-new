# PROFIT TRACKING - IMPLEMENTATION GUIDE

## Phase 1: Database & Backend (Core Feature)

### Step 1: Create Database Migration

Create file: `backend/migrations/YYYYMMDDHHMMSS-add-cost-price-to-fuel-prices.js`

```javascript
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add cost_price column to fuel_prices table
    await queryInterface.addColumn('fuel_prices', 'cost_price', {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: true,  // Allow null initially for existing prices
      defaultValue: null,
      field: 'cost_price',
      comment: 'Purchase/cost price per litre for profit calculation'
    });

    // Add index for performance
    await queryInterface.addIndex('fuel_prices', ['cost_price'], {
      name: 'idx_fuel_prices_cost_price'
    });

    console.log('✅ Added cost_price column to fuel_prices');
  },

  async down (queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex('fuel_prices', 'idx_fuel_prices_cost_price');
    
    // Remove column
    await queryInterface.removeColumn('fuel_prices', 'cost_price');
    
    console.log('✅ Rolled back cost_price column from fuel_prices');
  }
};
```

### Step 2: Update FuelPrice Model

File: `backend/src/models/FuelPrice.js`

**Add after the `price` field:**

```javascript
costPrice: {
  type: DataTypes.DECIMAL(8, 2),
  allowNull: true,
  field: 'cost_price',
  validate: {
    min: 0.01
  },
  comment: 'Purchase/cost price per litre for profit calculation'
},
```

**Add helper method after existing static methods:**

```javascript
/**
 * Calculate profit per litre for a fuel type on a specific date
 */
FuelPrice.getProfitForDate = async function(stationId, fuelType, date) {
  const price = await this.findOne({
    where: {
      stationId,
      fuelType,
      effectiveFrom: {
        [sequelize.Sequelize.Op.lte]: date
      }
    },
    order: [['effectiveFrom', 'DESC']]
  });
  
  if (!price) return null;
  
  const sellingPrice = parseFloat(price.price);
  const costPrice = price.costPrice ? parseFloat(price.costPrice) : null;
  
  return {
    sellingPrice,
    costPrice,
    profitPerLitre: costPrice ? sellingPrice - costPrice : null,
    profitMarginPercent: costPrice ? (((sellingPrice - costPrice) / sellingPrice) * 100).toFixed(2) : null
  };
};
```

### Step 3: Update Price API Endpoint

File: `backend/src/controllers/priceController.js` (or wherever prices are handled)

**Update the create/update method to accept costPrice:**

```javascript
const createPrice = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { fuelType, price, costPrice, effectiveFrom } = req.body;
    
    // Validate cost price if provided
    if (costPrice && costPrice >= price) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Cost price must be less than selling price',
          code: 'INVALID_COST_PRICE'
        }
      });
    }
    
    const fuelPrice = await FuelPrice.create({
      stationId,
      fuelType,
      price,
      costPrice: costPrice || null,  // Optional field
      effectiveFrom: effectiveFrom || new Date().toISOString().split('T')[0],
      updatedBy: req.user.id
    });
    
    // Log to audit
    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      stationId,
      action: 'CREATE',
      entityType: 'FuelPrice',
      entityId: fuelPrice.id,
      newValues: {
        fuelType,
        price,
        costPrice: costPrice || 'Not specified',
        profitPerLitre: costPrice ? (price - costPrice).toFixed(2) : 'N/A'
      },
      category: 'pricing',
      severity: 'info',
      description: `Created fuel price: ${fuelType} @ ₹${price}${costPrice ? ` (cost: ₹${costPrice})` : ''}`
    });
    
    res.status(201).json({ success: true, data: fuelPrice });
  } catch (error) {
    console.error('Create price error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to create price' } });
  }
};
```

### Step 4: Create Profit Summary Endpoint

File: `backend/src/controllers/profitController.js` (new file)

```javascript
/**
 * Profit & Loss Tracking Controller
 * Calculates detailed P&L for owner dashboard
 */

const { 
  NozzleReading, 
  FuelPrice, 
  Expense, 
  CostOfGoods,
  Settlement,
  Station 
} = require('../models');
const { Op, fn, col } = require('sequelize');
const { logAudit } = require('../utils/auditLog');

/**
 * Get profit summary for a month
 * GET /stations/:stationId/profit-summary?month=2025-01
 * Access: Owner only
 */
exports.getProfitSummary = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { month } = req.query;
    
    // Default to current month
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    
    // Parse month to get date range
    const [year, monthNum] = targetMonth.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);
    
    // Verify station exists and owner has access
    const station = await Station.findByPk(stationId);
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }
    
    // Get all readings for the month
    const readings = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: {
          [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
        }
      },
      include: [
        {
          model: FuelPrice,
          as: 'fuelPrice',
          attributes: ['price', 'costPrice']
        }
      ]
    });
    
    // Calculate revenue and cost of goods
    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    let totalLitres = 0;
    let revenueByFuelType = {};
    let profitByFuelType = {};
    
    readings.forEach(reading => {
      const litres = parseFloat(reading.litresSold);
      const sellingPrice = parseFloat(reading.pricePerLitre);
      const costPrice = reading.fuelPrice?.costPrice ? parseFloat(reading.fuelPrice.costPrice) : null;
      const fuelType = reading.fuelType;
      
      // Revenue calculation
      const revenue = litres * sellingPrice;
      totalRevenue += revenue;
      totalLitres += litres;
      
      // Cost of goods (if cost price is available)
      let costOfGoods = 0;
      if (costPrice) {
        costOfGoods = litres * costPrice;
        totalCostOfGoods += costOfGoods;
      }
      
      // Track by fuel type
      if (!revenueByFuelType[fuelType]) {
        revenueByFuelType[fuelType] = {
          revenue: 0,
          costOfGoods: 0,
          litres: 0
        };
      }
      revenueByFuelType[fuelType].revenue += revenue;
      revenueByFuelType[fuelType].costOfGoods += costOfGoods;
      revenueByFuelType[fuelType].litres += litres;
    });
    
    // Calculate profit by fuel type
    Object.keys(revenueByFuelType).forEach(fuelType => {
      const data = revenueByFuelType[fuelType];
      profitByFuelType[fuelType] = {
        revenue: parseFloat(data.revenue.toFixed(2)),
        costOfGoods: parseFloat(data.costOfGoods.toFixed(2)),
        litres: parseFloat(data.litres.toFixed(3)),
        profitPerLitre: data.litres > 0 
          ? parseFloat(((data.revenue - data.costOfGoods) / data.litres).toFixed(2))
          : 0
      };
    });
    
    // Get total expenses for the month
    const expensesResult = await Expense.sum('amount', {
      where: {
        stationId,
        expenseMonth: targetMonth
      }
    });
    const totalExpenses = parseFloat((expensesResult || 0).toFixed(2));
    
    // Get expenses by category
    const expensesByCategory = await Expense.findAll({
      attributes: [
        'category',
        [fn('SUM', col('amount')), 'total']
      ],
      where: {
        stationId,
        expenseMonth: targetMonth
      },
      group: ['category'],
      raw: true
    });
    
    // Calculate profits
    const grossProfit = totalRevenue - totalCostOfGoods;
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalRevenue > 0 
      ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(2))
      : 0;
    const profitPerLitre = totalLitres > 0
      ? parseFloat((netProfit / totalLitres).toFixed(2))
      : 0;
    
    // Log view
    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      stationId,
      action: 'READ',
      entityType: 'ProfitSummary',
      entityId: stationId,
      category: 'analytics',
      severity: 'info',
      description: `Viewed profit summary for ${targetMonth}`
    });
    
    res.json({
      success: true,
      data: {
        month: targetMonth,
        summary: {
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalCostOfGoods: parseFloat(totalCostOfGoods.toFixed(2)),
          totalExpenses,
          grossProfit: parseFloat(grossProfit.toFixed(2)),
          netProfit: parseFloat(netProfit.toFixed(2)),
          profitMargin,
          totalLitres: parseFloat(totalLitres.toFixed(3)),
          profitPerLitre
        },
        breakdown: {
          byFuelType: profitByFuelType,
          byExpenseCategory: expensesByCategory.map(item => ({
            category: item.category,
            amount: parseFloat(item.dataValues.total)
          }))
        },
        readingsCount: readings.length
      }
    });
  } catch (error) {
    console.error('Get profit summary error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to fetch profit summary' } 
    });
  }
};

/**
 * Get daily profit summary
 * GET /stations/:stationId/profit-daily?date=2025-01-25
 */
exports.getDailyProfit = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    
    const queryDate = date || new Date().toISOString().split('T')[0];
    
    // Get all readings for the day
    const readings = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: queryDate
      },
      include: [
        {
          model: FuelPrice,
          as: 'fuelPrice',
          attributes: ['price', 'costPrice']
        }
      ]
    });
    
    // Calculate
    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    let totalLitres = 0;
    
    readings.forEach(reading => {
      const litres = parseFloat(reading.litresSold);
      const revenue = litres * parseFloat(reading.pricePerLitre);
      totalRevenue += revenue;
      totalLitres += litres;
      
      if (reading.fuelPrice?.costPrice) {
        totalCostOfGoods += litres * parseFloat(reading.fuelPrice.costPrice);
      }
    });
    
    // Get daily expenses
    const dailyExpenses = await Expense.sum('amount', {
      where: {
        stationId,
        expenseDate: queryDate
      }
    }) || 0;
    
    const grossProfit = totalRevenue - totalCostOfGoods;
    const netProfit = grossProfit - dailyExpenses;
    
    res.json({
      success: true,
      data: {
        date: queryDate,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCostOfGoods: parseFloat(totalCostOfGoods.toFixed(2)),
        dailyExpenses: parseFloat(dailyExpenses.toFixed(2)),
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        totalLitres: parseFloat(totalLitres.toFixed(3)),
        readingsCount: readings.length
      }
    });
  } catch (error) {
    console.error('Get daily profit error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to fetch daily profit' } 
    });
  }
};
```

### Step 5: Add Routes

File: `backend/src/routes/index.js` or create `backend/src/routes/profit.js`

```javascript
const express = require('express');
const router = express.Router();
const profitController = require('../controllers/profitController');
const { authenticate, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Owner-only endpoints
router.get('/stations/:stationId/profit-summary', 
  requireRole('owner', 'super_admin'), 
  profitController.getProfitSummary
);

router.get('/stations/:stationId/profit-daily', 
  requireRole('owner', 'super_admin'), 
  profitController.getDailyProfit
);

module.exports = router;
```

---

## Phase 2: Frontend (UI Updates)

### Step 1: Update Prices Page

File: `src/pages/owner/Prices.tsx` or `src/components/PriceManagement.tsx`

**Update form to include costPrice field:**

```typescript
interface FuelPriceForm {
  fuelType: string;
  price: number;
  costPrice?: number;  // Add this
  effectiveFrom?: string;
}

// In the form JSX:
<div className="space-y-4">
  {/* Existing selling price field */}
  <div>
    <Label>Selling Price (₹/Litre)</Label>
    <Input
      type="number"
      step="0.01"
      {...register('price', { required: 'Selling price is required' })}
      placeholder="e.g., 112.00"
    />
  </div>

  {/* NEW: Cost/Purchase Price Field */}
  <div>
    <Label>Purchase Price (₹/Litre)</Label>
    <Input
      type="number"
      step="0.01"
      {...register('costPrice')}
      placeholder="e.g., 100.00"
      onChange={(e) => {
        // Show profit calculation
        const costPrice = parseFloat(e.target.value) || 0;
        const sellingPrice = watch('price') || 0;
        setProfitPerLitre(sellingPrice - costPrice);
      }}
    />
    {profitPerLitre > 0 && (
      <p className="text-sm text-green-600 mt-1">
        ✓ Profit/Litre: ₹{profitPerLitre.toFixed(2)}
      </p>
    )}
  </div>

  {/* Optional: Show margin % */}
  {profitPerLitre > 0 && (
    <div className="bg-blue-50 p-3 rounded">
      <p className="text-sm text-blue-900">
        Profit Margin: {((profitPerLitre / (watch('price') || 1)) * 100).toFixed(1)}%
      </p>
    </div>
  )}
</div>
```

### Step 2: Add Profit Dashboard

File: `src/components/ProfitDashboard.tsx` (new component)

```typescript
interface ProfitData {
  month: string;
  summary: {
    totalRevenue: number;
    totalCostOfGoods: number;
    totalExpenses: number;
    grossProfit: number;
    netProfit: number;
    profitMargin: number;
    profitPerLitre: number;
  };
  breakdown: {
    byFuelType: Record<string, any>;
    byExpenseCategory: Array<{ category: string; amount: number }>;
  };
}

export function ProfitDashboard({ stationId, month }: Props) {
  const { data: profit } = useQuery({
    queryKey: ['profit-summary', stationId, month],
    queryFn: () => apiClient.get(`/stations/${stationId}/profit-summary?month=${month}`)
  });

  if (!profit?.data?.summary) return <Skeleton />;

  const { summary, breakdown } = profit.data;

  return (
    <div className="space-y-6">
      {/* Revenue Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Total Sales:</span>
            <span className="font-bold text-lg">₹{summary.totalRevenue.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Total Litres Sold:</span>
            <span>{summary.totalLitres.toFixed(3)} L</span>
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Costs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between pb-2 border-b">
            <span>Cost of Goods:</span>
            <span className="font-semibold">₹{summary.totalCostOfGoods.toFixed(0)}</span>
          </div>
          <div className="flex justify-between pb-2 border-b">
            <span>Operating Expenses:</span>
            <span className="font-semibold">₹{summary.totalExpenses.toFixed(0)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>Total Costs:</span>
            <span>₹{(summary.totalCostOfGoods + summary.totalExpenses).toFixed(0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Profit Summary Card */}
      <Card className={summary.netProfit >= 0 ? 'border-green-200' : 'border-red-200'}>
        <CardHeader>
          <CardTitle className={summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
            Profit & Loss
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between pb-2 border-b">
            <span>Gross Profit:</span>
            <span className="font-semibold text-blue-600">
              ₹{summary.grossProfit.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between pb-2 border-b">
            <span>Less: Expenses</span>
            <span className="font-semibold text-orange-600">
              -₹{summary.totalExpenses.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>NET PROFIT:</span>
            <span className={summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
              ₹{summary.netProfit.toFixed(0)}
            </span>
          </div>
          <div className="bg-gray-50 p-2 rounded text-sm">
            <p className="flex justify-between">
              <span>Profit Margin:</span>
              <span className="font-semibold">{summary.profitMargin.toFixed(2)}%</span>
            </p>
            <p className="flex justify-between">
              <span>Profit per Litre:</span>
              <span className="font-semibold">₹{summary.profitPerLitre.toFixed(2)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Expenses by Category */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expenses Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {breakdown.byExpenseCategory.map(item => (
              <div key={item.category} className="flex justify-between text-sm">
                <span className="capitalize">{item.category}:</span>
                <span className="font-semibold">₹{item.amount.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Profit by Fuel Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profit by Fuel Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(breakdown.byFuelType).map(([fuelType, data]: any) => (
              <div key={fuelType} className="border-b pb-2">
                <p className="font-semibold capitalize">{fuelType}</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>Revenue: ₹{data.revenue.toFixed(0)}</div>
                  <div>Profit/L: ₹{data.profitPerLitre.toFixed(2)}</div>
                  <div>Litres: {data.litres.toFixed(3)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Running the Migration

### On your local/dev environment:

```bash
# Run the migration
npm run sequelize migration:up

# Or using npx
npx sequelize-cli db:migrate
```

### Verify it worked:

```sql
-- Check the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fuel_prices' AND column_name = 'cost_price';
```

---

## Testing the Feature

### 1. Test Data Setup
```sql
-- Update an existing fuel price with cost price
UPDATE fuel_prices 
SET cost_price = 100.00 
WHERE fuel_type = 'diesel' 
AND station_id = 'YOUR_STATION_ID';
```

### 2. Test Profit Calculation
```bash
# Call the endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/v1/stations/{stationId}/profit-summary?month=2025-01"
```

### 3. Expected Response
```json
{
  "success": true,
  "data": {
    "month": "2025-01",
    "summary": {
      "totalRevenue": 50000,
      "totalCostOfGoods": 40000,
      "totalExpenses": 5000,
      "grossProfit": 10000,
      "netProfit": 5000,
      "profitMargin": 10.00,
      "profitPerLitre": 10.00,
      "totalLitres": 500.000
    }
  }
}
```

---

## Validation Rules

Add to price validation:

```javascript
// Validate cost price
if (costPrice && costPrice >= price) {
  throw new Error('Cost price must be less than selling price');
}

// Warn if margin too low (< 5%)
if (costPrice) {
  const margin = ((price - costPrice) / price) * 100;
  if (margin < 5) {
    console.warn(`⚠️ Low margin for ${fuelType}: ${margin.toFixed(2)}%`);
  }
}
```

---

## Summary

| Component | File | Change |
|-----------|------|--------|
| Migration | `migrations/...add-cost-price...` | Create new file |
| Model | `models/FuelPrice.js` | Add `costPrice` field |
| Controller | `controllers/profitController.js` | Create new file |
| Routes | `routes/profit.js` | Create new file |
| Frontend | `src/pages/owner/Prices.tsx` | Add input field |
| Frontend | `src/components/ProfitDashboard.tsx` | Create new component |

**Total: ~6 files to create/modify**

---

Ready to implement? 🚀
