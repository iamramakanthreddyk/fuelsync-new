/**
 * Station Service
 * Handles station, pump, and nozzle API calls
 * Backend: /api/v1/stations/*
 */

import { apiClient, ApiResponse, PaginatedResponse } from '@/lib/api-client';

// Types
export interface Station {
  id: string;
  ownerId: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  gstNumber?: string;
  oilCompany?: string;
  isActive: boolean;
  requireShiftForReadings: boolean;
  alertOnMissedReadings: boolean;
  missedReadingThresholdDays: number;
  createdAt: string;
  updatedAt: string;
  pumpCount?: number;
  activePumps?: number;
  owner?: { id: string; name: string; email: string };
  pumps?: Pump[];
}

export interface Pump {
  id: string;
  stationId: string;
  pumpNumber: number;
  name: string;
  status: 'active' | 'inactive' | 'maintenance';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  nozzles?: Nozzle[];
}

export interface Nozzle {
  id: string;
  pumpId: string;
  stationId: string;
  nozzleNumber: number;
  fuelType: 'petrol' | 'diesel';
  status: 'active' | 'inactive' | 'maintenance';
  initialReading: number;
  lastReading?: number;
  lastReadingDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StationSettings {
  requireShiftForReadings: boolean;
  alertOnMissedReadings: boolean;
  missedReadingThresholdDays: number;
}

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
      const response = await apiClient.get<ApiResponse<StationSettings>>(`/stations/${id}/settings`);

      if (response.success && response.data) {
        return response.data;
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
    const response = await apiClient.put<ApiResponse<StationSettings>>(`/stations/${id}/settings`, settings);

    if (!response.success || !response.data) {
      throw new Error('Failed to update station settings');
    }

    return response.data;
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

  // Use StationStaff type for staff (from core/models/station.model.ts)
  async getStaff(stationId: string): Promise<import("@/core/models/station.model").StationStaff[]> {
    const response = await apiClient.get<ApiResponse<import("@/core/models/station.model").StationStaff[]>>(`/stations/${stationId}/staff`);

    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }
};
