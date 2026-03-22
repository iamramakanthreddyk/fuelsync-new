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
  const pumpsQuery = usePumps(stationId || '');
  const pumpsResponse = pumpsQuery.data;
  const fuelPricesQuery = useFuelPrices(stationId || '');
  // API returns object with { stationId, current: [...], history: [...] }
  const fuelPricesData = unwrapDataOrObject(fuelPricesQuery.data, null);

  return useMemo(() => {
    if (!stationId) {
      return {
        prices: {},
        hasPrices: false,
        missingFuelTypes: [],
        pricesArray: []
      };
    }

    // Get prices from global context, ensure it's an object
    const stationPrices = (pricesByStation && typeof pricesByStation === 'object' && pricesByStation[stationId]) || {};
    let hasPrices = Object.keys(stationPrices).length > 0;
    let pricesArray: Array<{ fuel_type: string; price_per_litre: number }> = [];

    // Safely create pricesArray
    if (stationPrices && typeof stationPrices === 'object') {
      pricesArray = Object.entries(stationPrices).map(([fuel_type, price_per_litre]) => ({
        fuel_type,
        price_per_litre: Number(price_per_litre) || 0
      }));
    }

    // If global context doesn't have prices, use the direct data as fallback
    // API returns nested structure: { stationId, current: [...], history: [...] }
    if (!hasPrices && fuelPricesData) {
      let pricesListToProcess = [];
      
      // Handle nested structure: { current: [...], history: [...] }
      if (fuelPricesData.current && Array.isArray(fuelPricesData.current) && fuelPricesData.current.length > 0) {
        pricesListToProcess = fuelPricesData.current;
      }
      // Handle flat array fallback
      else if (Array.isArray(fuelPricesData) && fuelPricesData.length > 0) {
        pricesListToProcess = fuelPricesData;
      }
      
      if (pricesListToProcess.length > 0) {
        hasPrices = true;
        pricesArray = pricesListToProcess.map(price => ({
          // Handle both camelCase (fuelType) and snake_case (fuel_type)
          fuel_type: (price.fuel_type || price.fuelType || '').toUpperCase(),
          // Handle both "price" and "price_per_litre"
          price_per_litre: Number(price.price_per_litre || price.price || 0)
        }));
        // Convert to prices object
        pricesListToProcess.forEach(price => {
          const fuelType = (price.fuel_type || price.fuelType || '').toUpperCase();
          const priceValue = Number(price.price_per_litre || price.price || 0);
          if (fuelType) {
            stationPrices[fuelType] = priceValue;
          }
        });
      }
    }

    // Get fuel types from active nozzles
    const activeFuelTypes = new Set<string>();
    const pumpsArray = unwrapDataOrArray(pumpsResponse, []);
    pumpsArray.forEach(pump => {
        if (pump.nozzles && Array.isArray(pump.nozzles)) {
          pump.nozzles.forEach(nozzle => {
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
