import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type ReportType = 'daily' | 'monthly' | 'pump' | 'fuel';

export interface ReportRow {
  [key: string]: unknown;
}

export function useReports(stationId?: string, startDate?: string, endDate?: string, reportType: ReportType = 'daily', enabled = true) {
  return useQuery({
    queryKey: ['reports', stationId, startDate, endDate, reportType],
    queryFn: async () => {
      if (!stationId) return { data: [] } as { data: ReportRow[] };
      const res = await apiClient.get<ReportRow[]>(`/api/v1/reports/${reportType}?stationId=${stationId}&startDate=${startDate || ''}&endDate=${endDate || ''}`);
      // normalize response as { data: ReportRow[] }
      return { data: res || [] } as { data: ReportRow[] };
    },
    enabled: enabled && !!stationId,
    staleTime: 5 * 60 * 1000,
  });
}
