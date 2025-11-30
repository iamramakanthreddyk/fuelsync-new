/**
 * Analytics Hook
 * Provides easy access to analytics data with caching
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/date-utils';

interface HourlySalesData {
  hour: number;
  date: string;
  volume: number;
  revenue: number;
  salesCount: number;
}

interface PeakHourData {
  hour: number;
  timeRange: string;
  avgVolume: number;
  avgRevenue: number;
  avgSalesCount: number;
}

interface FuelPerformanceData {
  fuelType: string;
  volume: number;
  revenue: number;
  salesCount: number;
  averagePrice: number;
}

interface StationOverviewData {
  today: {
    volume: number;
    revenue: number;
    salesCount: number;
  };
  yesterday: {
    volume: number;
    revenue: number;
    salesCount: number;
  };
  growth: {
    revenue: number;
    volume: number;
  };
}

/**
 * Hook for hourly sales data
 */
export function useHourlySales(
  stationId: string,
  dateFrom: Date,
  dateTo: Date,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['hourly-sales', stationId, formatDate(dateFrom), formatDate(dateTo)],
    queryFn: async () => {
      const response = await apiClient.get<HourlySalesData[]>(
        `/analytics/hourly-sales?stationId=${stationId}&dateFrom=${formatDate(dateFrom)}&dateTo=${formatDate(dateTo)}`
      );
      return response || [];
    },
    enabled: enabled && !!stationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for peak hours data
 */
export function usePeakHours(stationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['peak-hours', stationId],
    queryFn: async () => {
      const response = await apiClient.get<PeakHourData[]>(
        `/analytics/peak-hours?stationId=${stationId}`
      );
      return response || [];
    },
    enabled: enabled && !!stationId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for fuel performance data
 */
export function useFuelPerformance(
  stationId: string,
  dateFrom: Date,
  dateTo: Date,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['fuel-performance', stationId, formatDate(dateFrom), formatDate(dateTo)],
    queryFn: async () => {
      const response = await apiClient.get<FuelPerformanceData[]>(
        `/analytics/fuel-performance?stationId=${stationId}&dateFrom=${formatDate(dateFrom)}&dateTo=${formatDate(dateTo)}`
      );
      return response || [];
    },
    enabled: enabled && !!stationId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for station overview
 */
export function useStationOverview(stationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['station-overview', stationId],
    queryFn: async () => {
      const response = await apiClient.get<StationOverviewData>(
        `/analytics/overview?stationId=${stationId}`
      );
      return response;
    },
    enabled: enabled && !!stationId,
    staleTime: 2 * 60 * 1000, // 2 minutes - more frequent for overview
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });
}

/**
 * Hook for daily sales summary
 */
export function useDailySales(
  stationId: string,
  dateFrom: Date,
  dateTo: Date,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['daily-sales', stationId, formatDate(dateFrom), formatDate(dateTo)],
    queryFn: async () => {
      const response = await apiClient.get<Array<{
        date: string;
        volume: number;
        revenue: number;
        salesCount: number;
      }>>(
        `/analytics/daily-sales?stationId=${stationId}&dateFrom=${formatDate(dateFrom)}&dateTo=${formatDate(dateTo)}`
      );
      return response || [];
    },
    enabled: enabled && !!stationId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for top performing nozzles
 */
export function useTopNozzles(stationId: string, limit: number = 5, enabled: boolean = true) {
  return useQuery({
    queryKey: ['top-nozzles', stationId, limit],
    queryFn: async () => {
      const response = await apiClient.get<Array<{
        nozzleId: string;
        nozzleNumber: number;
        fuelType: string;
        pumpNumber: number;
        volume: number;
        revenue: number;
        salesCount: number;
      }>>(
        `/analytics/top-nozzles?stationId=${stationId}&limit=${limit}`
      );
      return response || [];
    },
    enabled: enabled && !!stationId,
    staleTime: 10 * 60 * 1000,
  });
}
