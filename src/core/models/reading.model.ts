/**
 * Reading Model
 * 
 * Types and interfaces for nozzle readings and fuel prices.
 * 
 * @module core/models/reading
 */

import { BaseEntity, Notable, DateRangeFilter } from './base.model';
import { FuelType } from '../enums';

// ============================================
// NOZZLE READING ENTITY
// ============================================

/**
 * Nozzle reading entity - represents a meter reading
 */
export interface NozzleReading extends BaseEntity, Notable {
  nozzleId: string;
  stationId: string;
  pumpId: string;
  shiftId?: number;
  enteredBy: string;
  readingDate: string;
  previousReading: number;
  currentReading: number;
  litresSold: number;
  fuelType: FuelType;
  pricePerLitre: number;
  totalAmount: number;
  cashAmount: number;
  onlineAmount: number;
  creditAmount: number;
  creditorId?: string;
  isInitialReading: boolean;
}

/**
 * Reading with related data
 */
export interface ReadingWithRelations extends NozzleReading {
  nozzle?: {
    id: string;
    nozzleNumber: number;
    fuelType: FuelType;
    pump?: {
      id: string;
      pumpNumber: number;
      name: string;
    };
  };
  user?: {
    id: string;
    name: string;
  };
  creditor?: {
    id: string;
    name: string;
  };
}

// ============================================
// FUEL PRICE ENTITY
// ============================================

/**
 * Fuel price entity
 */
export interface FuelPrice extends BaseEntity {
  stationId: string;
  fuelType: FuelType;
  price: number;
  effectiveFrom: string;
  effectiveTo?: string;
  updatedBy: string;
}

/**
 * Current price info for a fuel type
 */
export interface CurrentPrice {
  fuelType: FuelType;
  price: number;
  effectiveFrom: string;
  isSet: boolean;
}

// ============================================
// READING DTOs
// ============================================

/**
 * DTO for submitting a new reading
 */
export interface SubmitReadingDTO {
  nozzleId: string;
  stationId?: string;
  readingDate: string;
  currentReading: number;
  cashAmount?: number;
  onlineAmount?: number;
  creditAmount?: number;
  creditorId?: string;
  shiftId?: number;
  notes?: string;
}

/**
 * DTO for updating a reading
 */
export interface UpdateReadingDTO {
  currentReading?: number;
  cashAmount?: number;
  onlineAmount?: number;
  creditAmount?: number;
  creditorId?: string;
  notes?: string;
}

/**
 * Previous reading info for data entry
 */
export interface PreviousReadingInfo {
  previousReading: number;
  lastReadingDate?: string;
  fuelType: FuelType;
  currentPrice?: number;
  priceSet: boolean;
}

// ============================================
// FUEL PRICE DTOs
// ============================================

/**
 * DTO for setting a fuel price
 */
export interface SetFuelPriceDTO {
  stationId?: string;
  fuelType: FuelType;
  price: number;
  effectiveFrom?: string;
}

/**
 * DTO for bulk price update
 */
export interface BulkPriceUpdateDTO {
  stationId?: string;
  prices: Array<{
    fuelType: FuelType;
    price: number;
  }>;
  effectiveFrom?: string;
}

// ============================================
// READING FILTERS
// ============================================

/**
 * Filter options for reading list
 */
export interface ReadingFilter extends DateRangeFilter {
  stationId?: string;
  nozzleId?: string;
  pumpId?: string;
  fuelType?: FuelType;
  enteredBy?: string;
  shiftId?: number;
  page?: number;
  limit?: number;
}

/**
 * Filter for price history
 */
export interface PriceHistoryFilter extends DateRangeFilter {
  stationId?: string;
  fuelType?: FuelType;
}

// ============================================
// READING SUMMARIES
// ============================================

/**
 * Daily reading summary
 */
export interface DailyReadingSummary {
  date: string;
  stationId: string;
  totalLitres: number;
  totalAmount: number;
  cashAmount: number;
  onlineAmount: number;
  creditAmount: number;
  readingCount: number;
  byFuelType: Record<FuelType, {
    litres: number;
    amount: number;
    readings: number;
  }>;
}

/**
 * Fuel type breakdown
 */
export interface FuelBreakdown {
  fuelType: FuelType;
  fuelTypeName: string;
  volume: number;
  sales: number;
  percentage: number;
  averagePrice: number;
  transactions: number;
}

/**
 * Reading validation result
 */
export interface ReadingValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  expectedLitres?: number;
  expectedAmount?: number;
  variance?: number;
}
