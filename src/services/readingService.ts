/**
 * Reading Service
 * Handles nozzle reading related API calls
 */

import { apiClient, ApiResponse } from '@/lib/api-client';

export interface NozzleReading {
  id: string;
  nozzleId: string;
  stationId: string;
  reading: number;
  recordedAt: string; // ISO date
  createdAt: string;
  updatedAt: string;
  userId?: string;
  paymentType?: string;
  creditorId?: string | null;
  notes?: string;
}

export interface PreviousReadingInfo {
  reading: number;
  recordedAt?: string;
}

export interface SubmitReadingRequest {
  nozzleId: string;
  stationId: string;
  reading: number;
  recordedAt?: string;
  shiftId?: number | null;
  paymentType?: string;
  creditorId?: string | null;
  notes?: string;
}

export interface ReadingFilters {
  stationId?: string;
  nozzleId?: string;
  startDate?: string;
  endDate?: string;
}

export const readingService = {
  async getPreviousReading(nozzleId: string, date?: string): Promise<PreviousReadingInfo | null> {
    try {
      const url = date ? `/readings/nozzles/${nozzleId}/previous?date=${date}` : `/readings/nozzles/${nozzleId}/previous`;
      const response = await apiClient.get<ApiResponse<PreviousReadingInfo>>(url);
      if (response.success && response.data) return response.data;
      return null;
    } catch {
      return null;
    }
  },

  async getDailyReadings(stationId: string, date: string): Promise<NozzleReading[]> {
    const response = await apiClient.get<ApiResponse<NozzleReading[]>>(`/readings/daily?stationId=${stationId}&date=${date}`);
    if (response.success && response.data) return response.data;
    return [];
  },

  async submitReading(data: SubmitReadingRequest): Promise<NozzleReading> {
    const response = await apiClient.post<ApiResponse<NozzleReading>>('/readings', data);
    if (!response.success || !response.data) throw new Error('Failed to submit reading');
    return response.data;
  },

  async listReadings(filters: ReadingFilters = {}): Promise<NozzleReading[]> {
    const params = new URLSearchParams();
    if (filters.stationId) params.append('stationId', filters.stationId);
    if (filters.nozzleId) params.append('nozzleId', filters.nozzleId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const url = `/readings${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get<ApiResponse<NozzleReading[]>>(url);
    if (response.success && response.data) return response.data;
    return [];
  }
};

export default readingService;
