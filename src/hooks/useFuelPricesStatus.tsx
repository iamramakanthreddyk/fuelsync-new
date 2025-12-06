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

  const status = useMemo<FuelPricesStatus>(() => {
    // Debug logging
    console.log('useFuelPricesStatus Debug:', {
      stationId,
      effectiveStation: effectiveStation?.id,
      isLoading,
      fuelPrices,
      fuelPricesType: typeof fuelPrices,
      fuelPricesIsArray: Array.isArray(fuelPrices),
      fuelPricesLength: Array.isArray(fuelPrices) ? fuelPrices.length : 'N/A'
    });

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
    const pricesArray = Array.isArray(fuelPrices) ? fuelPrices : [];
    const pricesCount = pricesArray.length;
    const hasPrices = pricesCount > 0;

    console.log('useFuelPricesStatus Prices Analysis:', {
      pricesArray,
      pricesCount,
      hasPrices,
      firstPrice: pricesArray[0] || null
    });

    // Get fuel types from prices
    const setFuelTypes = pricesArray.map(p => p.fuel_type.toUpperCase()) || [];
    const commonFuelTypes = ['PETROL', 'DIESEL'];
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
  }, [fuelPrices, isLoading, effectiveStation]);

  return status;
}
