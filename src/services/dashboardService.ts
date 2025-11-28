/**
 * Dashboard Service
 * 
 * Provides methods to fetch dashboard data including:
 * - Summary statistics
 * - Daily totals
 * - Fuel breakdown
 * - Pump performance
 * - Financial overview
 * - Alerts
 */

import { apiClient } from '../lib/api-client';
import type { ApiResponse } from '../lib/api-client';

// Dashboard Summary Types
export interface DashboardSummary {
  totalSales: number;
  totalVolume: number;
  activeShifts: number;
  pendingHandovers: number;
  alerts: number;
  lastUpdated: string;
}

// Daily Totals Types
export interface DailyTotals {
  date: string;
  totalSales: number;
  totalVolume: number;
  fuelSales: number;
  shopSales: number;
  creditSales: number;
  cashSales: number;
  transactions: number;
}

// Fuel Breakdown Types
export interface FuelBreakdown {
  fuelType: string;
  volume: number;
  sales: number;
  percentage: number;
  averagePrice: number;
}

// Pump Performance Types
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

// Financial Overview Types
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

// Alert Types
export interface DashboardAlert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  category: 'inventory' | 'finance' | 'shift' | 'equipment' | 'compliance';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// Date Range Parameters
export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
  stationId?: string;
}

// Dashboard Service Methods
export const dashboardService = {
  /**
   * Get dashboard summary statistics
   */
  async getSummary(params?: DateRangeParams): Promise<DashboardSummary> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.stationId) queryParams.append('stationId', params.stationId);
    
    const queryString = queryParams.toString();
    const url = `/dashboard/summary${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<ApiResponse<DashboardSummary>>(url);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to fetch dashboard summary');
  },

  /**
   * Get daily totals for a specific date or date range
   */
  async getDailyTotals(params?: DateRangeParams): Promise<DailyTotals[]> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.stationId) queryParams.append('stationId', params.stationId);
    
    const queryString = queryParams.toString();
    const url = `/dashboard/daily${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<ApiResponse<DailyTotals[]>>(url);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to fetch daily totals');
  },

  /**
   * Get fuel breakdown by type
   */
  async getFuelBreakdown(params?: DateRangeParams): Promise<FuelBreakdown[]> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.stationId) queryParams.append('stationId', params.stationId);
    
    const queryString = queryParams.toString();
    const url = `/dashboard/fuel-breakdown${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<ApiResponse<FuelBreakdown[]>>(url);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to fetch fuel breakdown');
  },

  /**
   * Get pump performance metrics
   */
  async getPumpPerformance(params?: DateRangeParams): Promise<PumpPerformance[]> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.stationId) queryParams.append('stationId', params.stationId);
    
    const queryString = queryParams.toString();
    const url = `/dashboard/pump-performance${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<ApiResponse<PumpPerformance[]>>(url);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to fetch pump performance');
  },

  /**
   * Get financial overview
   */
  async getFinancialOverview(params?: DateRangeParams): Promise<FinancialOverview> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.stationId) queryParams.append('stationId', params.stationId);
    
    const queryString = queryParams.toString();
    const url = `/dashboard/financial-overview${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<ApiResponse<FinancialOverview>>(url);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to fetch financial overview');
  },

  /**
   * Get dashboard alerts
   */
  async getAlerts(params?: { 
    stationId?: string; 
    acknowledged?: boolean;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    category?: string;
  }): Promise<DashboardAlert[]> {
    const queryParams = new URLSearchParams();
    if (params?.stationId) queryParams.append('stationId', params.stationId);
    if (params?.acknowledged !== undefined) queryParams.append('acknowledged', String(params.acknowledged));
    if (params?.severity) queryParams.append('severity', params.severity);
    if (params?.category) queryParams.append('category', params.category);
    
    const queryString = queryParams.toString();
    const url = `/dashboard/alerts${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<ApiResponse<DashboardAlert[]>>(url);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to fetch alerts');
  },

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<DashboardAlert> {
    const response = await apiClient.put<ApiResponse<DashboardAlert>>(`/dashboard/alerts/${alertId}/acknowledge`, {});
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to acknowledge alert');
  },

  /**
   * Get all dashboard data in a single call (for initial load)
   */
  async getAllDashboardData(params?: DateRangeParams): Promise<{
    summary: DashboardSummary;
    dailyTotals: DailyTotals[];
    fuelBreakdown: FuelBreakdown[];
    pumpPerformance: PumpPerformance[];
    financialOverview: FinancialOverview;
    alerts: DashboardAlert[];
  }> {
    const [summary, dailyTotals, fuelBreakdown, pumpPerformance, financialOverview, alerts] = await Promise.all([
      this.getSummary(params),
      this.getDailyTotals(params),
      this.getFuelBreakdown(params),
      this.getPumpPerformance(params),
      this.getFinancialOverview(params),
      this.getAlerts({ stationId: params?.stationId })
    ]);

    return {
      summary,
      dailyTotals,
      fuelBreakdown,
      pumpPerformance,
      financialOverview,
      alerts
    };
  }
};

export default dashboardService;
