/**
 * Utility functions for converting between snake_case and camelCase
 * Ensures consistent API responses across the entire backend
 */

/**
 * Convert a snake_case string to camelCase
 * @param {string} str - Snake case string
 * @returns {string} Camel case string
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a camelCase string to snake_case
 * @param {string} str - Camel case string
 * @returns {string} Snake case string
 */
function camelToSnake(str) {
  return str.replace(/([A-Z])/g, (_, letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert an object with snake_case keys to camelCase keys recursively
 * @param {any} obj - Object to convert
 * @returns {any} Converted object
 */
function convertKeysToCamelCase(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToCamelCase(item));
  }

  const camelCaseObj = {};
  
  Object.keys(obj).forEach(key => {
    const camelKey = snakeToCamel(key);
    const value = obj[key];
    
    // Recursively convert nested objects
    if (value !== null && typeof value === 'object') {
      camelCaseObj[camelKey] = convertKeysToCamelCase(value);
    } else {
      camelCaseObj[camelKey] = value;
    }
  });
  
  return camelCaseObj;
}

/**
 * Convert an object with camelCase keys to snake_case keys recursively
 * @param {any} obj - Object to convert
 * @returns {any} Converted object
 */
function convertKeysToSnakeCase(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToSnakeCase(item));
  }

  const snakeCaseObj = {};
  
  Object.keys(obj).forEach(key => {
    const snakeKey = camelToSnake(key);
    const value = obj[key];
    
    // Recursively convert nested objects
    if (value !== null && typeof value === 'object') {
      snakeCaseObj[snakeKey] = convertKeysToSnakeCase(value);
    } else {
      snakeCaseObj[snakeKey] = value;
    }
  });
  
  return snakeCaseObj;
}

/**
 * Transform database query results to camelCase
 * @param {any} result - Database result
 * @returns {any} Transformed result
 */
function transformDbResult(result) {
  if (!result) {
    return result;
  }

  // Handle Sequelize model instance
  if (result.dataValues) {
    return convertKeysToCamelCase(result.dataValues);
  }

  // Handle direct array of rows
  if (Array.isArray(result)) {
    return result.map(row => {
      if (row.dataValues) {
        return convertKeysToCamelCase(row.dataValues);
      }
      return convertKeysToCamelCase(row);
    });
  }

  // Handle single object
  return convertKeysToCamelCase(result);
}

/**
 * Middleware to automatically convert response data to camelCase
 */
function camelCaseResponseMiddleware() {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Convert the response data to camelCase
      const convertedData = convertKeysToCamelCase(data);
      return originalJson.call(this, convertedData);
    };
    
    next();
  };
}

module.exports = {
  snakeToCamel,
  camelToSnake,
  convertKeysToCamelCase,
  convertKeysToSnakeCase,
  transformDbResult,
  camelCaseResponseMiddleware
};
