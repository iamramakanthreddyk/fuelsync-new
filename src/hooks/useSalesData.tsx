
import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { extractApiArray } from "@/lib/api-response";
import { useRoleAccess } from "./useRoleAccess";

export interface Sale {
  id: string;
  stationId: string;
  stationName: string;
  nozzleId: string;
  nozzleNumber: number;
  fuelType: string;
  pumpId: string;
  pumpName: string;
  readingId: string;
  readingDate: string;
  deltaVolumeL: number;
  pricePerLitre: number;
  totalAmount: number;
  paymentBreakdown: Record<string, unknown>;
  cashAmount: number;
  onlineAmount: number;
  enteredBy: string;
  createdAt: string;
}

export function useSalesData(date?: string, startDate?: string, endDate?: string) {
  const { currentStation, canAccessAllStations, role } = useRoleAccess();

  return useQuery({
    queryKey: ['sales', currentStation?.id, date, startDate, endDate],
    queryFn: async (): Promise<Sale[]> => {
      if (!canAccessAllStations && !currentStation?.id && role !== 'manager') {
        return [];
      }

      let url = '/sales';
      const params = new URLSearchParams();

      if (!canAccessAllStations && currentStation?.id) {
        params.append('station_id', currentStation.id.toString());
      }

      if (startDate && endDate) {
        params.append('start_date', startDate);
        params.append('end_date', endDate);
      } else if (date) {
        params.append('date', date);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      try {
        // apiClient.get returns the full envelope {success, data}
        const response = await apiClient.get(url);

        // Extract array data from wrapped response
        const salesData = extractApiArray(response, []);

        if (Array.isArray(salesData)) {
          return salesData;
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch sales:', error);
        return [];
      }
    },
    enabled: canAccessAllStations || !!currentStation?.id || role === 'manager',
  });
}
