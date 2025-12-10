/**
 * Report Hooks
 * Custom hooks for fetching and managing report data
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { extractApiArray } from '@/lib/api-response';
import type { DateRange } from '@/components/reports';

// ============================================
// TYPES
// ============================================

export interface SalesReport {
  stationId: string;
  stationName: string;
  date: string;
  totalSales: number;
  totalQuantity: number;
  totalTransactions: number;
  fuelTypeSales: {
    fuelType: string;
    sales: number;
    quantity: number;
    transactions: number;
  }[];
}

export interface ShiftReport {
  id: number;
  stationName: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  openingCash: number;
  closingCash: number;
  totalSales: number;
  cashSales: number;
  digitalSales: number;
  status: 'active' | 'completed' | 'cancelled';
}

export interface PumpPerformance {
  pumpId: string;
  pumpName: string;
  pumpNumber: string;
  stationName: string;
  totalSales: number;
  totalQuantity: number;
  transactions: number;
  nozzles: {
    nozzleId: string;
    nozzleNumber: string;
    fuelType: string;
    sales: number;
    quantity: number;
  }[];
}

export interface NozzleBreakdown {
  nozzleId: string;
  nozzleNumber: number | string;
  fuelType: string;
  pumpName: string;
  stationName: string;
  totalSales: number;
  totalQuantity: number;
  transactions: number;
  avgTransactionValue: number;
}

interface ReportQueryParams {
  dateRange: DateRange;
  selectedStation: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const buildReportParams = ({ dateRange, selectedStation }: ReportQueryParams) => {
  const params = new URLSearchParams({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  if (selectedStation !== 'all') {
    params.append('stationId', selectedStation);
  }
  return params.toString();
};

// ============================================
// HOOKS
// ============================================

/**
 * Hook to fetch sales reports
 */
export function useSalesReports({ dateRange, selectedStation }: ReportQueryParams) {
  return useQuery({
    queryKey: ['sales-reports', dateRange, selectedStation],
    queryFn: async () => {
      const params = buildReportParams({ dateRange, selectedStation });
      const response = await apiClient.get<{ success: boolean; data: SalesReport[] }>(
        `/reports/sales?${params}`
      );
      return extractApiArray(response, []);
    },
  });
}

/**
 * Hook to fetch shift reports
 */
export function useShiftReports({ dateRange, selectedStation }: ReportQueryParams) {
  return useQuery({
    queryKey: ['shift-reports', dateRange, selectedStation],
    queryFn: async () => {
      const params = buildReportParams({ dateRange, selectedStation });
      const response = await apiClient.get<{ success: boolean; data: ShiftReport[] }>(
        `/reports/shifts?${params}`
      );
      return extractApiArray(response, []);
    },
  });
}

/**
 * Hook to fetch pump performance data
 */
export function usePumpPerformance({ dateRange, selectedStation }: ReportQueryParams) {
  return useQuery({
    queryKey: ['pump-performance', dateRange, selectedStation],
    queryFn: async () => {
      const params = buildReportParams({ dateRange, selectedStation });
      const response = await apiClient.get<{ success: boolean; data: PumpPerformance[] }>(
        `/reports/pumps?${params}`
      );
      return extractApiArray(response, []);
    },
  });
}

/**
 * Hook to fetch nozzle breakdown data
 */
export function useNozzleBreakdown({ dateRange, selectedStation }: ReportQueryParams) {
  return useQuery({
    queryKey: ['nozzle-breakdown', dateRange, selectedStation],
    queryFn: async () => {
      const params = buildReportParams({ dateRange, selectedStation });
      const response = await apiClient.get<{
        success: boolean;
        data: {
          startDate: string;
          endDate: string;
          nozzles: Array<{
            nozzleId: string;
            nozzleNumber: number;
            fuelType?: string;
            fuelLabel?: string;
            pump?: { id?: string; name?: string; number?: number };
            litres?: number;
            amount?: number;
            cash?: number;
            online?: number;
            credit?: number;
            readings?: number;
          }>;
        };
      }>(`/dashboard/nozzle-breakdown?${params}`);

      const backendNozzles =
        (response as any)?.data?.nozzles || (response as any)?.nozzles || [];

      // Map backend shape to UI shape
      const mapped: NozzleBreakdown[] = (
        Array.isArray(backendNozzles) ? backendNozzles : []
      ).map((n: any) => ({
        nozzleId: n.nozzleId,
        nozzleNumber: n.nozzleNumber,
        fuelType: n.fuelType || n.fuelLabel || 'unknown',
        pumpName: n.pump?.name || '',
        stationName: '',
        totalSales: n.amount ?? 0,
        totalQuantity: n.litres ?? 0,
        transactions: n.readings ?? 0,
        avgTransactionValue:
          n.readings && n.readings > 0 ? (n.amount ?? 0) / n.readings : 0,
      }));

      return mapped;
    },
  });
}

/**
 * Calculate totals from sales reports
 */
export function calculateSalesTotals(reports: SalesReport[] | undefined) {
  if (!reports) return { sales: 0, quantity: 0, transactions: 0 };
  return reports.reduce(
    (acc, report) => ({
      sales: acc.sales + report.totalSales,
      quantity: acc.quantity + report.totalQuantity,
      transactions: acc.transactions + report.totalTransactions,
    }),
    { sales: 0, quantity: 0, transactions: 0 }
  );
}
