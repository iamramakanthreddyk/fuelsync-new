/**
 * Middleware to normalize request body from snake_case to camelCase
 * This allows the API to accept both snake_case and camelCase field names
 */

const toCamelCase = (str) => {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
};

const toCamelCaseObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCaseObject(item));
  }
  
  const newObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = toCamelCase(key);
      const value = obj[key];
      newObj[camelKey] = typeof value === 'object' && value !== null && !Array.isArray(value)
        ? toCamelCaseObject(value)
        : Array.isArray(value)
        ? value.map(item => typeof item === 'object' ? toCamelCaseObject(item) : item)
        : value;
    }
  }
  return newObj;
};

/**
 * Express middleware to normalize request body
 * Converts snake_case keys to camelCase for validation and processing
 */
const normalizeRequestBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = toCamelCaseObject(req.body);
  }
  next();
};

module.exports = normalizeRequestBody;
