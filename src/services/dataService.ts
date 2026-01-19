/**
 * UNIFIED DATA SERVICE
 * Single source for all API calls
 * Replaces: api.ts, dashboardService.ts, readingService.ts, etc.
 * 
 * Pattern:
 * - One method per API endpoint
 * - Consistent error handling
 * - Type-safe responses
 * - Easy to test and mock
 */

import { apiClient, ApiResponse, PaginatedResponse } from '@/lib/api-client';

// ============================================
// TYPE DEFINITIONS
// ============================================

// Readings
export interface NozzleReading {
  id: string;
  nozzleId: string;
  stationId: string;
  previousReading: number;
  currentReading: number;
  litresSold: number;
  fuelType: 'petrol' | 'diesel';
  readingDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingFilters {
  stationId?: string;
  nozzleId?: string;
  fuelType?: 'petrol' | 'diesel';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateReadingDto {
  nozzleId: string;
  readingDate: string;
  currentReading: number;
  notes?: string;
}

// Transactions
export interface Transaction {
  id: string;
  stationId: string;
  date: string;
  totalLitres: number;
  totalSales: number;
  fuelSales: number;
  shopSales: number;
  creditSales: number;
  cashSales: number;
  readingIds: string[];
  status: 'draft' | 'submitted' | 'approved';
  createdAt: string;
  updatedAt: string;
}

export interface TransactionFilters {
  stationId?: string;
  startDate?: string;
  endDate?: string;
  status?: 'draft' | 'submitted' | 'approved';
  page?: number;
  limit?: number;
}

export interface CreateTransactionDto {
  stationId: string;
  transactionDate: string;
  readingIds: string[];
  paymentBreakdown: {
    cash: number;
    credit: number;
    shop: number;
  };
}

// Analytics
export interface DashboardSummary {
  totalSales: number;
  totalVolume: number;
  activeShifts: number;
  alerts: number;
  lastUpdated: string;
}

export interface FuelBreakdown {
  fuelType: string;
  volume: number;
  sales: number;
  percentage: number;
  averagePrice: number;
}

export interface PumpPerformance {
  pumpId: string;
  pumpNumber: number;
  totalVolume: number;
  totalSales: number;
  transactions: number;
  averageTransaction: number;
  uptime: number;
  status: 'active' | 'inactive' | 'maintenance';
}

export interface FinancialOverview {
  grossSales: number;
  netSales: number;
  costOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  cashOnHand: number;
  creditOutstanding: number;
  bankDeposits: number;
}

export interface AnalyticsParams {
  stationId?: string;
  startDate?: string;
  endDate?: string;
}

// Shifts
export interface Shift {
  id: string;
  stationId: string;
  startedBy: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'closed' | 'cancelled';
  readings?: NozzleReading[];
  transactions?: Transaction[];
  createdAt: string;
  updatedAt: string;
}

export interface ShiftFilters {
  stationId?: string;
  status?: 'active' | 'closed' | 'cancelled';
  page?: number;
  limit?: number;
}

export interface StartShiftDto {
  stationId: string;
}

export interface EndShiftDto {
  closingNotes?: string;
}

// ============================================
// DATA SERVICE
// ============================================

/**
 * Unified Data Service
 * ONE entry point for all API calls
 * Easy to mock, test, and maintain
 */
export const dataService = {
  
  // ============================================
  // READINGS
  // ============================================
  
  /**
   * Get readings with optional filters
   */
  async getReadings(filters: ReadingFilters = {}): Promise<PaginatedResponse<NozzleReading>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<NozzleReading>>>('/readings', {
      params: filters,
    });
    return response?.data || { items: [], pagination: { page: 1, limit: 20, total: 0 } };
  },

  /**
   * Get single reading by ID
   */
  async getReading(id: string): Promise<NozzleReading | null> {
    try {
      const response = await apiClient.get<ApiResponse<NozzleReading>>(`/readings/${id}`);
      return response?.data || null;
    } catch (error) {
      console.error('Failed to fetch reading:', error);
      return null;
    }
  },

  /**
   * Get previous reading for a nozzle
   */
  async getPreviousReading(nozzleId: string, date?: string): Promise<NozzleReading | null> {
    try {
      const params = new URLSearchParams();
      params.append('nozzleId', nozzleId);
      if (date) params.append('date', date);
      
      const response = await apiClient.get<ApiResponse<NozzleReading>>(
        `/readings/previous/${nozzleId}?${params.toString()}`
      );
      return response?.data || null;
    } catch (error) {
      console.error('Failed to fetch previous reading:', error);
      return null;
    }
  },

  /**
   * Create new reading
   */
  async createReading(data: CreateReadingDto): Promise<NozzleReading> {
    const response = await apiClient.post<ApiResponse<NozzleReading>>('/readings', data);
    if (!response?.data) throw new Error('Failed to create reading');
    return response.data;
  },

  /**
   * Update reading
   */
  async updateReading(id: string, data: Partial<NozzleReading>): Promise<NozzleReading> {
    const response = await apiClient.put<ApiResponse<NozzleReading>>(`/readings/${id}`, data);
    if (!response?.data) throw new Error('Failed to update reading');
    return response.data;
  },

  /**
   * Delete reading
   */
  async deleteReading(id: string): Promise<void> {
    await apiClient.delete(`/readings/${id}`);
  },

  // ============================================
  // TRANSACTIONS
  // ============================================

  /**
   * Get transactions with optional filters
   */
  async getTransactions(filters: TransactionFilters = {}): Promise<PaginatedResponse<Transaction>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Transaction>>>('/transactions', {
      params: filters,
    });
    return response?.data || { items: [], pagination: { page: 1, limit: 20, total: 0 } };
  },

