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
 * Cash Handover interface matching backend CashHandover model
 * Maps to: /api/v1/handovers/*
 */
export interface CashHandover {
  id: string;
  stationId: string;
  handoverType: 'shift_collection' | 'employee_to_manager' | 'manager_to_owner' | 'deposit_to_bank';
  handoverDate: string;
  fromUserId: string | null;
  toUserId: string | null;
  expectedAmount: number;
  actualAmount: number | null;
  difference: number | null;
  shiftId: number | null;
  previousHandoverId: string | null;
  status: 'pending' | 'confirmed' | 'disputed' | 'resolved';
  confirmedAt: string | null;
  confirmedBy: string | null;
  bankName: string | null;
  depositReference: string | null;
  depositReceiptUrl: string | null;
  notes: string | null;
  disputeNotes: string | null;
  resolutionNotes: string | null;
  fromUser?: { id: string; name: string };
  toUser?: { id: string; name: string };
  station?: { id: string; name: string };
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
 * Cash Handover Service
 * Handles cash handover chain management
 * Backend: /api/v1/handovers/*
 */
export const cashHandoverService = {
  /**
   * Get pending handovers for current user
   * GET /api/v1/handovers/pending
   */
  async getPendingHandovers(): Promise<CashHandover[]> {
    try {
      const response = await apiClient.get<ApiResponse<CashHandover[]>>('/handovers/pending');

      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch pending handovers:', error);
      return [];
    }
  },

  /**
   * Create a new handover (manager+ only)
   * POST /api/v1/handovers
   */
  async createHandover(data: {
    stationId: string;
    handoverType: 'shift_collection' | 'employee_to_manager' | 'manager_to_owner' | 'deposit_to_bank';
    handoverDate?: string;
    fromUserId?: string;
    expectedAmount?: number;
    notes?: string;
  }): Promise<CashHandover> {
    const response = await apiClient.post<ApiResponse<CashHandover>>('/handovers', data);

    if (!response.success || !response.data) {
      throw new Error('Failed to create handover');
    }

    return response.data;
  },

  /**
   * Confirm a handover
   * POST /api/v1/handovers/:id/confirm
   */
  async confirmHandover(
    handoverId: string,
    data: {
      actualAmount: number;
      notes?: string;
    }
  ): Promise<CashHandover> {
    const response = await apiClient.post<ApiResponse<CashHandover>>(
      `/handovers/${handoverId}/confirm`,
      data
    );

    if (!response.success || !response.data) {
      throw new Error('Failed to confirm handover');
    }

    return response.data;
  },

  /**
   * Resolve a disputed handover (owner+ only)
   * POST /api/v1/handovers/:id/resolve
   */
  async resolveDispute(
    handoverId: string,
    resolutionNotes: string
  ): Promise<CashHandover> {
    const response = await apiClient.post<ApiResponse<CashHandover>>(
      `/handovers/${handoverId}/resolve`,
      { resolutionNotes }
    );

    if (!response.success || !response.data) {
      throw new Error('Failed to resolve dispute');
    }

    return response.data;
  },

  /**
   * Record bank deposit (owner+ only)
   * POST /api/v1/handovers/bank-deposit
   */
  async recordBankDeposit(data: {
    stationId: string;
    handoverDate?: string;
    amount: number;
    bankName?: string;
    depositReference?: string;
    depositReceiptUrl?: string;
    notes?: string;
  }): Promise<CashHandover> {
    const response = await apiClient.post<ApiResponse<CashHandover>>(
      '/handovers/bank-deposit',
      data
    );

    if (!response.success || !response.data) {
      throw new Error('Failed to record bank deposit');
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
   * Get pending handovers alert
   * GET /api/v1/dashboard/alerts/pending-handovers
   */
  async getPendingHandoversAlert(): Promise<{
    pendingCount: number;
    disputedCount: number;
    pendingHandovers: CashHandover[];
    hasAlerts: boolean;
  }> {
    try {
      const response = await apiClient.get<ApiResponse<{
        pendingCount: number;
        disputedCount: number;
        pendingHandovers: CashHandover[];
        hasAlerts: boolean;
      }>>('/dashboard/alerts/pending-handovers');

      if (response.success && response.data) {
        return response.data;
      }
      return { pendingCount: 0, disputedCount: 0, pendingHandovers: [], hasAlerts: false };
    } catch (error) {
      console.error('Failed to fetch pending handovers alert:', error);
      return { pendingCount: 0, disputedCount: 0, pendingHandovers: [], hasAlerts: false };
    }
  },

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
// NOTE: tenderService is deprecated, use shiftService and cashHandoverService instead
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
  ): Promise<{ data: any[]; total: number }> {
    console.warn('tenderService.getTenderEntries is deprecated. Use shiftService or dashboardAlertsService instead.');
    // Return empty data as tender entries endpoint doesn't exist
    // Frontend should migrate to using shift/handover endpoints
    return { data: [], total: 0 };
  },

  /**
   * @deprecated Use cashHandoverService instead
   */
  async createTenderEntry(
    stationId: string,
    entryData: {
      type: 'cash' | 'card' | 'upi' | 'credit';
      payer: string;
      amount: number;
      entry_date: string;
      user_id: string;
    }
  ): Promise<any> {
    console.warn('tenderService.createTenderEntry is deprecated. Use cashHandoverService instead.');
    throw new Error('This endpoint is deprecated. Use cash handover workflow instead.');
  },

  /**
   * @deprecated Use dailyClosureService.getDailySummary() instead
   */
  async getDailySummary(stationId: string, date: string) {
    console.warn('tenderService.getDailySummary is deprecated. Use dailyClosureService.getDailySummary() instead.');
    // Import and use the actual dashboard summary
    try {
      const { dailyClosureService } = await import('./dailyClosureService');
      const summary = await dailyClosureService.getDailySummary();
      
      if (summary) {
        return {
          cash: summary.today.cash,
          card: 0, // Backend tracks online (card + upi combined)
          upi: 0,
          online: summary.today.online,
          credit: summary.today.credit,
          total: summary.today.amount
        };
      }
    } catch (error) {
      console.error('Failed to get daily summary:', error);
    }

    return {
      cash: 0,
      card: 0,
      upi: 0,
      credit: 0,
      total: 0
    };
  }
};
