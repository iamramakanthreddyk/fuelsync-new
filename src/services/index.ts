export { apiClient, ApiError, getToken, setToken, removeToken } from '@/lib/api-client';
export { api as apiWrapper } from '@/lib/api-wrapper';
export type { ApiResponse, PaginatedResponse } from '@/lib/api-client';

export { authService } from './authService';
export type { AuthUser, AuthStation, RegisterRequest } from './authService';

export { stationService } from './stationService';
export type { Station, Pump, Nozzle, StationSettings, CreateStationRequest, CreatePumpRequest, CreateNozzleRequest } from './stationService';

export { readingService } from './readingService';
export type { NozzleReading, SubmitReadingRequest, PreviousReadingInfo, ReadingFilters } from './readingService';

export { dashboardService } from './dashboardService';
export type { DashboardSummary, DailyTotals, FuelBreakdown, PumpPerformance, FinancialOverview, DashboardAlert, DateRangeParams } from './dashboardService';

export { shiftService, dashboardAlertsService } from './shiftService';
export { fuelPriceService } from './fuelPriceService';
export { settlementsService } from './settlementsService';

export { apiService } from './api';
export { planLimitsService } from './planLimitsService';
