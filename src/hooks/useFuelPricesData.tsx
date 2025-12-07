/**
 * useFuelPricesData Hook
 * 
 * Fetches fuel prices from the actual backend endpoint:
 * - GET /api/v1/stations/:stationId/prices
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { extractNestedData } from "@/lib/api-response";
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

export function useFuelPricesData(overrideStationId?: string) {
  const { currentStation, isAdmin } = useRoleAccess();
  // Use provided stationId or fall back to currentStation
  const stationId = overrideStationId || currentStation?.id;

  return useQuery<FuelPrice[]>({
    queryKey: ['fuel-prices', stationId],
    queryFn: async () => {
      // Prevent API call if stationId is undefined
      if (!stationId) {
        return [];
      }
      try {
        // Use the correct endpoint: /stations/:stationId/prices
        const url = `/stations/${stationId}/prices`;
        // apiClient.get returns the full response: {success, data}
        const response = await apiClient.get<ApiResponse<{ current: BackendFuelPrice[], history: BackendFuelPrice[] }>>(url);

        // Extract current prices from the API response
        // Handle the specific structure: {success, data: {current: [...]}, fuelPrices: {current: [...]}}
        let currentPrices: BackendFuelPrice[] = [];
        
        // The apiClient returns the wrapped response: {success, data, ...}
        // For fuel prices, data contains {current: [...], history: [...]}
        if (response && typeof response === 'object' && 'data' in response) {
          const data = response.data;
          if (data && typeof data === 'object' && 'current' in data && Array.isArray(data.current)) {
            currentPrices = data.current;
          }
        }
        
        // Fallback: check if response has fuelPrices directly
        if (currentPrices.length === 0 && response && typeof response === 'object' && 'fuelPrices' in response) {
          const fuelPrices = response.fuelPrices;
          if (fuelPrices && typeof fuelPrices === 'object' && 'current' in fuelPrices && Array.isArray(fuelPrices.current)) {
            currentPrices = fuelPrices.current;
          }
        }
        
        if (currentPrices.length > 0) {
          const transformed = currentPrices.map(transformPrice);
          return transformed;
        }
        return [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!stationId,
    staleTime: 0, // Force refetch to debug
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
