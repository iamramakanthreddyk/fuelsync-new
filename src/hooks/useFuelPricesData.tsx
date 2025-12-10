/**
 * useFuelPricesData Hook
 * 
 * Fetches fuel prices from the actual backend endpoint:
 * - GET /api/v1/stations/:stationId/prices
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { useRoleAccess } from "./useRoleAccess";
import { FuelTypeEnum } from "@/core/enums";
import { useFuelPricesGlobal, setPricesFromDashboard } from "@/context/FuelPricesContext";

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
// Includes both snake_case and camelCase for flexibility
export interface FuelPrice {
  id: number | string;
  station_id: string;
  stationId?: string; // camelCase alias
  fuel_type: string; // Normalized to uppercase: PETROL, DIESEL, etc.
  fuelType?: string; // camelCase alias (lowercase from backend)
  price_per_litre: number;
  pricePerLitre?: number; // camelCase alias
  price?: number; // backend original
  valid_from: string;
  validFrom?: string; // camelCase alias
  created_by?: string;
  createdBy?: string; // camelCase alias
  created_at: string;
  createdAt?: string; // camelCase alias
}

/**
 * Normalize fuel type to uppercase key for FuelPriceCard
 * Handles both lowercase backend values and uppercase display keys
 */
export function normalizeFuelType(fuelType: string): string {
  if (!fuelType) return '';
  const lower = fuelType.toLowerCase();
  // Map backend enum values to display keys
  switch (lower) {
    case FuelTypeEnum.PETROL:
    case 'petrol':
      return 'PETROL';
    case FuelTypeEnum.DIESEL:
    case 'diesel':
      return 'DIESEL';
    case FuelTypeEnum.CNG:
    case 'cng':
      return 'CNG';
    case FuelTypeEnum.LPG:
    case 'lpg':
      return 'LPG';
    case FuelTypeEnum.EV_CHARGING:
    case 'ev_charging':
    case 'ev':
      return 'EV';
    case FuelTypeEnum.PREMIUM_PETROL:
    case 'premium_petrol':
      return 'PREMIUM_PETROL';
    case FuelTypeEnum.PREMIUM_DIESEL:
    case 'premium_diesel':
      return 'PREMIUM_DIESEL';
    default:
      return fuelType.toUpperCase();
  }
}

// Transform backend format to frontend format
function transformPrice(price: BackendFuelPrice): FuelPrice {
  return {
    id: price.id,
    station_id: price.stationId,
    fuel_type: normalizeFuelType(price.fuelType),
    fuelType: price.fuelType, // Keep original for reference
    price_per_litre: price.price,
    pricePerLitre: price.price, // Alias
    price: price.price, // Original
    valid_from: price.effectiveFrom,
    created_by: price.createdBy,
    created_at: price.createdAt
  };
}

export function useFuelPricesData(overrideStationId?: string) {
  const { currentStation } = useRoleAccess();
  const { prices, setPrices } = useFuelPricesGlobal();
  const stationId = overrideStationId || currentStation?.id;

  // If prices exist in context, use them
  const contextPrices = Object.entries(prices || {}).map(([fuelType, price]) => ({
    id: fuelType,
    station_id: stationId,
    fuel_type: fuelType,
    price_per_litre: price,
  }));

  return useQuery<FuelPrice[]>({
    queryKey: ['fuel-prices', stationId],
    queryFn: async () => {
      if (contextPrices.length > 0) {
        return contextPrices;
      }
      if (!stationId) {
        return [];
      }
      try {
        const url = `/stations/${stationId}/prices`;
        const response = await apiClient.get<ApiResponse<{ current: BackendFuelPrice[], history: BackendFuelPrice[] }>>(url);
        let currentPrices: BackendFuelPrice[] = [];
        if (response && typeof response === 'object' && 'data' in response) {
          const data = response.data;
          if (data && typeof data === 'object' && 'current' in data && Array.isArray(data.current)) {
            currentPrices = data.current;
          }
        }
        if (currentPrices.length === 0 && response && typeof response === 'object' && 'fuelPrices' in response) {
          const fuelPrices = response.fuelPrices;
          if (fuelPrices && typeof fuelPrices === 'object' && 'current' in fuelPrices && Array.isArray(fuelPrices.current)) {
            currentPrices = fuelPrices.current;
          }
        }
        if (currentPrices.length > 0) {
          // Set in context for reuse
          setPricesFromDashboard({ fuelPrices: { current: currentPrices } }, setPrices);
          const transformed = currentPrices.map(transformPrice);
          return transformed;
        }
        return [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!stationId,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
