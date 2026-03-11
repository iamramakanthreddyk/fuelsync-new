/**
 * Stations API
 * Single source of truth for stations, pumps, nozzles, and fuel price API calls.
 * Only this file (and other src/api/ modules) should import from api-client.
 */

import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';
import type { Station, Pump, Nozzle, FuelPrice, User } from '@/types/api';

// ── Station calls ──────────────────────────────────────────────────────────

export const stationApi = {
  /** GET /stations */
  getAll: () => apiClient.get<ApiResponse<Station[]>>('/stations'),

  /** GET /stations/:id */
  get: (id: string) => apiClient.get<ApiResponse<Station>>(`/stations/${id}`),

  /** GET /stations/:id/settings */
  getSettings: (id: string) =>
    apiClient.get<ApiResponse<{ settings: Station }>>(`/stations/${id}/settings`),

  /** POST /stations */
  create: (data: Partial<Station>) => apiClient.post<ApiResponse<Station>>('/stations', data),

  /** PUT /stations/:id */
  update: (id: string, data: Partial<Station>) =>
    apiClient.put<ApiResponse<Station>>(`/stations/${id}`, data),

  /** PUT /stations/:id/settings */
  updateSettings: (id: string, settings: Partial<Station>) =>
    apiClient.put<ApiResponse<Station>>(`/stations/${id}/settings`, settings),

  /** GET /stations/:id/staff */
  getStaff: (id: string) => apiClient.get<ApiResponse<User[]>>(`/stations/${id}/staff`),
};

// ── Pump calls ─────────────────────────────────────────────────────────────

export const pumpApi = {
  /** GET /stations/:stationId/pumps */
  getAll: (stationId: string) =>
    apiClient.get<ApiResponse<Pump[]>>(`/stations/${stationId}/pumps`),

  /** POST /stations/:stationId/pumps */
  create: (stationId: string, data: Partial<Pump>) =>
    apiClient.post<ApiResponse<Pump>>(`/stations/${stationId}/pumps`, data),

  /** PUT /stations/pumps/:id */
  update: (id: string, data: Partial<Pump>) =>
    apiClient.put<ApiResponse<Pump>>(`/stations/pumps/${id}`, data),
};

// ── Nozzle calls ───────────────────────────────────────────────────────────

export const nozzleApi = {
  /** GET /stations/pumps/:pumpId/nozzles */
  getAll: (pumpId: string) =>
    apiClient.get<ApiResponse<Nozzle[]>>(`/stations/pumps/${pumpId}/nozzles`),

  /** POST /stations/pumps/:pumpId/nozzles */
  create: (pumpId: string, data: Partial<Nozzle>) =>
    apiClient.post<ApiResponse<Nozzle>>(`/stations/pumps/${pumpId}/nozzles`, data),

  /** PUT /stations/nozzles/:id */
  update: (id: string, data: Partial<Nozzle>) =>
    apiClient.put<ApiResponse<Nozzle>>(`/stations/nozzles/${id}`, data),
};

// ── Fuel price calls ───────────────────────────────────────────────────────

export const fuelPriceApi = {
  /** GET /stations/:stationId/prices */
  getAll: (stationId: string) =>
    apiClient.get<ApiResponse<{ current: FuelPrice[]; history: FuelPrice[] }>>(
      `/stations/${stationId}/prices`
    ),

  /** GET /stations/:stationId/prices/check?fuelType=...&date=... */
  check: (stationId: string, fuelType: string, date: string) =>
    apiClient.get<ApiResponse<{ priceSet: boolean; price: number | null }>>(
      `/stations/${stationId}/prices/check?fuelType=${fuelType}&date=${date}`
    ),

  /** POST /stations/:stationId/prices */
  set: (
    stationId: string,
    data: { fuelType: string; price: number; effectiveFrom?: string }
  ) => apiClient.post<ApiResponse<FuelPrice>>(`/stations/${stationId}/prices`, data),
};
