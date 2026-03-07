/**
 * Legacy API service wrapper (minimal)
 */

import { apiClient, ApiResponse } from '@/lib/api-client';

export const apiService = {
  async rawGet<T = any>(url: string) {
    const res = await apiClient.get<ApiResponse<T>>(url);
    if (res.success) return res.data as T;
    throw new Error(res.error?.message || 'API error');
  }
};

export default apiService;
