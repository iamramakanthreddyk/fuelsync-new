
import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";

interface Nozzle {
  id: number;
  nozzle_number: number;
  fuel_type: string;
}

export function usePumpNozzles(pumpId?: number) {
  return useQuery({
    queryKey: ["nozzles", pumpId],
    queryFn: async (): Promise<Nozzle[]> => {
      if (!pumpId) return [];
      
      try {
        const response = await apiClient.get<ApiResponse<Nozzle[]>>(
          `/pumps/${pumpId}/nozzles`
        );

        if (response.success && response.data) {
          return response.data;
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch nozzles:', error);
        return [];
      }
    },
    enabled: !!pumpId,
  });
}
