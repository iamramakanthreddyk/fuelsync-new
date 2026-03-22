/**
 * Pagination Helper Utility
 * 
 * Centralized pagination logic to avoid duplication across controllers
 * Used by: readingController, creditController, expenseController, userController, etc.
 * 
 * PROBLEM SOLVED:
 * - Pagination logic repeated 20+ times across controllers
 * - Each controller had identical offset/limit calculations
 * - Inconsistent response formatting
 * 
 * SOLUTION:
 * - Single source of truth for pagination
 * - Consistent response format everywhere
 * - Easy to update pagination logic globally
 */

const { Op } = require('sequelize');

/**
 * Parse pagination params from request query
 * @param {number} [page=1] - Current page (1-indexed)
 * @param {number} [limit=20] - Items per page
 * @param {number} [maxLimit=100] - Maximum allowed limit
 * @returns {Object} { page, limit, offset }
 */
const getPaginationParams = (page = 1, limit = 20, maxLimit = 100) => {
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(parseInt(limit) || 20, maxLimit);
  
  return {
    page: parsedPage,
    limit: parsedLimit,
    offset: (parsedPage - 1) * parsedLimit
  };
};

/**
 * Create Sequelize pagination options for findAndCountAll
 * @param {number} [page=1] - Current page
 * @param {number} [limit=20] - Items per page
 * @param {number} [maxLimit=100] - Maximum allowed limit
 * @returns {Object} { limit, offset }
 */
const getPaginationOptions = (page = 1, limit = 20, maxLimit = 100) => {
  const { limit: parsedLimit, offset } = getPaginationParams(page, limit, maxLimit);
  return { limit: parsedLimit, offset };
};

/**
 * Format paginated response with metadata
 * @param {Array} data - Array of records
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} { data, pagination }
 */
const formatPaginatedResponse = (data, total, page = 1, limit = 20) => {
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.max(1, parseInt(limit) || 20);
  
  return {
    data,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      pages: Math.ceil(total / parsedLimit) || 1,
      hasNext: parsedPage < Math.ceil(total / parsedLimit),
      hasPrev: parsedPage > 1
    }
  };
};

/**
 * Parse and apply sort options
 * @param {string} [sortBy='createdAt'] - Field to sort by
 * @param {string} [order='DESC'] - ASC or DESC
 * @param {Array} [allowedFields] - Whitelisted fields (security)
 * @returns {Object} Sequelize order array
 */
const getSortOptions = (sortBy = 'createdAt', order = 'DESC', allowedFields = []) => {
  // Default allowed fields if not specified
  if (!allowedFields || allowedFields.length === 0) {
    allowedFields = ['createdAt', 'updatedAt', 'id', 'name', 'date'];
  }
  
  const field = allowedFields.includes(sortBy) ? sortBy : 'createdAt';
  const direction = ['ASC', 'DESC'].includes(order?.toUpperCase()) ? order.toUpperCase() : 'DESC';
  
  return [[field, direction]];
};

/**
 * Complete pagination middleware for controllers
 * Usage: const { data, pagination } = await paginateQuery(Model, where, req.query, { allowedFields })
 * @param {Model} model - Sequelize model
 * @param {Object} where - Where clause
 * @param {Object} queryParams - req.query object
 * @param {Object} options - { allowedFields, maxLimit, include, attributes }
 * @returns {Promise<Object>} { data, pagination }
 */
const paginateQuery = async (model, where = {}, queryParams = {}, options = {}) => {
  const {
    allowedFields = ['createdAt', 'updatedAt'],
    maxLimit = 100,
    include = null,
    raw = false,
    subQuery = false
  } = options;

  const { page, limit, offset } = getPaginationParams(
    queryParams.page,
    queryParams.limit,
    maxLimit
  );

  const sortOptions = getSortOptions(queryParams.sortBy, queryParams.order, allowedFields);

  const findOptions = {
    where,
    limit,
    offset,
    order: sortOptions,
    raw,
    subQuery,
    ...(include && { include })
  };

  const { count, rows } = await model.findAndCountAll(findOptions);

  return formatPaginatedResponse(rows, count, page, limit);
};

module.exports = {
  getPaginationParams,
  getPaginationOptions,
  formatPaginatedResponse,
  getSortOptions,
  paginateQuery
};
