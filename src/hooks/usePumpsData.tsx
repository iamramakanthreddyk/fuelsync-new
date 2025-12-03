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
import type { Pump as PumpType, Nozzle as NozzleType } from '@/types/api';

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

// Transform backend format to frontend format
function transformPump(pump: BackendPump): PumpType {
  return {
    id: pump.id,
    stationId: pump.stationId,
    pumpNumber: pump.pumpNumber,
    name: pump.name,
    status: pump.status,
    notes: pump.notes,
    createdAt: pump.createdAt,
    updatedAt: pump.updatedAt,
    nozzles: (pump.nozzles || []).map(nozzle => ({
      id: nozzle.id,
      pumpId: nozzle.pumpId,
      stationId: nozzle.stationId,
      nozzleNumber: nozzle.nozzleNumber,
      fuelType: (nozzle.fuelType as 'petrol' | 'diesel'),
      status: nozzle.status,
      initialReading: nozzle.initialReading,
      lastReading: nozzle.lastReading,
      lastReadingDate: nozzle.lastReadingDate,
      createdAt: '',
      updatedAt: ''
    } as NozzleType))
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
        console.log('🔍 Fetching pumps from:', url);
        
        // apiClient.get already unwraps {success, data} structure
        const pumps = await apiClient.get<BackendPump[]>(url);
        
        console.log('✅ Pumps fetched:', pumps);
        console.log('Is array?', Array.isArray(pumps));
        console.log('Count:', pumps?.length);

        if (Array.isArray(pumps)) {
          // Transform each pump to frontend format
          const transformed = pumps.map(transformPump);
          console.log('✅ Transformed pumps:', transformed);
          return transformed;
        }
        
        console.warn('⚠️ Pumps is not an array:', pumps);
        return [];
      } catch (error) {
        console.error('❌ Error fetching pumps:', error);
        return [];
      }
    },
    enabled: !!stationId || isAdmin,
    staleTime: 30000,
  });
}
