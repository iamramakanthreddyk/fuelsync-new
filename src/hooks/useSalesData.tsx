
import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { useRoleAccess } from "./useRoleAccess";

interface Sale {
  id: number;
  station_id: number;
  nozzle_id: number;
  reading_id: number;
  delta_volume_l: number;
  price_per_litre: number;
  total_amount: number;
  created_at: string;
}

export function useSalesData(date?: string) {
  const { currentStation, canAccessAllStations } = useRoleAccess();

  return useQuery({
    queryKey: ['sales', currentStation?.id, date],
    queryFn: async (): Promise<Sale[]> => {
      if (!canAccessAllStations && !currentStation?.id) {
        return [];
      }

      let url = '/sales';
      const params = new URLSearchParams();

      if (!canAccessAllStations && currentStation?.id) {
        params.append('station_id', currentStation.id.toString());
      }

      if (date) {
        params.append('date', date);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      try {
        const response = await apiClient.get<ApiResponse<Sale[]>>(url);
        
        if (response.success && response.data) {
          return response.data;
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch sales:', error);
        return [];
      }
    },
    enabled: canAccessAllStations || !!currentStation?.id,
  });
}
