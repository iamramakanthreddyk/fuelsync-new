/**
 * Pump Model
 * 
 * Types and interfaces for pump and nozzle entities.
 * 
 * @module core/models/pump
 */

import { BaseEntity, Notable, CreateDTO, UpdateDTO } from './base.model';
import { EquipmentStatus, FuelType } from '../enums';
import type { Pump as ApiPump, Nozzle as ApiNozzle } from '@/types/api';

// ============================================
// PUMP ENTITY
// ============================================

/**
 * Pump entity - represents a fuel dispenser
 */
export type Pump = ApiPump & BaseEntity & Notable;

/**
 * Pump with related data
 */
export interface PumpWithRelations extends Pump {
  nozzles?: Nozzle[];
  station?: { id: string; name: string };
}

// ============================================
// NOZZLE ENTITY
// ============================================

/**
 * Nozzle entity - represents a fuel dispensing nozzle
 */
export type Nozzle = ApiNozzle & BaseEntity & Notable;

/**
 * Nozzle with related data
 */
export interface NozzleWithRelations extends Nozzle {
  pump?: { id: string; pumpNumber: number; name: string };
  currentPrice?: number;
}

// ============================================
// PUMP DTOs
// ============================================

/**
 * DTO for creating a pump
 */
export interface CreatePumpDTO {
  stationId?: string; // Optional if context provides it
  pumpNumber: number;
  name: string;
  status?: EquipmentStatus;
  notes?: string;
}

/**
 * DTO for updating a pump
 */
export interface UpdatePumpDTO {
  name?: string;
  status?: EquipmentStatus;
  notes?: string;
}

// ============================================
// NOZZLE DTOs
// ============================================

/**
 * DTO for creating a nozzle
 */
export interface CreateNozzleDTO {
  pumpId?: string; // Optional if context provides it
  nozzleNumber: number;
  fuelType: FuelType;
  initialReading: number;
  status?: EquipmentStatus;
  notes?: string;
}

/**
 * DTO for updating a nozzle
 */
export interface UpdateNozzleDTO {
  fuelType?: FuelType;
  status?: EquipmentStatus;
  notes?: string;
}

// ============================================
// PUMP/NOZZLE FILTERS
// ============================================

/**
 * Filter options for pump list
 */
export interface PumpFilter {
  stationId?: string;
  status?: EquipmentStatus;
  search?: string;
}

/**
 * Filter options for nozzle list
 */
export interface NozzleFilter {
  stationId?: string;
  pumpId?: string;
  fuelType?: FuelType;
  status?: EquipmentStatus;
}

// ============================================
// PUMP STATS
// ============================================

/**
 * Pump performance metrics
 */
export interface PumpPerformance {
  pumpId: string;
  pumpNumber: number;
  pumpName: string;
  totalVolume: number;
  totalSales: number;
  transactions: number;
  avgTransactionSize: number;
  uptime: number; // percentage
  status: EquipmentStatus;
}

/**
 * Nozzle performance metrics
 */
export interface NozzlePerformance {
  nozzleId: string;
  nozzleNumber: number;
  fuelType: FuelType;
  totalVolume: number;
  totalSales: number;
  transactions: number;
  avgPricePerLitre: number;
}
