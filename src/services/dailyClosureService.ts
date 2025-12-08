import { apiClient, ApiResponse } from '@/lib/api-client';

/**
 * Daily summary from dashboard endpoint
 * Maps to: GET /api/v1/dashboard/summary
 */
export interface DailySummary {
  date: string;
  today: {
    litres: number;
    amount: number;
    cash: number;
    online: number;
    credit: number;
    readings: number;
  };
  creditOutstanding: number;
  pumps: PumpSummary[];
}

export interface PumpSummary {
  id: number;
  name: string;
  number: number;
  status: string;
  nozzleCount: number;
  activeNozzles: number;
  today: {
    litres: number;
    amount: number;
  };
}

/**
 * Daily data for date range
 * Maps to: GET /api/v1/dashboard/daily
 */
export interface DailyData {
  date: string;
  litres: number;
  amount: number;
  cash: number;
  online: number;
  credit: number;
  readings: number;
}

/**
 * Financial overview for a month
 * Maps to: GET /api/v1/dashboard/financial-overview
 */
export interface FinancialOverview {
  month: string;
  revenue: {
    totalSales: number;
    cashReceived: number;
    onlineReceived: number;
    creditSettlements: number;
    totalReceived: number;
  };
  credits: {
    givenThisMonth: number;
    settledThisMonth: number;
    totalOutstanding: number;
  };
  costs: {
    costOfGoods: number;
    expenses: number;
    totalCosts: number;
  };
  profit: {
    grossProfit: number;
    netProfit: number;
    margin: string | number;
  };
  notes?: string | null;
}

/**
 * Daily Closure Service
 * Uses backend dashboard endpoints for daily summaries and closures
 * Backend: /api/v1/dashboard/*
 */
export const dailyClosureService = {
  /**
   * Get today's dashboard summary
   * GET /api/v1/dashboard/summary
   */
  async getDailySummary(stationId?: string, date?: string): Promise<DailySummary | null> {
    try {
      let url = '/dashboard/summary';
      const params: string[] = [];
      if (stationId) params.push(`stationId=${encodeURIComponent(stationId)}`);
      if (date) params.push(`startDate=${encodeURIComponent(date)}&endDate=${encodeURIComponent(date)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await apiClient.get<ApiResponse<DailySummary>>(url);

      if (response && (response as any).success && (response as any).data) {
        return (response as any).data as DailySummary;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch daily summary:', error);
      return null;
    }
  },

  /**
   * Get daily summaries for a date range
   * GET /api/v1/dashboard/daily?startDate=&endDate=
   */
  async getDailyHistory(startDate: string, endDate: string): Promise<DailyData[]> {
    try {
      const response = await apiClient.get<ApiResponse<DailyData[]>>(
        `/dashboard/daily?startDate=${startDate}&endDate=${endDate}`
      );

      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch daily history:', error);
      return [];
    }
  },

  /**
   * Get financial overview for a month
   * GET /api/v1/dashboard/financial-overview?month=YYYY-MM
   */
  async getFinancialOverview(month?: string): Promise<FinancialOverview | null> {
    try {
      let url = '/dashboard/financial-overview';
      if (month) {
        url += `?month=${month}`;
      }

      const response = await apiClient.get<ApiResponse<FinancialOverview>>(url);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch financial overview:', error);
      return null;
    }
  },

  /**
   * Get fuel type breakdown
   * GET /api/v1/dashboard/fuel-breakdown?startDate=&endDate=
   */
  async getFuelBreakdown(startDate?: string, endDate?: string): Promise<{
    startDate: string;
    endDate: string;
    breakdown: Array<{
      fuelType: string;
      label: string;
      litres: number;
      amount: number;
      cash: number;
      online: number;
      credit: number;
    }>;
  } | null> {
    try {
      let url = '/dashboard/fuel-breakdown';
      const params: string[] = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await apiClient.get<ApiResponse<{
        startDate: string;
        endDate: string;
        breakdown: Array<{
          fuelType: string;
          label: string;
          litres: number;
          amount: number;
          cash: number;
          online: number;
          credit: number;
        }>;
      }>>(url);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch fuel breakdown:', error);
      return null;
    }
  },

  /**
   * Get pump performance
   * GET /api/v1/dashboard/pump-performance?startDate=&endDate=
   */
  async getPumpPerformance(startDate?: string, endDate?: string): Promise<{
    startDate: string;
    endDate: string;
    pumps: Array<{
      id: number;
      name: string;
      number: number;
      status: string;
      litres: number;
      amount: number;
      cash: number;
      online: number;
      credit: number;
      readings: number;
    }>;
  } | null> {
    try {
      let url = '/dashboard/pump-performance';
      const params: string[] = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await apiClient.get<ApiResponse<{
        startDate: string;
        endDate: string;
        pumps: Array<{
          id: number;
          name: string;
          number: number;
          status: string;
          litres: number;
          amount: number;
          cash: number;
          online: number;
          credit: number;
          readings: number;
        }>;
      }>>(url);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch pump performance:', error);
      return null;
    }
  },

  /**
   * Get nozzle breakdown (owner/super_admin only)
   * GET /api/v1/dashboard/nozzle-breakdown?startDate=&endDate=&pumpId=
   */
  async getNozzleBreakdown(startDate?: string, endDate?: string, pumpId?: number): Promise<{
    startDate: string;
    endDate: string;
    nozzles: Array<{
      nozzleId: number;
      nozzleNumber: number;
      fuelType: string;
      fuelLabel: string;
      pump: { id: number; name: string; number: number };
      litres: number;
      amount: number;
      cash: number;
      online: number;
      credit: number;
      readings: number;
    }>;
  } | null> {
    try {
      let url = '/dashboard/nozzle-breakdown';
      const params: string[] = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (pumpId) params.push(`pumpId=${pumpId}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await apiClient.get<ApiResponse<{
        startDate: string;
        endDate: string;
        nozzles: Array<{
          nozzleId: number;
          nozzleNumber: number;
          fuelType: string;
          fuelLabel: string;
          pump: { id: number; name: string; number: number };
          litres: number;
          amount: number;
          cash: number;
          online: number;
          credit: number;
          readings: number;
        }>;
      }>>(url);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch nozzle breakdown:', error);
      return null;
    }
  }
};
