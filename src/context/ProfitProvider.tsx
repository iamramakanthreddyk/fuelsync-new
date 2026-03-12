import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';
import type { ProfitSummary } from '@/api/analytics';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface ProfitContextValue {
  data: ProfitSummary | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

const ProfitContext = createContext<ProfitContextValue | undefined>(undefined);

interface ProfitProviderProps {
  stationId: string;
  dateRange?: DateRange;
  month?: string;
  children: React.ReactNode;
}

export function ProfitProvider({ stationId, dateRange, month, children }: ProfitProviderProps) {
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['profit-summary', stationId, dateRange || month],
    queryFn: async () => {
      const response = dateRange
        ? await analyticsApi.getProfitSummary(stationId, undefined, dateRange.startDate, dateRange.endDate)
        : await analyticsApi.getProfitSummary(stationId, month);
      return response?.data as ProfitSummary;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!stationId
  });

  const value = useMemo(() => ({
    data,
    isLoading,
    error,
    refetch
  }), [data, isLoading, error, refetch]);

  return (
    <ProfitContext.Provider value={value}>
      {children}
    </ProfitContext.Provider>
  );
}

export function useProfit() {
  const ctx = useContext(ProfitContext);
  if (!ctx) throw new Error('useProfit must be used within a ProfitProvider');
  return ctx;
}
