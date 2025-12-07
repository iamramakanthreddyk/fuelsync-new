/**
 * usePumpsData Hook
 * 
 * Fetches pumps and nozzles from the actual backend endpoints:
 * - GET /api/v1/stations/:stationId/pumps
 * - GET /api/v1/stations/pumps/:pumpId/nozzles
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { extractApiArray } from "@/lib/api-response";
import { useRoleAccess } from "./useRoleAccess";
import { EquipmentStatusEnum, FuelTypeEnum } from "@/core/enums";
import type { Pump as PumpType, Nozzle as NozzleType } from '@/types/api';

// Backend pump format
interface BackendPump {
  id: string;
  stationId: string;
  pumpNumber: number;
  name: string;
  status: EquipmentStatusEnum;
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
  fuelType: FuelTypeEnum;
  status: EquipmentStatusEnum;
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
  const { currentStation, isAdmin } = useRoleAccess();
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
        
        // apiClient.get returns the full response: {success, data}
        const response = await apiClient.get<{ success: boolean; data: BackendPump[] }>(url);
        
        // Extract array data from wrapped response - handles both wrapped and unwrapped
        const pumpsData = extractApiArray(response, []);
        
        console.log('✅ Raw response:', response);
        console.log('✅ Extracted data:', pumpsData);
        console.log('Count:', pumpsData?.length);

        if (Array.isArray(pumpsData) && pumpsData.length > 0) {
          // Transform each pump to frontend format
          const transformed = pumpsData.map(transformPump);
          console.log('✅ Transformed pumps:', transformed);
          return transformed;
        }
        
        console.warn('⚠️ No pumps data found');
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
