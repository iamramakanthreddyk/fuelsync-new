/**
 * API Hooks - React Query hooks for all backend endpoints
 *
 * All API calls go through @/api (the single source of truth).
 * This file must NOT import from @/lib/api-client or @/lib/api-wrapper directly.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  stationApi,
  pumpApi,
  nozzleApi,
  fuelPriceApi,
  readingApi,
  shiftApi,
  creditApi,
  expenseApi,
  analyticsApi,
  tankApi,
  userApi,
  salesApi,
  authApi,
  configApi,
} from '@/api';
import { useStationStore } from '@/store/stationStore';
import { getApiErrorMessage } from '@/lib/apiErrorHandler';
import type {
  Station,
  Pump,
  Nozzle,
  Creditor,
  CreditTransaction,
  Expense,
  Tank,
  TankRefill,
  User,
  SubmitReadingRequest,
  StartShiftRequest,
  EndShiftRequest,
  Sale,
} from '@/types/api';

// ============================================
// QUERY KEYS
// ============================================

export const queryKeys = {
  // Config
  config: ['config'] as const,
  
  // Stations
  stations: ['stations'] as const,
  station: (id: string) => ['stations', id] as const,
  stationSettings: (id: string) => ['stations', id, 'settings'] as const,
  
  // Pumps
  pumps: (stationId: string) => ['pumps', stationId] as const,
  pump: (id: string) => ['pumps', 'detail', id] as const,
  
  // Nozzles
  nozzles: (pumpId: string) => ['nozzles', pumpId] as const,
  
  // Prices
  prices: (stationId: string) => ['prices', stationId] as const,
  priceCheck: (stationId: string, fuelType: string, date: string) => 
    ['prices', 'check', stationId, fuelType, date] as const,
  
  // Readings
  readings: (stationId: string, date?: string) => 
    ['readings', stationId, date || 'all'] as const,
  previousReading: (nozzleId: string, date?: string) => 
    ['readings', 'previous', nozzleId, date || 'today'] as const,
  dailyReadings: (stationId: string, date: string) => 
    ['readings', 'daily', stationId, date] as const,
  
  // Shifts
  shifts: (stationId: string) => ['shifts', stationId] as const,
  shift: (id: number) => ['shifts', 'detail', id] as const,
  activeShift: ['shifts', 'active'] as const,
  
  // Creditors
  creditors: (stationId: string) => ['creditors', stationId] as const,
  creditor: (id: string) => ['creditors', 'detail', id] as const,
  
  // Expenses
  expenses: (stationId: string) => ['expenses', stationId] as const,
  
  // Sales
  sales: (stationId?: string, date?: string, startDate?: string, endDate?: string) => 
    ['sales', stationId, date, startDate, endDate] as const,
  
  // Tanks
  tanks: (stationId: string) => ['tanks', stationId] as const,
  tank: (id: string) => ['tanks', 'detail', id] as const,
  
  // Cash Handovers
  handovers: (stationId: string) => ['handovers', stationId] as const,
  
  // Dashboard
  dashboard: (stationId: string, startDate?: string, endDate?: string) => 
    ['dashboard', stationId, startDate, endDate] as const,
  
  // Users
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  stationStaff: (stationId: string) => ['users', 'staff', stationId] as const,
  me: ['auth', 'me'] as const,
};

// ============================================
// CONFIG HOOKS
// ============================================

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: () => configApi.get(),
    staleTime: 1000 * 60 * 60, // 1 hour - config rarely changes
  });
}

// ============================================
// STATION HOOKS
// ============================================

/**
 * Fetches all stations and updates the station store.
 * Standardized with centralized API error handling.
 */
export function useStations() {
  const setStations = useStationStore(state => state.setStations);
  return useQuery({
    queryKey: queryKeys.stations,
    queryFn: async () => {
      try {
        const response = await stationApi.getAll();
        if (response.success) {
          setStations(response.data as Station[]);
        }
        return response;
      } catch (error) {
        throw new Error(getApiErrorMessage(error));
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useStation(id: string) {
  return useQuery({
    queryKey: queryKeys.station(id),
    queryFn: () => stationApi.get(id),
    enabled: !!id,
  });
}

export function useStationSettings(stationId: string) {
  return useQuery({
    queryKey: queryKeys.stationSettings(stationId),
    queryFn: () => stationApi.getSettings(stationId),
    enabled: !!stationId,
  });
}

export function useCreateStation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Station>) => stationApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stations });
    },
  });
}

export function useUpdateStation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Station> }) => stationApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stations });
      queryClient.invalidateQueries({ queryKey: queryKeys.station(id) });
    },
  });
}

export function useUpdateStationSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: Partial<Station> }) => stationApi.updateSettings(id, settings),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stationSettings(id) });
    },
  });
}

// ============================================
// PUMP HOOKS
// ============================================

