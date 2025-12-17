import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useStations } from '@/hooks/api';

type PriceRecord = Record<string, number>;
type PricesByStation = Record<string, PriceRecord>;

// ============================================================================
// Context Definition
// ============================================================================

export const FuelPricesContext = createContext({
  prices: {} as PriceRecord,
  setPrices: (_prices: PriceRecord) => {},
  pricesByStation: {} as PricesByStation,
  setPricesByStation: (_prices: PricesByStation) => {},
  stationId: '',
  setStationId: (_id: string) => {},
});

// ============================================================================
// Helper Functions
// ============================================================================

// Context now reads from global React Query cache instead of making API calls
// pricesByStation is populated as stations are selected from global cache

// ============================================================================
// Provider Component
// ============================================================================

export function FuelPricesProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<PriceRecord>({});
  const [pricesByStation, setPricesByStation] = useState<PricesByStation>({});
  const [stationId, setStationId] = useState<string>('');

  // Get stations data to construct the correct query key
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data || [];
  const stationsKey = stations?.map(s => s.id).sort().join(',');

  // Subscribe to global fuel prices cache - this will automatically update when cache changes
  const { data: allFuelPrices } = useQuery({
    queryKey: ['all-fuel-prices', stationsKey],
    queryFn: () => null, // We don't need to fetch, just subscribe to existing cache
    enabled: !!stationsKey, // Only subscribe when we have stations
    staleTime: Infinity, // Never consider stale since we want to react to cache changes
  });

  // Update prices when stationId or global cache changes
  useEffect(() => {
    if (!stationId || !allFuelPrices) {
      setPrices({});
      return;
    }

    try {
      // Find prices for this station
      const stationPrices = (allFuelPrices as any)[stationId];

      if (Array.isArray(stationPrices)) {
        // Normalize the prices format from array
        const normalized: PriceRecord = {};
        stationPrices.forEach((priceData: any) => {
          if (priceData && typeof priceData === 'object' && 'fuel_type' in priceData && 'price_per_litre' in priceData) {
            const fuelTypeUpper = (priceData.fuel_type || '').toString().toUpperCase();
            const price = Number(priceData.price_per_litre);
            if (!Number.isNaN(price) && fuelTypeUpper) {
              normalized[fuelTypeUpper] = price;
            }
          }
        });

        setPrices(normalized);

        // Also cache in pricesByStation
        setPricesByStation(prev => ({
          ...prev,
          [stationId]: normalized
        }));
      } else {
        setPrices({});
      }
    } catch (error) {
      setPrices({});
    }
  }, [stationId, allFuelPrices, stationsKey]);

  const contextValue = useMemo(() => ({
    prices,
    setPrices,
    pricesByStation,
    setPricesByStation,
    stationId,
    setStationId,
  }), [prices, pricesByStation, stationId]);

  return (
    <FuelPricesContext.Provider value={contextValue}>
      {children}
    </FuelPricesContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useFuelPricesGlobal() {
  return useContext(FuelPricesContext);
}
