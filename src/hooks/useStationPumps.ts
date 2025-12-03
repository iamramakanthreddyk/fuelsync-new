
import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import type { Pump, Nozzle } from "@/types/api";

export function useStationPumps(stationId?: string) {
  return useQuery({
    queryKey: ["pumps", stationId],
    queryFn: async (): Promise<Pump[]> => {
      if (!stationId) return [];
      
      try {
        // apiClient.get already unwraps {success, data} structure
        const pumps = await apiClient.get<Pump[]>(
          `/stations/${stationId}/pumps`
        );

        if (Array.isArray(pumps)) {
          return pumps;
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
