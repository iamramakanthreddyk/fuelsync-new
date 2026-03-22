/**
 * Station Service
 * Handles station, pump, and nozzle API calls
 * Backend: /api/v1/stations/*
 */

import { apiClient, ApiResponse, PaginatedResponse } from '@/lib/api-client';
import type { StationSettings, StationStaff } from '@/types/station';
import type { Station, Pump, Nozzle } from '@/types/api';

// Reuse central StationSettings type


export interface CreateStationRequest {
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  gstNumber?: string;
  oilCompany?: string;
  ownerId?: string;
}

export interface CreatePumpRequest {
  pumpNumber: number;
  name: string;
  status?: 'active' | 'inactive' | 'maintenance';
  notes?: string;
}

export interface CreateNozzleRequest {
  nozzleNumber: number;
  fuelType: 'petrol' | 'diesel';
  initialReading: number;
  status?: 'active' | 'inactive' | 'maintenance';
  notes?: string;
}

export const stationService = {
  // ============================================
  // STATIONS
  // ============================================

  /**
   * Get all stations for current user
   * GET /api/v1/stations
   */
  async getStations(): Promise<Station[]> {
    const response = await apiClient.get<ApiResponse<Station[]>>('/stations');

    if (response.success && response.data) {
      return response.data;
    }
    return [];
  },

  /**
   * Get single station
   * GET /api/v1/stations/:id
   */
  async getStation(id: string): Promise<Station | null> {
    try {
      const response = await apiClient.get<ApiResponse<Station>>(`/stations/${id}`);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Create a new station
   * POST /api/v1/stations
   */
  async createStation(data: CreateStationRequest): Promise<Station> {
    const response = await apiClient.post<ApiResponse<Station>>('/stations', data);

    if (!response.success || !response.data) {
      throw new Error('Failed to create station');
    }

    return response.data;
  },

  /**
   * Update a station
   * PUT /api/v1/stations/:id
   */
  async updateStation(id: string, data: Partial<CreateStationRequest>): Promise<Station> {
    const response = await apiClient.put<ApiResponse<Station>>(`/stations/${id}`, data);

    if (!response.success || !response.data) {
      throw new Error('Failed to update station');
    }

    return response.data;
  },

  /**
   * Get station settings
   * GET /api/v1/stations/:id/settings
   */
  async getStationSettings(id: string): Promise<StationSettings | null> {
    try {
      const response = await apiClient.get<ApiResponse<any>>(`/stations/${id}/settings`);

      if (response && (response as ApiResponse<any>).success && (response as ApiResponse<any>).data) {
        const payload = (response as ApiResponse<any>).data;
        // backend returns { id, name, settings }
        if (payload && typeof payload === 'object' && 'settings' in payload) {
          return payload.settings as StationSettings;
        }
        // fallback: if API returned settings directly
        return payload as StationSettings;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Update station settings
   * PUT /api/v1/stations/:id/settings
   */
  async updateStationSettings(id: string, settings: Partial<StationSettings>): Promise<StationSettings> {
    const response = await apiClient.put<ApiResponse<any>>(`/stations/${id}/settings`, settings);

    if (!response || !(response as ApiResponse<any>).success || !(response as ApiResponse<any>).data) {
      throw new Error('Failed to update station settings');
    }

    const payload = (response as ApiResponse<any>).data;
    if (payload && typeof payload === 'object' && 'settings' in payload) return payload.settings as StationSettings;
    return payload as StationSettings;
  },

  // ============================================
  // PUMPS
  // ============================================

  /**
   * Get pumps for a station
   * GET /api/v1/stations/:stationId/pumps
   */
  async getPumps(stationId: string): Promise<Pump[]> {
    const response = await apiClient.get<ApiResponse<Pump[]>>(`/stations/${stationId}/pumps`);

    if (response.success && response.data) {
      return response.data;
    }
    return [];
  },

  /**
   * Create a pump
   * POST /api/v1/stations/:stationId/pumps
   */
  async createPump(stationId: string, data: CreatePumpRequest): Promise<Pump> {
    const response = await apiClient.post<ApiResponse<Pump>>(`/stations/${stationId}/pumps`, data);

    if (!response.success || !response.data) {
      throw new Error('Failed to create pump');
    }

    return response.data;
  },

  /**
   * Update a pump
   * PUT /api/v1/stations/pumps/:id
   */
  async updatePump(id: string, data: Partial<CreatePumpRequest>): Promise<Pump> {
    const response = await apiClient.put<ApiResponse<Pump>>(`/stations/pumps/${id}`, data);

    if (!response.success || !response.data) {
      throw new Error('Failed to update pump');
    }

    return response.data;
  },

  // ============================================
  // NOZZLES
  // ============================================

  /**
   * Get nozzles for a pump
   * GET /api/v1/stations/pumps/:pumpId/nozzles
   */
  async getNozzles(pumpId: string): Promise<Nozzle[]> {
    const response = await apiClient.get<ApiResponse<Nozzle[]>>(`/stations/pumps/${pumpId}/nozzles`);

    if (response.success && response.data) {
      return response.data;
    }
    return [];
  },

  /**
   * Create a nozzle
   * POST /api/v1/stations/pumps/:pumpId/nozzles
   */
  async createNozzle(pumpId: string, data: CreateNozzleRequest): Promise<Nozzle> {
    const response = await apiClient.post<ApiResponse<Nozzle>>(`/stations/pumps/${pumpId}/nozzles`, data);

    if (!response.success || !response.data) {
      throw new Error('Failed to create nozzle');
    }

    return response.data;
  },

  /**
   * Update a nozzle
   * PUT /api/v1/stations/nozzles/:id
   */
  async updateNozzle(id: string, data: Partial<CreateNozzleRequest>): Promise<Nozzle> {
    const response = await apiClient.put<ApiResponse<Nozzle>>(`/stations/nozzles/${id}`, data);

    if (!response.success || !response.data) {
      throw new Error('Failed to update nozzle');
    }

    return response.data;
  },

  // ============================================
  // STATION STAFF
  // ============================================

  /**
   * Get staff for a station
   * GET /api/v1/stations/:stationId/staff
   */

  // Use StationStaff type from central types
  async getStaff(stationId: string): Promise<StationStaff[]> {
    const response = await apiClient.get<ApiResponse<{ staff: StationStaff[]; summary: any }>>(`/stations/${stationId}/staff`);

    if (response && (response as any).success && (response as any).data) {
      const data = (response as any).data;
      // Handle response structure: { staff: [...], summary: {...} }
      if (data && typeof data === 'object' && Array.isArray(data.staff)) {
        return data.staff;
      }
      // Fallback: if data is already an array
      if (Array.isArray(data)) {
        return data;
      }
    }
    return [];
  }
};
