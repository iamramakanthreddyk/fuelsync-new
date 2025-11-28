
import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";

interface Pump {
  id: number;
  pump_sno: string;
  name: string;
}

export function useStationPumps(stationId?: number) {
  return useQuery({
    queryKey: ["pumps", stationId],
    queryFn: async (): Promise<Pump[]> => {
      if (!stationId) return [];
      
      try {
        const response = await apiClient.get<ApiResponse<Pump[]>>(
          `/stations/${stationId}/pumps`
        );

        if (response.success && response.data) {
          return response.data;
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch station pumps:', error);
        return [];
      }
    },
    enabled: !!stationId,
  });
}
