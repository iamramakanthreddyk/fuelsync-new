# Fuel Prices Not Loading for Second Station - FIX

## Problem
When you switched to a second station in QuickDataEntryEnhanced, the fuel prices for that station were not loading. The page would show:
```
Price not set for this fuel type.
Set prices in the Prices page. Prices update automatically.
```

Even though the prices **were already set** for the second station (as verified in Network tab showing `GET /api/v1/stations/{stationId}/prices` with correct prices).

## Root Cause
The issue was in how `useFuelPricesForStation()` hook works:

1. **The Hook Architecture:**
   - `useFuelPricesForStation()` gets fuel prices from the global `FuelPricesContext`
   - The context stores prices in `pricesByStation` object: `{ stationId1: {...}, stationId2: {...} }`
   - Prices are loaded into `pricesByStation` only when `setStationId()` is called
   - There's also a fallback `useEffect` in the context that fetches prices when `stationId` changes

2. **The Bug in QuickDataEntryEnhanced:**
   - Component called `useFuelPricesForStation(selectedStation)` to get prices
   - **But it never called `setStationId()` to tell the context which station to load**
   - When you switched stations, the context's `pricesByStation[selectedStation]` was empty
   - So `useFuelPricesForStation()` returned empty prices

3. **Cross-Station Context Issue:**
   - First station's prices were cached in context (loaded on app init or first visit)
   - When switching to second station, context didn't know to fetch new prices
   - The second station's prices existed on backend but were never cached in context

## Solution
Added a `useEffect` hook in `QuickDataEntryEnhanced` to call `setStationId()` whenever `selectedStation` changes:

```tsx
import { useFuelPricesGlobal } from '@/context/FuelPricesContext';

export default function QuickDataEntry() {
  // ... other code ...
  const { setStationId } = useFuelPricesGlobal();
  
  // Update context when selected station changes (loads prices for that station)
  useEffect(() => {
    if (selectedStation) {
      setStationId(selectedStation);
    }
  }, [selectedStation, setStationId]);
  
  // ... rest of component ...
}
```

## How It Works Now
1. User selects a station → `selectedStation` state updates
2. `useEffect` detects change → calls `setStationId(selectedStation)`
3. Context's `useEffect` sees `stationId` change → fetches prices from `/api/v1/stations/{stationId}/prices`
4. `useFuelPricesForStation()` now gets populated prices from `pricesByStation[selectedStation]`
5. `hasPriceForFuelType()` check passes → fuel type inputs are enabled
6. Error message disappears → prices display correctly

## Files Modified
- `src/pages/owner/QuickDataEntryEnhanced.tsx`
  - Added import: `useFuelPricesGlobal` from FuelPricesContext
  - Added effect to sync `selectedStation` with context's `stationId`

## Testing
To verify the fix:
1. Go to Quick Data Entry page
2. Select First Station → See fuel prices displayed, inputs enabled
3. Switch to Second Station → Prices should now load automatically for second station
4. Switch back to First Station → First station prices should display again
5. No "Price not set" messages should appear if prices are already configured in Prices page

## Related Components
- `src/context/FuelPricesContext.tsx` - Global context that manages prices
- `src/hooks/useFuelPricesForStation.tsx` - Hook that retrieves prices from context
- `src/pages/PricesPage.tsx` - Where prices are initially set (uses `useFuelPricesData` directly)
