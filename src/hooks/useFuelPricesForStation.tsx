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
import { usePumps, useFuelPrices } from './api';
import { unwrapDataOrArray, unwrapDataOrObject } from '@/lib/api-utils';

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
  
  // Always fetch prices directly for this station
  const fuelPricesQuery = useFuelPrices(stationId || '');
  // API returns object with { stationId, current: [...], history: [...] }
  const fuelPricesData = unwrapDataOrObject(fuelPricesQuery.data, null) as any;
  
  const pumpsQuery = usePumps(stationId || '');
  const pumpsResponse = pumpsQuery.data;

  return useMemo(() => {
    if (!stationId) {
      return {
        prices: {},
        hasPrices: false,
        missingFuelTypes: [],
        pricesArray: []
      };
    }

    let stationPrices: Record<string, number> = {};
    let pricesArray: Array<{ fuel_type: string; price_per_litre: number }> = [];
    let hasPrices = false;

    // Priority 1: Try direct API response first (most up-to-date)
    if (fuelPricesData && typeof fuelPricesData === 'object' && 'current' in fuelPricesData) {
      const currentPrices = fuelPricesData.current;
      if (Array.isArray(currentPrices) && currentPrices.length > 0) {
        hasPrices = true;
        pricesArray = currentPrices.map((price: any) => ({
          fuel_type: (price.fuel_type || price.fuelType || '').toUpperCase(),
          price_per_litre: Number(price.price_per_litre || price.price || 0)
        }));
        // Build prices object
        currentPrices.forEach((price: any) => {
          const fuelType = (price.fuel_type || price.fuelType || '').toUpperCase();
          const priceValue = Number(price.price_per_litre || price.price || 0);
          if (fuelType && priceValue > 0) {
            stationPrices[fuelType] = priceValue;
          }
        });
      }
    }

    // Priority 2: Fallback to context if API didn't return data
    if (!hasPrices && pricesByStation && typeof pricesByStation === 'object') {
      const contextPrices = pricesByStation[stationId];
      if (contextPrices && typeof contextPrices === 'object' && Object.keys(contextPrices).length > 0) {
        hasPrices = true;
        stationPrices = contextPrices;
        pricesArray = Object.entries(contextPrices).map(([fuel_type, price_per_litre]) => ({
          fuel_type,
          price_per_litre: Number(price_per_litre)
        }));
      }
    }

    // Get fuel types from active nozzles
    const activeFuelTypes = new Set<string>();
    const pumpsArray = unwrapDataOrArray(pumpsResponse, []) as any[];
    pumpsArray.forEach((pump: any) => {
        if (pump.nozzles && Array.isArray(pump.nozzles)) {
          pump.nozzles.forEach((nozzle: any) => {
            if (nozzle.status === 'active') {
              activeFuelTypes.add(nozzle.fuelType?.toUpperCase() || '');
            }
          });
        }
    });

    // Find missing fuel types (active in nozzles but no price set)
    const missingFuelTypes = Array.from(activeFuelTypes).filter(
      fuelType => fuelType && !stationPrices[fuelType]
    );

    return {
      prices: stationPrices,
      hasPrices,
      missingFuelTypes,
      pricesArray
    };
  }, [stationId, pricesByStation, pumpsResponse, fuelPricesData]);
}
