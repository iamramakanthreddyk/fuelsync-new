import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type ReportType = 'sales' | 'daily-sales' | 'sample-readings' | 'sample-statistics';

export interface ReportRow {
  [key: string]: unknown;
}

export interface SalesReport extends ReportRow {
  stationId: string;
  stationName: string;
  date: string;
  totalSales: number;
  totalQuantity: number;
  totalTransactions: number;
  fuelTypeSales?: {
    fuelType: string;
    sales: number;
    quantity: number;
    transactions: number;
  }[];
}

export interface DailySalesReport extends ReportRow {
  stationId: string;
  stationName: string;
  date: string;
  totalSaleValue: number;
  totalLiters: number;
  readingsCount: number;
  byFuelType?: Record<string, {
    value: number;
    liters: number;
    count: number;
  }>;
  settledCash?: number;
  settledOnline?: number;
  settledCredit?: number;
  settlementStatus?: string;
}

export function useReports(
  stationId?: string,
  startDate?: string,
  endDate?: string,
  reportType: ReportType = 'sales',
  enabled = true
) {
  return useQuery({
    queryKey: ['reports', stationId, startDate, endDate, reportType],
    queryFn: async () => {
      if (!stationId) return { data: [] };

      let endpoint = `/reports/${reportType}`;
      const params = new URLSearchParams();

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (stationId) params.append('stationId', stationId);

      const queryString = params.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }

      const response = await apiClient.get(endpoint);

      // Normalize response - some endpoints return { data: [] }, others return [] directly
      if (response && typeof response === 'object' && 'data' in response) {
        return { data: response.data || [] };
      }

      return { data: response || [] };
    },
    enabled: enabled && !!stationId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
