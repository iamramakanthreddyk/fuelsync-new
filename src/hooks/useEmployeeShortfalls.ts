import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface EmployeeShortfallRecord {
  employeeName: string;
  employeeId?: string;
  totalShortfall: number;
  daysWithShortfall: number;
  averagePerDay: number;
  settlementsCount: number;
  lastShortfallDate?: string;
  shortfallDates?: string[];
}

export interface EmployeeShortfallsSummary {
  totalShortfall: number;
  employeesAffected: number;
  totalDaysWithShortfall: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface EmployeeShortfallsData {
  data: EmployeeShortfallRecord[];
  summary: EmployeeShortfallsSummary;
}

export function useEmployeeShortfalls(
  stationId: string | undefined,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ['employee-shortfalls', stationId, startDate, endDate],
    queryFn: async () => {
      if (!stationId) return null;
      try {
        const response = await apiClient.get<{ 
          success: boolean; 
          data: EmployeeShortfallRecord[];
          metadata?: any;
        }>(
          `/stations/${stationId}/employee-shortfalls?startDate=${startDate}&endDate=${endDate}`
        );
        
        const records = response?.data;
        if (!records || !Array.isArray(records) || records.length === 0) {
          return null;
        }

        const totalShortfall = records.reduce((sum: number, r: EmployeeShortfallRecord) => sum + r.totalShortfall, 0);
        const totalDaysWithShortfall = records.reduce((sum: number, r: EmployeeShortfallRecord) => sum + r.daysWithShortfall, 0);

        return {
          data: records,
          summary: {
            totalShortfall,
            employeesAffected: records.length,
            totalDaysWithShortfall,
            dateRange: { startDate, endDate }
          }
        } as EmployeeShortfallsData;
      } catch (error) {
        return null;
      }
    },
    enabled: !!stationId && !!startDate && !!endDate
  });
}
