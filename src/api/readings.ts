/**
 * Readings API
 * Single source of truth for nozzle reading API calls.
 * Only this file (and other src/api/ modules) should import from api-client.
 */

import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';
import type { NozzleReading, PreviousReadingResponse, SubmitReadingRequest } from '@/types/api';

export const readingApi = {
  /** GET /readings/nozzles/:nozzleId/previous?date=... */
  getPrevious: (nozzleId: string, date?: string) => {
    const url = date
      ? `/readings/nozzles/${nozzleId}/previous?date=${date}`
      : `/readings/nozzles/${nozzleId}/previous`;
    return apiClient.get<PreviousReadingResponse>(url);
  },

  /** GET /readings/daily?stationId=...&date=... */
  getDaily: (stationId: string, date: string) =>
    apiClient.get<ApiResponse<NozzleReading[]>>(
      `/readings/daily?stationId=${stationId}&date=${date}`
    ),

  /** POST /readings */
  submit: (data: SubmitReadingRequest) =>
    apiClient.post<ApiResponse<NozzleReading>>('/readings', data),
};
