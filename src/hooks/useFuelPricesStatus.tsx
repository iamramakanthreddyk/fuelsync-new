/**
 * useFuelPricesStatus Hook
 * 
 * Checks if fuel prices are set for a specific station
 * Used globally to enforce price setup before allowing readings
 * 
 * @param stationId - Optional: Check prices for a specific station. If not provided, uses currentStation
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFuelPrices, useStations } from './api';
import { unwrapDataOrObject } from '@/lib/api-utils';
import { useRoleAccess } from './useRoleAccess';
import { useFuelPricesGlobal } from '@/context/FuelPricesContext';
import { FuelTypeEnum } from '@/core/enums';

export interface FuelPricesStatus {
  hasPrices: boolean;
  pricesCount: number;
  missingFuelTypes: string[];
  isLoading: boolean;
  warning: string | null;
  canEnterReadings: boolean;
}

/**
 * Hook to check fuel prices status for the current station or a specific station
 * Returns info about whether prices are set and any warnings
 * 
 * @param stationId - Optional: Specific station ID to check. If not provided, uses currentStation
 */
export function useFuelPricesStatus(stationId?: string): FuelPricesStatus {
  const { currentStation } = useRoleAccess();
  const { data: stationsResponse } = useStations();
  const stations = (stationsResponse && 'data' in stationsResponse && Array.isArray(stationsResponse.data))
    ? stationsResponse.data
    : [];
  const stationsKey = stations?.map((s: any) => s.id).sort().join(',');
  
  // Subscribe to the global pre-fetched prices cache from AppContent
  const { data: allCachedPrices } = useQuery({
    queryKey: ['all-fuel-prices', stationsKey],
    queryFn: () => {
      // This should be pre-populated by AppContent - we're just subscribing
      // If somehow not in cache, return empty to trigger fallback below
      return {};
    },
    enabled: !!stationsKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  
  // Also fetch directly for the specific station as a backup
  const fuelPricesQuery = useFuelPrices(stationId || '');
  const fuelPricesData = unwrapDataOrObject(fuelPricesQuery.data, null);
  const directPrices = (fuelPricesData && fuelPricesData.current && Array.isArray(fuelPricesData.current))
    ? fuelPricesData.current
    : [];
  
  const { prices: globalPrices, pricesByStation, stationId: ctxStationId } = useFuelPricesGlobal();

  const status = useMemo<FuelPricesStatus>(() => {
    const effectiveStation = stationId ? { id: stationId } : currentStation;
    
    // If still loading direct API call, assume prices will load
    if (fuelPricesQuery.isLoading) {
      return {
        hasPrices: true,
        pricesCount: 0,
        missingFuelTypes: [],
        isLoading: true,
        warning: null,
        canEnterReadings: true
      };
    }

    if (!effectiveStation) {
      return {
        hasPrices: false,
        pricesCount: 0,
        missingFuelTypes: [],
        isLoading: false,
        warning: 'No station assigned',
        canEnterReadings: false
      };
    }

    let pricesArray: any[] = [];

    // Priority 1: Direct API query (most specific, most recent)
    if (Array.isArray(directPrices) && directPrices.length > 0) {
      pricesArray = directPrices;
    }
    // Priority 2: Cached prices from AppContent pre-fetch
    else if (allCachedPrices && typeof allCachedPrices === 'object') {
      const cachedStationPrices = (allCachedPrices as any)[effectiveStation.id];
      if (Array.isArray(cachedStationPrices) && cachedStationPrices.length > 0) {
        pricesArray = cachedStationPrices;
      }
    }
    // Priority 3: Context pricesByStation (pre-loaded on app init)
    if (pricesArray.length === 0 && pricesByStation && effectiveStation) {
      const stationPricesRecord = pricesByStation[effectiveStation.id];
      if (stationPricesRecord && typeof stationPricesRecord === 'object' && Object.keys(stationPricesRecord).length > 0) {
        pricesArray = Object.entries(stationPricesRecord).map(([fuel_type, price_per_litre]) => ({
          fuel_type,
          price_per_litre: Number(price_per_litre)
        }));
      }
    }
    // Priority 4: Global context prices (fallback for when nothing else available)
    if (pricesArray.length === 0 && globalPrices && Object.keys(globalPrices).length > 0) {
      const useFallback = Boolean(stationId) || (ctxStationId && effectiveStation && ctxStationId === effectiveStation.id);
      if (useFallback) {
        pricesArray = Object.entries(globalPrices).map(([fuel_type, price_per_litre]) => ({
          fuel_type,
          price_per_litre: Number(price_per_litre)
        }));
      }
    }

    const pricesCount = pricesArray.length;
    const hasPrices = pricesCount > 0;

    // Normalize fuel types from prices
    const setFuelTypes = pricesArray
      .map(p => {
        const ft = (p.fuel_type || p.fuelType || '').toString().toUpperCase().trim();
        return ft;
      })
      .filter(ft => ft.length > 0);
    
    const commonFuelTypes = [FuelTypeEnum.PETROL.toUpperCase(), FuelTypeEnum.DIESEL.toUpperCase()];
    const missingFuelTypes = commonFuelTypes.filter(ft => !setFuelTypes.includes(ft));

    let warning: string | null = null;
    let canEnterReadings = true;

    if (!hasPrices) {
      warning = 'Fuel prices not yet set for this station. Please configure prices before entering readings.';
      canEnterReadings = false;
    } else if (missingFuelTypes.length > 0) {
      warning = `Warning: Missing prices for ${missingFuelTypes.join(', ')}. Readings can be entered but calculations may be incomplete.`;
      canEnterReadings = true;
    }

    return {
      hasPrices,
      pricesCount,
      missingFuelTypes,
      isLoading: false,
      warning,
      canEnterReadings
    };
  }, [
    directPrices,
    allCachedPrices,
    pricesByStation,
    globalPrices,
    fuelPricesQuery.isLoading,
    stationId,
    currentStation?.id,
    ctxStationId
  ]);

  return status;
}
