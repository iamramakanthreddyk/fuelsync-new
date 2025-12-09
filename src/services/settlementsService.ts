/*
 * Settlements Service
 * Replaces dailyClosureService with settlement-centric naming.
 */
import { apiClient, ApiResponse } from '@/lib/api-client';

export interface DailySummary {
  date: string;
  today: {
    litres: number;
    amount: number;
    cash: number;
    online: number;
    credit: number;
    readings: number;
  };
  creditOutstanding: number;
  pumps: PumpSummary[];
}

export interface PumpSummary {
  id: number;
  name: string;
  number: number;
  status: string;
  nozzleCount: number;
  activeNozzles: number;
  today: {
    litres: number;
    amount: number;
  };
}

export const settlementsService = {
  async getDailySummary(stationId?: string, date?: string): Promise<DailySummary | null> {
    try {
      let url = '/dashboard/summary';
      const params: string[] = [];
      if (stationId) params.push(`stationId=${encodeURIComponent(stationId)}`);
      if (date) params.push(`startDate=${encodeURIComponent(date)}&endDate=${encodeURIComponent(date)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await apiClient.get<ApiResponse<DailySummary>>(url);
      if (response && (response as any).success && (response as any).data) {
        return (response as any).data as DailySummary;
      }
      return null;
    } catch (err) {
      console.warn('settlementsService.getDailySummary error', err);
      return null;
    }
  }
};
