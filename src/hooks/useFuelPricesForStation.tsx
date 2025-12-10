/**
 * useFuelPricesForStation Hook
 * 
 * Gets fuel prices for a specific station from the global context.
 * The context is pre-loaded with ALL owner's station prices on app init.
 * 
 * Usage:
 *   const { prices, hasPrices, missingFuelTypes } = useFuelPricesForStation(stationId);
 *   if (!hasPrices) show warning
 */

import { useMemo } from 'react';
import { useFuelPricesGlobal } from '@/context/FuelPricesContext';
import { usePumps } from './api';

export interface StationFuelPricesStatus {
  prices: Record<string, number>; // { PETROL: 105.50, DIESEL: 95.75 }
  hasPrices: boolean;
  missingFuelTypes: string[]; // Fuel types in active nozzles but without prices
  pricesArray: Array<{ fuel_type: string; price_per_litre: number }>;
}

/**
 * Get fuel prices for a specific station
 * Prices come from global context (loaded once on app init for all owner's stations)
 */
export function useFuelPricesForStation(stationId?: string): StationFuelPricesStatus {
  const { pricesByStation } = useFuelPricesGlobal();
  const { data: pumpsResponse } = usePumps(stationId || '');

  return useMemo(() => {
    if (!stationId || !pricesByStation) {
      return {
        prices: {},
        hasPrices: false,
        missingFuelTypes: [],
        pricesArray: []
      };
    }

    // Get prices for this station from global context
    const stationPrices = pricesByStation[stationId] || {};
    const hasPrices = Object.keys(stationPrices).length > 0;

    // Convert to array format
    const pricesArray = Object.entries(stationPrices).map(([fuel_type, price_per_litre]) => ({
      fuel_type,
      price_per_litre: Number(price_per_litre) || 0
    }));

    // Get fuel types from active nozzles
    const activeFuelTypes = new Set<string>();
    if (pumpsResponse?.data) {
      pumpsResponse.data.forEach(pump => {
        pump.nozzles?.forEach(nozzle => {
          if (nozzle.status === 'active') {
            activeFuelTypes.add(nozzle.fuelType.toUpperCase());
          }
        });
      });
    }

    // Find missing fuel types (active in nozzles but no price set)
    const missingFuelTypes = Array.from(activeFuelTypes).filter(
      fuelType => !stationPrices[fuelType]
    );

    return {
      prices: stationPrices,
      hasPrices,
      missingFuelTypes,
      pricesArray
    };
  }, [stationId, pricesByStation, pumpsResponse?.data]);
}
