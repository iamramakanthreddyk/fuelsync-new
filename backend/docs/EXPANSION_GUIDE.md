# FuelSync Expansion Guide

This guide explains how to add new features, modify existing ones, and maintain the codebase.

---

## Table of Contents

1. [Adding a New Fuel Type](#adding-a-new-fuel-type)
2. [Adding a New Payment Method](#adding-a-new-payment-method)
3. [Adding a New Expense Category](#adding-a-new-expense-category)
4. [Adding a New User Role](#adding-a-new-user-role)
5. [Adding a New Model/Table](#adding-a-new-modeltable)
6. [Adding a New API Endpoint](#adding-a-new-api-endpoint)
7. [Adding Plan Features](#adding-plan-features)
8. [Adding Dashboard Widgets](#adding-dashboard-widgets)
9. [Common Patterns](#common-patterns)
10. [Testing Checklist](#testing-checklist)

---

## Adding a New Fuel Type

**Scenario:** Add LPG as a fuel type

### Step 1: Update Constants
```javascript
// src/config/constants.js

const FUEL_TYPES = {
  PETROL: 'petrol',
  DIESEL: 'diesel',
  PREMIUM_PETROL: 'premium_petrol',
  PREMIUM_DIESEL: 'premium_diesel',
  CNG: 'cng',
  LPG: 'lpg',              // ← ADD THIS
  SUPER: 'super'           // ← OR THIS
};

const FUEL_TYPE_LABELS = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  premium_petrol: 'Premium Petrol',
  premium_diesel: 'Premium Diesel',
  cng: 'CNG',
  lpg: 'LPG',              // ← ADD THIS
  super: 'Super 97'        // ← OR THIS
};

const FUEL_TYPE_COLORS = {
  petrol: '#22c55e',
  diesel: '#eab308',
  premium_petrol: '#3b82f6',
  premium_diesel: '#f97316',
  cng: '#06b6d4',
  lpg: '#8b5cf6',          // ← ADD THIS
  super: '#ec4899'         // ← OR THIS
};
```

### Step 2: That's it!
The system automatically:
- Accepts new fuel type in nozzle creation
- Includes it in fuel breakdown reports
- Shows correct label in dashboard

**No database migration needed** - fuel type is stored as string.

---

## Adding a New Payment Method

**Scenario:** Add "Fleet Card" payment method

### Step 1: Update Constants
```javascript
// src/config/constants.js

const PAYMENT_METHODS = {
  CASH: 'cash',
  UPI: 'upi',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  CREDIT: 'credit',
  FLEET_CARD: 'fleet_card'    // ← ADD THIS
};
```

### Step 2: Update NozzleReading Model
```javascript
// src/models/NozzleReading.js

// Add new field
fleetCardAmount: {
  type: DataTypes.DECIMAL(12, 2),
  defaultValue: 0,
  field: 'fleet_card_amount'
}

// Update payment validation in hooks
const totalPayment = parseFloat(reading.cashAmount || 0)
  + parseFloat(reading.onlineAmount || 0)
  + parseFloat(reading.creditAmount || 0)
  + parseFloat(reading.fleetCardAmount || 0);  // ← ADD THIS
```

### Step 3: Update Reading Controller
```javascript
// src/controllers/readingController.js

// In submitReading:
const { nozzleId, currentReading, readingDate, cashAmount, onlineAmount, 
        creditAmount, fleetCardAmount, creditorId, notes } = req.body;
        
// Include in create
await NozzleReading.create({
  // ... existing fields
  fleetCardAmount: fleetCardAmount || 0
});
```

### Step 4: Update Dashboard Queries
```javascript
// Add to all aggregation queries
[fn('SUM', col('fleet_card_amount')), 'fleetCard']
```

---

## Adding a New Expense Category

**Scenario:** Add "Fuel Allowance" category

### Step 1: Update Constants Only
```javascript
// src/config/constants.js

const EXPENSE_CATEGORIES = {
  SALARY: 'salary',
  ELECTRICITY: 'electricity',
  RENT: 'rent',
  MAINTENANCE: 'maintenance',
  SUPPLIES: 'supplies',
  TAXES: 'taxes',
  INSURANCE: 'insurance',
  TRANSPORTATION: 'transportation',
  FUEL_ALLOWANCE: 'fuel_allowance',  // ← ADD THIS
  MISCELLANEOUS: 'miscellaneous'
};

const EXPENSE_CATEGORY_LABELS = {
  salary: 'Salary & Wages',
  electricity: 'Electricity',
  rent: 'Rent',
  maintenance: 'Maintenance & Repairs',
  supplies: 'Supplies & Consumables',
  taxes: 'Taxes & Duties',
  insurance: 'Insurance',
  transportation: 'Transportation',
  fuel_allowance: 'Fuel Allowance',   // ← ADD THIS
  miscellaneous: 'Miscellaneous'
};
```

**Done!** Category automatically appears in expense creation.

---

## Adding a New User Role

**Scenario:** Add "Accountant" role

### Step 1: Update Constants
```javascript
// src/config/constants.js

const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  ACCOUNTANT: 'accountant',  // ← ADD THIS
  EMPLOYEE: 'employee'
};
```

### Step 2: Update User Model ENUM
```javascript
// src/models/User.js

role: {
  type: DataTypes.ENUM('super_admin', 'owner', 'manager', 'accountant', 'employee'),
  allowNull: false,
  defaultValue: 'employee'
}
```

### Step 3: Update Auth Middleware
```javascript
// src/middleware/auth.js

const requireMinRole = (minRole) => {
  const roleHierarchy = {
    'employee': 1,
    'accountant': 2,     // ← ADD THIS (between employee and manager)
    'manager': 3,
    'owner': 4,
    'super_admin': 5
  };
  // ... rest unchanged
};
```

### Step 4: Update User Controller Creation Rules
```javascript
// src/controllers/userController.js

const creationRules = {
  'super_admin': ['owner'],
  'owner': ['manager', 'accountant', 'employee'],  // ← ADD accountant
  'manager': ['accountant', 'employee'],           // ← ADD accountant
  'accountant': [],                                 // ← ADD THIS
  'employee': []
};
```

### Step 5: Add Role-Specific Route Access
```javascript
// src/routes/expenses.js

// Accountant can view but not edit
router.get('/stations/:stationId/expenses', 
  requireMinRole('accountant'),  // Changed from 'employee'
  expenseController.getExpenses
);

// Accountant can view P/L
router.get('/stations/:stationId/profit-loss', 
  requireRole(['owner', 'super_admin', 'accountant']),  // ← ADD accountant
  expenseController.getProfitLoss
);
```

### Step 6: Database Migration
```sql
-- Run this in PostgreSQL
ALTER TYPE enum_users_role ADD VALUE 'accountant' BEFORE 'employee';
```

---

## Adding a New Model/Table

**Scenario:** Add "FuelDelivery" for tracking fuel purchases

### Step 1: Create Model File
```javascript
// src/models/FuelDelivery.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FuelDelivery = sequelize.define('FuelDelivery', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    stationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'station_id',
      references: { model: 'stations', key: 'id' }
    },
    fuelType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'fuel_type'
    },
    litresDelivered: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'litres_delivered'
    },
    costPerLitre: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'cost_per_litre'
    },
    totalCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      field: 'total_cost'
    },
    deliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'delivery_date'
    },
    supplierName: {
      type: DataTypes.STRING(100),
      field: 'supplier_name'
    },
    invoiceNumber: {
      type: DataTypes.STRING(50),
      field: 'invoice_number'
    },
    vehicleNumber: {
      type: DataTypes.STRING(20),
      field: 'vehicle_number'
    },
    receivedBy: {
      type: DataTypes.UUID,
      field: 'received_by',
      references: { model: 'users', key: 'id' }
    }
  }, {
    tableName: 'fuel_deliveries',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id'] },
      { fields: ['delivery_date'] },
      { fields: ['fuel_type'] }
    ]
  });

  FuelDelivery.associate = (models) => {
    FuelDelivery.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    FuelDelivery.belongsTo(models.User, { foreignKey: 'receivedBy', as: 'receivedByUser' });
  };

  return FuelDelivery;
};
```

### Step 2: Register in Index
```javascript
// src/models/index.js

// Import
const FuelDelivery = require('./FuelDelivery')(sequelize);

// Add to models object
const models = {
  // ... existing models
  FuelDelivery
};

// Export
module.exports = {
  // ... existing exports
  FuelDelivery
};
```

### Step 3: Create Controller
```javascript
// src/controllers/deliveryController.js

const { FuelDelivery, Station, User } = require('../models');

exports.getDeliveries = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate, fuelType } = req.query;
    
    const where = { stationId };
    if (startDate && endDate) {
      where.deliveryDate = { [Op.between]: [startDate, endDate] };
    }
    if (fuelType) where.fuelType = fuelType;
    
    const deliveries = await FuelDelivery.findAll({
      where,
      include: [{ model: User, as: 'receivedByUser', attributes: ['name'] }],
      order: [['deliveryDate', 'DESC']]
    });
    
    res.json({ success: true, data: deliveries });
  } catch (error) {
    next(error);
  }
};

exports.recordDelivery = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const data = req.body;
    
    const delivery = await FuelDelivery.create({
      ...data,
      stationId,
      receivedBy: req.userId
    });
    
    res.status(201).json({ success: true, data: delivery });
  } catch (error) {
    next(error);
  }
};
```

### Step 4: Create Routes
```javascript
// src/routes/deliveries.js

const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const { authenticate, requireMinRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/stations/:stationId/deliveries', deliveryController.getDeliveries);
router.post('/stations/:stationId/deliveries', requireMinRole('manager'), deliveryController.recordDelivery);

module.exports = router;
```

### Step 5: Register in App
```javascript
// src/app.js

const deliveryRoutes = require('./routes/deliveries');
app.use('/api/v1', deliveryRoutes);
```

### Step 6: Auto-Sync Creates Table
```bash
npm run dev
# Table created automatically on startup
```

---

## Adding a New API Endpoint

**Scenario:** Add "Export to CSV" endpoint

### Step 1: Add to Controller
```javascript
// src/controllers/reportController.js

const { Parser } = require('json2csv');

exports.exportReadingsCSV = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Check plan permission
    const user = await User.findByPk(req.userId, { include: ['plan'] });
    if (!user.plan?.canExport) {
      return res.status(403).json({ 
        success: false, 
        error: 'Export feature not available in your plan' 
      });
    }
    
    const readings = await NozzleReading.findAll({
      where: { stationId, readingDate: { [Op.between]: [startDate, endDate] } },
      include: ['nozzle', 'pump'],
      raw: true
    });
    
    const fields = ['readingDate', 'pumpName', 'nozzleNumber', 'fuelType', 
                    'litresSold', 'totalAmount', 'cashAmount', 'onlineAmount'];
    const parser = new Parser({ fields });
    const csv = parser.parse(readings);
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`readings-${startDate}-to-${endDate}.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
```

### Step 2: Add Route
```javascript
// src/routes/reports.js

router.get('/stations/:stationId/export/readings', 
  requireMinRole('owner'),
  reportController.exportReadingsCSV
);
```

---

## Adding Plan Features

**Scenario:** Add "canViewAnalytics" feature to plans

### Step 1: Update Plan Model
```javascript
// src/models/Plan.js

canViewAnalytics: {
  type: DataTypes.BOOLEAN,
  defaultValue: true,
  field: 'can_view_analytics'
}
```

### Step 2: Update Constants
```javascript
// src/config/constants.js

const DEFAULT_PLAN_LIMITS = {
  free: {
    // ... existing
    canViewAnalytics: false    // ← ADD THIS
  },
  basic: {
    // ... existing
    canViewAnalytics: true
  },
  premium: {
    // ... existing
    canViewAnalytics: true
  }
};
```

### Step 3: Check in Controller
```javascript
// src/controllers/dashboardController.js

exports.getAnalytics = async (req, res, next) => {
  const user = await User.findByPk(req.userId, { include: ['plan'] });
  
  if (!user.plan?.canViewAnalytics) {
    return res.status(403).json({
      success: false,
      error: 'Analytics not available in your plan',
      upgradeRequired: true
    });
  }
  
  // ... rest of analytics logic
};
```

---

## Adding Dashboard Widgets

**Scenario:** Add "Top Selling Nozzles" widget

### Step 1: Add Controller Method
```javascript
// src/controllers/dashboardController.js

exports.getTopNozzles = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const user = await User.findByPk(req.userId);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stationFilter = getStationFilter(user);
    
    const topNozzles = await NozzleReading.findAll({
      where: {
        ...stationFilter,
        readingDate: { [Op.gte]: startDate.toISOString().split('T')[0] }
      },
      include: [{
        model: Nozzle,
        as: 'nozzle',
        include: [{ model: Pump, as: 'pump' }]
      }],
      attributes: [
        [fn('SUM', col('litres_sold')), 'totalLitres'],
        [fn('SUM', col('total_amount')), 'totalAmount']
      ],
      group: ['nozzle.id', 'nozzle.pump.id'],
      order: [[fn('SUM', col('total_amount')), 'DESC']],
      limit: 5,
      raw: true,
      nest: true
    });
    
    res.json({
      success: true,
      data: {
        period: `Last ${days} days`,
        topNozzles
      }
    });
  } catch (error) {
    next(error);
  }
};
```

### Step 2: Add Route
```javascript
// src/routes/dashboard.js

router.get('/top-nozzles', dashboardController.getTopNozzles);
```

---

## Common Patterns

### Pattern 1: Station Access Check
```javascript
// Always verify station access
const station = await Station.findByPk(stationId);
if (!station) {
  return res.status(404).json({ success: false, error: 'Station not found' });
}

if (user.role === 'owner' && station.ownerId !== user.id) {
  return res.status(403).json({ success: false, error: 'Access denied' });
}

if (['manager', 'employee'].includes(user.role) && user.stationId !== stationId) {
  return res.status(403).json({ success: false, error: 'Access denied' });
}
```

### Pattern 2: Plan Limit Check
```javascript
// Check before creating resources
const plan = await Plan.findByPk(owner.planId);
const currentCount = await Model.count({ where: { stationId } });

if (currentCount >= plan.maxResource) {
  return res.status(403).json({
    success: false,
    error: `Plan limit reached (${plan.maxResource})`,
    upgradeRequired: true
  });
}
```

### Pattern 3: Date Range Filtering
```javascript
const { startDate, endDate } = req.query;

if (startDate && endDate) {
  where.dateField = { 
    [Op.between]: [startDate, endDate] 
  };
}
```

### Pattern 4: Pagination
```javascript
const { page = 1, limit = 20 } = req.query;
const offset = (parseInt(page) - 1) * parseInt(limit);

const { count, rows } = await Model.findAndCountAll({
  where,
  limit: parseInt(limit),
  offset
});

res.json({
  success: true,
  data: rows,
  pagination: {
    page: parseInt(page),
    limit: parseInt(limit),
    total: count,
    pages: Math.ceil(count / limit)
  }
});
```

---

## Testing Checklist

Before deploying any change:

- [ ] **Unit Test:** Test the new feature in isolation
- [ ] **Role Test:** Test with all 4 roles (super_admin, owner, manager, employee)
- [ ] **Permission Test:** Verify unauthorized access is blocked
- [ ] **Plan Test:** Verify plan limits are enforced
- [ ] **Edge Cases:** Empty data, max limits, invalid input
- [ ] **Multi-Station:** Test owner with multiple stations
- [ ] **API Response:** Verify consistent response format
- [ ] **Error Handling:** Verify error responses are clear
- [ ] **Documentation:** Update API_REFERENCE.md

---

## File Naming Conventions

| Type | Format | Example |
|------|--------|---------|
| Model | PascalCase.js | `FuelDelivery.js` |
| Controller | camelCaseController.js | `deliveryController.js` |
| Route | plural lowercase.js | `deliveries.js` |
| Middleware | camelCase.js | `stationAccess.js` |
| Constants | UPPER_SNAKE_CASE | `FUEL_TYPES` |

---

## Need Help?

1. Check existing implementations in similar files
2. Follow the established patterns
3. Keep it DRY - reuse utility functions
4. Document your changes
5. Test all user roles
