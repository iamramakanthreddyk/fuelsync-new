import apiClient from './api-client';
import { ApiError } from './api-client';

export type NormalizedSuccess<T> = { success: true; data: T; raw?: unknown };
export type NormalizedFailure = { success: false; error: { message: string; code?: string; details?: unknown }; statusCode?: number; raw?: unknown };
export type NormalizedResponse<T> = NormalizedSuccess<T> | NormalizedFailure;

async function normalize<T>(p: Promise<unknown>): Promise<NormalizedResponse<T>> {
  try {
    const res = await p;

    // If server returned an envelope with `success` flag, respect it
    if (res && typeof res === 'object' && 'success' in (res as any)) {
      const env = res as any;
      if (env.success) {
        return { success: true, data: env.data as T, raw: env };
      }

      // env.success === false
      const errorObj = env.error || { message: env.message || 'Request failed' };
      const errMsg = typeof errorObj === 'string' ? { message: errorObj } : (errorObj as any);
      return { success: false, error: { message: errMsg.message || 'Request failed', code: errMsg.code, details: errMsg.details }, raw: env };
    }

    // Otherwise, treat returned value as raw data
    return { success: true, data: res as T, raw: res };
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, error: { message: err.message, code: err.code, details: err.details }, statusCode: err.statusCode };
    }

    // Fallback
    const message = err && (err as any).message ? (err as any).message : String(err);
    return { success: false, error: { message }, statusCode: (err as any)?.status || undefined };
  }
}

export const api = {
  get: <T>(endpoint: string, options?: any) => normalize<T>(apiClient.get(endpoint, options)),
  post: <T>(endpoint: string, data?: unknown, options?: any) => normalize<T>(apiClient.post(endpoint, data, options)),
  put: <T>(endpoint: string, data?: unknown, options?: any) => normalize<T>(apiClient.put(endpoint, data, options)),
  patch: <T>(endpoint: string, data?: unknown, options?: any) => normalize<T>(apiClient.patch(endpoint, data, options)),
  delete: <T>(endpoint: string, options?: any) => normalize<T>(apiClient.delete(endpoint, options)),
};

export default api;
