/**
 * Query Optimizer Utility
 * Provides common query optimization patterns:
 * - Pagination helpers with cursor/offset support
 * - Query batching to prevent N+1 queries
 * - Eager loading optimization
 * - Field projection (SELECT only needed columns)
 */

const { Op } = require('sequelize');

/**
 * Standard pagination response builder
 * Normalizes pagination across all endpoints
 */
class PaginationHelper {
  /**
   * Parse pagination params from request
   * @param {Object} query - Request query params
   * @param {number} defaultLimit - Default limit (default 50)
   * @param {number} maxLimit - Maximum allowed limit (default 500)
   * @returns {Object} { limit, offset, page, sort }
   */
  static parsePaginationParams(query, defaultLimit = 50, maxLimit = 500) {
    let limit = parseInt(query.limit, 10) || defaultLimit;
    let offset = parseInt(query.offset, 10) || 0;
    
    // Enforce max limit
    if (limit > maxLimit) limit = maxLimit;
    if (limit < 1) limit = 1;
    if (offset < 0) offset = 0;

    const page = Math.floor(offset / limit) + 1;
    const sort = query.sort || 'createdAt:DESC';

    return { limit, offset, page, sort };
  }

  /**
   * Build sort clause from sort string
   * Format: "field1:ASC,field2:DESC"
   * @param {string} sortStr - Sort string
   * @returns {Array} Sequelize order clause
   */
  static buildSortClause(sortStr) {
    if (!sortStr) return [['createdAt', 'DESC']];

    return sortStr.split(',').map(s => {
      const [field, direction] = s.split(':');
      return [field, (direction || 'ASC').toUpperCase()];
    });
  }

  /**
   * Build paginated response
   * @param {Object} queryResult - Result from findAndCountAll
   * @param {Object} paginationParams - Pagination params
   * @returns {Object} Normalized response with metadata
   */
  static buildPaginatedResponse(queryResult, paginationParams) {
    const { count, rows } = queryResult;
    const { limit, offset, page } = paginationParams;
    
    const totalPages = Math.ceil(count / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        offset,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        nextOffset: hasNextPage ? offset + limit : null,
        prevOffset: hasPreviousPage ? Math.max(0, offset - limit) : null
      }
    };
  }
}

/**
 * Batch Query Provider
 * Groups multiple queries into single optimized queries
 */
class BatchQueryHelper {
  /**
   * Fetch multiple items by IDs in a single query
   * Prevents N+1 when fetching related items
   * @param {Function} findFn - Sequelize findAll function
   * @param {Array} ids - Array of IDs to fetch
   * @param {Object} options - Query options (where, include, attributes, etc.)
   * @returns {Promise<Map>} Map of id -> item
   */
  static async fetchByIds(findFn, ids, options = {}) {
    if (!ids || ids.length === 0) return new Map();

    const items = await findFn({
      ...options,
      where: {
        ...options.where,
        id: { [Op.in]: ids }
      }
    });

    // Return as Map for O(1) lookups
    const map = new Map();
    items.forEach(item => {
      map.set(item.id, item);
    });
    return map;
  }

  /**
   * Batch fetch relations for multiple parent items
   * Prevents N+1 when loading child relations across multiple parents
   * 
   * @param {Array} parentItems - Parent items already fetched
   * @param {string} parentIdField - Field name in parent (usually 'id')
   * @param {Function} fetchRelationsFn - Async function to fetch relations
   * @param {string} relationKey - Key to attach relations to parent
   * @returns {Promise<Array>} Parent items with relations attached
   */
  static async batchLoadRelations(parentItems, parentIdField, fetchRelationsFn, relationKey) {
    if (parentItems.length === 0) return parentItems;

    // Extract parent IDs
    const parentIds = parentItems.map(item => item[parentIdField]);

    // Fetch all related items in one query
    const relationMap = await fetchRelationsFn(parentIds);

    // Attach relations to parents
    return parentItems.map(parent => ({
      ...parent,
      [relationKey]: relationMap.get(parent[parentIdField]) || []
    }));
  }

  /**
   * Aggregate calculation for batch of items
   * Example: Calculate total for multiple stations in one query
   * @param {Function} aggregateFn - Function that performs aggregation
   * @param {Array} ids - IDs to aggregate
   * @returns {Promise<Map>} Map of id -> aggregated value
   */
  static async batchAggregate(aggregateFn, ids) {
    if (!ids || ids.length === 0) return new Map();

    const results = await aggregateFn(ids);
    const map = new Map();
    
    results.forEach(result => {
      map.set(result.id, result.value);
    });
    return map;
  }
}

