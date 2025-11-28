# 🧹 Dummy Data Cleanup Guide

## 📋 Overview

This document outlines where temporary dummy data exists in the FuelSync codebase and how to remove it once your database and real data sources are connected.

---

## 🔍 Backend Dummy Data Locations

### ⚠️ Files with Dummy Data (TODO: Remove)

#### 1. Sales Controller (`backend/controllers/salesController.js`)
**Location**: Lines with `// TODO: Replace with real DB data`
**What to Remove**: 
- Fallback empty data structures in `getDailySummary`
- Hourly breakdown placeholder in summary response
- Any hardcoded sample data

**How to Replace**:
```javascript
// Remove this fallback:
if (sales.length === 0) {
  return res.json({
    success: true,
    data: {
      date,
      totalRevenue: 0,
      // ... dummy structure
    }
  });
}

// Replace with proper database aggregation
```

#### 2. Upload Controller (`backend/controllers/uploadController.js`)
**Location**: Lines with simulated OCR processing
**What to Remove**:
- `setTimeout` simulation of OCR processing
- Random data generation for amount, litres, fuelType
- Mock processing delays

**How to Replace**:
```javascript
// Remove this:
setTimeout(async () => {
  await Upload.update({
    amount: Math.random() * 5000 + 500, // Remove
    litres: Math.random() * 50 + 10,   // Remove
    // ... other mock data
  });
}, 3000);

// Replace with:
const ocrResult = await processReceiptWithAzure(upload.filename);
await Upload.update({
  amount: ocrResult.amount,
  litres: ocrResult.litres,
  fuelType: ocrResult.fuelType,
  status: 'success',
  processedAt: new Date(),
  ocrData: ocrResult
}, { where: { id: upload.id } });
```

#### 3. Price Controller (`backend/controllers/priceController.js`)
**Location**: Price comparison dummy data
**What to Remove**:
- Hardcoded competitor station data
- Random price generation for competitors
- Mock price history calculations

**How to Replace**:
```javascript
// Remove competitor dummy data
const comparison = [
  {
    stationName: 'Competitor A',
    petrolPrice: petrolPrice + (Math.random() * 4 - 2), // Remove
    // ...
  }
];

// Replace with real competitor API or manual data entry
```

#### 4. Pump Controller (`backend/controllers/pumpController.js`)
**Location**: Pump metrics calculation
**What to Remove**:
- Hardcoded uptime and efficiency percentages
- Mock hourly data arrays
- Placeholder performance metrics

**How to Replace**:
```javascript
// Replace with real calculations from sales data:
const metrics = await calculateRealPumpMetrics(pump.id, period);
```

---

## ✅ Frontend Data Sources

### No Frontend Cleanup Needed

✅ **All frontend components now use API calls**  
✅ **No hardcoded dummy data in React components**  
✅ **All data flows through `apiService.ts`**

The frontend cleanup has been completed. All components fetch data from the backend API.

---

## 🗄️ Database Connections

### Current Status
✅ **User authentication**: Connected to database  
✅ **Plan management**: Connected to database  
✅ **Upload tracking**: Connected to database  
⚠️ **Sales aggregation**: Partially connected (needs real calculation logic)  
⚠️ **Pump metrics**: Needs real performance calculation  
⚠️ **Price history**: Needs price change tracking table  

### Missing Database Features

1. **Price History Tracking**
   - Create `price_history` table
   - Track price changes with timestamps
   - Record change reasons

2. **Pump Performance Metrics**
   - Calculate from actual sales data
   - Track uptime from pump status changes
   - Generate efficiency metrics

3. **Hourly Sales Breakdown**
   - Group sales by hour
   - Calculate hourly patterns
   - Generate trend analysis

---

## 🔧 Step-by-Step Cleanup Process

### Phase 1: Remove Backend Dummy Data

