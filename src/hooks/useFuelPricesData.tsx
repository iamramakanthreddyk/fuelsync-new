/**
 * useFuelPricesData Hook
 *
 * Fetches fuel prices from the actual backend endpoint:
 * - GET /api/v1/stations/:stationId/prices
 *
 * Now optimized to fetch all prices for all user's stations once
 * and cache them globally for reuse across components.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { useRoleAccess } from "./useRoleAccess";
import { FuelTypeEnum } from "@/core/enums";
import { useFuelPricesGlobal } from "@/context/FuelPricesContext";

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
  const { currentStation, stations } = useRoleAccess();
  const queryClient = useQueryClient();
  const stationId = overrideStationId || currentStation?.id;

  // Read from the global fuel prices cache
  const globalQueryKey = ['all-fuel-prices', stations?.map(s => s.id).sort().join(',')];
  const globalData = queryClient.getQueryData<Record<string, FuelPrice[]>>(globalQueryKey);

  // Transform the data to match the expected format
  const fuelPrices = stationId && globalData ? globalData[stationId] || [] : [];

  // Return in the same format as useQuery
  return {
    data: fuelPrices,
    isLoading: false, // Data should already be loaded by the global query
    error: null,
    refetch: () => queryClient.invalidateQueries({ queryKey: globalQueryKey }),
  };
}
