/**
 * Users API
 * Single source of truth for user management API calls.
 * Only this file (and other src/api/ modules) should import from api-client.
 */

import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';
import type { Sale, User } from '@/types/api';

export const userApi = {
  /** GET /auth/me — see also authApi.me() in auth.ts */
  getMe: () => apiClient.get<ApiResponse<User>>('/auth/me'),

  /** POST /users */
  create: (data: Partial<User> & { password: string }) =>
    apiClient.post<ApiResponse<User>>('/users', data),
};

export const salesApi = {
  /** GET /sales?station_id=...&date=... (or start_date / end_date) */
  get: (params?: {
    stationId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.stationId) qs.set('station_id', params.stationId);
    if (params?.startDate && params?.endDate) {
      qs.set('start_date', params.startDate);
      qs.set('end_date', params.endDate);
    } else if (params?.date) {
      qs.set('date', params.date);
    }
    const q = qs.toString();
    return apiClient.get<ApiResponse<Sale[]>>(`/sales${q ? `?${q}` : ''}`);
  },
};
