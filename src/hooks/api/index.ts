/**
 * API Hooks - React Query hooks for all backend endpoints
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiResponse } from '@/lib/api-client';
import { useStationStore } from '@/store/stationStore';
import { getApiErrorMessage } from '@/lib/apiErrorHandler';
import type {
  Station,
  Pump,
  Nozzle,
  FuelPrice,
  NozzleReading,
  Shift,
  Creditor,
  CreditTransaction,
  Expense,
  Tank,
  TankRefill,
  User,
  DashboardSummary,
  ConfigResponse,
  PreviousReadingResponse,
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
    queryFn: () => apiClient.get<ConfigResponse>('/config'),
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
        const response = await apiClient.get<ApiResponse<Station[]>>('/stations');
        if (response.success) {
          setStations(response.data);
        }
        return response;
      } catch (error) {
        // Use centralized error handler
        throw new Error(getApiErrorMessage(error));
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useStation(id: string) {
  return useQuery({
    queryKey: queryKeys.station(id),
    queryFn: () => apiClient.get<ApiResponse<Station>>(`/stations/${id}`),
    enabled: !!id,
  });
}

export function useStationSettings(stationId: string) {
  return useQuery({
    queryKey: queryKeys.stationSettings(stationId),
    queryFn: () => apiClient.get<ApiResponse<{ settings: Station }>>(`/stations/${stationId}/settings`),
    enabled: !!stationId,
  });
}

export function useCreateStation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Station>) => 
      apiClient.post<ApiResponse<Station>>('/stations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stations });
    },
  });
}

export function useUpdateStation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Station> }) => 
      apiClient.put<ApiResponse<Station>>(`/stations/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stations });
      queryClient.invalidateQueries({ queryKey: queryKeys.station(id) });
    },
  });
}

export function useUpdateStationSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: Partial<Station> }) => 
      apiClient.put<ApiResponse<Station>>(`/stations/${id}/settings`, settings),
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
      const response = await apiClient.get<ApiResponse<Pump[]>>(`/stations/${stationId}/pumps`);
      if (response.success) {
        setPumps(response.data);
      }
      return response;
    },
    enabled: !!stationId,
  });
}

export function useCreatePump() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: Partial<Pump> }) => 
      apiClient.post<ApiResponse<Pump>>(`/stations/${stationId}/pumps`, data),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<Pump> }) => 
      apiClient.put<ApiResponse<Pump>>(`/stations/pumps/${id}`, data),
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
    queryFn: () => apiClient.get<ApiResponse<Nozzle[]>>(`/stations/pumps/${pumpId}/nozzles`),
    enabled: !!pumpId,
  });
}

export function useCreateNozzle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pumpId, data }: { pumpId: string; data: Partial<Nozzle> }) => 
      apiClient.post<ApiResponse<Nozzle>>(`/stations/pumps/${pumpId}/nozzles`, data),
    onSuccess: (_, { pumpId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nozzles(pumpId) });
    },
  });
}

export function useUpdateNozzle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Nozzle> }) => 
      apiClient.put<ApiResponse<Nozzle>>(`/stations/nozzles/${id}`, data),
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
    queryFn: () => apiClient.get<ApiResponse<{ current: FuelPrice[]; history: FuelPrice[] }>>(`/stations/${stationId}/prices`),
    enabled: !!stationId,
  });
}

export function usePriceCheck(stationId: string, fuelType: string, date?: string) {
  const checkDate = date || new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: queryKeys.priceCheck(stationId, fuelType, checkDate),
    queryFn: () => apiClient.get<ApiResponse<{ priceSet: boolean; price: number | null }>>(`/stations/${stationId}/prices/check?fuelType=${fuelType}&date=${checkDate}`),
    enabled: !!stationId && !!fuelType,
  });
}

export function useSetFuelPrice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: { fuelType: string; price: number; effectiveFrom?: string } }) => 
      apiClient.post<ApiResponse<FuelPrice>>(`/stations/${stationId}/prices`, data),
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
    queryFn: () => {
      const url = date 
        ? `/readings/nozzles/${nozzleId}/previous?date=${date}`
        : `/readings/nozzles/${nozzleId}/previous`;
      return apiClient.get<PreviousReadingResponse>(url);
    },
    enabled: !!nozzleId,
  });
}

export function useDailyReadings(stationId: string, date: string) {
  return useQuery({
    queryKey: queryKeys.dailyReadings(stationId, date),
    queryFn: () => apiClient.get<ApiResponse<NozzleReading[]>>(`/readings/daily?stationId=${stationId}&date=${date}`),
    enabled: !!stationId && !!date,
  });
}

export function useSubmitReading() {
  const queryClient = useQueryClient();
  const stationId = useStationStore(state => state.selectedStationId);
  
  return useMutation({
    mutationFn: (data: SubmitReadingRequest) => 
      apiClient.post<ApiResponse<NozzleReading>>('/readings', data),
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
    queryFn: () => apiClient.get<ApiResponse<Shift | null>>('/shifts/my/active'),
  });
}

export function useStartShift() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: StartShiftRequest) => 
      apiClient.post<ApiResponse<Shift>>('/shifts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShift });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

export function useEndShift() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EndShiftRequest }) => 
      apiClient.put<ApiResponse<Shift>>(`/shifts/${id}/end`, data),
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
    queryFn: () => apiClient.get<ApiResponse<Shift[]>>(`/stations/${stationId}/shifts`),
    enabled: !!stationId,
  });
}

// ============================================
// CREDITOR HOOKS
// ============================================

export function useCreditors(stationId: string) {
  return useQuery({
    queryKey: queryKeys.creditors(stationId),
    queryFn: () => apiClient.get<ApiResponse<Creditor[]>>(`/credits/creditors?stationId=${stationId}`),
    enabled: !!stationId,
  });
}

export function useCreditor(id: string) {
  return useQuery({
    queryKey: queryKeys.creditor(id),
    queryFn: () => apiClient.get<ApiResponse<Creditor>>(`/credits/creditors/${id}`),
    enabled: !!id,
  });
}

export function useCreateCreditor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Creditor>) => 
      apiClient.post<ApiResponse<Creditor>>('/credits/creditors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditors'] });
    },
  });
}

export function useAddCreditSale() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ creditorId, data }: { creditorId: string; data: Partial<CreditTransaction> }) => 
      apiClient.post<ApiResponse<CreditTransaction>>(`/credits/creditors/${creditorId}/sales`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditors'] });
    },
  });
}

export function useSettleCredit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ creditorId, data }: { creditorId: string; data: { amount?: number; referenceNumber?: string; notes?: string; invoiceNumber?: string; allocations?: Array<{ creditTransactionId: string; amount: number }> } }) => 
      apiClient.post<ApiResponse<CreditTransaction>>(`/credits/creditors/${creditorId}/settle`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditors'] });
    },
  });
}

// ============================================
// EXPENSE HOOKS
// ============================================

export function useExpenses(stationId: string, filters?: { startDate?: string; endDate?: string; category?: string }) {
  const searchParams = new URLSearchParams();
  searchParams.set('stationId', stationId);
  if (filters?.startDate) searchParams.set('startDate', filters.startDate);
  if (filters?.endDate) searchParams.set('endDate', filters.endDate);
  if (filters?.category) searchParams.set('category', filters.category);

  return useQuery({
    queryKey: [...queryKeys.expenses(stationId), filters],
    queryFn: () => apiClient.get<ApiResponse<Expense[]>>(`/expenses?${searchParams.toString()}`),
    enabled: !!stationId,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Expense>) => 
      apiClient.post<ApiResponse<Expense>>('/expenses', data),
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
  const searchParams = new URLSearchParams();
  
  if (stationId) searchParams.set('station_id', stationId);
  if (startDate && endDate) {
    searchParams.set('start_date', startDate);
    searchParams.set('end_date', endDate);
  } else if (date) {
    searchParams.set('date', date);
  }

  const queryString = searchParams.toString();
  const url = queryString ? `/sales?${queryString}` : '/sales';

  return useQuery({
    queryKey: queryKeys.sales(stationId, date, startDate, endDate),
    queryFn: () => apiClient.get<ApiResponse<Sale[]>>(url),
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
    queryFn: () => apiClient.get<ApiResponse<Tank[]>>(`/stations/${stationId}/tanks`),
    enabled: !!stationId,
  });
}

/**
 * Fetch single tank with full details
 */
