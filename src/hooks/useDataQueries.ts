/**
 * QUERY HOOKS
 * Reusable React Query hooks for common API calls
 * Benefits:
 * - Automatic caching
 * - Stale time management
 * - Error handling
 * - Loading states
 * - Easy to mock in tests
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '@/services/dataService';
import type {
  NozzleReading,
  ReadingFilters,
  CreateReadingDto,
  Transaction,
  TransactionFilters,
  CreateTransactionDto,
  DashboardSummary,
  FuelBreakdown,
  PumpPerformance,
  FinancialOverview,
  AnalyticsParams,
  Shift,
  ShiftFilters,
  StartShiftDto,
  EndShiftDto,
} from '@/services/dataService';

// ============================================
// READING HOOKS
// ============================================

/**
 * Hook: Get readings with filters
 * Auto-caches for 5 minutes
 */
export function useReadings(filters: ReadingFilters = {}) {
  return useQuery({
    queryKey: ['readings', filters],
    queryFn: () => dataService.getReadings(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook: Get single reading
 */
export function useReading(id: string | null) {
  return useQuery({
    queryKey: ['readings', id],
    queryFn: () => dataService.getReading(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook: Get previous reading for nozzle
 */
export function usePreviousReading(nozzleId: string, date?: string) {
  return useQuery({
    queryKey: ['readings', 'previous', nozzleId, date],
    queryFn: () => dataService.getPreviousReading(nozzleId, date),
    enabled: !!nozzleId,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook: Create reading mutation
 */
export function useCreateReading() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateReadingDto) => dataService.createReading(data),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['readings'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Hook: Update reading mutation
 */
export function useUpdateReading() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NozzleReading> }) =>
      dataService.updateReading(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readings'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

/**
 * Hook: Delete reading mutation
 */
export function useDeleteReading() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => dataService.deleteReading(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readings'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// ============================================
// TRANSACTION HOOKS
// ============================================

/**
 * Hook: Get transactions with filters
 * Auto-caches for 2 minutes (more volatile than readings)
 */
export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => dataService.getTransactions(filters),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook: Get transaction for specific date
 */
export function useTransactionForDate(stationId: string, date: string) {
  return useQuery({
    queryKey: ['transactions', stationId, date],
    queryFn: () => dataService.getTransactionForDate(stationId, date),
    enabled: !!stationId && !!date,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook: Get transactions for station
 */
export function useTransactionsForStation(
  stationId: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ['transactions', stationId, startDate, endDate],
    queryFn: () => dataService.getTransactionsForStation(stationId, startDate, endDate),
    enabled: !!stationId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook: Create transaction mutation
 */
export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateTransactionDto) => dataService.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

/**
 * Hook: Update transaction mutation
 */
export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) =>
      dataService.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

/**
 * Hook: Delete transaction mutation
 */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => dataService.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// ============================================
// ANALYTICS HOOKS
// ============================================

/**
 * Hook: Get dashboard summary
 * Auto-caches for 10 minutes
 */
export function useSummary(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'summary', params],
    queryFn: () => dataService.getSummary(params),
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook: Get fuel breakdown
 */
export function useFuelBreakdown(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'fuel-breakdown', params],
    queryFn: () => dataService.getFuelBreakdown(params),
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook: Get pump performance
 */
export function usePumpPerformance(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'pump-performance', params],
    queryFn: () => dataService.getPumpPerformance(params),
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook: Get financial overview
 */
export function useFinancialOverview(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'financial', params],
    queryFn: () => dataService.getFinancialOverview(params),
    staleTime: 1000 * 60 * 15, // Longer cache as this changes less frequently
  });
}

/**
 * Hook: Get alerts
 * Auto-caches for 2 minutes (should be fresh)
 */
export function useAlerts(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'alerts', params],
    queryFn: () => dataService.getAlerts(params),
    staleTime: 1000 * 60 * 2,
  });
}

// ============================================
// SHIFT HOOKS
// ============================================

/**
 * Hook: Get shifts with filters
 * Auto-caches for 2 minutes
 */
export function useShifts(filters: ShiftFilters = {}) {
  return useQuery({
    queryKey: ['shifts', filters],
    queryFn: () => dataService.getShifts(filters),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook: Get single shift
 */
export function useShift(id: string | null) {
  return useQuery({
    queryKey: ['shifts', id],
    queryFn: () => dataService.getShift(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook: Start shift mutation
 */
export function useStartShift() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: StartShiftDto) => dataService.startShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'summary'] });
    },
  });
}

/**
 * Hook: End shift mutation
 */
export function useEndShift() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ shiftId, data }: { shiftId: string; data: EndShiftDto }) =>
      dataService.endShift(shiftId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

/**
 * Hook: Cancel shift mutation
 */
export function useCancelShift() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (shiftId: string) => dataService.cancelShift(shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

// ============================================
// COMBINED HOOKS
// ============================================

/**
 * Hook: Get all dashboard data at once
 * Useful for pages that need multiple analytics
 */
export function useDashboardData(params: AnalyticsParams = {}) {
  const summary = useSummary(params);
  const fuelBreakdown = useFuelBreakdown(params);
  const pumpPerformance = usePumpPerformance(params);
  const financialOverview = useFinancialOverview(params);
  const alerts = useAlerts(params);

  return {
    summary,
    fuelBreakdown,
    pumpPerformance,
    financialOverview,
    alerts,
    isLoading:
      summary.isLoading ||
      fuelBreakdown.isLoading ||
      pumpPerformance.isLoading ||
      financialOverview.isLoading ||
      alerts.isLoading,
    isError:
      summary.isError ||
      fuelBreakdown.isError ||
      pumpPerformance.isError ||
      financialOverview.isError ||
      alerts.isError,
  };
}

/**
 * Hook: Get all shift data
 * Useful for shift management pages
 */
export function useShiftData(filters: ShiftFilters = {}) {
  const shifts = useShifts(filters);
  const startShift = useStartShift();
  const endShift = useEndShift();
  const cancelShift = useCancelShift();

  return {
    shifts,
    startShift,
    endShift,
    cancelShift,
    isLoading: shifts.isLoading,
    isError: shifts.isError,
  };
}

export default {
  // Reading hooks
  useReadings,
  useReading,
  usePreviousReading,
  useCreateReading,
  useUpdateReading,
  useDeleteReading,

  // Transaction hooks
  useTransactions,
  useTransactionForDate,
  useTransactionsForStation,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,

  // Analytics hooks
  useSummary,
  useFuelBreakdown,
  usePumpPerformance,
  useFinancialOverview,
  useAlerts,

  // Shift hooks
  useShifts,
  useShift,
  useStartShift,
  useEndShift,
  useCancelShift,

  // Combined hooks
  useDashboardData,
  useShiftData,
};
