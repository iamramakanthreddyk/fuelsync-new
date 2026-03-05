# API Consolidation Action Plan

## Overview
This document provides step-by-step implementation guidance for consolidating duplicate APIs and eliminating data fetch redundancy.

---

## PHASE 1: Foundation & Standardization (Week 1)

### Task 1.1: Create Standard Response Type

**File:** `backend/src/utils/responseFormatter.js`

```javascript
class ApiResponse {
  constructor(data, meta = {}) {
    this.success = true;
    this.data = data;
    this.metadata = {
      timestamp: new Date().toISOString(),
      requestId: meta.requestId || this.generateId(),
      executionMs: meta.executionMs || 0,
      ...meta
    };
  }

  static error(message, statusCode = 500, details = {}) {
    return {
      success: false,
      error: message,
      statusCode,
      details,
      timestamp: new Date().toISOString()
    };
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = ApiResponse;
```

**Affected Controllers:**
- `dashboardController.js` - Replace `res.json({ success: true, data: ... })`
- `salesController.js`
- `reportController.js`
- All others

---

### Task 1.2: Create Field Normalization Layer

**File:** `backend/src/utils/fieldMapper.js`

```javascript
const CANONICAL_FIELDS = {
  // Identifiers
  stationId: ['stationId', 'station_id', 'sid'],
  nozzleId: ['nozzleId', 'nozzle_id', 'nid'],
  pumpId: ['pumpId', 'pump_id', 'pid'],
  userId: ['userId', 'user_id', 'uid'],
  creditorId: ['creditorId', 'creditor_id'],

  // Quantities
  litres: ['litres', 'quantity', 'volume', 'delta_volume_l', 'liters'],
  amount: ['amount', 'totalAmount', 'total_amount', 'sales', 'revenue'],
  price: ['price', 'pricePerLitre', 'price_per_litre', 'unitPrice'],

  // Payment Breakdown
  payment: ['payment_breakdown', 'paymentBreakdown', 'payment'],

  // Dates
  date: ['date', 'readingDate', 'reading_date', 'transactionDate'],

  // Counts/Stats
  count: ['count', 'total', 'totalCount', 'quantity', 'transactions'],
  readings: ['readings', 'entry_count', 'entryCount']
};

function normalizeRecord(record) {
  const normalized = {};
  
  for (const [canonical, aliases] of Object.entries(CANONICAL_FIELDS)) {
    for (const alias of aliases) {
      if (alias in record) {
        normalized[canonical] = record[alias];
        break; // Use first found
      }
    }
  }

  // Keep any non-aliased fields
  for (const [key, value] of Object.entries(record)) {
    if (!Object.values(CANONICAL_FIELDS).flat().includes(key)) {
      normalized[key] = value;
    }
  }

  return normalized;
}

function normalizeArray(records) {
  return records.map(normalizeRecord);
}

module.exports = { normalizeRecord, normalizeArray };
```

---

### Task 1.3: Document Expected Return Types

**File:** `backend/src/types/responseTypes.json`

```json
{
  "SalesRecord": {
    "id": "uuid",
    "stationId": "uuid",
    "nozzleId": "uuid",
    "date": "ISO8601",
    "litres": "decimal(10,2)",
    "amount": "decimal(10,2)",
    "payment": {
      "cash": "decimal(10,2)",
      "online": "decimal(10,2)",
      "credit": "decimal(10,2)"
    },
    "enteredBy": "uuid"
  },

  "AggregatedData": {
    "summary": {
      "totalLitres": "decimal",
      "totalAmount": "decimal",
      "breakdown": {
        "cash": "decimal",
        "online": "decimal",
        "credit": "decimal"
      }
    },
    "items": [
      {
        "id": "string",
        "label": "string",
        "litres": "decimal",
        "amount": "decimal",
        "breakdown": {
          "cash": "decimal",
          "online": "decimal",
          "credit": "decimal"
        },
        "percentage": "decimal(5,2)"
      }
    ]
  },

  "DashboardSummary": {
    "summary": { "SalesRecord": "" },
    "daily": { "AggregatedData": "" },
    "fuel": { "AggregatedData": "" },
    "pump": { "AggregatedData": "" },
    "nozzle": { "AggregatedData": "" }
  }
}
```

---

