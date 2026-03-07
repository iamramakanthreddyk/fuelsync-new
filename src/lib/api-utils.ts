// Small helpers to safely handle API responses that may be
// normalized into { success: true, data: T } or raw arrays/objects.
export function isApiSuccess<T = any>(v: any): v is { success: true; data: T } {
  return Boolean(v && typeof v === 'object' && v.success === true && 'data' in v);
}

export function unwrapDataOrArray<T = any>(resp: any, fallback: T[] = []): T[] {
  if (!resp) return fallback;
  if (isApiSuccess<T[]>(resp) && Array.isArray(resp.data)) return resp.data as T[];
  if (Array.isArray(resp)) return resp as T[];
  return fallback;
}

export function unwrapDataOrObject<T = any>(resp: any, fallback: T | null = null): T | null {
  if (!resp) return fallback;
  if (isApiSuccess<T>(resp) && resp.data !== undefined) return resp.data as T;
  if (resp && typeof resp === 'object' && !Array.isArray(resp)) return resp as T;
  return fallback;
}

export default {
  isApiSuccess,
  unwrapDataOrArray,
  unwrapDataOrObject
};
