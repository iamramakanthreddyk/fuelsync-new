/**
 * usePumpsData Hook
 * 
 * Fetches pumps and nozzles from the actual backend endpoints:
 * - GET /api/v1/stations/:stationId/pumps
 * - GET /api/v1/stations/pumps/:pumpId/nozzles
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { useRoleAccess } from "./useRoleAccess";

// Backend pump format
interface BackendPump {
  id: string;
  stationId: string;
  pumpNumber: number;
  name: string;
  status: 'active' | 'inactive' | 'maintenance';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  nozzles?: BackendNozzle[];
}

interface BackendNozzle {
  id: string;
  pumpId: string;
  stationId: string;
  nozzleNumber: number;
  fuelType: 'petrol' | 'diesel';
  status: 'active' | 'inactive' | 'maintenance';
  initialReading: number;
  lastReading?: number;
  lastReadingDate?: string;
}

// Frontend-friendly format (for backward compatibility)
export interface Pump {
  id: number | string;
  pump_sno: string;
  name: string;
  is_active: boolean;
  station_id: string;
  created_at: string;
  updated_at: string;
  nozzles: Array<{
    id: string;
    nozzle_number: number;
    fuel_type: 'PETROL' | 'DIESEL' | 'CNG' | 'EV';
    is_active: boolean;
    pumpId: string;
    initialReading?: number;
    lastReading?: number;
  }>;
}

// Transform backend format to frontend format
function transformPump(pump: BackendPump): Pump {
  return {
    id: pump.id,
    pump_sno: `P${pump.pumpNumber}`,
    name: pump.name,
    is_active: pump.status === 'active',
    station_id: pump.stationId,
    created_at: pump.createdAt,
    updated_at: pump.updatedAt,
    nozzles: (pump.nozzles || []).map(nozzle => ({
      id: nozzle.id,
      nozzle_number: nozzle.nozzleNumber,
      fuel_type: nozzle.fuelType.toUpperCase() as 'PETROL' | 'DIESEL' | 'CNG' | 'EV',
      is_active: nozzle.status === 'active',
      pumpId: nozzle.pumpId,
      initialReading: nozzle.initialReading,
      lastReading: nozzle.lastReading
    }))
  };
}

export function usePumpsData() {
  const { currentStation, canAccessAllStations, isAdmin } = useRoleAccess();
  const stationId = currentStation?.id;

  return useQuery<Pump[]>({
    queryKey: ['pumps', stationId],
    queryFn: async () => {
      if (!stationId && !isAdmin) {
        return [];
      }

      try {
        // Use the correct endpoint: /stations/:stationId/pumps
        const url = `/stations/${stationId}/pumps`;
        const response = await apiClient.get<ApiResponse<BackendPump[]>>(url);

        if (response.success && response.data) {
          // Transform each pump to frontend format
          return response.data.map(transformPump);
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch pumps:', error);
        return [];
      }
    },
    enabled: !!stationId || isAdmin,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
