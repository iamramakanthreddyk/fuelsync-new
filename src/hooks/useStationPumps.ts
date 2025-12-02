
import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";


interface Nozzle {
  id: string;
  name: string;
  status: string;
  fuelType?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface Pump {
  id: string;
  stationId: string;
  name: string;
  pumpNumber: number;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  nozzles?: Nozzle[];
}

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
