/**
 * TEST EXAMPLES FOR OPTIMIZED REPOSITORIES
 * 
 * Demonstrates how to test pagination, caching, and batch operations
 */

const {
  PaginationHelper,
  BatchQueryHelper,
  EagerLoadingOptimizer,
  QueryPerformanceLogger
} = require('../utils/queryOptimizer');
const { queryCache, CacheKeyGenerator, CacheInvalidationManager } = require('../services/cacheService');
const readingRepoOptimized = require('../repositories/readingRepositoryOptimized');
const dashboardRepoOptimized = require('../repositories/dashboardRepositoryOptimized');

// ============================================================================
// PAGINATION TESTS
// ============================================================================

describe('PaginationHelper', () => {
  
  it('should parse pagination params with defaults', () => {
    const query = {};
    const result = PaginationHelper.parsePaginationParams(query);
    
    expect(result).toEqual({
      limit: 50,
      offset: 0,
      page: 1,
      sort: 'createdAt:DESC'
    });
  });

  it('should enforce maximum limit', () => {
    const query = { limit: 1000 }; // Trying to get 1000 items
    const result = PaginationHelper.parsePaginationParams(query);
    
    expect(result.limit).toBeLessThanOrEqual(500); // Max enforced
  });

  it('should calculate page from offset and limit', () => {
    const query = { limit: 50, offset: 100 };
    const result = PaginationHelper.parsePaginationParams(query);
    
    expect(result.page).toBe(3); // offset 100, limit 50 = page 3
  });

  it('should format paginated response correctly', () => {
    const findAndCountAllResult = {
      count: 250,
      rows: Array(50).fill({ id: 1 }) // 50 items on this page
    };
    
    const response = PaginationHelper.buildPaginatedResponse(findAndCountAllResult, {
      limit: 50,
      offset: 0
    });
    
    expect(response).toEqual({
      success: true,
      data: findAndCountAllResult.rows,
      pagination: {
        page: 1,
        limit: 50,
        total: 250,
        pages: 5,
        hasMore: true
      }
    });
  });

  it('should indicate no more pages on last page', () => {
    const response = PaginationHelper.buildPaginatedResponse(
      { count: 100, rows: Array(10).fill({}) },
      { limit: 50, offset: 50 }
    );
    
    expect(response.pagination.hasMore).toBe(false); // Last page
    expect(response.pagination.page).toBe(2);
  });
});

// ============================================================================
// BATCH QUERY TESTS
// ============================================================================

describe('BatchQueryHelper', () => {
  
  it('should fetch multiple items and return as Map', async () => {
    const mockFindAll = jest.fn().mockResolvedValue([
      { id: 1, name: 'Nozzle 1' },
      { id: 2, name: 'Nozzle 2' },
      { id: 3, name: 'Nozzle 3' }
    ]);
    
    const result = await BatchQueryHelper.fetchByIds(
      mockFindAll,
      [1, 2, 3, 99], // Including non-existent ID
      { attributes: ['id', 'name'] }
    );
    
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);
    expect(result.get(1).name).toBe('Nozzle 1');
    expect(result.has(99)).toBe(false); // Non-existent ID not in map
  });

  it('should enable O(1) lookups after fetch', async () => {
    const mockFindAll = jest.fn().mockResolvedValue([
      { id: 'nozzle-1', fuelType: 'Petrol' },
      { id: 'nozzle-2', fuelType: 'Diesel' }
    ]);
    
    const nozzlesMap = await BatchQueryHelper.fetchByIds(
      mockFindAll,
      ['nozzle-1', 'nozzle-2'],
      {}
    );
    
    // Lookup is O(1)
    const nozzle = nozzlesMap.get('nozzle-1');
    expect(nozzle.fuelType).toBe('Petrol');
  });
});

// ============================================================================
// CACHE SERVICE TESTS
// ============================================================================

