// Utilities to convert object keys between snake_case and camelCase
function toCamel(s: string) {
  return s.replace(/_([a-z0-9])/g, (_m, p1) => p1.toUpperCase());
}

function toSnake(s: string) {
  return s.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
}

export function convertKeysToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToCamel);
  if (typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const newKey = toCamel(key);
      out[newKey] = convertKeysToCamel(value);
    }
    return out;
  }
  return obj;
}

export function convertKeysToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToSnake);
  if (typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const newKey = toSnake(key);
      out[newKey] = convertKeysToSnake(value);
    }
    return out;
  }
  return obj;
}

export default {
  convertKeysToCamel,
  convertKeysToSnake,
};