1. **Sales Controller Cleanup**:
   ```bash
   # Find and replace all dummy data
   grep -n "TODO.*dummy\|Math.random\|dummy.*data" backend/controllers/salesController.js
   ```

2. **Upload Controller Cleanup**:
   ```bash
   # Remove OCR simulation
   grep -n "setTimeout\|Math.random\|simulate" backend/controllers/uploadController.js
   ```

3. **Price Controller Cleanup**:
   ```bash
   # Remove competitor dummy data
   grep -n "Math.random\|dummy.*comparison\|TODO.*competitor" backend/controllers/priceController.js
   ```

### Phase 2: Connect Real Data Sources

1. **Azure OCR Integration**:
   ```javascript
   // In uploadController.js
   const { processOCR } = require('../services/azureService');
   
   // Replace dummy processing with:
   const ocrResult = await processOCR(upload.filename);
   ```

2. **Real Sales Calculations**:
   ```javascript
   // Create proper aggregation queries
   const summary = await Sale.findAll({
     attributes: [
       [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalRevenue'],
       [sequelize.fn('SUM', sequelize.col('litres')), 'totalLitres'],
       [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions']
     ],
     where: whereClause
   });
   ```

3. **Pump Performance Metrics**:
   ```javascript
   // Calculate real metrics from pump data
   const metrics = await calculatePumpPerformance(pumpId, period);
   ```

### Phase 3: Add Missing Features

1. **Price History Table**:
   ```sql
   CREATE TABLE price_history (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     fuel_type VARCHAR(10) NOT NULL,
     old_price DECIMAL(8,2),
     new_price DECIMAL(8,2),
     change_reason TEXT,
     updated_by UUID REFERENCES users(id),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Competitor Price Tracking**:
   ```sql
   CREATE TABLE competitor_prices (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     station_name VARCHAR(100),
     fuel_type VARCHAR(10),
     price DECIMAL(8,2),
     location VARCHAR(255),
     distance DECIMAL(5,2),
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

---

## 🧪 Testing After Cleanup

### Verification Checklist

#### Backend API Testing
```bash
# Test sales endpoints
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/v1/sales/daily/2024-06-03

# Test upload endpoints  
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/v1/uploads

# Test pump endpoints
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/v1/pumps
```

#### Frontend Functionality
- [ ] Dashboard loads with real data
- [ ] Upload page shows actual uploads
- [ ] Sales page displays real analytics
- [ ] Pumps page shows actual pump status
- [ ] Price management uses real prices

#### Error Handling
- [ ] Empty data states display correctly
- [ ] Loading states work properly
- [ ] Error messages are user-friendly
- [ ] Plan limits are enforced

---

## 📞 Support During Cleanup

### If You Need Help

1. **Technical Issues**: Check console logs and error messages
2. **Database Queries**: Refer to Sequelize documentation
3. **Azure Integration**: Check Azure service configuration
4. **Frontend Issues**: Use browser dev tools for debugging

### Contact Support
- **Email**: support@fuelsync.app
- **Documentation**: Check `/docs` folder for additional guides
- **Code Comments**: Look for `TODO` comments for specific guidance

---

## ✅ Cleanup Completion Checklist

### Backend Cleanup
- [ ] Removed all `Math.random()` data generation
- [ ] Removed all `setTimeout` simulations
- [ ] Replaced dummy data with database queries
- [ ] Connected Azure OCR service
- [ ] Implemented real price history tracking
- [ ] Added competitor price management

### Database Integration
- [ ] All sales data comes from database
- [ ] Upload tracking is fully functional
- [ ] Pump performance uses real metrics
- [ ] Price changes are tracked historically
- [ ] User plans and limits are enforced

### Testing & Validation
- [ ] All API endpoints return real data
- [ ] Frontend displays accurate information
- [ ] Error handling works correctly
- [ ] Plan limits are properly enforced
- [ ] Performance is acceptable

**Once complete, delete this file and update your README to reflect the production-ready status.**
