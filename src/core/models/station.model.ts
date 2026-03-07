/**
 * Station Model
 * 
 * Types and interfaces for station-related entities.
 * Includes stations, settings, and configuration.
 * 
 * @module core/models/station
 */

import { BaseEntity, Activatable, Addressable, Contactable, Notable, CreateDTO, UpdateDTO } from './base.model';
import { OilCompany } from '../enums';
import type { StationOwner, StationPump, StationStaff, StationMetrics, StationSettings, StationNotificationSettings, StationConfiguration } from '@/types/station';

// ============================================
// STATION ENTITY
// ============================================

/**
 * Station entity - represents a fuel station
 */
export interface Station extends BaseEntity, Activatable, Addressable, Contactable, Notable {
  ownerId: string;
  name: string;
  code?: string;
  gstNumber?: string;
  oilCompany?: OilCompany;
  licenseNumber?: string;
  licenseExpiry?: string;
  requireShiftForReadings: boolean;
  alertOnMissedReadings: boolean;
  missedReadingThresholdDays: number;
}

/**
 * Station with related data
 */
export interface StationWithRelations extends Station {
  owner?: StationOwner;
  pumps?: StationPump[];
  staff?: StationStaff[];
  metrics?: StationMetrics;
}

/* Station small interfaces are centralized in src/types/station.ts */

// ============================================
// STATION SETTINGS
// ============================================

/* Station settings and configuration types are centralized in src/types/station.ts */

// ============================================
// STATION DTOs
// ============================================

/**
 * DTO for creating a new station
 */
export interface CreateStationDTO {
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  oilCompany?: OilCompany;
  ownerId?: string; // Optional if creating for self
}

/**
 * DTO for updating station
 */
export type UpdateStationDTO = UpdateDTO<Station>;

/**
 * DTO for updating station settings
 */
export type UpdateStationSettingsDTO = Partial<StationSettings>;

// ============================================
// STATION FILTERS
// ============================================

/**
 * Filter options for station list
 */
export interface StationFilter {
  search?: string;
  ownerId?: string;
  city?: string;
  state?: string;
  oilCompany?: OilCompany;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// ============================================
// STATION STATS
// ============================================

/**
 * Station statistics for dashboard
 */
export interface StationStats {
  stationId: string;
  stationName: string;
  todaySales: number;
  todayVolume: number;
  activeShifts: number;
  pendingHandovers: number;
  lowInventoryAlerts: number;
}

/**
 * Station comparison data
 */
export interface StationComparison {
  stationId: string;
  stationName: string;
  sales: number;
  volume: number;
  transactions: number;
  efficiency: number;
}