export function useTank(tankId: string) {
  return useQuery({
    queryKey: queryKeys.tank(tankId),
    queryFn: () => apiClient.get<ApiResponse<Tank>>(`/tanks/${tankId}`),
    enabled: !!tankId,
  });
}

/**
 * Fetch tank warnings (low, critical, empty, negative)
 */
export function useTankWarnings() {
  return useQuery({
    queryKey: ['tanks', 'warnings'],
    queryFn: () => apiClient.get<ApiResponse<Tank[]>>('/tanks/warnings'),
  });
}

/**
 * Create a new tank
 */
export function useCreateTank() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: Partial<Tank> }) => 
      apiClient.post<ApiResponse<Tank>>(`/stations/${stationId}/tanks`, data),
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
    mutationFn: ({ tankId, data }: { tankId: string; data: Partial<Tank> }) => 
      apiClient.put<ApiResponse<Tank>>(`/tanks/${tankId}`, data),
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
    mutationFn: ({ tankId, data }: { tankId: string; data: Partial<TankRefill> }) => 
      apiClient.post<ApiResponse<TankRefill>>(`/tanks/${tankId}/refill`, data),
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
    mutationFn: ({ tankId, dipReading, date, notes }: { 
      tankId: string; 
      dipReading: number; 
      date?: string;
      notes?: string;
    }) => 
      apiClient.post<ApiResponse<Tank>>(`/tanks/${tankId}/calibrate`, { dipReading, date, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    },
  });
}

/**
 * Fetch tank refill history
 */
export function useTankRefills(tankId: string, filters?: { startDate?: string; endDate?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.page) params.set('page', filters.page.toString());
  if (filters?.limit) params.set('limit', filters.limit.toString());
  
  const queryString = params.toString();
  const url = queryString ? `/tanks/${tankId}/refills?${queryString}` : `/tanks/${tankId}/refills`;
  
  return useQuery({
    queryKey: ['tanks', tankId, 'refills', filters],
    queryFn: () => apiClient.get<ApiResponse<TankRefill[]>>(url),
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
  const params = new URLSearchParams();
  params.set('stationId', stationId);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  
  return useQuery({
    queryKey: queryKeys.dashboard(stationId, startDate, endDate),
    queryFn: () => apiClient.get<ApiResponse<DashboardSummary>>(`/analytics/summary?${params.toString()}`),
    enabled: !!stationId,
  });
}

// ============================================
// USER HOOKS
// ============================================

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiClient.get<ApiResponse<User>>('/auth/me'),
  });
}

export function useStationStaff(stationId: string) {
  return useQuery({
    queryKey: queryKeys.stationStaff(stationId),
    queryFn: () => apiClient.get<ApiResponse<User[]>>(`/stations/${stationId}/staff`),
    enabled: !!stationId,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<User> & { password: string }) => 
      apiClient.post<ApiResponse<User>>('/users', data),
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