export function usePumps(stationId: string) {
  const setPumps = useStationStore(state => state.setPumps);
  
  return useQuery({
    queryKey: queryKeys.pumps(stationId),
    queryFn: async () => {
      const response = await pumpApi.getAll(stationId);
      if (response.success) {
        setPumps(response.data as Pump[]);
      }
      return response;
    },
    enabled: !!stationId,
  });
}

export function useCreatePump() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: Partial<Pump> }) => pumpApi.create(stationId, data),
    onSuccess: (_, { stationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pumps(stationId) });
      queryClient.invalidateQueries({ queryKey: ['pumps-data', stationId] });
      // Also invalidate stations to update pumpCount
      queryClient.invalidateQueries({ queryKey: queryKeys.stations });
    },
  });
}

export function useUpdatePump() {
  const queryClient = useQueryClient();
  const stationId = useStationStore(state => state.selectedStationId);
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pump> }) => pumpApi.update(id, data),
    onSuccess: () => {
      if (stationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.pumps(stationId) });
        queryClient.invalidateQueries({ queryKey: ['pumps-data', stationId] });
      }
      // Also invalidate stations to update pump status
      queryClient.invalidateQueries({ queryKey: queryKeys.stations });
    },
  });
}

// ============================================
// NOZZLE HOOKS
// ============================================

export function useNozzles(pumpId: string) {
  return useQuery({
    queryKey: queryKeys.nozzles(pumpId),
    queryFn: () => nozzleApi.getAll(pumpId),
    enabled: !!pumpId,
  });
}

export function useCreateNozzle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pumpId, data }: { pumpId: string; data: Partial<Nozzle> }) => nozzleApi.create(pumpId, data),
    onSuccess: (_, { pumpId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nozzles(pumpId) });
    },
  });
}

export function useUpdateNozzle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Nozzle> }) => nozzleApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nozzles'] });
      queryClient.invalidateQueries({ queryKey: ['pumps'] });
    },
  });
}

// ============================================
// PRICE HOOKS
// ============================================

export function useFuelPrices(stationId: string) {
  return useQuery({
    queryKey: queryKeys.prices(stationId),
    queryFn: () => fuelPriceApi.getAll(stationId),
    enabled: !!stationId,
  });
}

export function usePriceCheck(stationId: string, fuelType: string, date?: string) {
  const checkDate = date || new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: queryKeys.priceCheck(stationId, fuelType, checkDate),
    queryFn: () => fuelPriceApi.check(stationId, fuelType, checkDate),
    enabled: !!stationId && !!fuelType,
  });
}

export function useSetFuelPrice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: { fuelType: string; price: number; effectiveFrom?: string } }) => fuelPriceApi.set(stationId, data),
    onSuccess: (_, { stationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prices(stationId) });
      queryClient.invalidateQueries({ queryKey: ['prices', 'check'] });
      // Also invalidate stations to update displayed data
      queryClient.invalidateQueries({ queryKey: queryKeys.stations });
    },
  });
}

// ============================================
// READING HOOKS
// ============================================

export function usePreviousReading(nozzleId: string, date?: string) {
  return useQuery({
    queryKey: queryKeys.previousReading(nozzleId, date),
    queryFn: () => readingApi.getPrevious(nozzleId, date),
    enabled: !!nozzleId,
  });
}

export function useDailyReadings(stationId: string, date: string) {
  return useQuery({
    queryKey: queryKeys.dailyReadings(stationId, date),
    queryFn: () => readingApi.getDaily(stationId, date),
    enabled: !!stationId && !!date,
  });
}

export function useSubmitReading() {
  const queryClient = useQueryClient();
  const stationId = useStationStore(state => state.selectedStationId);
  
  return useMutation({
    mutationFn: (data: SubmitReadingRequest) => readingApi.submit(data),
    onSuccess: (_, { nozzleId }) => {
      queryClient.invalidateQueries({ queryKey: ['readings'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.previousReading(nozzleId) });
      if (stationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(stationId) });
      }
    },
  });
}

// ============================================
// SHIFT HOOKS
// ============================================

export function useActiveShift() {
  return useQuery({
    queryKey: queryKeys.activeShift,
    queryFn: () => shiftApi.getActive(),
  });
}

export function useStartShift() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: StartShiftRequest) => shiftApi.start(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShift });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

export function useEndShift() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EndShiftRequest }) => shiftApi.end(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShift });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
    },
  });
}

export function useStationShifts(stationId: string) {
  return useQuery({
    queryKey: queryKeys.shifts(stationId),
    queryFn: () => shiftApi.getForStation(stationId),
    enabled: !!stationId,
  });
}

// ============================================
// CREDITOR HOOKS
// ============================================

export function useCreditors(stationId: string) {
  return useQuery({
    queryKey: queryKeys.creditors(stationId),
    queryFn: () => creditApi.getCreditors(stationId),
    enabled: !!stationId,
  });
}

export function useCreditor(id: string) {
  return useQuery({
    queryKey: queryKeys.creditor(id),
    queryFn: () => creditApi.getCreditor(id),
    enabled: !!id,
  });
}

