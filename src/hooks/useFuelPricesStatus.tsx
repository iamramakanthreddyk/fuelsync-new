/**
 * useFuelPricesStatus Hook
 * 
 * Checks if fuel prices are set for a specific station
 * Used globally to enforce price setup before allowing readings
 * 
 * @param stationId - Optional: Check prices for a specific station. If not provided, uses currentStation
 */

import { useMemo } from 'react';
import { useFuelPricesData } from './useFuelPricesData';
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
  const { data: fuelPrices, isLoading } = useFuelPricesData(stationId);
  const { currentStation } = useRoleAccess();
  
  // Use provided stationId or fall back to currentStation
  const effectiveStation = stationId ? { id: stationId } : currentStation;

  const { prices: globalPrices, stationId: ctxStationId } = useFuelPricesGlobal();

  const status = useMemo<FuelPricesStatus>(() => {
    // If still loading, don't block entry - assume prices will load
    if (isLoading) {
      return {
        hasPrices: true, // Assume true while loading to avoid false warnings
        pricesCount: 0,
        missingFuelTypes: [],
        isLoading: true,
        warning: null,
        canEnterReadings: true
      };
    }

    // If no station, can't enter readings
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

    // Count prices that are set
    // Ensure fuelPrices is an array before accessing it
    let pricesArray = Array.isArray(fuelPrices) ? fuelPrices : [];

    // If react-query returned no prices yet but the global context already has prices
    // for the same station, use the context as a fallback to avoid race conditions.
    if ((pricesArray.length === 0 || !pricesArray) && globalPrices && Object.keys(globalPrices).length > 0) {
      // If caller passed an explicit stationId, prefer the global context if it has prices
      // Otherwise require context stationId to match effectiveStation.id to avoid cross-station leakage
      const useFallback = Boolean(stationId) || (ctxStationId && effectiveStation && ctxStationId === effectiveStation.id);
      if (useFallback) {
        // Debug: log mismatch for investigation
        // eslint-disable-next-line no-console
        console.debug('[useFuelPricesStatus] falling back to globalPrices. react-query prices:', pricesArray, 'globalPrices:', globalPrices, 'effectiveStation:', effectiveStation, 'ctxStationId:', ctxStationId);
        // Convert globalPrices (Record<string, number>) to a synthetic pricesArray shape
        pricesArray = Object.entries(globalPrices).map(([fuel_type, price_per_litre]) => ({ fuel_type, price_per_litre }));
      }
    }

    const pricesCount = pricesArray.length;
    const hasPrices = pricesCount > 0;

    // Get fuel types from prices
    const setFuelTypes = (pricesArray.map(p => (p.fuel_type ?? p.fuelType ?? '').toString().toUpperCase())) || [];
    const commonFuelTypes = [FuelTypeEnum.PETROL.toUpperCase(), FuelTypeEnum.DIESEL.toUpperCase()];
    const missingFuelTypes = commonFuelTypes.filter(ft => !setFuelTypes.includes(ft));

    let warning: string | null = null;
    let canEnterReadings = true;

    if (!hasPrices) {
      warning = 'No fuel prices set for this station';
      canEnterReadings = false;
    } else if (missingFuelTypes.length > 0) {
      warning = `Missing prices for: ${missingFuelTypes.join(', ')}`;
      // Can still enter readings with partial prices, but show warning
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
  }, [fuelPrices, isLoading, effectiveStation, ctxStationId, globalPrices, stationId]);

  return status;
}