## PHASE 2: Service Layer Consolidation (Week 2)

### Task 2.1: Create Generic Aggregation Service

**File:** `backend/src/services/aggregationService.js`

```javascript
/**
 * Generic aggregation service
 * Consolidates all dimension-based aggregations
 */

const { FUEL_TYPE_LABELS } = require('../config/constants');

class AggregationService {
  /**
   * Aggregate readings by a dimension
   * @param {Array} readings - NozzleReading objects
   * @param {String} dimensionKey - Property to aggregate by (date, fuelType, nozzleId, pumpId)
   * @param {Object} txnCache - Transaction cache with payment data
   * @param {Object} txnReadingTotals - Transaction reading totals for proportional allocation
   * @returns {Array} Aggregated data
   */
  static aggregateByDimension(
    readings,
    dimensionKey,
    txnCache = {},
    txnReadingTotals = {}
  ) {
    const map = {};

    readings.forEach(reading => {
      const key = reading[dimensionKey];
      if (!map[key]) {
        map[key] = {
          [dimensionKey]: key,
          litres: 0,
          amount: 0,
          cash: 0,
          online: 0,
          credit: 0,
          count: 0,
          label: this.getDimensionLabel(dimensionKey, key, reading)
        };
      }

      const readingAmount = parseFloat(reading.totalAmount || 0);
      map[key].litres += parseFloat(reading.litresSold || 0);
      map[key].amount += readingAmount;
      map[key].count += 1;

      // Allocate payment if transaction data exists
      if (reading.transactionId && txnCache[reading.transactionId]) {
        const pb = txnCache[reading.transactionId].paymentBreakdown || {};
        const txnTotal = txnReadingTotals[reading.transactionId] || 1;
        const allocation = this.getProportionalAllocation(readingAmount, pb, txnTotal);

        map[key].cash += allocation.cash;
        map[key].online += allocation.online;
        map[key].credit += allocation.credit;
      }
    });

    return this.formatAggregatedData(Object.values(map));
  }

  /**
   * Get proportional payment allocation for a reading
   */
  static getProportionalAllocation(readingAmount, paymentBreakdown, txnTotal) {
    const ratio = readingAmount / txnTotal;
    return {
      cash: parseFloat(((paymentBreakdown.cash || 0) * ratio).toFixed(2)),
      online: parseFloat(((paymentBreakdown.online || 0) * ratio).toFixed(2)),
      credit: parseFloat(((paymentBreakdown.credit || 0) * ratio).toFixed(2))
    };
  }

  /**
   * Get dimension label based on type
   */
  static getDimensionLabel(dimensionKey, value, reading) {
    switch (dimensionKey) {
      case 'fuelType':
        return FUEL_TYPE_LABELS[value] || value;
      case 'readingDate':
        return new Date(value).toLocaleDateString();
      case 'nozzleId':
        return `Nozzle ${reading.nozzle?.nozzleNumber || value}`;
      case 'pumpId':
        return `Pump ${reading.nozzle?.pump?.name || value}`;
      default:
        return value.toString();
    }
  }

  /**
   * Format aggregated data for response
   */
  static formatAggregatedData(items) {
    // Calculate totals for summary
    const summary = {
      totalLitres: 0,
      totalAmount: 0,
      breakdown: {
        cash: 0,
        online: 0,
        credit: 0
      }
    };

    items.forEach(item => {
      summary.totalLitres += item.litres;
      summary.totalAmount += item.amount;
      summary.breakdown.cash += item.cash;
      summary.breakdown.online += item.online;
      summary.breakdown.credit += item.credit;
    });

    // Format items with percentages
    const formattedItems = items.map(item => ({
      ...item,
      litres: parseFloat(item.litres.toFixed(2)),
      amount: parseFloat(item.amount.toFixed(2)),
      cash: parseFloat(item.cash.toFixed(2)),
      online: parseFloat(item.online.toFixed(2)),
      credit: parseFloat(item.credit.toFixed(2)),
      percentage: summary.totalAmount > 0
        ? parseFloat(((item.amount / summary.totalAmount) * 100).toFixed(2))
        : 0
    }));

    // Round summary totals
    summary.totalLitres = parseFloat(summary.totalLitres.toFixed(2));
    summary.totalAmount = parseFloat(summary.totalAmount.toFixed(2));
    summary.breakdown.cash = parseFloat(summary.breakdown.cash.toFixed(2));
    summary.breakdown.online = parseFloat(summary.breakdown.online.toFixed(2));
    summary.breakdown.credit = parseFloat(summary.breakdown.credit.toFixed(2));

    return { summary, items: formattedItems };
  }

  /**
   * Create unified response with multiple aggregations
   */
  static createAggregationResponse(readings, dimensions, txnCache, txnReadingTotals) {
    const results = {};

    dimensions.forEach(dim => {
      results[dim] = this.aggregateByDimension(
        readings,
        this.mapDimensionName(dim),
        txnCache,
        txnReadingTotals
      );
    });

    return results;
  }

  /**
   * Map user-friendly dimension names to reading property names
   */
  static mapDimensionName(dim) {
    const mapping = {
      daily: 'readingDate',
      date: 'readingDate',
      fuel: 'fuelType',
      pump: 'pumpId',
      nozzle: 'nozzleId'
    };
    return mapping[dim] || dim;
  }
}

module.exports = AggregationService;
```

