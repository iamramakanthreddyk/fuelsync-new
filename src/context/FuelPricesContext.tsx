import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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

// Context handles lazy-loading of prices per station
// pricesByStation is populated as stations are selected

// ============================================================================
// Provider Component
// ============================================================================

export function FuelPricesProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<PriceRecord>({});
  const [pricesByStation, setPricesByStation] = useState<PricesByStation>({});
  const [stationId, setStationId] = useState<string>('');

  // Keep the station-specific price fetching for backward compatibility
  // Updates when stationId changes
  useEffect(() => {
    async function fetchAndNormalizePrices() {
      if (!stationId) {
        setPrices({});
        return;
      }
      try {
        const res: any = await apiClient.get(`/fuel-prices?stationId=${stationId}`);
        let items: any[] = [];
        if (res && typeof res === 'object') {
          if ('data' in res && res.data && typeof res.data === 'object' && Array.isArray((res.data as any)?.current)) {
            items = (res.data as any).current;
          } else if (Array.isArray(res)) {
            items = res;
          }
        }
        const normalized: PriceRecord = {};
        items.forEach((cur: any) => {
          const fuelType = (cur.fuelType ?? cur.fuel_type ?? '').toString().toUpperCase();
          const rawPrice = cur.price_per_litre ?? cur.pricePerLitre ?? cur.price;
          const pricePerLitre = rawPrice !== undefined && rawPrice !== null ? Number(rawPrice) : undefined;
          if (fuelType && pricePerLitre !== undefined && !Number.isNaN(pricePerLitre)) {
            normalized[fuelType] = pricePerLitre;
          }
        });
        setPrices(normalized);
        
        // Also cache in pricesByStation
        if (stationId) {
          setPricesByStation(prev => ({
            ...prev,
            [stationId]: normalized
          }));
        }
      } catch {
        setPrices({});
      }
    }
    fetchAndNormalizePrices();
  }, [stationId]);

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
