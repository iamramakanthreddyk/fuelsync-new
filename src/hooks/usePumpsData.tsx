/**
 * usePumpsData Hook - DEPRECATED
 *
 * This hook has been replaced by the centralized usePumps hook from @/hooks/api
 * Please use: import { usePumps } from '@/hooks/api'
 *
 * @deprecated Use usePumps from @/hooks/api instead
 */

import { usePumps } from './api';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Pump, Nozzle } from '@/types/api';
import { useStationStore } from '@/store/stationStore';

// Backwards-compatible wrapper that returns the raw `Pump[]` (or undefined)
// instead of the ApiResponse envelope. Many legacy components expect
// `data` to be an array of pumps, so normalize here. Accepts an optional
// `stationId`; when omitted, falls back to the selected station from store.
export function usePumpsData(stationId?: string): UseQueryResult<Pump[] | undefined> {
	const selectedStationId = useStationStore(state => state.selectedStationId);
	const idToUse = stationId ?? selectedStationId ?? '';

	const res = usePumps(idToUse) as UseQueryResult<any>;

	const normalizedData: Pump[] | undefined = res.data && res.data.success ? res.data.data : undefined;

	return {
		...res,
		data: normalizedData,
	} as UseQueryResult<Pump[] | undefined>;
}

// Keep the old type exports for compatibility
export type { Pump as PumpType, Nozzle as NozzleType } from '@/types/api';