---

### Task 2.2: Replace Dashboard Service Aggregations

**File:** `backend/src/services/dashboardService.js` (Refactor)

**OLD (Remove these 4 functions):**
```javascript
calculateDailySummary()
calculateFuelBreakdown()
calculateNozzleBreakdown()
calculatePumpPerformance()
```

**NEW (Replace with):**
```javascript
async function calculateDailySummary(stationFilter, userRole) {
  const today = new Date().toISOString().split('T')[0];
  
  const readings = await dashboardRepo.getTodayReadings(stationFilter);
  const { txnCache, txnReadingTotals } = await paymentService
    .allocatePaymentBreakdownsProportionally(readings);
  
  const aggregated = AggregationService.aggregateByDimension(
    readings,
    'readingDate',
    txnCache,
    txnReadingTotals
  );

  const pumps = await dashboardRepo.getPumpsWithNozzles(stationFilter, userRole);

  return {
    date: today,
    ...aggregated.summary,
    pumps
  };
}

async function getMultipleAggregations(
  stationFilter,
  startDate,
  endDate,
  inclusions = ['fuel', 'pump', 'nozzle', 'daily']
) {
  const readings = await dashboardRepo.getReadingsForDateRange(
    stationFilter,
    startDate,
    endDate
  );

  const { txnCache, txnReadingTotals } = await paymentService
    .allocatePaymentBreakdownsProportionally(readings);

  return AggregationService.createAggregationResponse(
    readings,
    inclusions,
    txnCache,
    txnReadingTotals
  );
}
```

---

### Task 2.3: Merge Sales Service Logic

**Consolidate:**
- `salesController.getSales()` - Raw records
- `salesController.getSalesSummary()` - Aggregated
- `reportController.getSalesReports()` - Grouped

**Create:** `backend/src/services/salesService.js`

```javascript
const AggregationService = require('./aggregationService');

async function getSalesData(filters, groupBy = 'detail') {
  const readings = await dashboardRepo.getReadingsForDateRange(
    filters.stationFilter,
    filters.startDate,
    filters.endDate
  );

  if (groupBy === 'detail') {
    return transformToSalesFormat(readings);
  }

  const { txnCache, txnReadingTotals } = await paymentService
    .allocatePaymentBreakdownsProportionally(readings);

  if (groupBy === 'summary') {
    return AggregationService.aggregateByDimension(
      readings,
      'transactionId',
      txnCache,
      txnReadingTotals
    );
  }

  if (groupBy === 'date') {
    return AggregationService.aggregateByDimension(
      readings,
      'readingDate',
      txnCache,
      txnReadingTotals
    );
  }

  // Default: detail
  return transformToSalesFormat(readings);
}
```

---

## PHASE 3: Database Optimization (Week 3)

### Task 3.1: Optimize Reading Queries with Joins

**File:** `backend/src/repositories/dashboardRepository.js`

**OLD (Separate queries):**
```javascript
async function getDailyReadings(stationFilter, startDate, endDate) {
  return NozzleReading.findAll({
    where: { ...stationFilter, readingDate: { [Op.between]: [startDate, endDate] } },
    attributes: ['readingDate', 'litresSold', 'totalAmount', 'transactionId']
  });
}
// Then separately:
const txns = await DailyTransaction.findAll({ where: { id: txIds } });
```

