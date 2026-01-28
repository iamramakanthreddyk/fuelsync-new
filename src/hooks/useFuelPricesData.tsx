/**
 * useFuelPricesData Hook - DEPRECATED
 *
 * This hook has been replaced by the centralized useFuelPrices hook from @/hooks/api
 * Please use: import { useFuelPrices } from '@/hooks/api'
 *
 * @deprecated Use useFuelPrices from @/hooks/api instead
 */

import { useFuelPrices } from './api';
import { FuelTypeEnum } from '@/core/enums';

// Re-export the centralized hook for backward compatibility
export const useFuelPricesData = (stationId?: string) => {
  const result = useFuelPrices(stationId || '');
  return {
    data: result.data?.data?.current || [],
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch
  };
};

// Re-export the centralized normalizeFuelType function for backward compatibility
export { normalizeFuelType } from '@/core/fuel/fuelConfig';

// Keep existing exports for backward compatibility
export type { FuelPrice } from '@/types/api';
