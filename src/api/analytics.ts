/**
 * Analytics API
 * Single source of truth for all financial reporting and analytics API calls.
 * Only this file (and other src/api/ modules) should import from api-client.
 */

import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OwnerStats {
  totalStations: number;
  totalEmployees: number;
  totalActiveCreditors: number;
  totalOutstandingCredit: number;
  totalSalesValue: number;
  totalSalesLitres: number;
  monthlyTrend: Array<{ date: string; sales: number; litres: number; credit: number }>;
  stationBreakdown: Array<{ id: string; name: string; sales: number; litres: number; credit: number }>;
}

export interface OwnerAnalytics {
  overview: {
    totalSales: number;
    totalQuantity: number;
    totalTransactions: number;
    averageTransaction: number;
    salesGrowth: number;
    quantityGrowth: number;
  };
  salesByStation: Array<{ stationId: string; stationName: string; sales: number; percentage: number }>;
  dailyTrend: Array<{ date: string; sales: number; quantity: number; transactions: number }>;
  topPerformingStations: Array<{ stationId: string; stationName: string; sales: number; growth: number }>;
  employeePerformance: Array<{
    employeeId: string;
    employeeName: string;
    shifts: number;
    totalSales: number;
    averageSales: number;
  }>;
}

export interface IncomeReceivablesReport {
  period: { startDate: string; endDate: string };
  station: { id: string; name: string };
  salesBreakdown: {
    totalSales: number;
    totalLitres: number;
    transactions: number;
    cash: number;
    online: number;
    credit: number;
  };
  creditorsBreakdown: {
    totalOutstanding: number;
    totalOverdue: number;
    creditors: Array<{ id: string; name: string; outstanding: number; overdue: number }>;
  };
  dailyBreakdown: Array<{
    date: string;
    sales: number;
    litres: number;
    cash: number;
    online: number;
    credit: number;
  }>;
}

export interface ProfitSummary {
  month: string;
  summary: {
    totalRevenue: number;
    totalCostOfGoods: number;
    totalShortfall: number;
    totalExpenses: number;
    pendingExpenses?: number;
    grossProfit: number;
    netProfit: number;
    profitMargin: number;
    totalLitres: number;
    profitPerLitre: number;
  };
  breakdown: {
    byFuelType: Record<
      string,
      {
        revenue: number;
        costOfGoods: number;
        litres: number;
        profitPerLitre: number | null;
        profitMargin: number | null;
        hasCompleteData?: boolean;
      }
    >;
    byExpenseCategory: Array<{ category: string; label?: string; amount: number }>;
    readingDetails?: Record<
      string,
      {
        withCostPrice: Array<{
          date: string;
          litres: number;
          salePrice: number;
          costPrice: number;
          revenue: number;
          cogs: number;
          profit: number;
        }>;
        withoutCostPrice: Array<{
          date: string;
          litres: number;
          salePrice: number;
          revenue: number;
          note: string;
        }>;
      }
    >;
  };
  dataCompleteness: {
    totalReadings: number;
    readingsUsedForCalculation: number;
    readingsExcluded: number;
    completenessPercentage: number;
    note: string;
  };
}

export interface SalesData {
  date?: string;
  stationId?: string;
  stationName?: string;
  totalSales: number;
  totalLitres: number;
  cash: number;
  online: number;
  credit: number;
  readings: number;
  transactions?: number;
}

