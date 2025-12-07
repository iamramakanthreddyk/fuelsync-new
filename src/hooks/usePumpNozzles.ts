
import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";

interface Nozzle {
  id: string;
  nozzleNumber: number;
  fuelType: string;
  status: string;
}

export function usePumpNozzles(pumpId?: string) {
  return useQuery({
    queryKey: ["nozzles", pumpId],
    queryFn: async (): Promise<Nozzle[]> => {
      if (!pumpId) return [];
      
      try {
        // apiClient.get already unwraps {success, data} structure
        // Route is under /stations prefix: /api/v1/stations/pumps/:pumpId/nozzles
        const nozzles = await apiClient.get<Nozzle[]>(
          `/stations/pumps/${pumpId}/nozzles`
        );

        if (Array.isArray(nozzles)) {
          return nozzles;
        }
        return [];
      } catch (error) {
        console.error('❌ Failed to fetch nozzles:', error);
        return [];
      }
    },
    enabled: !!pumpId,
  });
}