/**
 * Eager Loading Optimizer
 * Prevents N+1 and memory issues by smart include strategies
 */
class EagerLoadingOptimizer {
  /**
   * Deep include configuration with field limiting
   * @param {Array} baseIncludes - Base include array
   * @param {Set} requiredFields - Fields needed in response
   * @returns {Array} Optimized include with field projections
   */
  static optimizeIncludes(baseIncludes, requiredFields = null) {
    return baseIncludes.map(include => {
      const optimized = { ...include };

      // Only fetch needed fields if requiredFields specified
      if (requiredFields && include.attributes !== undefined) {
        optimized.attributes = include.attributes.filter(field =>
          requiredFields.has(field) || requiredFields.has(`${include.model.name}.${field}`)
        );
      }

      // Recursively optimize nested includes
      if (include.include) {
        optimized.include = this.optimizeIncludes(include.include, requiredFields);
      }

      return optimized;
    });
  }

  /**
   * Build safe include with limits to prevent memory issues
   * @param {Array} includes - Sequelize include clauses
   * @param {number} maxRows - Max rows to fetch per include (default 1000)
   * @returns {Array} Include with limits
   */
  static limitIncludes(includes, maxRows = 1000) {
    return includes.map(include => ({
      ...include,
      limit: include.limit || maxRows,
      separate: include.separate !== false // Use separate queries for large includes
    }));
  }

  /**
   * Single vs separate include strategy
   * Use separate: true for large collections to avoid memory bloat
   * @param {Object} include - Include object
   * @param {number} expectedRowCount - Expected number of related rows
   * @returns {Object} Include with optimized separate flag
   */
  static optimizeSeparateStrategy(include, expectedRowCount = 100) {
    const needsSeparate = expectedRowCount > 100; // Threshold
    
    return {
      ...include,
      separate: needsSeparate,
      limit: needsSeparate ? 1000 : undefined
    };
  }
}

/**
 * Field Projection Helper
 * Only SELECT needed columns from database
 */
class ProjectionHelper {
  /**
   * Build attributes array from requested fields
   * @param {Array} requestedFields - Fields user requested (e.g., ['id', 'name', 'email'])
   * @param {Array} allowedFields - Fields safe to return
   * @param {Array} defaultFields - Fields to include by default
   * @returns {Array} Sequelize attributes array
   */
  static buildProjection(requestedFields, allowedFields, defaultFields) {
    if (!requestedFields || requestedFields.length === 0) {
      return defaultFields;
    }

    const fields = new Set(defaultFields);
    
    requestedFields.forEach(field => {
      if (allowedFields.includes(field)) {
        fields.add(field);
      }
    });

    return Array.from(fields);
  }

  /**
   * Common field presets for quick projection
   */
  static PRESETS = {
    ID_ONLY: ['id'],
    BASIC: ['id', 'name', 'label', 'createdAt'],
    FULL: null // Include all fields
  };
}

/**
 * Query Performance Logger
 * Track slow queries for optimization
 */
class QueryPerformanceLogger {
  constructor() {
    this.slowQueryThreshold = 1000; // 1 second in ms
    this.queries = [];
  }

  /**
   * Log query with execution time
   * @param {string} queryName - Name for this query
   * @param {number} executionTime - Time in milliseconds
   * @param {Object} details - Additional details (row count, filters, etc.)
   */
  logQuery(queryName, executionTime, details = {}) {
    const query = {
      name: queryName,
      time: executionTime,
      isSlow: executionTime > this.slowQueryThreshold,
      details,
      timestamp: new Date()
    };

    this.queries.push(query);

    if (query.isSlow) {
      console.warn(`[SLOW QUERY] ${queryName}: ${executionTime}ms`, details);
    }
  }

  /**
   * Get slow queries for analysis
   */
  getSlowQueries() {
    return this.queries.filter(q => q.isSlow);
  }

  /**
   * Get query statistics
   */
  getStats() {
    const total = this.queries.length;
    const slow = this.queries.filter(q => q.isSlow).length;
    const avgTime = this.queries.reduce((sum, q) => sum + q.time, 0) / total;

    return {
      totalQueries: total,
      slowQueries: slow,
      slowQueryPercentage: ((slow / total) * 100).toFixed(2),
      averageTime: avgTime.toFixed(2),
      slowUeries: this.getSlowQueries()
    };
  }

  /**
   * Reset stats
   */
  reset() {
    this.queries = [];
  }
}

module.exports = {
  PaginationHelper,
  BatchQueryHelper,
  EagerLoadingOptimizer,
  ProjectionHelper,
  QueryPerformanceLogger
};
