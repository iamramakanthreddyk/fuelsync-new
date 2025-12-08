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
    ? await apiClient.get(`/stations/${stationId}/prices`)
    : await apiClient.get('/fuel-prices');

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
    const pricesArr: any[] = data ?? [];
    const priceObj: PriceRecord = {};

    pricesArr.forEach((cur: any) => {
      const fuelType = cur.fuel_type ?? cur.fuelType ?? '';
      const pricePerLitre = cur.price_per_litre ?? cur.pricePerLitre ?? cur.price;
      if (fuelType && pricePerLitre !== undefined && pricePerLitre !== null) {
        priceObj[fuelType] = pricePerLitre;
      }
    });

    if (Object.keys(priceObj).length > 0) {
      console.log('[FuelPricesContext] Setting prices for station', stationId, priceObj);
      setPrices(priceObj);
    } else {
      console.log('[FuelPricesContext] No prices found in API response, clearing prices. Data:', data);
      setPrices({});
    }
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