export function useCreateCreditor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Creditor>) => creditApi.createCreditor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditors'] });
    },
  });
}

export function useAddCreditSale() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ creditorId, data }: { creditorId: string; data: Partial<CreditTransaction> }) => creditApi.addSale(creditorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditors'] });
    },
  });
}

export function useSettleCredit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ creditorId, data }: { creditorId: string; data: { amount?: number; referenceNumber?: string; notes?: string; invoiceNumber?: string; allocations?: Array<{ creditTransactionId: string; amount: number }> } }) => creditApi.settle(creditorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditors'] });
    },
  });
}

// ============================================
// EXPENSE HOOKS
// ============================================

export function useExpenses(stationId: string, filters?: { startDate?: string; endDate?: string; category?: string }) {
  return useQuery({
    queryKey: [...queryKeys.expenses(stationId), filters],
    queryFn: () => expenseApi.getForStation(stationId, { startDate: filters?.startDate, endDate: filters?.endDate, category: filters?.category }),
    enabled: !!stationId,
  });
}

// Fetch all expenses across all stations for a date range
export function useAllExpenses(filters?: { startDate?: string; endDate?: string; limit?: number }) {
  return useQuery({
    queryKey: ['expenses-all', filters],
    queryFn: () => expenseApi.getAll({ startDate: filters?.startDate, endDate: filters?.endDate, limit: filters?.limit }),
    enabled: !!(filters?.startDate && filters?.endDate),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Expense>) => expenseApi.createDirect(data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ============================================
// SALES HOOKS
// ============================================

export function useSales(stationId?: string, date?: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: queryKeys.sales(stationId, date, startDate, endDate),
    queryFn: () => salesApi.get({ stationId, date, startDate, endDate }),
    enabled: !!stationId || !!date || (!!startDate && !!endDate),
  });
}

// ============================================
// TANK HOOKS
// Enhanced with "since last refill" tracking
// ============================================

/**
 * Fetch all tanks for a station with full status
 * Includes "since last refill" tracking data
 */
export function useTanks(stationId: string) {
  return useQuery({
    queryKey: queryKeys.tanks(stationId),
    queryFn: () => tankApi.getAll(stationId),
    enabled: !!stationId,
  });
}

/**
 * Fetch single tank with full details
 */
export function useTank(tankId: string) {
  return useQuery({
    queryKey: queryKeys.tank(tankId),
    queryFn: () => tankApi.get(tankId),
    enabled: !!tankId,
  });
}

/**
 * Fetch tank warnings (low, critical, empty, negative)
 */
export function useTankWarnings() {
  return useQuery({
    queryKey: ['tanks', 'warnings'],
    queryFn: () => tankApi.getWarnings(),
  });
}

/**
 * Create a new tank
 */
export function useCreateTank() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: Partial<Tank> }) => tankApi.create(stationId, data),
    onSuccess: (_, { stationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tanks(stationId) });
      queryClient.invalidateQueries({ queryKey: ['tanks', 'warnings'] });
    },
  });
}

/**
 * Update tank settings
 */
export function useUpdateTank() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tankId, data }: { tankId: string; data: Partial<Tank> }) => tankApi.update(tankId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    },
  });
}

/**
 * Delete a tank
 */
export function useDeleteTank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tankId: string) => tankApi.delete(tankId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    },
  });
}

/**
 * Record a tank refill
 */
export function useRecordRefill() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tankId, data }: { tankId: string; data: Partial<TankRefill> }) => tankApi.recordRefill(tankId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    },
  });
}

/**
 * Calibrate tank with dip reading
 */
export function useCalibrateTank() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tankId, dipReading, date, notes }: { tankId: string; dipReading: number; date?: string; notes?: string; }) => tankApi.calibrate(tankId, { dipReading, date, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    },
  });
}

/**
 * Fetch tank refill history
 */
export function useTankRefills(tankId: string, filters?: { startDate?: string; endDate?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['tanks', tankId, 'refills', filters],
    queryFn: () => tankApi.getRefills(tankId, { startDate: filters?.startDate, endDate: filters?.endDate, page: filters?.page, limit: filters?.limit }),
    enabled: !!tankId,
  });
}

// ============================================
// CASH HANDOVER HOOKS
// ============================================

// ============================================
// DASHBOARD HOOKS
// ============================================

export function useDashboardSummary(stationId: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(stationId, startDate, endDate),
    queryFn: () => analyticsApi.getSummary(stationId, startDate, endDate),
    enabled: !!stationId,
  });
}

// ============================================
// USER HOOKS
// ============================================

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me(),
  });
}

export function useStationStaff(stationId: string) {
  return useQuery({
    queryKey: queryKeys.stationStaff(stationId),
    queryFn: () => stationApi.getStaff(stationId),
    enabled: !!stationId,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<User> & { password: string }) => userApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: ['users', 'staff'] });
    },
  });
}

// ============================================
// TYPE EXPORTS
// ============================================

export type { Sale };
