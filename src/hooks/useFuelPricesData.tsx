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
  costPrice?: number | null;
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
  cost_price?: number | null; // Purchase price for COGS calculation
  costPrice?: number | null; // camelCase alias
  profit_per_litre?: number; // profit = price - cost
  profitPerLitre?: number; // camelCase alias
  profit_margin?: number; // (profit / price) * 100
  profitMargin?: number; // camelCase alias
  has_cost_price?: boolean; // Whether cost price is available
  hasCostPrice?: boolean; // camelCase alias
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
      return 'EV_CHARGING';
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
  const sellingPrice = price.price;
  const costPrice = price.costPrice;
  const hasCostPrice = costPrice !== null && costPrice !== undefined && costPrice > 0;
  
  let profitPerLitre: number | undefined;
  let profitMargin: number | undefined;
  
  if (hasCostPrice && costPrice! < sellingPrice) {
    profitPerLitre = parseFloat((sellingPrice - costPrice!).toFixed(2));
    profitMargin = parseFloat(((profitPerLitre / sellingPrice) * 100).toFixed(2));
  }
  
  return {
    id: price.id,
    station_id: price.stationId,
    fuel_type: normalizeFuelType(price.fuelType),
    fuelType: price.fuelType, // Keep original for reference
    price_per_litre: sellingPrice,
    pricePerLitre: sellingPrice, // Alias
    price: sellingPrice, // Original
    cost_price: costPrice,
    costPrice: costPrice,
    profit_per_litre: profitPerLitre,
    profitPerLitre: profitPerLitre,
    profit_margin: profitMargin,
    profitMargin: profitMargin,
    has_cost_price: hasCostPrice,
    hasCostPrice: hasCostPrice,
    valid_from: price.effectiveFrom,
    created_by: price.createdBy,
    created_at: price.createdAt
  };
}

export function useFuelPricesData(overrideStationId?: string) {
  const { currentStation, stations } = useRoleAccess();
  const queryClient = useQueryClient();
  const stationId = overrideStationId || currentStation?.id;

  // Always call useQuery to maintain hook order consistency
  const { data: directData, isLoading: directLoading, error: directError, refetch: directRefetch } = useQuery({
    queryKey: ['fuel-prices', stationId],
    queryFn: async () => {
      if (!stationId) return [];
      try {
        const url = `/stations/${stationId}/prices`;
        const response = await apiClient.get(url);

        let currentPrices: any[] = [];
        if (response && typeof response === 'object' && 'data' in response) {
          const data = response.data;
          if (data && typeof data === 'object' && 'current' in data && Array.isArray(data.current)) {
            currentPrices = data.current;
          }
        }

        // Transform prices to match the expected format
        const transformed = currentPrices.map((price: any) => {
          const sellingPrice = price.price;
          const costPrice = price.costPrice;
          const hasCostPrice = costPrice !== null && costPrice !== undefined && costPrice > 0;
          
          let profitPerLitre: number | undefined;
          let profitMargin: number | undefined;
          
          if (hasCostPrice && costPrice < sellingPrice) {
            profitPerLitre = parseFloat((sellingPrice - costPrice).toFixed(2));
            profitMargin = parseFloat(((profitPerLitre / sellingPrice) * 100).toFixed(2));
          }

          return {
            id: price.id,
            station_id: stationId,
            fuel_type: (price.fuelType || '').toString().toUpperCase(),
            fuelType: price.fuelType,
            price_per_litre: sellingPrice,
            pricePerLitre: sellingPrice,
            price: sellingPrice,
            cost_price: costPrice,
            costPrice: costPrice,
            profit_per_litre: profitPerLitre,
            profitPerLitre: profitPerLitre,
            profit_margin: profitMargin,
            profitMargin: profitMargin,
            has_cost_price: hasCostPrice,
            hasCostPrice: hasCostPrice,
            valid_from: price.effectiveFrom,
            created_at: price.createdAt
          };
        });

        return transformed;
      } catch (error) {
        console.error(`Failed to fetch prices for station ${stationId}:`, error);
        return [];
      }
    },
    enabled: !!stationId, // Always enabled, but data will be overridden by global if available
    staleTime: 30 * 60 * 1000, // 30 minutes - prevent excessive refetches during navigation
    gcTime: 45 * 60 * 1000,     // Keep in cache for 45 minutes before garbage collection
  });

  // Read from the global fuel prices cache
  const globalQueryKey = ['all-fuel-prices', stations?.map(s => s.id).sort().join(',')];
  const globalQuery = queryClient.getQueryState(globalQueryKey);
  const globalData = queryClient.getQueryData<Record<string, FuelPrice[]>>(globalQueryKey);

  // Always use direct data for this hook since it has proper transformation with cost_price
  // The direct query includes cost_price transformation which global data might not have
  const finalData = directData && directData.length > 0 ? directData : (globalData && stationId && globalData[stationId]) ? globalData[stationId] : directData;
  const finalLoading = directLoading;
  const finalError = directError;

  return {
    data: finalData || [],
    isLoading: finalLoading,
    error: finalError,
    refetch: () => {
      // Invalidate both global and direct queries
      queryClient.invalidateQueries({ queryKey: globalQueryKey });
      directRefetch();
    },
  };
}
