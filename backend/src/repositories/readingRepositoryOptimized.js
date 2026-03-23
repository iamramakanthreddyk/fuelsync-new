/**
 * Optimized Reading Repository
 * Features:
 * - Eliminates N+1 queries via batch loading
 * - Pagination support
 * - Query result caching
 * - Projection optimization
 * - Performance logging
 */

const { NozzleReading, Nozzle, Pump, Station, User, DailyTransaction } = require('../models');
const { Op } = require('sequelize');
const { PaginationHelper, BatchQueryHelper, EagerLoadingOptimizer, QueryPerformanceLogger } = require('../utils/queryOptimizer');
const { queryCache, CacheKeyGenerator } = require('./cacheService');
const { createContextLogger } = require('./loggerService');

const logger = createContextLogger('OptimizedReadingRepo');
const perfLogger = new QueryPerformanceLogger();

// Optimized include with separate queries for large collections
const READING_INCLUDES_OPTIMIZED = [
  {
    model: Nozzle,
    as: 'nozzle',
    attributes: ['id', 'name', 'fuelType', 'nozzleNumber'],
    include: [{
      model: Pump,
      as: 'pump',
      attributes: ['id', 'name', 'stationId', 'pumpNumber'],
      separate: true
    }],
    separate: false
  },
  {
    model: User,
    as: 'enteredByUser',
    attributes: ['id', 'name', 'email', 'role'],
    separate: true
  },
  {
    model: User,
    as: 'assignedEmployee',
    attributes: ['id', 'name', 'email', 'role'],
    required: false,
    separate: true
  },
  {
    model: DailyTransaction,
    as: 'transaction',
    attributes: ['id', 'paymentBreakdown', 'transactionDate'],
    required: false,
    separate: true
  }
];

/**
 * Optimized getReadingsWithFilters
 * Features:
 * - Pagination with configurable limits
 * - Query result caching
 * - Separate queries for large includes
 * - Performance logging
 */
exports.getReadingsWithFilters = async ({
  stationId,
  pumpId,
  nozzleId,
  startDate,
  endDate,
  offset = 0,
  limit = 50,
  accessibleStationIds,
  employeeId,
  sort = 'readingDate:DESC',
  includeRelations = true,
  useCache = true
}) => {
  const startTime = Date.now();

  // Build cache key
  const cacheKey = CacheKeyGenerator.query(CacheKeyGenerator.NAMESPACES.READING, {
    stationId,
    pumpId,
    nozzleId,
    startDate,
    endDate,
    employeeId,
    accessibleStationIds: accessibleStationIds?.join(',')
  }, { offset, limit });

  // Check cache
  if (useCache) {
    const cached = queryCache.cache.get(cacheKey);
    if (cached) {
      logger.debug('Cache hit for readings query', { cacheKey });
      return cached;
    }
  }

  try {
    const where = {};

    if (stationId) where.stationId = stationId;
    if (pumpId) where.pumpId = pumpId;
    if (nozzleId) where.nozzleId = nozzleId;
    if (employeeId) {
      where[Op.or] = [
        { enteredBy: employeeId },
        { assignedEmployeeId: employeeId }
      ];
    }
    if (accessibleStationIds && accessibleStationIds.length > 0) {
      where.stationId = { [Op.in]: accessibleStationIds };
    }
    if (startDate || endDate) {
      where.readingDate = {};
      if (startDate) where.readingDate[Op.gte] = startDate;
      if (endDate) where.readingDate[Op.lte] = endDate;
    }

    // Parse sort
    const order = PaginationHelper.buildSortClause(sort);

    // Execute query
    const result = await NozzleReading.findAndCountAll({
      where,
      include: includeRelations ? READING_INCLUDES_OPTIMIZED : [],
      order,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      distinct: true,
      subQuery: false // Prevents COUNT bug with includes
    });

    const executionTime = Date.now() - startTime;
    perfLogger.logQuery('getReadingsWithFilters', executionTime, {
      count: result.count,
      rows: result.rows.length,
      filters: Object.keys(where).length
    });

    // Cache result
    if (useCache) {
      queryCache.cache.set(cacheKey, result, 300000); // 5 minutes
    }

    return result;
  } catch (error) {
    logger.error('Error fetching readings with filters', { error });
    throw error;
  }
};