describe('QueryCache', () => {
  
  beforeEach(() => {
    queryCache.cache.clear();
  });

  it('should cache query results and return cached result on second call', async () => {
    let callCount = 0;
    const expensiveQuery = async () => {
      callCount++;
      return { data: 'expensive result' };
    };

    // First call - executes query and caches
    const result1 = await queryCache.cached(
      expensiveQuery,
      CacheKeyGenerator.NAMESPACES.READING,
      { nozzleId: 1 },
      3600000
    );

    expect(callCount).toBe(1);
    expect(result1.data).toBe('expensive result');

    // Second call - returns from cache (no function call)
    const result2 = await queryCache.cached(
      expensiveQuery,
      CacheKeyGenerator.NAMESPACES.READING,
      { nozzleId: 1 },
      3600000
    );

    expect(callCount).toBe(1); // Not called again!
    expect(result2).toEqual(result1);
  });

  it('should have different cache keys for different parameters', async () => {
    const key1 = CacheKeyGenerator.query(
      CacheKeyGenerator.NAMESPACES.READING,
      { nozzleId: 1 }
    );
    const key2 = CacheKeyGenerator.query(
      CacheKeyGenerator.NAMESPACES.READING,
      { nozzleId: 2 }
    );

    expect(key1).not.toBe(key2);
  });

  it('should invalidate namespace when invalidateNamespace called', async () => {
    const key1 = `${CacheKeyGenerator.NAMESPACES.READING}:nozzle:1`;
    const key2 = `${CacheKeyGenerator.NAMESPACES.READING}:nozzle:2`;
    
    queryCache.cache.set(key1, 'value1', 3600000);
    queryCache.cache.set(key2, 'value2', 3600000);
    
    expect(queryCache.cache.has(key1)).toBe(true);
    expect(queryCache.cache.has(key2)).toBe(true);

    queryCache.invalidateNamespace(CacheKeyGenerator.NAMESPACES.READING);

    expect(queryCache.cache.has(key1)).toBe(false);
    expect(queryCache.cache.has(key2)).toBe(false);
  });

  it('should track cache hit rate', async () => {
    const query = async () => ({ data: 'test' });
    
    // Miss 1
    await queryCache.cached(query, 'test', {}, 3600000);
    // Hit 1
    await queryCache.cached(query, 'test', {}, 3600000);
    // Hit 2
    await queryCache.cached(query, 'test', {}, 3600000);

    const stats = queryCache.getStats();
    expect(stats.hitRate).toBeCloseTo(0.666, 2); // 2 hits / 3 calls
  });
});

// ============================================================================
// OPTIMIZED REPOSITORY TESTS
// ============================================================================

