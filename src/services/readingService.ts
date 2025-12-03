/**
 * Reading Service
 * Handles nozzle readings API calls
 * Backend: /api/v1/readings/*
 */

import { apiClient, ApiResponse } from '@/lib/api-client';

export interface NozzleReading {
  id: string;
  nozzleId: string;
  stationId: string;
  pumpId: string;
  shiftId?: number;
  enteredBy: string;
  readingDate: string;
  previousReading: number;
  currentReading: number;
  litresSold: number;
  fuelType: 'petrol' | 'diesel';
  pricePerLitre: number;
  totalAmount: number;
  cashAmount: number;
  onlineAmount: number;
  creditAmount: number;
  creditorId?: string;
  notes?: string;
  isInitialReading: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  nozzle?: {
    id: string;
    nozzleNumber: number;
    fuelType: string;
    pump?: { id: string; name: string; pumpNumber: number };
  };
  user?: { id: string; name: string };
}

export interface SubmitReadingRequest {
  nozzleId: string;
  stationId: string;
  readingDate: string;
  currentReading: number;
  cashAmount?: number;
  onlineAmount?: number;
  creditAmount?: number;
  creditorId?: string;
  notes?: string;
}

export interface PreviousReadingInfo {
  previousReading: number;
  lastReadingDate?: string;
  fuelType: 'petrol' | 'diesel';
  currentPrice: number;
  priceSet: boolean;
}

export interface ReadingFilters {
  stationId?: string;
  nozzleId?: string;
  pumpId?: string;
  startDate?: string;
  endDate?: string;
  fuelType?: 'petrol' | 'diesel';
  page?: number;
  limit?: number;
}

export const readingService = {
    /**
     * Approve a reading
     * POST /api/v1/readings/:id/approve
     */
    async approveReading(id: string): Promise<void> {
      const response = await apiClient.post<ApiResponse<void>>(`/readings/${id}/approve`, {});
      if (!response.success) {
        throw new Error('Failed to approve reading');
      }
    },

    /**
     * Reject a reading
     * POST /api/v1/readings/:id/reject
     */
    async rejectReading(id: string, reason: string): Promise<void> {
      const response = await apiClient.post<ApiResponse<void>>(`/readings/${id}/reject`, { reason });
      if (!response.success) {
        throw new Error('Failed to reject reading');
      }
    },
  /**
   * Get readings with filters
   * GET /api/v1/readings
   */
  async getReadings(filters: ReadingFilters = {}): Promise<{
    data: NozzleReading[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const params = new URLSearchParams();
    
    if (filters.stationId) params.set('stationId', filters.stationId);
    if (filters.nozzleId) params.set('nozzleId', filters.nozzleId);
    if (filters.pumpId) params.set('pumpId', filters.pumpId);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.fuelType) params.set('fuelType', filters.fuelType);
    if (filters.page) params.set('page', filters.page.toString());
    if (filters.limit) params.set('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/readings?${queryString}` : '/readings';

    const response = await apiClient.get<NozzleReading[] | { data: NozzleReading[]; pagination: { page: number; limit: number; total: number; totalPages?: number; pages?: number } }>(url);

    // If response has pagination, it's a paginated response
    if (response && typeof response === 'object' && 'pagination' in response) {
      return {
        data: response.data || [],
        pagination: {
          page: response.pagination.page ?? 0,
          limit: response.pagination.limit ?? 0,
          total: response.pagination.total ?? 0,
          pages: response.pagination.totalPages ?? response.pagination.pages ?? 0
        }
      };
    }
    
    // Otherwise it's just an array
    return { data: Array.isArray(response) ? response : [] };
  },

  /**
   * Get a single reading
   * GET /api/v1/readings/:id
   */
  async getReading(id: string): Promise<NozzleReading | null> {
    try {
      const response = await apiClient.get<ApiResponse<NozzleReading>>(`/readings/${id}`);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Get previous reading for a nozzle
   * GET /api/v1/readings/previous/:nozzleId
   */
  async getPreviousReading(nozzleId: string, date?: string): Promise<PreviousReadingInfo | null> {
    try {
      let url = `/readings/previous/${nozzleId}`;
      if (date) url += `?date=${date}`;

      const response = await apiClient.get<ApiResponse<PreviousReadingInfo>>(url);

      if (response.success && response.data) {
        // Ensure currentPrice is always a number
        return {
          ...response.data,
          currentPrice: response.data.currentPrice ?? 0,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Submit a new reading
   * POST /api/v1/readings
   */
  async submitReading(data: SubmitReadingRequest): Promise<NozzleReading> {
    const response = await apiClient.post<ApiResponse<NozzleReading>>('/readings', data);

    if (!response.success || !response.data) {
      throw new Error('Failed to submit reading');
    }

    return response.data;
  },

  /**
   * Update a reading
   * PUT /api/v1/readings/:id
   */
  async updateReading(id: string, data: Partial<SubmitReadingRequest>): Promise<NozzleReading> {
    const response = await apiClient.put<ApiResponse<NozzleReading>>(`/readings/${id}`, data);

    if (!response.success || !response.data) {
      throw new Error('Failed to update reading');
    }

    return response.data;
  },

  /**
   * Delete a reading
   * DELETE /api/v1/readings/:id
   */
  async deleteReading(id: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<void>>(`/readings/${id}`);

    if (!response.success) {
      throw new Error('Failed to delete reading');
    }
  },

  /**
   * Get today's readings for a station
   * Convenience method
   */
  async getTodayReadings(stationId: string): Promise<NozzleReading[]> {
    const response = await apiClient.get<ApiResponse<NozzleReading[]>>('/readings/today');
    return response.data ?? [];
  },

  /**
   * Get readings for date range
   * Convenience method
   */
  async getReadingsForDateRange(
    stationId: string,
    startDate: string,
    endDate: string
  ): Promise<NozzleReading[]> {
    const result = await this.getReadings({
      stationId,
      startDate,
      endDate
    });
    return result.data;
  }
};