export interface DashboardSummary {
  totalSales: number;
  totalLitres: number;
  cashSales: number;
  onlineSales: number;
  creditSales: number;
  totalReadings: number;
  activeShifts: number;
  openCreditors: number;
  totalOutstanding: number;
  dailyTrend?: Array<{ date: string; sales: number; litres: number }>;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const analyticsApi = {
  /** GET /analytics/summary?stationId=... */
  getSummary: (stationId: string, startDate?: string, endDate?: string) => {
    const qs = new URLSearchParams({ stationId });
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    return apiClient.get<ApiResponse<DashboardSummary>>(`/analytics/summary?${qs.toString()}`);
  },

  /** GET /analytics/owner/stats */
  getOwnerStats: (ownerId?: string) => {
    const url = ownerId ? `/analytics/owner/stats?ownerId=${ownerId}` : '/analytics/owner/stats';
    return apiClient.get<{ success: boolean; data: OwnerStats }>(url);
  },

  /** GET /analytics/owner/analytics?startDate=...&endDate=...&stationId=... */
  getOwnerAnalytics: (startDate: string, endDate: string, stationId?: string) => {
    const qs = new URLSearchParams({ startDate, endDate });
    if (stationId) qs.set('stationId', stationId);
    return apiClient.get<{ success: boolean; data: OwnerAnalytics }>(
      `/analytics/owner/analytics?${qs.toString()}`
    );
  },

  /** GET /analytics/income-receivables?stationId=...&startDate=...&endDate=... */
  getIncomeReceivables: (stationId: string, startDate: string, endDate: string) => {
    const qs = new URLSearchParams({ stationId, startDate, endDate });
    return apiClient.get<{ success: boolean; data: IncomeReceivablesReport }>(
      `/analytics/income-receivables?${qs.toString()}`
    );
  },

  /** GET /stations/:stationId/profit-summary?month=... OR ?startDate=...&endDate=... */
  getProfitSummary: (stationId: string, month?: string, startDate?: string, endDate?: string) => {
    if (startDate && endDate) {
      const qs = new URLSearchParams({ startDate, endDate });
      return apiClient.get<{ success: boolean; data: ProfitSummary }>(
        `/stations/${stationId}/profit-summary?${qs.toString()}`
      );
    }
    const url = month
      ? `/stations/${stationId}/profit-summary?month=${month}`
      : `/stations/${stationId}/profit-summary`;
    return apiClient.get<{ success: boolean; data: ProfitSummary }>(url);
  },

  /** GET /analytics/sales?startDate=...&endDate=...&stationId=... */
  getSalesAnalysis: (startDate: string, endDate: string, stationId?: string) => {
    const qs = new URLSearchParams({ startDate, endDate });
    if (stationId) qs.set('stationId', stationId);
    return apiClient.get<{ success: boolean; data: SalesData[] }>(
      `/analytics/sales?${qs.toString()}`
    );
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function calculateTotalSales(salesData: SalesData[]): number {
  return salesData.reduce((sum, sale) => sum + (sale.totalSales || 0), 0);
}

export function calculateTotalLitres(salesData: SalesData[]): number {
  return salesData.reduce((sum, sale) => sum + (sale.totalLitres || 0), 0);
}

export function parseSalesAmount(amount: string | number | undefined): number {
  if (!amount) return 0;
  if (typeof amount === 'number') return amount;
  const parsed = parseFloat(amount as string);
  return isNaN(parsed) ? 0 : parsed;
}

export function groupSalesByStation(
  salesData: SalesData[]
): Record<string, { name: string; sales: number; litres: number; items: SalesData[] }> {
  return salesData.reduce<
    Record<string, { name: string; sales: number; litres: number; items: SalesData[] }>
  >((acc, sale) => {
    const stationId = sale.stationId || 'unknown';
    if (!acc[stationId]) {
      acc[stationId] = { name: sale.stationName || 'Unknown Station', sales: 0, litres: 0, items: [] };
    }
    acc[stationId].sales += parseSalesAmount(sale.totalSales);
    acc[stationId].litres += parseSalesAmount(sale.totalLitres);
    acc[stationId].items.push(sale);
    return acc;
  }, {});
}

export function calculateFinancialRatios(data: {
  revenue?: number;
  cost?: number;
  profit?: number;
}) {
  const revenue = data.revenue || 0;
  const cost = data.cost || 0;
  const profit = data.profit ?? revenue - cost;
  return {
    profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
    costRatio: revenue > 0 ? (cost / revenue) * 100 : 0,
    roi: cost > 0 ? (profit / cost) * 100 : 0,
  };
}
