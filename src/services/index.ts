/**
 * FuelSync Services Layer
 * 
 * Centralized, type-safe API services for all backend endpoints.
 * Each service is responsible for a specific domain.
 * 
 * ARCHITECTURE:
 * - Services handle all API calls
 * - Components use hooks that wrap services
 * - All responses are typed
 * - Error handling is consistent
 */

// Core API client
export { apiClient, ApiError, getToken, setToken, removeToken } from '@/lib/api-client';
export type { ApiResponse, PaginatedResponse } from '@/lib/api-client';

// Domain services - Core
export { authService } from './authService';
export type { AuthUser, AuthStation, RegisterRequest } from './authService';

export { stationService } from './stationService';
export type { Station, Pump, Nozzle, StationSettings, CreateStationRequest, CreatePumpRequest, CreateNozzleRequest } from './stationService';

export { readingService } from './readingService';
export type { NozzleReading, SubmitReadingRequest, PreviousReadingInfo, ReadingFilters } from './readingService';

export { dashboardService } from './dashboardService';
export type { DashboardSummary, DailyTotals, FuelBreakdown, PumpPerformance, FinancialOverview, DashboardAlert, DateRangeParams } from './dashboardService';

export { shiftService, cashHandoverService, dashboardAlertsService } from './tenderService';
export { fuelPriceService } from './fuelPriceService';
export { settlementsService } from './settlementsService';

// Legacy exports for backward compatibility
export { apiService } from './api';
export { planLimitsService } from './planLimitsService';