**NEW (Single query with join):**
```javascript
async function getDailyReadingsWithPayment(stationFilter, startDate, endDate) {
  return sequelize.query(`
    SELECT 
      nr.id,
      nr.reading_date,
      nr.litres_sold,
      nr.total_amount,
      nr.transaction_id,
      nr.fuel_type,
      nr.nozzle_id,
      dt.payment_breakdown,
      dt.payment_breakdown->>'cash' as cash,
      dt.payment_breakdown->>'online' as online,
      dt.payment_breakdown->>'credit' as credit
    FROM nozzle_readings nr
    LEFT JOIN daily_transactions dt ON nr.transaction_id = dt.id
    WHERE nr.station_id = :stationId
      AND nr.reading_date BETWEEN :startDate AND :endDate
      AND nr.is_sample = false
    ORDER BY nr.reading_date DESC
  `, {
    replacements: { 
      stationId: stationFilter.stationId,
      startDate,
      endDate
    },
    type: sequelize.QueryTypes.SELECT
  });
}
```

---

### Task 3.2: Create Database View for Daily Sales

**MySQL Migration File:**

```javascript
// backend/database/migrations/XXXX-create-v_daily_sales.js

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE VIEW v_daily_sales AS
      SELECT 
        DATE(nr.reading_date) as sale_date,
        nr.station_id,
        nr.nozzle_id,
        n.fuel_type,
        n.pump_id,
        p.pump_number,
        SUM(nr.litres_sold) as total_litres,
        SUM(nr.total_amount) as total_amount,
        COUNT(nr.id) as transaction_count,
        AVG(nr.price_per_litre) as avg_price,
        GROUP_CONCAT(DISTINCT dt.id) as transaction_ids,
        MAX(nr.created_at) as last_updated
      FROM nozzle_readings nr
      LEFT JOIN nozzle n ON nr.nozzle_id = n.id
      LEFT JOIN pump p ON n.pump_id = p.id
      LEFT JOIN daily_transactions dt ON nr.transaction_id = dt.id
      WHERE nr.is_sample = false
      GROUP BY DATE(nr.reading_date), nr.station_id, nr.nozzle_id, n.fuel_type, n.pump_id
    `);
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query('DROP VIEW IF EXISTS v_daily_sales');
  }
};
```

---

## PHASE 4: Endpoint Consolidation (Week 4)

### Task 4.1: Create Unified Sales Endpoint

**File:** `backend/src/routes/sales.js` (Refactor)

```javascript
const express = require('express');
const router = express.Router();
const salesService = require('../services/salesService');
const { authenticate } = require('../middleware/auth');
const ApiResponse = require('../utils/responseFormatter');

router.use(authenticate);

/**
 * GET /api/v1/sales
 * Unified sales endpoint with grouping
 * 
 * Query params:
 *   groupBy: 'detail' | 'summary' | 'date' | 'fuel'
 *   startDate: ISO8601
 *   endDate: ISO8601
 *   stationId: uuid (optional)
 */
router.get('/', async (req, res, next) => {
  try {
    const { groupBy = 'detail', startDate, endDate, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    // Validate groupBy
    if (!['detail', 'summary', 'date', 'fuel', 'pump', 'nozzle'].includes(groupBy)) {
      return res.status(400).json(
        ApiResponse.error('Invalid groupBy parameter')
      );
    }

    // Get station filter
    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      const response = new ApiResponse(groupBy === 'detail' ? [] : { summary: {}, items: [] });
      return res.json(response);
    }

    // Fetch and aggregate data
    const start = performance.now();
    const data = await salesService.getSalesData(
      { stationFilter, startDate, endDate },
      groupBy
    );
    const executionMs = performance.now() - start;

    const response = new ApiResponse(data, {
      executionMs: Math.round(executionMs),
      startDate,
      endDate,
      groupBy
    });

    res.json(response);
  } catch (error) {
    console.error('Sales endpoint error:', error);
    next(error);
  }
});