/**
 * Batch fetch latest readings for multiple nozzles
 * Prevents N+1 query when loading latest reading per nozzle
 * @param {Array<string>} nozzleIds - Nozzle IDs
 * @returns {Promise<Map>} Map of nozzleId -> reading
 */
exports.getLatestReadingsForNozzles = async (nozzleIds, useCache = true, stationId) => {
  if (!stationId) {
    throw new Error('stationId is required for getLatestReadingsForNozzles to prevent cross-station data mixing');
  }
  if (!nozzleIds || nozzleIds.length === 0) return new Map();

  const startTime = Date.now();
  const cacheKey = `${CacheKeyGenerator.NAMESPACES.READING}:latest:${stationId}:${nozzleIds.sort().join(',')}`;

  // Check cache
  if (useCache) {
    const cached = queryCache.cache.get(cacheKey);
    if (cached) {
      logger.debug('Cache hit for latest readings', { count: cached.size });
      return cached;
    }
  }

  try {
    // Use raw SQL for better performance
    const readings = await NozzleReading.findAll({
      where: { 
        nozzleId: { [Op.in]: nozzleIds },
        stationId
      },
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
      attributes: ['id', 'nozzleId', 'readingValue', 'readingDate', 'litresSold', 'totalAmount'],
      raw: true
    });

    // Group by nozzle (keep only latest per nozzle)
    const map = new Map();
    const seen = new Set();

    readings.forEach(reading => {
      if (!seen.has(reading.nozzleId)) {
        map.set(reading.nozzleId, reading);
        seen.add(reading.nozzleId);
      }
    });

    const executionTime = Date.now() - startTime;
    perfLogger.logQuery('getLatestReadingsForNozzles', executionTime, {
      nozzleCount: nozzleIds.length,
      foundReadings: map.size
    });

    // Cache result  (1 day TTL since it's only called once per day typically)
    if (useCache) {
      queryCache.cache.set(cacheKey, map, 86400000);
    }

    return map;
  } catch (error) {
    logger.error('Error fetching latest readings for nozzles', { error });
    throw error;
  }
};

/**
 * Get daily summary WITH batch loading (no N+1)
 * @param {string} stationId - Station ID
 * @param {string} date - Reading date (YYYY-MM-DD format)
 * @returns {Promise<Object>} Daily summary with breakdown
 */
