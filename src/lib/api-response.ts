/**
 * API Response Utility
 * Standardizes extraction and handling of API responses across the frontend
 * Ensures consistent data extraction from {success, data} wrapped responses
 */

/**
 * Extract data from API response
 * Handles both wrapped {success, data} and unwrapped data
 * @param {any} response - API response that might be wrapped or unwrapped
 * @param {any} fallback - Fallback value if extraction fails (default: null)
 * @returns {any} Extracted data or fallback
 */
export function extractApiData(response: any, fallback: any = null): any {
  if (!response) return fallback;

  // If response has a data property, it's wrapped: {success, data}
  if ('data' in response && typeof response === 'object') {
    return response.data !== undefined ? response.data : fallback;
  }

  // Otherwise it's already unwrapped
  return response || fallback;
}

/**
 * Extract array data from API response
 * Ensures result is always an array
 * @param {any} response - API response
 * @param {array} fallback - Fallback array (default: [])
 * @returns {array} Extracted array or fallback
 */
export function extractApiArray(response: any, fallback: any[] = []): any[] {
  const data = extractApiData(response, fallback);
  return Array.isArray(data) ? data : fallback;
}

/**
 * Extract nested data from API response
 * Useful for endpoints returning {success, data: {current, history}}
 * @param {any} response - API response
 * @param {string} path - Dot-separated path (e.g., 'current' or 'data.current')
 * @param {any} fallback - Fallback value
 * @returns {any} Extracted nested data or fallback
 */
export function extractNestedData(response: any, path: string, fallback: any = null): any {
  const data = extractApiData(response, null);
  if (!data) return fallback;

  // Split path and traverse object
  const keys = path.split('.');
  let current = data;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return fallback;
    }
  }

  return current || fallback;
}

/**
 * Type guard to check if response is wrapped
 * @param {any} response - Response to check
 * @returns {boolean} True if response has {success, data} structure
 */
export function isWrappedResponse(response: any): boolean {
  return (
    response &&
    typeof response === 'object' &&
    'success' in response &&
    'data' in response
  );
}

/**
 * Safely access response data with logging
 * @param {any} response - API response
 * @param {string} context - Context for debugging (optional)
 * @returns {any} Extracted data
 */
export function safeExtractData(response: any, context: string = ''): any {
  const data = extractApiData(response, null);

  return data;
}

/**
 * Create a handler function for query transformations
 * @param {Function} transformer - Function to transform extracted data
 * @returns {Function} Query transformation function
 */
export function createResponseTransformer(transformer: (data: any) => any) {
  return (response: any) => {
    const data = extractApiData(response, null);
    return transformer(data);
  };
}

export default {
  extractApiData,
  extractApiArray,
  extractNestedData,
  isWrappedResponse,
  safeExtractData,
  createResponseTransformer
};
