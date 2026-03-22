/**
 * useFuelTypePrice Hook
 * 
 * Checks if a specific fuel type has a price set for a station
 * Used to validate if readings can be entered for a specific fuel type
 */

import { useMemo } from 'react';
import { useFuelPrices } from './api';
import { unwrapDataOrObject } from '@/lib/api-utils';

export interface FuelTypePriceStatus {
  hasPriceForType: boolean;
  price: number | null;
  fuelType: string;
}

/**
 * Check if a specific fuel type has a price set
 * @param stationId - Station to check prices for
 * @param fuelType - Fuel type to check (e.g., 'PETROL', 'DIESEL')
 * @returns Whether the fuel type has a price set
 */
export function useFuelTypePrice(stationId?: string, fuelType?: string): FuelTypePriceStatus {
  const fuelPricesQuery = useFuelPrices(stationId || '');
  // API returns object: { stationId, current: [...], history: [...] }
  const fuelPricesData = unwrapDataOrObject(fuelPricesQuery.data, null);
  const fuelPrices = (fuelPricesData && fuelPricesData.current && Array.isArray(fuelPricesData.current))
    ? fuelPricesData.current
    : [];

  const status = useMemo<FuelTypePriceStatus>(() => {
    if (!fuelType) {
      return {
        hasPriceForType: false,
        price: null,
        fuelType: ''
      };
    }

    // Ensure fuelPrices is an array
    const pricesArray = Array.isArray(fuelPrices) ? fuelPrices : [];
    
    // Find price for this specific fuel type
    const priceForType = pricesArray.find(
      p => fuelType && (p.fuel_type || p.fuelType || '').toUpperCase() === fuelType.toUpperCase()
    );

    return {
      hasPriceForType: !!priceForType,
      price: (priceForType?.price_per_litre || priceForType?.price) ? Number(priceForType?.price_per_litre || priceForType?.price) : null,
      fuelType
    };
  }, [fuelPrices, fuelType]);

  return status;
}
