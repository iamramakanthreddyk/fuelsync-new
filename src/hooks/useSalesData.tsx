
/**
 * useSalesData Hook - DEPRECATED
 *
 * This hook has been replaced by the centralized useSales hook from @/hooks/api
 * Please use: import { useSales } from '@/hooks/api'
 *
 * @deprecated Use useSales from @/hooks/api instead
 */

import { useSales } from './api';
import { useRoleAccess } from './useRoleAccess';

// Re-export the centralized hook for backward compatibility
export const useSalesData = (date?: string, startDate?: string, endDate?: string) => {
  const { currentStation, canAccessAllStations, role } = useRoleAccess();
  const stationId = currentStation?.id;

  const result = useSales(
    canAccessAllStations || role === 'manager' ? undefined : stationId,
    date,
    startDate,
    endDate
  );

  return {
    data: result.data?.data || [],
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch
  };
};

// Keep existing exports for backward compatibility
export type { Sale } from './api';
