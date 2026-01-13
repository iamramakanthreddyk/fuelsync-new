import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface DayVarianceData {
  date: string;
  variance: number;
  expectedCash: number;
  settlementCount: number;
  variancePercentage: number;
}

export interface VarianceSummaryData {
  periodStart: string;
  periodEnd: string;
  settlementCount: number;
  dayCount: number;
  totalVariance: number;
  avgDailyVariance: number;
  totalExpectedCash: number;
  variancePercentage: number;
  byDay: DayVarianceData[];
  summary: {
    status: 'HEALTHY' | 'REVIEW' | 'INVESTIGATE' | 'NO_DATA';
    interpretation: string;
    message: string;
  };
}

export function useVarianceSummary(
  stationId: string | undefined,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ['variance-summary', stationId, startDate, endDate],
    queryFn: async () => {
      if (!stationId) return null;
      const response = await apiClient.get<{ success: boolean; data: VarianceSummaryData }>(
        `/stations/${stationId}/variance-summary?startDate=${startDate}&endDate=${endDate}`
      );
      return response?.data || null;
    },
    enabled: !!stationId && !!startDate && !!endDate
  });
}
