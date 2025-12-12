import { apiClient, ApiResponse, PaginatedResponse } from '@/lib/api-client';

/**
 * Shift interface matching backend Shift model
 * Maps to: /api/v1/shifts/*
 */
export interface Shift {
  id: number;
  stationId: string;
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string | null;
  shiftType: 'morning' | 'evening' | 'night' | 'full_day' | 'custom';
  cashCollected: number | null;
  onlineCollected: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
  readingsCount: number;
  totalLitresSold: number;
  totalSalesAmount: number;
  status: 'active' | 'ended' | 'cancelled';
  endedBy: string | null;
  notes: string | null;
  endNotes: string | null;
  employee?: { id: string; name: string };
  station?: { id: string; name: string };
  endedByUser?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

/**
 * Shift Service
 * Handles shift management and cash collections
 * Backend: /api/v1/shifts/*
 */
export const shiftService = {
  /**
   * Start a new shift
   * POST /api/v1/shifts/start
   */
  async startShift(data: {
    employeeId?: string;
    stationId?: string;
    shiftDate?: string;
    startTime?: string;
    shiftType?: 'morning' | 'evening' | 'night' | 'full_day' | 'custom';
    notes?: string;
  }): Promise<Shift> {
    const response = await apiClient.post<ApiResponse<Shift>>('/shifts/start', data);

    if (!response.success || !response.data) {
      throw new Error('Failed to start shift');
    }

    return response.data;
  },

  /**
   * Get active shift for current user or specified employee
   * GET /api/v1/shifts/active?employeeId=
   */
  async getActiveShift(employeeId?: string): Promise<Shift | null> {
    try {
      let url = '/shifts/active';
      if (employeeId) {
        url += `?employeeId=${employeeId}`;
      }

      const response = await apiClient.get<Shift | null>(url);
      return response || null;
    } catch (error) {
      console.error('Failed to get active shift:', error);
      return null;
    }
  },

  /**
   * Get shift by ID
   * GET /api/v1/shifts/:id
   */
  async getShift(id: number): Promise<Shift | null> {
    try {
      const response = await apiClient.get<ApiResponse<Shift & { duration?: number }>>(
        `/shifts/${id}`
      );

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to get shift:', error);
      return null;
    }
  },

  /**
   * End a shift
   * POST /api/v1/shifts/:id/end
   */
  async endShift(
    shiftId: number,
    data: {
      cashCollected?: number;
      onlineCollected?: number;
      endTime?: string;
      endNotes?: string;
    }
  ): Promise<Shift> {
    const response = await apiClient.post<ApiResponse<Shift>>(`/shifts/${shiftId}/end`, data);

    if (!response.success || !response.data) {
      throw new Error('Failed to end shift');
    }

    return response.data;
  },

  /**
   * Cancel a shift (manager+ only)
   * POST /api/v1/shifts/:id/cancel
   */
  async cancelShift(shiftId: number, reason?: string): Promise<Shift> {
    const response = await apiClient.post<ApiResponse<Shift>>(`/shifts/${shiftId}/cancel`, {
      reason
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to cancel shift');
    }

    return response.data;
  }
};

/**
 * Dashboard Alerts Service
 * Backend: /api/v1/dashboard/alerts/*
 */
export const dashboardAlertsService = {
  /**
   * Get shift status
   * GET /api/v1/dashboard/shift-status
   */
  async getShiftStatus(): Promise<{
    myActiveShift: Shift | null;
    stationActiveShifts: Array<{
      id: number;
      employeeId: string;
      employeeName: string;
      startTime: string;
      shiftType: string;
    }>;
    todayShiftsCount: number;
    todayCompletedCount: number;
  }> {
    try {
      const response = await apiClient.get<ApiResponse<{
        myActiveShift: Shift | null;
        stationActiveShifts: Array<{
          id: number;
          employeeId: string;
          employeeName: string;
          startTime: string;
          shiftType: string;
        }>;
        todayShiftsCount: number;
        todayCompletedCount: number;
      }>>('/dashboard/shift-status');

      if (response.success && response.data) {
        return response.data;
      }
      return {
        myActiveShift: null,
        stationActiveShifts: [],
        todayShiftsCount: 0,
        todayCompletedCount: 0
      };
    } catch (error) {
      console.error('Failed to fetch shift status:', error);
      return {
        myActiveShift: null,
        stationActiveShifts: [],
        todayShiftsCount: 0,
        todayCompletedCount: 0
      };
    }
  }
};

// Re-export for backwards compatibility with existing imports
// NOTE: tenderService is deprecated, use shiftService and settlementsService instead
export const tenderService = {
  /**
   * @deprecated Use dashboardAlertsService.getShiftStatus() and daily closure service instead
   * This is a compatibility layer that fetches data from shift endpoints
   */
  async getTenderEntries(
    stationId: string,
    date?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: unknown[]; total: number }> {
    console.warn('tenderService.getTenderEntries is deprecated. Use shiftService or dashboardAlertsService instead.');
    // Return empty data as tender entries endpoint doesn't exist
    // Frontend should migrate to using shift/handover endpoints
    return { data: [], total: 0 };
  },

  /**
   * @deprecated Use settlementsService.getDailySummary() instead
   */
  async getDailySummary(stationId: string, date: string) {
    console.warn('tenderService.getDailySummary is deprecated. Use settlementsService.getDailySummary() instead.');
    // Import and use the actual dashboard summary
    try {
      const { settlementsService } = await import('./settlementsService');
      const summary = await settlementsService.getDailySummary(stationId, date);
      
      if (summary) {
        return {
          cash: summary.today.cash ?? 0,
          card: 0,
          upi: summary.today.online ? (summary.today.online * 0.5) : 0,  // Approximate UPI as half of online
          online: summary.today.online ?? 0,
          credit: summary.today.credit ?? 0,
          total: summary.today.amount ?? 0
        };
      }
    } catch (error) {
      console.error('Failed to get daily summary:', error);
    }

    return {
      cash: 0,
      card: 0,
      upi: 0,
      online: 0,
      credit: 0,
      total: 0
    };
  }
};
