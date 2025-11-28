/**
 * API Module - Re-exports from api-client
 * 
 * This file provides a simplified API interface for components
 * that don't need the full api-client functionality.
 */

export { apiClient, ApiError, getToken, setToken, removeToken } from './api-client';
export type { ApiResponse, PaginatedResponse } from './api-client';

// Convenience functions for common API calls
import { apiClient } from './api-client';
import type { ApiResponse } from './api-client';

/**
 * Fetch current user profile
 */
export async function fetchCurrentUser() {
  return apiClient.get<ApiResponse<any>>('/auth/me');
}

/**
 * Fetch stations for current user
 */
export async function fetchStations() {
  return apiClient.get<ApiResponse<any[]>>('/stations');
}

/**
 * Fetch pumps for a station
 */
export async function fetchPumps(stationId: string) {
  return apiClient.get<ApiResponse<any[]>>(`/stations/${stationId}/pumps`);
}

/**
 * Fetch nozzles for a pump
 */
export async function fetchNozzles(pumpId: string) {
  return apiClient.get<ApiResponse<any[]>>(`/stations/pumps/${pumpId}/nozzles`);
}

/**
 * Fetch fuel prices for a station
 */
export async function fetchFuelPrices(stationId: string) {
  return apiClient.get<ApiResponse<any>>(`/stations/${stationId}/prices`);
}

/**
 * Submit a nozzle reading
 */
export async function submitReading(data: {
  nozzleId: string;
  stationId: string;
  currentReading: number;
  readingDate: string;
  shiftId?: number;
}) {
  return apiClient.post<ApiResponse<any>>('/readings', data);
}

/**
 * Fetch dashboard summary
 */
export async function fetchDashboardSummary(stationId: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams({ stationId });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  return apiClient.get<ApiResponse<any>>(`/dashboard/summary?${params.toString()}`);
}
