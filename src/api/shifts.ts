/**
 * Shifts API
 * Single source of truth for shift-related API calls.
 * Only this file (and other src/api/ modules) should import from api-client.
 */

import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';
import type { Shift, StartShiftRequest, EndShiftRequest } from '@/types/api';

export const shiftApi = {
  /** GET /shifts/my/active */
  getActive: () => apiClient.get<ApiResponse<Shift | null>>('/shifts/my/active'),

  /** GET /stations/:stationId/shifts */
  getForStation: (stationId: string) =>
    apiClient.get<ApiResponse<Shift[]>>(`/stations/${stationId}/shifts`),

  /** POST /shifts */
  start: (data: StartShiftRequest) => apiClient.post<ApiResponse<Shift>>('/shifts', data),

  /** PUT /shifts/:id/end */
  end: (id: number, data: EndShiftRequest) =>
    apiClient.put<ApiResponse<Shift>>(`/shifts/${id}/end`, data),
};
