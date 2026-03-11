/**
 * Financial Reporting API Service Layer
 * Centralized API calls for owner financial operations
 * 
 * Endpoints:
 * - GET /analytics/owner/stats - Owner dashboard statistics
 * - GET /analytics/owner/analytics - Owner comprehensive analytics
 * - GET /analytics/income-receivables - Income & receivables report
 * - GET /stations/{stationId}/profit-summary - Station profit summary
 * - GET /analytics/sales - Sales analysis
 */

import { apiClient } from './api-client';

export interface OwnerStats {
  totalStations: number;
  totalEmployees: number;
  totalActiveCreditors: number;
  totalOutstandingCredit: number;
  totalSalesValue: number;
  totalSalesLitres: number;
  monthlyTrend: Array<{
    date: string;
    sales: number;
    litres: number;
    credit: number;
  }>;
  stationBreakdown: Array<{
    id: string;
    name: string;
    sales: number;
    litres: number;
    credit: number;
  }>;
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
  salesByStation: Array<{
    stationId: string;
    stationName: string;
    sales: number;
    percentage: number;
  }>;
  dailyTrend: Array<{
    date: string;
    sales: number;
    quantity: number;
    transactions: number;
  }>;
  topPerformingStations: Array<{
    stationId: string;
    stationName: string;
    sales: number;
    growth: number;
  }>;
  employeePerformance: Array<{
    employeeId: string;
    employeeName: string;
    shifts: number;
    totalSales: number;
    averageSales: number;
  }>;
}

export interface IncomeReceivablesReport {
  period: {
    startDate: string;
    endDate: string;
  };
  station: {
    id: string;
    name: string;
  };
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
    creditors: Array<{
      id: string;
      name: string;
      outstanding: number;
      overdue: number;
    }>;
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
    byFuelType: Record<string, {
      revenue: number;
      costOfGoods: number;
      litres: number;
      profitPerLitre: number | null;
      profitMargin: number | null;
      hasCompleteData?: boolean;
    }>;
    byExpenseCategory: Array<{ category: string; label?: string; amount: number }>;
    readingDetails?: Record<string, {
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
    }>;
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

/**
 * Get owner dashboard statistics
 * @param ownerId - Optional owner ID for verification
 * @returns Owner stats with stations, employees, credit info
 */
export async function getOwnerStats(ownerId?: string): Promise<{
  success: boolean;
  data: OwnerStats;
}> {
  try {
    const url = ownerId ? `/analytics/owner/stats?ownerId=${ownerId}` : '/analytics/owner/stats';
    const response = await apiClient.get<{ success: boolean; data: OwnerStats }>(url);
    return response || { success: false, data: {} as OwnerStats };
  } catch (error) {
    console.error('Error fetching owner stats:', error);
    throw error;
  }
}

/**
 * Get owner comprehensive analytics
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param stationId - Optional station filter
 * @returns Detailed analytics with trends and breakdowns
 */
export async function getOwnerAnalytics(
  startDate: string,
  endDate: string,
  stationId?: string
): Promise<{ success: boolean; data: OwnerAnalytics }> {
  try {
    const params = new URLSearchParams({
      startDate,
      endDate
    });
    if (stationId) params.set('stationId', stationId);

    const response = await apiClient.get<{ success: boolean; data: OwnerAnalytics }>(
      `/analytics/owner/analytics?${params.toString()}`
    );
    return response || { success: false, data: {} as OwnerAnalytics };
  } catch (error) {
    console.error('Error fetching owner analytics:', error);
    throw error;
  }
}

/**
 * Get income & receivables report
 * @param stationId - Station ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Income and receivables breakdown
 */
export async function getIncomeReceivablesReport(
  stationId: string,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; data: IncomeReceivablesReport }> {
  try {
    const params = new URLSearchParams({
      stationId,
      startDate,
      endDate,
    });

    const response = await apiClient.get<{
      success: boolean;
      data: IncomeReceivablesReport;
    }>(`/analytics/income-receivables?${params.toString()}`);
    return response || { success: false, data: {} as IncomeReceivablesReport };
  } catch (error) {
    console.error('Error fetching income-receivables report:', error);
    throw error;
  }
}

/**
 * Get station profit summary
 * @param stationId - Station ID
 * @param month - Month in YYYY-MM format (optional)
 * @returns Profit summary with metrics
 */
export async function getProfitSummary(
  stationId: string,
  month?: string
): Promise<{ success: boolean; data: ProfitSummary }> {
  try {
    const url = month
      ? `/stations/${stationId}/profit-summary?month=${month}`
      : `/stations/${stationId}/profit-summary`;

    const response = await apiClient.get<{ success: boolean; data: ProfitSummary }>(url);
    return response || { success: false, data: {} as ProfitSummary };
  } catch (error) {
    console.error('Error fetching profit summary:', error);
    throw error;
  }
}

/**
 * Get sales analysis data
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param stationId - Optional station filter
 * @returns Sales data with aggregations
 */
export async function getSalesAnalysis(
  startDate: string,
  endDate: string,
  stationId?: string
): Promise<{ success: boolean; data: SalesData[] }> {
  try {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    if (stationId) params.set('stationId', stationId);

    const response = await apiClient.get<{ success: boolean; data: SalesData[] }>(
      `/analytics/sales?${params.toString()}`
    );
    return response || { success: false, data: [] };
  } catch (error) {
    console.error('Error fetching sales analysis:', error);
    throw error;
  }
}

/**
 * Helper: Calculate total sales from sales data array
 */
export function calculateTotalSales(salesData: SalesData[]): number {
  return salesData.reduce((sum, sale) => sum + (sale.totalSales || 0), 0);
}

/**
 * Helper: Calculate total litres from sales data array
 */
export function calculateTotalLitres(salesData: SalesData[]): number {
  return salesData.reduce((sum, sale) => sum + (sale.totalLitres || 0), 0);
}

/**
 * Helper: Parse sales amount (handle string/number)
 */
export function parseSalesAmount(amount: string | number | undefined): number {
  if (!amount) return 0;
  if (typeof amount === 'number') return amount;
  const parsed = parseFloat(amount as string);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Helper: Group sales data by station
 */
export function groupSalesByStation(
  salesData: SalesData[]
): Record<string, { name: string; sales: number; litres: number; items: SalesData[] }> {
  const grouped: Record<string, { name: string; sales: number; litres: number; items: SalesData[] }> = {};

  salesData.forEach(sale => {
    const stationId = sale.stationId || 'unknown';
    if (!grouped[stationId]) {
      grouped[stationId] = {
        name: sale.stationName || 'Unknown Station',
        sales: 0,
        litres: 0,
        items: [],
      };
    }
    grouped[stationId].sales += parseSalesAmount(sale.totalSales);
    grouped[stationId].litres += parseSalesAmount(sale.totalLitres);
    grouped[stationId].items.push(sale);
  });

  return grouped;
}

/**
 * Helper: Calculate financial ratios
 */
export function calculateFinancialRatios(data: { revenue?: number; cost?: number; profit?: number }) {
  const revenue = data.revenue || 0;
  const cost = data.cost || 0;
  const profit = data.profit || revenue - cost;

  return {
    profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
    costRatio: revenue > 0 ? (cost / revenue) * 100 : 0,
    roi: cost > 0 ? (profit / cost) * 100 : 0,
  };
}
