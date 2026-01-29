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

export interface Settlement {
  id: string;
  date: string;
  stationId: string;
  stationName?: string; // Added for multi-station support
  expectedCash: number;
  actualCash: number;
  variance: number;
  online: number;
  credit: number;
  varianceOnline?: number;
  varianceCredit?: number;
  employeeCash?: number;
  employeeOnline?: number;
  employeeCredit?: number;
  notes?: string;
  status: 'draft' | 'final' | 'locked';
  recordedBy: string;
  recordedAt: string;
  isFinal?: boolean;
  finalizedAt?: string;
  readingIds?: string[];
  employeeShortfalls?: Record<string, { employeeName: string; shortfall: number; count: number }>;
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
// AGGREGATION HELPERS
// ============================================

/**
 * Aggregate raw reading data into SalesReport format
 * Groups by station and date, aggregates sales and fuel type breakdown
 * NOTE: API response uses snake_case but apiClient converts to camelCase
 */
export function aggregateRawReadingsToSalesReports(readings: any[]): SalesReport[] {
  if (!readings || readings.length === 0) return [];

  // Group by station_id + date
  // Note: Keys are camelCase (stationId, readingDate) due to apiClient conversion
  const grouped = new Map<string, any[]>();
  readings.forEach(reading => {
    // Use camelCase keys (from apiClient conversion)
    const stationId = reading.stationId;
    const readingDate = reading.readingDate;
    
    const key = `${stationId}|${readingDate}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(reading);
  });

  // Convert to SalesReport format
  const reports = Array.from(grouped.values()).map(readingsGroup => {
    const firstReading = readingsGroup[0];
    
    // Handle camelCase field names from apiClient conversion
    const totalSales = readingsGroup.reduce((sum, r) => {
      const val = r.totalAmount ?? 0;
      const num = typeof val === 'string' ? parseFloat(val) : Number(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
    
    const totalQuantity = readingsGroup.reduce((sum, r) => {
      const val = r.deltaVolumeL ?? 0;
      const num = typeof val === 'string' ? parseFloat(val) : Number(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);

    // Group by fuel type for breakdown
    const fuelMap = new Map<string, any>();
    readingsGroup.forEach(reading => {
      const fuelType = reading.fuelType || 'unknown';
      if (!fuelMap.has(fuelType)) {
        fuelMap.set(fuelType, { fuelType, sales: 0, quantity: 0, transactions: 0 });
      }
      const fuel = fuelMap.get(fuelType)!;
      const salesVal = reading.totalAmount ?? 0;
      const salesNum = typeof salesVal === 'string' ? parseFloat(salesVal) : Number(salesVal);
      fuel.sales += isNaN(salesNum) ? 0 : salesNum;
      
      const qtyVal = reading.deltaVolumeL ?? 0;
      const qtyNum = typeof qtyVal === 'string' ? parseFloat(qtyVal) : Number(qtyVal);
      fuel.quantity += isNaN(qtyNum) ? 0 : qtyNum;
      fuel.transactions += 1;
    });

    const report: SalesReport = {
      stationId: firstReading.stationId,
      stationName: firstReading.stationName,
      date: firstReading.readingDate || new Date().toISOString().split('T')[0],
      totalSales: Math.round(totalSales * 100) / 100,
      totalQuantity: Math.round(totalQuantity * 100) / 100,
      totalTransactions: readingsGroup.length,
      fuelTypeSales: Array.from(fuelMap.values()),
    };
    
    return report;
  });

  return reports;
}

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
      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        `/analytics/sales?${params}`
      );
      const rawReadings = extractApiArray(response, []);
      
      // Aggregate raw readings into SalesReport format
      return aggregateRawReadingsToSalesReports(rawReadings);
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
      const response = await apiClient.get<{ success: boolean; data: { pumps: PumpPerformance[] } }>(
        `/analytics/pump-performance?${params}`
      );
      
      // Extract data object directly (not as array)
      const dataObj = (response as any)?.data;
      
      // If data is an object with pumps property, return pumps
      if (dataObj && typeof dataObj === 'object' && Array.isArray(dataObj.pumps)) {
        return dataObj.pumps;
      }
      
      // If data is already an array, return it
      if (Array.isArray(dataObj)) {
        return dataObj;
      }
      
      return [];
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
      }>(`/analytics/nozzle-breakdown?${params}`);

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
export function calculateSalesTotals(reports: any[] | undefined) {
  if (!reports || reports.length === 0) return { sales: 0, quantity: 0, transactions: 0 };
  
  // Handle both aggregated report format and raw reading format
  const firstReport = reports[0];
  
  // After API client converts snake_case to camelCase:
  // Aggregated format has: totalSales, totalQuantity, totalTransactions, fuelTypeSales[]
  // Raw format has: totalAmount, deltaVolumeL, readingDate, stationId
  const hasAggregatedFormat = 'totalSales' in firstReport && 'totalQuantity' in firstReport && 'fuelTypeSales' in firstReport;
  const hasRawFormat = 'totalAmount' in firstReport && 'deltaVolumeL' in firstReport && 'readingDate' in firstReport;
  
  if (hasAggregatedFormat) {
    // Aggregated format: sum up the aggregated totals
    return reports.reduce(
      (acc, report) => {
        const sales = Number(report.totalSales) || 0;
        const quantity = Number(report.totalQuantity) || 0;
        const transactions = Number(report.totalTransactions) || 0;
        
        return {
          sales: acc.sales + sales,
          quantity: acc.quantity + quantity,
          transactions: acc.transactions + transactions,
        };
      },
      { sales: 0, quantity: 0, transactions: 0 }
    );
  }
  
  if (hasRawFormat) {
    // Raw reading format: sum individual readings (camelCase after API client conversion)
    return reports.reduce(
      (acc, reading) => ({
        sales: acc.sales + (Number(reading.totalAmount) || 0),
        quantity: acc.quantity + (Number(reading.deltaVolumeL) || 0),
        transactions: acc.transactions + 1,
      }),
      { sales: 0, quantity: 0, transactions: 0 }
    );
  }
  
  // Fallback: assume raw format with camelCase
  return reports.reduce(
    (acc, report) => ({
      sales: acc.sales + (Number(report.totalAmount) || 0),
      quantity: acc.quantity + (Number(report.deltaVolumeL) || 0),
      transactions: acc.transactions + 1,
    }),
    { sales: 0, quantity: 0, transactions: 0 }
  );
}

export const useSettlements = ({ dateRange, selectedStation }: ReportQueryParams) => {
  return useQuery({
    queryKey: ['settlements', dateRange, selectedStation],
    queryFn: async () => {
      if (selectedStation === 'all') {
        // Fetch settlements from all accessible stations
        const stationsResponse = await apiClient.get('/stations');
        const stations = extractApiArray(stationsResponse);

        if (!stations || stations.length === 0) {
          return [];
        }

        // Fetch settlements for each station and combine
        const allSettlements = await Promise.all(
          stations.map(async (station: any) => {
            try {
              const params = buildReportParams({ dateRange, selectedStation: station.id });
              const response = await apiClient.get<{ success: boolean; data: Settlement[] }>(
                `/stations/${station.id}/settlements?${params}`
              );
              const stationSettlements = extractApiArray(response);
              // Add station info to each settlement
              return stationSettlements.map((settlement: Settlement) => ({
                ...settlement,
                stationName: station.name,
                stationId: station.id,
              }));
            } catch (error) {
              // If a station doesn't have settlements endpoint or fails, skip it
              console.warn(`Failed to fetch settlements for station ${station.id}:`, error);
              return [];
            }
          })
        );

        return allSettlements.flat();
      } else {
        // Fetch settlements for specific station
        const params = buildReportParams({ dateRange, selectedStation });
        const response = await apiClient.get<{ success: boolean; data: Settlement[] }>(
          `/stations/${selectedStation}/settlements?${params}`
        );
        return extractApiArray(response);
      }
    },
    enabled: !!selectedStation,
  });
};
