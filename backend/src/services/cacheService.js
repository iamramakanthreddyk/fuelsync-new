/**
 * Advanced Caching Service
 * Multi-layered caching: Memory cache first, optional Redis fallback
 * Features:
 * - Automatic expiration
 * - Cache invalidation patterns
 * - Metrics and monitoring
 * - Query result caching
 */

const { createContextLogger } = require('./loggerService');

const logger = createContextLogger('CacheService');

/**
 * Memory-based cache layer (primary)
 * Fast in-process cache with TTL support
 */
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlMs - Time to live in milliseconds
   * @returns {void}
   */
  set(key, value, ttlMs = 3600000) { // Default 1 hour
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Calculate expiration
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;

    // Store in cache
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    });

    // Set auto-cleanup timer
    if (ttlMs) {
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttlMs);

      this.timers.set(key, timer);
    }
  }

  /**
   * Delete from cache
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries matching pattern
   * @param {string|RegExp} pattern - Key pattern to match
   */
  deletePattern(pattern) {
    const regex = typeof pattern === 'string' ? new RegExp(`^${pattern}`) : pattern;
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Check if key exists
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear entire cache
   */
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.hits + this.misses > 0
      ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(2)
      : 0;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      totalRequests: this.hits + this.misses
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Cache Key Generator
 * Provides consistent key naming across application
 */
class CacheKeyGenerator {
  // Namespace prefixes
  static NAMESPACES = {
    READING: 'reading',
    NOZZLE: 'nozzle',
    STATION: 'station',
    PUMP: 'pump',
    DASHBOARD: 'dashboard',
    AGGREGATION: 'agg',
    TRANSACTION: 'txn',
    SETTLEMENT: 'settlement'
  };

  /**
   * Generate cache key for entity
   * @param {string} namespace - Cache namespace
   * @param {string|number} id - Entity ID
   * @param {string} variant - Optional variant (e.g., 'full', 'summary')
   * @returns {string} Cache key
   */
  static entity(namespace, id, variant = '') {
    const base = `${namespace}:${id}`;
    return variant ? `${base}:${variant}` : base;
  }

  /**
   * Generate cache key for collection query
   * @param {string} namespace - Cache namespace
   * @param {Object} filters - Query filters
   * @param {Object} pagination - Pagination params
   * @returns {string} Cache key
   */
  static query(namespace, filters = {}, pagination = {}) {
    const filterStr = Object.entries(filters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
      .join('|');

    const pageStr = `page:${pagination.page || 0}:limit:${pagination.limit || 50}`;

    return filterStr
      ? `${namespace}:query:${pageStr}:${filterStr}`
      : `${namespace}:query:${pageStr}`;
  }

  /**
   * Generate cache key for aggregation
   * @param {string} namespace - Aggregation namespacelike 'dashboard'
   * @param {string} metric - Metric name like 'dailySalesTotal'
   * @param {string} stationId - Station ID
   * @param {string} dateRange - Date range like '2024-01-01:2024-01-31'
   * @returns {string} Cache key
   */
  static aggregation(namespace, metric, stationId, dateRange) {
    return `${namespace}:${metric}:${stationId}:${dateRange}`;
  }

  /**
   * Generate pattern for cache invalidation
   * @param {string} namespace - Namespace to invalidate
   * @param {string} entityId - Optional entity ID (invalidates specific entity)
   * @returns {string} Pattern for deletePattern()
   */
  static invalidationPattern(namespace, entityId = '') {
    return entityId ? `${namespace}:${entityId}` : `${namespace}:`;
  }
}

/**
 * Cache Invalidation Manager
 * Coordinates cache invalidation across dependent caches
 */
class CacheInvalidationManager {
  constructor(cache) {
    this.cache = cache;
    this.dependencies = new Map();
    this.registerDefaultDependencies();
  }

  /**
   * Register cache dependencies
   * When key A is invalidated, also invalidate related keys
   * @param {string} invalidatedKey - Key being invalidated
   * @param {Array<string|RegExp>} dependentPatterns - Patterns that depend on it
   */
  registerDependency(invalidatedKey, dependentPatterns) {
    this.dependencies.set(invalidatedKey, dependentPatterns);
  }

  /**
   * Default dependency mappings
   */
  registerDefaultDependencies() {
    // When a nozzle changes, invalidate related caches
    this.registerDependency('nozzle:', [
      'reading:', // Readings depend on nozzle
      'dashboard:', // Dashboard aggregations
      'agg:' // Aggregations
    ]);

    // When readings change, invalidate dashboard
    this.registerDependency('reading:', [
      'dashboard:',
      'agg:',
      'txn:'
    ]);

    // When transactions change, invalidate related data
    this.registerDependency('txn:', [
      'dashboard:',
      'agg:',
      'settlement:'
    ]);
  }

  /**
   * Invalidate cache and all dependent caches
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    logger.info('Invalidating cache', { key });
    
    // Remove primary key
    this.cache.delete(key);

    // Invalidate dependent patterns
    const dependentPatterns = this.dependencies.get(key) || [];
    dependentPatterns.forEach(pattern => {
      const count = this.cache.deletePattern(pattern);
      logger.debug('Invalidated dependent pattern', { pattern, count });
    });
  }

  /**
   * Invalidate all caches matching namespace
   * @param {string} namespace - Namespace prefix
   */
  invalidateNamespace(namespace) {
    const count = this.cache.deletePattern(`^${namespace}:`);
    logger.info('Invalidated namespace', { namespace, count });
    return count;
  }
}

/**
 * Query Result Cache Decorator
 * Wraps query functions with automatic caching
 */
class QueryCache {
  constructor(cache) {
    this.cache = cache;
    this.invalidationMgr = new CacheInvalidationManager(cache);
  }

  /**
   * Wrap a query function with caching
   * @param {Function} queryFn - Async query function
   * @param {string} cacheKey - Cache key
   * @param {number} ttlMs - Cache TTL in milliseconds
   * @param {Function} invalidationFn - Optional function to determine invalidation on mutation
   * @returns {Promise} Query result
   */
  async withCache(queryFn, cacheKey, ttlMs = 3600000, invalidationFn = null) {
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      logger.debug('Cache hit', { cacheKey });
      return cached;
    }

    logger.debug('Cache miss, executing query', { cacheKey });

    // Execute query
    const result = await queryFn();

    // Store in cache
    this.cache.set(cacheKey, result, ttlMs);

    // Register invalidation if provided
    if (invalidationFn) {
      const invalidationKey = invalidationFn(result);
      this.invalidationMgr.registerDependency(invalidationKey, [cacheKey]);
    }

    return result;
  }

  /**
   * Cache a query with automatic key generation
   * @param {Function} queryFn - Async query function
   * @param {string} namespace - Cache namespace
   * @param {Object} keyParams - Parameters for key generation
   * @param {number} ttlMs - Cache TTL
   * @returns {Promise} Query result
   */
  async cached(queryFn, namespace, keyParams, ttlMs = 3600000) {
    const cacheKey = CacheKeyGenerator.query(namespace, keyParams);
    return this.withCache(queryFn, cacheKey, ttlMs);
  }

  /**
   * Invalidate by namespace
   */
  invalidateNamespace(namespace) {
    return this.invalidationMgr.invalidateNamespace(namespace);
  }

  /**
   * Invalidate by pattern
   */
  invalidatePattern(pattern) {
    return this.cache.deletePattern(pattern);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }
}

/**
 * Singleton cache instance
 */
const globalCache = new MemoryCache();
const queryCache = new QueryCache(globalCache);

module.exports = {
  MemoryCache,
  CacheKeyGenerator,
  CacheInvalidationManager,
  QueryCache,
  // Singletons for application-wide use
  cache: globalCache,
  queryCache
};
