import { apiClient, ApiResponse } from '@/lib/api-client';

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
   * Get active shifts for station
   * GET /api/v1/shifts/active
   */
  async getActiveShifts(stationId?: string): Promise<Shift[]> {
    const url = stationId ? `/shifts/active?stationId=${stationId}` : '/shifts/active';
    const response = await apiClient.get<ApiResponse<Shift[]>>(url);

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch active shifts');
    }

    return response.data;
  },

  /**
   * Get shift by ID
   * GET /api/v1/shifts/:id
   */
  async getShift(shiftId: number): Promise<Shift> {
    const response = await apiClient.get<ApiResponse<Shift>>(`/shifts/${shiftId}`);

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch shift');
    }

    return response.data;
  },

  /**
   * Get shifts for a date range
   * GET /api/v1/shifts
   */
  async getShifts(params: {
    stationId?: string;
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<Shift[]> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = queryParams.toString() ? `/shifts?${queryParams.toString()}` : '/shifts';
    const response = await apiClient.get<ApiResponse<Shift[]>>(url);

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch shifts');
    }

    return response.data;
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
      stationId: string;
      stationName: string;
      shiftDate: string;
      startTime: string;
      shiftType: string;
      status: string;
    }>;
    pendingHandovers: Array<{
      id: number;
      employeeId: string;
      employeeName: string;
      stationId: string;
      stationName: string;
      shiftDate: string;
      cashCollected: number;
      onlineCollected: number;
      expectedCash: number;
      difference: number;
    }>;
  }> {
    const response = await apiClient.get<ApiResponse<any>>('/dashboard/shift-status');

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch shift status');
    }

    return response.data;
  },

  /**
   * Get dashboard alerts
   * GET /api/v1/dashboard/alerts
   */
  async getAlerts(): Promise<{
    unreadCount: number;
    alerts: Array<{
      id: string;
      type: 'shift_end' | 'handover_pending' | 'settlement_required' | 'variance_alert';
      title: string;
      message: string;
      stationId: string;
      stationName: string;
      priority: 'low' | 'medium' | 'high';
      createdAt: string;
      readAt: string | null;
      metadata?: any;
    }>;
  }> {
    const response = await apiClient.get<ApiResponse<any>>('/dashboard/alerts');

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch alerts');
    }

    return response.data;
  },

  /**
   * Mark alert as read
   * POST /api/v1/dashboard/alerts/:id/read
   */
  async markAlertRead(alertId: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>(`/dashboard/alerts/${alertId}/read`);

    if (!response.success) {
      throw new Error('Failed to mark alert as read');
    }
  },

  /**
   * Get pending actions count
   * GET /api/v1/dashboard/pending-actions
   */
  async getPendingActions(): Promise<{
    shiftsToEnd: number;
    handoversToConfirm: number;
    settlementsToReview: number;
    variancesToInvestigate: number;
  }> {
    const response = await apiClient.get<ApiResponse<any>>('/dashboard/pending-actions');

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch pending actions');
    }

    return response.data;
  }
};