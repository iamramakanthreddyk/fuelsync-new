/**
 * Dashboard Service
 * Minimal implementation to satisfy service barrel exports and provide typed stubs
 */

import { apiClient, ApiResponse } from '@/lib/api-client';

export interface DailyTotals {
  date: string;
  totalVolume: number;
  totalAmount: number;
}

export interface FuelBreakdown {
  fuelType: string;
  volume: number;
  amount: number;
}

export interface PumpPerformance {
  pumpId: string;
  volume: number;
  amount: number;
}

export interface FinancialOverview {
  revenue: number;
  cost: number;
  profit: number;
}

export interface DashboardAlert {
  id: string;
  type: string;
  message: string;
}

export interface DashboardSummary {
  dailyTotals: DailyTotals[];
  fuelBreakdown: FuelBreakdown[];
  pumpPerformance: PumpPerformance[];
  financialOverview: FinancialOverview;
  alerts?: DashboardAlert[];
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export const dashboardService = {
  async getDashboard(stationId: string, startDate?: string, endDate?: string): Promise<DashboardSummary | null> {
    try {
      const url = `/dashboard?stationId=${stationId}${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`;
      const res = await apiClient.get<ApiResponse<DashboardSummary>>(url);
      if (res.success && res.data) return res.data;
      return null;
    } catch {
      return null;
    }
  }
};

export default dashboardService;
