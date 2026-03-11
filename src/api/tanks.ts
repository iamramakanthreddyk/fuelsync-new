/**
 * Tanks API
 * Single source of truth for tank and refill API calls.
 * Only this file (and other src/api/ modules) should import from api-client.
 */

import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';
import type { Tank, TankRefill } from '@/types/api';

export const tankApi = {
  /** GET /stations/:stationId/tanks */
  getAll: (stationId: string) =>
    apiClient.get<ApiResponse<Tank[]>>(`/stations/${stationId}/tanks`),

  /** GET /tanks/:id */
  get: (tankId: string) => apiClient.get<ApiResponse<Tank>>(`/tanks/${tankId}`),

  /** GET /tanks/warnings */
  getWarnings: () => apiClient.get<ApiResponse<Tank[]>>('/tanks/warnings'),

  /** POST /stations/:stationId/tanks */
  create: (stationId: string, data: Partial<Tank>) =>
    apiClient.post<ApiResponse<Tank>>(`/stations/${stationId}/tanks`, data),

  /** PUT /tanks/:id */
  update: (tankId: string, data: Partial<Tank>) =>
    apiClient.put<ApiResponse<Tank>>(`/tanks/${tankId}`, data),

  /** POST /tanks/:id/refill */
  recordRefill: (tankId: string, data: Partial<TankRefill>) =>
    apiClient.post<ApiResponse<TankRefill>>(`/tanks/${tankId}/refill`, data),

  /** POST /tanks/:id/calibrate */
  calibrate: (tankId: string, data: { dipReading: number; date?: string; notes?: string }) =>
    apiClient.post<ApiResponse<Tank>>(`/tanks/${tankId}/calibrate`, data),

  /** GET /tanks/:id/refills */
  getRefills: (
    tankId: string,
    params?: { startDate?: string; endDate?: string; page?: number; limit?: number }
  ) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return apiClient.get<ApiResponse<TankRefill[]>>(
      `/tanks/${tankId}/refills${q ? `?${q}` : ''}`
    );
  },
};
