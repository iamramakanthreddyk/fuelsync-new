import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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
  const queryClient = useQueryClient();

  // Read from global React Query cache instead of making API calls
  // Updates when stationId changes
  useEffect(() => {
    async function loadPricesFromCache() {
      if (!stationId) {
        setPrices({});
        return;
      }

      try {
        // Get all fuel prices from global cache
        const allFuelPrices = queryClient.getQueryData(['all-fuel-prices']);
        
        if (allFuelPrices && typeof allFuelPrices === 'object') {
          // Find prices for this station
          const stationPrices = (allFuelPrices as any)[stationId];
          
          if (stationPrices && typeof stationPrices === 'object') {
            // Normalize the prices format
            const normalized: PriceRecord = {};
            Object.entries(stationPrices as Record<string, any>).forEach(([fuelType, priceData]) => {
              if (priceData && typeof priceData === 'object' && 'price_per_litre' in priceData) {
                const fuelTypeUpper = fuelType.toUpperCase();
                const price = Number(priceData.price_per_litre);
                if (!Number.isNaN(price)) {
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
        } else {
          setPrices({});
        }
      } catch {
        setPrices({});
      }
    }
    
    loadPricesFromCache();
  }, [stationId, queryClient]);

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
