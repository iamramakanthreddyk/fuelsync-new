/**
 * useFuelPricesStatus Hook
 * 
 * Checks if fuel prices are set for the current station
 * Used globally to enforce price setup before allowing readings
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
 * Hook to check fuel prices status for the current station
 * Returns info about whether prices are set and any warnings
 */
export function useFuelPricesStatus(): FuelPricesStatus {
  const { data: fuelPrices, isLoading } = useFuelPricesData();
  const { currentStation } = useRoleAccess();

  const status = useMemo<FuelPricesStatus>(() => {
    // If still loading, return loading state
    if (isLoading) {
      return {
        hasPrices: false,
        pricesCount: 0,
        missingFuelTypes: [],
        isLoading: true,
        warning: 'Loading fuel prices...',
        canEnterReadings: false
      };
    }

    // If no station, can't enter readings
    if (!currentStation) {
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
    const pricesCount = fuelPrices?.length || 0;
    const hasPrices = pricesCount > 0;

    // Get fuel types from prices
    const setFuelTypes = fuelPrices?.map(p => p.fuel_type.toUpperCase()) || [];
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
  }, [fuelPrices, isLoading, currentStation]);

  return status;
}