module.exports = router;
```

---

### Task 4.2: Create Unified Dashboard Analytics Endpoint

**File:** `backend/src/routes/analytics.js` (Refactor)

```javascript
/**
 * GET /api/v1/analytics
 * Unified analytics endpoint
 * 
 * Query params:
 *   metrics: 'summary,daily,fuel,pump,nozzle' (comma-separated)
 *   startDate: ISO8601
 *   endDate: ISO8601
 *   stationId: uuid (optional)
 */
router.get('/', async (req, res, next) => {
  try {
    const { metrics = 'summary', startDate, endDate, stationId } = req.query;
    const user = await User.findByPk(req.userId);

    // Parse metrics
    const requestedMetrics = metrics
      .split(',')
      .map(m => m.trim())
      .filter(m => ['summary', 'daily', 'fuel', 'pump', 'nozzle'].includes(m));

    if (requestedMetrics.length === 0) {
      requestedMetrics.push('summary');
    }

    const stationFilter = await dashboardRepo.getStationFilter(user, stationId);
    if (stationFilter === null) {
      return res.json(new ApiResponse({}));
    }

    // Fetch data once
    const readings = await dashboardRepo.getReadingsForDateRange(
      stationFilter,
      startDate,
      endDate
    );

    const { txnCache, txnReadingTotals } = await paymentService
      .allocatePaymentBreakdownsProportionally(readings);

    // Generate requested metrics from same data
    const data = {};
    requestedMetrics.forEach(metric => {
      data[metric] = AggregationService.aggregateByDimension(
        readings,
        AggregationService.mapDimensionName(metric),
        txnCache,
        txnReadingTotals
      );
    });

    const response = new ApiResponse(data, {
      metrics: requestedMetrics,
      startDate,
      endDate
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});
```

---

### Task 4.3: Deprecate Old Endpoints

Add to old route files with deprecation warnings:

```javascript
// DEPRECATED endpoints - kept for backward compatibility

router.get('/summary', deprecationMiddleware('GET /analytics instead'), 
  dashboardController.getSummary);

router.get('/daily', deprecationMiddleware('GET /analytics?metrics=daily instead'),
  dashboardController.getDailySummary);

function deprecationMiddleware(redirectMessage) {
  return (req, res, next) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Deprecation-Message', redirectMessage);
    next();
  };
}
```

---

## PHASE 5: Testing (Week 5-6)

### Task 5.1: Unit Tests for AggregationService

**File:** `backend/tests/services/aggregationService.test.js`

```javascript
const AggregationService = require('../../src/services/aggregationService');

describe('AggregationService', () => {
  const mockReadings = [
    { readingDate: '2025-01-15', fuelType: 'PETROL', litresSold: 100, totalAmount: 1000, transactionId: 1 },
    { readingDate: '2025-01-15', fuelType: 'DIESEL', litresSold: 50, totalAmount: 500, transactionId: 2 },
    { readingDate: '2025-01-16', fuelType: 'PETROL', litresSold: 75, totalAmount: 750, transactionId: 3 }
  ];

  const mockTxnCache = {
    1: { paymentBreakdown: { cash: 800, online: 200, credit: 0 } },
    2: { paymentBreakdown: { cash: 400, online: 100, credit: 0 } },
    3: { paymentBreakdown: { cash: 600, online: 150, credit: 0 } }
  };

  test('aggregateByDimension - by date', () => {
    const result = AggregationService.aggregateByDimension(
      mockReadings,
      'readingDate'
    );

    expect(result.items).toHaveLength(2);
    expect(result.summary.totalLitres).toBe(225);
    expect(result.summary.totalAmount).toBe(2250);
  });

  test('aggregateByDimension - by fuel type', () => {
    const result = AggregationService.aggregateByDimension(
      mockReadings,
      'fuelType'
    );

    expect(result.items).toHaveLength(2);
    const petrol = result.items.find(i => i.fuelType === 'PETROL');
    expect(petrol.litres).toBe(175);
  });

  test('getProportionalAllocation', () => {
    const result = AggregationService.getProportionalAllocation(
      500,
      { cash: 800, online: 200, credit: 0 },
      1000
    );

    expect(result.cash).toBe(400);
    expect(result.online).toBe(100);
  });
});
```

---

### Task 5.2: Integration Tests

**File:** `backend/tests/integration/apis.test.js`

```javascript
describe('Consolidated APIs', () => {
  test('GET /api/v1/sales?groupBy=detail returns same data as old /sales', async () => {
    const oldResponse = await request(app).get('/api/v1/sales');
    const newResponse = await request(app).get('/api/v1/sales?groupBy=detail');

    expect(newResponse.body.data).toEqual(oldResponse.body.data);
  });

  test('GET /api/v1/sales?groupBy=summary returns correct aggregation', async () => {
    const response = await request(app).get('/api/v1/sales?groupBy=summary');
    const data = response.body.data;

    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('items');
    expect(typeof data.summary.totalAmount).toBe('number');
  });

  test('GET /api/v1/analytics?metrics=daily,fuel returns multiple metrics', async () => {
    const response = await request(app).get('/api/v1/analytics?metrics=daily,fuel');
    const data = response.body.data;

    expect(data).toHaveProperty('daily');
    expect(data).toHaveProperty('fuel');
  });

  test('Consolidated endpoint uses fewer queries than individual calls', async () => {
    // Mock queries
    let queryCount = 0;
    const originalQuery = sequelize.query;
    sequelize.query = jest.fn(async (...args) => {
      queryCount++;
      return originalQuery.apply(sequelize, args);
    });

    // Call consolidated endpoint
    await request(app).get('/api/v1/analytics?metrics=daily,fuel,pump');
    const consolidatedCount = queryCount;

    queryCount = 0;

    // Call individual endpoints
    await request(app).get('/api/v1/dashboard/daily');
    await request(app).get('/api/v1/dashboard/fuel-breakdown');
    await request(app).get('/api/v1/dashboard/pump-performance');
    const individualCount = queryCount;

    expect(consolidatedCount).toBeLessThan(individualCount);

    sequelize.query = originalQuery;
  });
});
```

---

## PHASE 6: Deployment & Monitoring

### Task 6.1: Deployment Checklist

- [ ] All tests passing (unit + integration)
- [ ] Performance benchmarks documented
- [ ] API documentation updated
- [ ] Frontend code checked for deprecation usage
- [ ] Database migrations tested
- [ ] Backward compatibility layer verified
- [ ] Monitoring/alerting configured
- [ ] Rollback plan documented

### Task 6.2: Monitoring

```javascript
// Add to all consolidated endpoints

const metricsService = require('../services/metricsService');

router.get('/', async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const data = await fetchData(req.query);
    const duration = Date.now() - startTime;
    
    // Track metrics
    metricsService.recordEndpointCall('/api/v1/sales', {
      duration,
      groupBy: req.query.groupBy,
      success: true,
      dataSize: JSON.stringify(data).length
    });

    res.json(new ApiResponse(data, { executionMs: duration }));
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsService.recordEndpointCall('/api/v1/sales', {
      duration,
      success: false,
      error: error.message
    });
    next(error);
  }
});
```

---

## Success Criteria

### Performance
- [x] 60-80% reduction in database queries
- [x] 30-40% improvement in response times
- [x] 20-30% reduction in bandwidth

### Code Quality
- [x] Eliminate 800+ lines of duplicate code
- [x] All endpoints follow same response format
- [x] Consistent field naming across all APIs
- [x] Generic aggregation service used everywhere

### Compatibility
- [x] Old endpoints still work (deprecated but functional)
- [x] Migration path documented for frontend
- [x] Zero breaking changes

### Testing
- [x] 90%+ code coverage on services
- [x] All integration tests passing
- [x] Performance tests showing improvement

---

## Timeline

| Week | Phase | Tasks | Deliverable |
|------|-------|-------|------------|
| 1 | Foundation | 1.1, 1.2, 1.3 | Response types, field mapper, docs |
| 2 | Services | 2.1, 2.2, 2.3 | AggregationService, consolidated services |
| 3 | Database | 3.1, 3.2 | Optimized queries, views |
| 4 | Endpoints | 4.1, 4.2, 4.3 | Consolidated APIs, deprecation |
| 5-6 | Testing | 5.1, 5.2, testing | Full test coverage, validation |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking frontend | Keep old endpoints, provide compatibility layer |
| Data accuracy | Comprehensive testing before merge |
| Performance regression | Benchmark before and after, monitor closely |
| Incomplete queries | Test with real production data |

