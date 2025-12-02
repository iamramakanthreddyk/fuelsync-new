import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';

export type ReportType = 'daily' | 'monthly' | 'pump' | 'fuel';

export interface ReportRow {
  [key: string]: any;
}

export function useReports(stationId?: string, startDate?: string, endDate?: string, reportType: ReportType = 'daily', enabled = true) {
  return useQuery({
    queryKey: ['reports', stationId, startDate, endDate, reportType],
    queryFn: async () => {
      if (!stationId) return { data: [] } as { data: ReportRow[] };
      const res = await apiService.generateReport(stationId, startDate || '', endDate || '', reportType);
      // normalize response as { data: ReportRow[] }
      return res as { data: ReportRow[] };
    },
    enabled: enabled && !!stationId,
    staleTime: 5 * 60 * 1000,
  });
}