exports.getDailySummaryOptimized = async (stationId, date, useCache = true) => {
  const startTime = Date.now();
  const cacheKey = CacheKeyGenerator.aggregation(
    CacheKeyGenerator.NAMESPACES.DASHBOARD,
    'dailySummary',
    stationId,
    date
  );

  // Check cache
  if (useCache) {
    const cached = queryCache.cache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    // Single query to get all readings for the day (with minimal fields)
    const readings = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: date,
        isSample: { [Op.ne]: true }
      },
      attributes: ['id', 'nozzleId', 'litresSold', 'totalAmount', 'transactionId'],
      raw: true
    });

    // Batch fetch nozzles (no N+1)
    const nozzleIds = [...new Set(readings.map(r => r.nozzleId))];
    const nozzlesMap = await BatchQueryHelper.fetchByIds(
      (options) => Nozzle.findAll(options),
      nozzleIds,
      {
        attributes: ['id', 'fuelType', 'nozzleNumber'],
        include: [{
          model: Pump,
          as: 'pump',
          attributes: ['id', 'pumpNumber'],
          required: false
        }]
      }
    );

    // Batch fetch transactions (no N+1)
    const transactionIds = [...new Set(readings.map(r => r.transactionId).filter(Boolean))];
    const transactionsMap = await BatchQueryHelper.fetchByIds(
      (options) => DailyTransaction.findAll(options),
      transactionIds,
      {
        attributes: ['id', 'paymentBreakdown', 'transactionDate']
      }
    );

    // Aggregate results
    const summary = {
      date,
      totalLitres: 0,
      totalValue: 0,
      byFuelType: {},
      readingCount: readings.length
    };

    readings.forEach(reading => {
      const nozzle = nozzlesMap.get(reading.nozzleId);
      if (!nozzle) return;

      const litres = parseFloat(reading.litresSold || 0);
      const value = parseFloat(reading.totalAmount || 0);
      const fuelType = nozzle.fuelType;

      summary.totalLitres += litres;
      summary.totalValue += value;

      if (!summary.byFuelType[fuelType]) {
        summary.byFuelType[fuelType] = { litres: 0, value: 0, readings: 0 };
      }
      summary.byFuelType[fuelType].litres += litres;
      summary.byFuelType[fuelType].value += value;
      summary.byFuelType[fuelType].readings += 1;
    });

    const executionTime = Date.now() - startTime;
    perfLogger.logQuery('getDailySummaryOptimized', executionTime, {
      readingCount: readings.length,
      nozzleCount: nozzleIds.length
    });

    // Cache (2 hours)
    if (useCache) {
      queryCache.cache.set(cacheKey, summary, 7200000);
    }

    return summary;
  } catch (error) {
    logger.error('Error fetching daily summary', { error });
    throw error;
  }
};

/**
 * Get readings for a nozzle with pagination
 * Uses query caching and batch operations
 */
exports.getNozzleReadingHistory = async ({
  nozzleId,
  startDate,
  endDate,
  limit = 100,
  offset = 0,
  useCache = true
}) => {
  const startTime = Date.now();
  const cacheKey = CacheKeyGenerator.query(
    CacheKeyGenerator.NAMESPACES.READING,
    { nozzleId, startDate, endDate },
    { limit, offset }
  );

  if (useCache) {
    const cached = queryCache.cache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    const where = { nozzleId };
    if (startDate || endDate) {
      where.readingDate = {};
      if (startDate) where.readingDate[Op.gte] = startDate;
      if (endDate) where.readingDate[Op.lte] = endDate;
    }

    const result = await NozzleReading.findAndCountAll({
      where,
      attributes: ['id', 'readingValue', 'readingDate', 'litresSold', 'totalAmount', 'isSample'],
      order: [['readingDate', 'DESC']],
      limit,
      offset,
      raw: true,
      subQuery: false
    });

    const executionTime = Date.now() - startTime;
    perfLogger.logQuery('getNozzleReadingHistory', executionTime, {
      total: result.count,
      returned: result.rows.length
    });

    if (useCache) {
      queryCache.cache.set(cacheKey, result, 600000); // 10 minutes
    }

    return result;
  } catch (error) {
    logger.error('Error fetching nozzle reading history', { error });
    throw error;
  }
};

/**
 * Invalidate relevant caches when reading is modified
 */
exports.invalidateReadingCaches = (stationId, nozzleId) => {
  logger.info('Invalidating reading caches', { stationId, nozzleId });
  
  queryCache.invalidatePattern(`${CacheKeyGenerator.NAMESPACES.READING}:`);
  queryCache.invalidatePattern(`${CacheKeyGenerator.NAMESPACES.DASHBOARD}:`);
  queryCache.invalidatePattern(`${CacheKeyGenerator.NAMESPACES.NOZZLE}:${nozzleId}`);
};

/**
 * Get performance metrics
 */
exports.getPerformanceMetrics = () => {
  return {
    queryStats: perfLogger.getStats(),
    cacheStats: queryCache.getStats()
  };
};

/**
 * Reset performance metrics
 */
exports.resetPerformanceMetrics = () => {
  perfLogger.reset();
  queryCache.cache.resetStats();
};
