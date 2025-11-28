/**
 * useFuelPricesData Hook
 * 
 * Fetches fuel prices from the actual backend endpoint:
 * - GET /api/v1/stations/:stationId/prices
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { useRoleAccess } from "./useRoleAccess";

// Backend price format
interface BackendFuelPrice {
  id: string;
  stationId: string;
  fuelType: 'petrol' | 'diesel';
  price: number;
  effectiveFrom: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Frontend-friendly format (for backward compatibility)
export interface FuelPrice {
  id: number | string;
  station_id: string;
  fuel_type: 'PETROL' | 'DIESEL' | 'CNG' | 'EV';
  price_per_litre: number;
  valid_from: string;
  created_by?: string;
  created_at: string;
}

// Transform backend format to frontend format
function transformPrice(price: BackendFuelPrice): FuelPrice {
  return {
    id: price.id,
    station_id: price.stationId,
    fuel_type: price.fuelType.toUpperCase() as 'PETROL' | 'DIESEL' | 'CNG' | 'EV',
    price_per_litre: price.price,
    valid_from: price.effectiveFrom,
    created_by: price.createdBy,
    created_at: price.createdAt
  };
}

export function useFuelPricesData() {
  const { currentStation, isAdmin } = useRoleAccess();
  const stationId = currentStation?.id;

  return useQuery<FuelPrice[]>({
    queryKey: ['fuel-prices', stationId],
    queryFn: async () => {
      if (!stationId && !isAdmin) {
        return [];
      }

      try {
        // Use the correct endpoint: /stations/:stationId/prices
        const url = `/stations/${stationId}/prices`;
        // apiClient.get already unwraps {success, data} structure
        const data = await apiClient.get<{ current: BackendFuelPrice[], history: BackendFuelPrice[] }>(url);

        // Backend returns {current: [], history: []} - we want current prices
        if (data && data.current && Array.isArray(data.current)) {
          return data.current.map(transformPrice);
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch fuel prices:', error);
        return [];
      }
    },
    enabled: !!stationId || isAdmin,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