  /**
   * Get transaction for specific station and date
   */
  async getTransactionForDate(stationId: string, date: string): Promise<Transaction | null> {
    try {
      const response = await apiClient.get<ApiResponse<Transaction>>(
        `/transactions/${stationId}/${date}`
      );
      return response?.data || null;
    } catch (error) {
      console.error('Failed to fetch transaction:', error);
      return null;
    }
  },

  /**
   * Get transactions for a station with date range
   */
  async getTransactionsForStation(
    stationId: string,
    startDate?: string,
    endDate?: string
  ): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await apiClient.get<ApiResponse<Transaction[]>>(
      `/transactions/${stationId}?${params.toString()}`
    );
    return response?.data || [];
  },

  /**
   * Create transaction (daily finalization)
   */
  async createTransaction(data: CreateTransactionDto): Promise<Transaction> {
    const response = await apiClient.post<ApiResponse<Transaction>>('/transactions', data);
    if (!response?.data) throw new Error('Failed to create transaction');
    return response.data;
  },

  /**
   * Update transaction
   */
  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
    const response = await apiClient.put<ApiResponse<Transaction>>(`/transactions/${id}`, data);
    if (!response?.data) throw new Error('Failed to update transaction');
    return response.data;
  },

  /**
   * Delete transaction
   */
  async deleteTransaction(id: string): Promise<void> {
    await apiClient.delete(`/transactions/${id}`);
  },

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get dashboard summary
   * ONE endpoint for all summary data
   */
  async getSummary(params: AnalyticsParams = {}): Promise<DashboardSummary> {
    const response = await apiClient.get<ApiResponse<DashboardSummary>>('/analytics/summary', {
      params,
    });
    return response?.data || {
      totalSales: 0,
      totalVolume: 0,
      activeShifts: 0,
      alerts: 0,
      lastUpdated: new Date().toISOString(),
    };
  },

  /**
   * Get fuel breakdown analytics
   */
  async getFuelBreakdown(params: AnalyticsParams = {}): Promise<FuelBreakdown[]> {
    const response = await apiClient.get<ApiResponse<FuelBreakdown[]>>(
      '/analytics/fuel-breakdown',
      { params }
    );
    return response?.data || [];
  },

  /**
   * Get pump performance analytics
   */
  async getPumpPerformance(params: AnalyticsParams = {}): Promise<PumpPerformance[]> {
    const response = await apiClient.get<ApiResponse<PumpPerformance[]>>(
      '/analytics/pump-performance',
      { params }
    );
    return response?.data || [];
  },

  /**
   * Get financial overview
   */
  async getFinancialOverview(params: AnalyticsParams = {}): Promise<FinancialOverview> {
    const response = await apiClient.get<ApiResponse<FinancialOverview>>(
      '/analytics/financial',
      { params }
    );
    return response?.data || {
      grossSales: 0,
      netSales: 0,
      costOfGoods: 0,
      grossProfit: 0,
      expenses: 0,
      netProfit: 0,
      cashOnHand: 0,
      creditOutstanding: 0,
      bankDeposits: 0,
    };
  },

  /**
   * Get system alerts
   */
  async getAlerts(params: AnalyticsParams = {}): Promise<any[]> {
    const response = await apiClient.get<ApiResponse<any[]>>('/analytics/alerts', { params });
    return response?.data || [];
  },

  // ============================================
  // SHIFTS
  // ============================================

  /**
   * Get shifts with optional filters
   */
  async getShifts(filters: ShiftFilters = {}): Promise<PaginatedResponse<Shift>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Shift>>>('/shifts', {
      params: filters,
    });
    return response?.data || { items: [], pagination: { page: 1, limit: 20, total: 0 } };
  },

  /**
   * Get single shift by ID
   */
  async getShift(id: string): Promise<Shift | null> {
    try {
      const response = await apiClient.get<ApiResponse<Shift>>(`/shifts/${id}`);
      return response?.data || null;
    } catch (error) {
      console.error('Failed to fetch shift:', error);
      return null;
    }
  },

  /**
   * Start new shift
   */
  async startShift(data: StartShiftDto): Promise<Shift> {
    const response = await apiClient.post<ApiResponse<Shift>>('/shifts/start', data);
    if (!response?.data) throw new Error('Failed to start shift');
    return response.data;
  },

  /**
   * End active shift
   */
  async endShift(shiftId: string, data: EndShiftDto): Promise<Shift> {
    const response = await apiClient.post<ApiResponse<Shift>>(`/shifts/${shiftId}/end`, data);
    if (!response?.data) throw new Error('Failed to end shift');
    return response.data;
  },

  /**
   * Cancel shift
   */
  async cancelShift(shiftId: string): Promise<Shift> {
    const response = await apiClient.post<ApiResponse<Shift>>(`/shifts/${shiftId}/cancel`, {});
    if (!response?.data) throw new Error('Failed to cancel shift');
    return response.data;
  },
};

export default dataService;