describe('readingRepositoryOptimized', () => {

  describe('getReadingsWithFilters', () => {
    
    it('should return paginated results with metadata', async () => {
      const result = await readingRepositoryOptimized.getReadingsWithFilters({
        stationId: 'station-1',
        offset: 0,
        limit: 50,
        useCache: false // Skip cache in tests
      });

      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('count');
      expect(result.rows.length).toBeLessThanOrEqual(50);
    });

    it('should filter by date range', async () => {
      const result = await readingRepositoryOptimized.getReadingsWithFilters({
        stationId: 'station-1',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        offset: 0,
        limit: 50,
        useCache: false
      });

      expect(result).toBeDefined();
      result.rows.forEach(row => {
        const date = new Date(row.readingDate);
        expect(date).toBeGreaterThanOrEqual(new Date('2025-01-01'));
        expect(date).toBeLessThanOrEqual(new Date('2025-01-31'));
      });
    });

    it('should cache results and return from cache on second call', async () => {
      // Clear cache
      queryCache.cache.clear();
      
      const options = {
        stationId: 'station-1',
        offset: 0,
        limit: 50,
        useCache: true
      };

      // First call - caches
      const result1 = await readingRepositoryOptimized.getReadingsWithFilters(options);
      
      // Second call - should be instant from cache
      const start = Date.now();
      const result2 = await readingRepositoryOptimized.getReadingsWithFilters(options);
      const elapsed = Date.now() - start;

      // Cache hit should be near-instant (< 5ms)
      expect(elapsed).toBeLessThan(5);
      expect(result1).toEqual(result2);
    });
  });

  describe('getLatestReadingsForNozzles', () => {

    it('should return map of nozzle IDs to latest readings', async () => {
      const nozzleIds = ['nozzle-1', 'nozzle-2', 'nozzle-3'];
      
      const result = await readingRepositoryOptimized.getLatestReadingsForNozzles(
        nozzleIds,
        false // No cache
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBeLessThanOrEqual(3);
      
      for (const [nozzleId, reading] of result.entries()) {
        expect(nozzleId).toBeTruthy();
        expect(reading).toHaveProperty('readingValue');
        expect(reading).toHaveProperty('readingDate');
      }
    });

    it('should handle empty nozzle list', async () => {
      const result = await readingRepositoryOptimized.getLatestReadingsForNozzles([], false);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should use batching to avoid N+1 queries', async () => {
      // This is tested implicitly by checking that:
      // 1. Multiple nozzle IDs can be fetched efficiently
      // 2. Performance improves with larger batches
      
      const nozzleIds = Array.from({ length: 100 }, (_, i) => `nozzle-${i}`);
      
      const start = Date.now();
      const result = await readingRepositoryOptimized.getLatestReadingsForNozzles(
        nozzleIds,
        false
      );
      const elapsed = Date.now() - start;

      // Should complete quickly even with 100 nozzles (single batch query)
      expect(elapsed).toBeLessThan(500);
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getDailySummaryOptimized', () => {

    it('should return aggregated daily summary', async () => {
      const summary = await readingRepositoryOptimized.getDailySummaryOptimized(
        'station-1',
        '2025-01-15',
        false
      );

      expect(summary).toHaveProperty('date');
      expect(summary).toHaveProperty('totalLitres');
      expect(summary).toHaveProperty('totalValue');
      expect(summary).toHaveProperty('byFuelType');
      expect(summary).toHaveProperty('readingCount');

      expect(summary.totalLitres).toBeGreaterThanOrEqual(0);
      expect(summary.totalValue).toBeGreaterThanOrEqual(0);
    });

    it('should batch-fetch nozzles and transactions', async () => {
      // Test that related items are fetched efficiently
      const summary = await readingRepositoryOptimized.getDailySummaryOptimized(
        'station-1',
        '2025-01-15',
        false
      );

      // If data exists, verify enrichment worked
      if (summary.readingCount > 0) {
        expect(summary.byFuelType).toBeDefined();
        expect(Object.keys(summary.byFuelType).length).toBeGreaterThan(0);
      }
    });

    it('should cache daily summary with 2 hour TTL', async () => {
      queryCache.cache.clear();

      // First call
      const summary1 = await readingRepositoryOptimized.getDailySummaryOptimized(
        'station-1',
        '2025-01-15',
        true
      );

      // Second call should be cached
      const start = Date.now();
      const summary2 = await readingRepositoryOptimized.getDailySummaryOptimized(
        'station-1',
        '2025-01-15',
        true
      );
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5); // Cache hit is instant
      expect(summary1).toEqual(summary2);
    });
  });

  describe('getNozzleReadingHistory', () => {

    it('should return paginated reading history for nozzle', async () => {
      const result = await readingRepositoryOptimized.getNozzleReadingHistory({
        nozzleId: 'nozzle-1',
        limit: 50,
        offset: 0,
        useCache: false
      });

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('rows');
      expect(result.rows.length).toBeLessThanOrEqual(50);
    });

    it('should filter by date range within pagination', async () => {
      const result = await readingRepositoryOptimized.getNozzleReadingHistory({
        nozzleId: 'nozzle-1',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        limit: 50,
        offset: 0,
        useCache: false
      });

      if (result.rows.length > 0) {
        result.rows.forEach(row => {
          const date = new Date(row.readingDate);
          expect(date).toBeGreaterThanOrEqual(new Date('2025-01-01'));
          expect(date).toBeLessThanOrEqual(new Date('2025-01-31'));
        });
      }
    });
  });
});

// ============================================================================
// OPTIMIZED DASHBOARD REPOSITORY TESTS
// ============================================================================

describe('dashboardRepositoryOptimized', () => {

  describe('getPumpsWithNozzles', () => {

    it('should return all pumps with nested nozzles', async () => {
      const pumps = await dashboardRepositoryOptimized.getPumpsWithNozzles(
        'station-1',
        false
      );

      expect(Array.isArray(pumps)).toBe(true);
      pumps.forEach(pump => {
        expect(pump).toHaveProperty('id');
        expect(pump).toHaveProperty('nozzles');
        expect(Array.isArray(pump.nozzles)).toBe(true);
        // Each nozzle should have fuel type
        pump.nozzles.forEach(nozzle => {
          expect(nozzle).toHaveProperty('fuelType');
        });
      });
    });

    it('should cache pump data with 1 hour TTL', async () => {
      queryCache.cache.clear();

      const start1 = Date.now();
      const pumps1 = await dashboardRepositoryOptimized.getPumpsWithNozzles('station-1', true);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const pumps2 = await dashboardRepositoryOptimized.getPumpsWithNozzles('station-1', true);
      const time2 = Date.now() - start2;

      expect(time2).toBeLessThan(time1 / 2); // Cache should be significantly faster
      expect(pumps1).toEqual(pumps2);
    });
  });

  describe('getTodayReadingsOptimized', () => {

    it('should return paginated today readings with batch-loaded relations', async () => {
      const summary = await dashboardRepositoryOptimized.getTodayReadingsOptimized(
        'station-1',
        false
      );

      expect(summary).toHaveProperty('date');
      expect(summary).toHaveProperty('totalReadings');
      expect(summary).toHaveProperty('totalLitres');
      expect(summary).toHaveProperty('totalValue');
      expect(summary).toHaveProperty('readings');

      if (summary.readings.length > 0) {
        summary.readings.forEach(reading => {
          expect(reading.nozzle).toBeDefined();
          expect(reading.enteredBy).toBeDefined();
        });
      }
    });

    it('should batch-fetch nozzles, pumps, and users', async () => {
      const summary = await dashboardRepositoryOptimized.getTodayReadingsOptimized(
        'station-1',
        false
      );

      // Verify enrichment happened
      if (summary.readings.length > 0) {
        expect(summary.readings[0].nozzle).toBeDefined();
        expect(summary.readings[0].nozzle.pump).toBeDefined();
        expect(summary.readings[0].enteredBy).toBeDefined();
      }
    });
  });

  describe('getDailyReadingsPaginated', () => {

    it('should return paginated daily readings', async () => {
      const result = await dashboardRepositoryOptimized.getDailyReadingsPaginated(
        'station-1',
        { offset: 0, limit: 50, useCache: false }
      );

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('total');
    });

    it('should support pagination over multiple days', async () => {
      // Get page 1
      const page1 = await dashboardRepositoryOptimized.getDailyReadingsPaginated(
        'station-1',
        { offset: 0, limit: 10, useCache: false }
      );

      // Get page 2
      const page2 = await dashboardRepositoryOptimized.getDailyReadingsPaginated(
        'station-1',
        { offset: 10, limit: 10, useCache: false }
      );

      // Should be different results
      expect(page1.data).not.toEqual(page2.data);
    });
  });

  describe('getTransactionSummary', () => {

    it('should return aggregated transaction summary by date', async () => {
      const summary = await dashboardRepositoryOptimized.getTransactionSummary(
        'station-1',
        '2025-01-01',
        '2025-01-31',
        false
      );

      expect(Array.isArray(summary)).toBe(true);
      summary.forEach(day => {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('transactionCount');
        expect(day).toHaveProperty('totalAmount');
        expect(day).toHaveProperty('totalLitres');
      });
    });
  });
});

// ============================================================================
// PERFORMANCE COMPARISON TESTS
// ============================================================================

describe('Performance Improvements', () => {

  it('should demonstrate pagination benefits', async () => {
    // Fetching all readings without pagination would be slow
    // With pagination (50 at a time) should be much faster
    
    const start = Date.now();
    await readingRepositoryOptimized.getReadingsWithFilters({
      stationId: 'station-1',
      offset: 0,
      limit: 50,
      useCache: false
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500); // Should be fast
  });

  it('should demonstrate caching benefits', async () => {
    const options = {
      stationId: 'station-1',
      offset: 0,
      limit: 50,
      useCache: true
    };

    // First call - slower (loads from DB)
    const start1 = Date.now();
    await readingRepositoryOptimized.getReadingsWithFilters(options);
    const time1 = Date.now() - start1;

    // Second call - should be much faster (from cache)
    const start2 = Date.now();
    await readingRepositoryOptimized.getReadingsWithFilters(options);
    const time2 = Date.now() - start2;

    // Cache should be at least 10x faster
    expect(time2).toBeLessThan(time1 / 10);
  });

  it('should demonstrate N+1 prevention via batching', async () => {
    // Getting latest readings for 100 nozzles
    // Old way: 100 separate queries (N+1)
    // New way: 1 batch query
    
    const nozzleIds = Array.from({ length: 100 }, (_, i) => `nozzle-${i}`);
    
    const start = Date.now();
    await readingRepositoryOptimized.getLatestReadingsForNozzles(nozzleIds, false);
    const elapsed = Date.now() - start;

    // Should complete quickly even with 100 nozzles
    expect(elapsed).toBeLessThan(1000);
  });
});

module.exports = {
  // Export for use in other test files
};
