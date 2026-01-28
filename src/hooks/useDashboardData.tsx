/**
 * useDashboardData Hook - DEPRECATED
 *
 * This hook has been replaced by the centralized useDashboardSummary hook from @/hooks/api
 * Please use: import { useDashboardSummary } from '@/hooks/api'
 *
 * @deprecated Use useDashboardSummary from @/hooks/api instead
 */

import { useDashboardSummary } from './api';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';

interface DashboardData {
  todaySales: number;
  todayPayments: number;
  totalReadings: number;
  today?: {
    litres: number;
    amount: number;
    cash: number;
    online: number;
    credit: number;
    readings: number;
  } | null;
  lastReading: string | null;
  pendingClosures: number;
  trendsData: Array<{
    date: string;
    sales: number;
    payments: number;
  }>;
  fuelPrices: {
    petrol?: number;
    diesel?: number;
    cng?: number;
  };
  pumps?: Array<{
    id: string;
    name: string;
    number: number;
    status: string;
    nozzleCount: number;
    activeNozzles: number;
    today?: { litres: number; amount: number };
  }>;
  alerts: Array<{
    id: string;
    type: 'warning' | 'info' | 'error';
    message: string;
    severity: 'low' | 'medium' | 'high';
    tags: string[];
  }>;
}

export const useDashboardData = (stationId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const effectiveStationId = stationId || user?.stations?.[0]?.id;

  const result = useDashboardSummary(effectiveStationId || '', undefined, undefined);

  // Transform the centralized hook result to match the expected DashboardData interface
  const data: DashboardData | undefined = result.data?.data ? {
    todaySales: result.data.data.today?.amount ?? 0,
    todayPayments: (result.data.data.today?.cash ?? 0) + (result.data.data.today?.online ?? 0) + (result.data.data.today?.credit ?? 0),
    totalReadings: result.data.data.today?.readings ?? 0,
    today: result.data.data.today ?? null,
    pumps: result.data.data.pumps ?? [],
    lastReading: null,
    pendingClosures: 0,
    trendsData: [], // Simplified - trends would need separate hook
    fuelPrices: {}, // Simplified - fuel prices would need separate hook
    alerts: []
  } : undefined;

  return {
    data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch
  };
};

// Keep existing exports for backward compatibility
export type { DashboardData };
