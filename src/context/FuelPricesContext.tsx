// Helper to set prices from dashboard API response
export function setPricesFromDashboard(payload: any, setPrices: (prices: PriceRecord) => void) {
  let items: any[] = [];
  if (payload && payload.fuelPrices && Array.isArray(payload.fuelPrices.current)) {
    items = payload.fuelPrices.current;
  } else if (payload && payload.data && Array.isArray(payload.data.current)) {
    items = payload.data.current;
  }
  const priceObj: PriceRecord = {};
  items.forEach((cur: any) => {
    const fuelType = (cur.fuelType ?? cur.fuel_type ?? '').toString().toUpperCase();
    const rawPrice = cur.price_per_litre ?? cur.pricePerLitre ?? cur.price;
    const pricePerLitre = rawPrice !== undefined && rawPrice !== null ? Number(rawPrice) : undefined;
    if (fuelType && pricePerLitre !== undefined && !Number.isNaN(pricePerLitre)) {
      priceObj[fuelType] = pricePerLitre;
    }
  });
  setPrices(priceObj);
}
import React, { createContext, useContext, useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

type PriceRecord = Record<string, number>;

export const FuelPricesContext = createContext({
  prices: {} as PriceRecord,
  setPrices: (_prices: PriceRecord) => {},
  stationId: '',
  setStationId: (_id: string) => {},
});

async function fetchFuelPrices(stationId: string) {
  const res: any = stationId
    ? await apiClient.get(`/api/v1/fuel-prices?stationId=${stationId}`)
    : await apiClient.get('/api/v1/fuel-prices');

  const payload = res && res.data ? res.data : res;

  if (Array.isArray(payload)) return payload;

  if (payload.current && Array.isArray(payload.current)) return payload.current;

  if (payload.fuelPrices && payload.fuelPrices.current && Array.isArray(payload.fuelPrices.current)) {
    return payload.fuelPrices.current;
  }

  let items: any[] = [];
  if (Array.isArray(payload)) items = payload;
  else if (payload && payload.current && Array.isArray(payload.current)) items = payload.current;
  else if (payload && payload.fuelPrices && payload.fuelPrices.current && Array.isArray(payload.fuelPrices.current)) items = payload.fuelPrices.current;
  else if (payload && payload.data) {
    const inner = payload.data;
    if (Array.isArray(inner)) items = inner;
    else if (inner.current && Array.isArray(inner.current)) items = inner.current;
    else if (inner.fuelPrices && inner.fuelPrices.current && Array.isArray(inner.fuelPrices.current)) items = inner.fuelPrices.current;
  }

  // Normalize to frontend shape: { id, station_id, fuel_type: UPPERCASE, price_per_litre }
  return items.map((p: any) => ({
    id: p.id,
    station_id: p.stationId ?? p.station_id,
    fuel_type: (p.fuelType ?? p.fuel_type ?? '').toString().toUpperCase(),
    price_per_litre: p.price_per_litre ?? p.pricePerLitre ?? p.price
  }));
}


export function FuelPricesProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<PriceRecord>({});
  const [stationId, setStationId] = useState<string>('');
  const { data } = useSWR(['fuel-prices', stationId], () => fetchFuelPrices(stationId), { revalidateOnFocus: true });

  useEffect(() => {


    async function fetchAndNormalizePrices() {
      if (!stationId) {
        setPrices({});
        return;
      }
      try {
        const res = await apiClient.get(`/api/v1/fuel-prices?stationId=${stationId}`);
        let items = [];
        if (res && typeof res === 'object') {
          if ('data' in res && res.data && typeof res.data === 'object' && Array.isArray((res.data as any)?.current)) {
            items = (res.data as any).current;
          } else if (Array.isArray(res)) {
            items = res;
          }
        }
        const normalized: PriceRecord = {};
        items.forEach((cur: any) => {
          // Normalize fuel type to uppercase
          const fuelType = (cur.fuelType ?? cur.fuel_type ?? '').toString().toUpperCase();
          const rawPrice = cur.price_per_litre ?? cur.pricePerLitre ?? cur.price;
          const pricePerLitre = rawPrice !== undefined && rawPrice !== null ? Number(rawPrice) : undefined;
          if (fuelType && pricePerLitre !== undefined && !Number.isNaN(pricePerLitre)) {
            normalized[fuelType] = pricePerLitre;
          }
        });
        setPrices(normalized);
      } catch {
        setPrices({});
      }
    }
    fetchAndNormalizePrices();
  }, [data, stationId]);

  return (
    <FuelPricesContext.Provider value={{ prices, setPrices, stationId, setStationId }}>
      {children}
    </FuelPricesContext.Provider>
  );
}

export function useFuelPricesGlobal() {
  return useContext(FuelPricesContext);
}
