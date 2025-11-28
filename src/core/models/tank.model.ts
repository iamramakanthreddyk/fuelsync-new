/**
 * Tank Model
 * 
 * Types and interfaces for fuel tank management and dip readings.
 * 
 * @module core/models/tank
 */

import { BaseEntity, Activatable, Notable, DateRangeFilter } from './base.model';
import { FuelType, TankStatus } from '../enums';

// ============================================
// TANK ENTITY
// ============================================

/**
 * Tank entity - represents a fuel storage tank
 */
export interface Tank extends BaseEntity, Activatable, Notable {
  stationId: string;
  name: string;
  tankNumber: number;
  fuelType: FuelType;
  capacity: number;
  currentLevel: number;
  reorderLevel: number;
  criticalLevel: number;
  status: TankStatus;
  lastDipReading?: number;
  lastDipDate?: string;
  location?: string;
}

/**
 * Tank with calculated properties
 */
export interface TankWithStatus extends Tank {
  availableCapacity: number;
  percentageFull: number;
  isBelowReorder: boolean;
  isCritical: boolean;
  connectedPumps?: Array<{
    pumpId: string;
    pumpNumber: number;
    nozzleCount: number;
  }>;
}

// ============================================
// DIP READING ENTITY
// ============================================

/**
 * Dip reading entity - physical measurement of tank level
 */
export interface DipReading extends BaseEntity, Notable {
  tankId: string;
  stationId: string;
  readingDate: string;
  physicalLevel: number;
  bookLevel: number;
  variance: number;
  variancePercentage: number;
  temperature?: number;
  waterLevel?: number;
  readingBy: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

/**
 * Dip reading with related data
 */
export interface DipReadingWithRelations extends DipReading {
  tank?: {
    id: string;
    name: string;
    tankNumber: number;
    fuelType: FuelType;
    capacity: number;
  };
  reader?: {
    id: string;
    name: string;
  };
  verifier?: {
    id: string;
    name: string;
  };
}

// ============================================
// FUEL RECEIPT ENTITY
// ============================================

/**
 * Fuel receipt/delivery entity
 */
export interface FuelReceipt extends BaseEntity, Notable {
  tankId: string;
  stationId: string;
  deliveryDate: string;
  supplierId?: string;
  supplierName: string;
  invoiceNumber: string;
  fuelType: FuelType;
  quantityOrdered: number;
  quantityReceived: number;
  pricePerLitre: number;
  totalAmount: number;
  tankLevelBefore: number;
  tankLevelAfter: number;
  variance: number;
  deliveryNote?: string;
  driverName?: string;
  vehicleNumber?: string;
  receivedBy: string;
  verifiedBy?: string;
}

/**
 * Fuel receipt with related data
 */
export interface FuelReceiptWithRelations extends FuelReceipt {
  tank?: {
    id: string;
    name: string;
    tankNumber: number;
    fuelType: FuelType;
  };
  receiver?: {
    id: string;
    name: string;
  };
}

// ============================================
// TANK DTOs
// ============================================

/**
 * DTO for creating a tank
 */
export interface CreateTankDTO {
  stationId?: string;
  name: string;
  tankNumber: number;
  fuelType: FuelType;
  capacity: number;
  currentLevel?: number;
  reorderLevel?: number;
  criticalLevel?: number;
  location?: string;
  notes?: string;
}

/**
 * DTO for updating a tank
 */
export interface UpdateTankDTO {
  name?: string;
  tankNumber?: number;
  capacity?: number;
  reorderLevel?: number;
  criticalLevel?: number;
  location?: string;
  isActive?: boolean;
  notes?: string;
}

// ============================================
// DIP READING DTOs
// ============================================

/**
 * DTO for recording a dip reading
 */
export interface RecordDipReadingDTO {
  tankId: string;
  stationId?: string;
  physicalLevel: number;
  readingDate?: string;
  temperature?: number;
  waterLevel?: number;
  notes?: string;
}

/**
 * DTO for verifying a dip reading
 */
export interface VerifyDipReadingDTO {
  verified: boolean;
  verifierNotes?: string;
}

// ============================================
// FUEL RECEIPT DTOs
// ============================================

/**
 * DTO for recording a fuel receipt
 */
export interface RecordFuelReceiptDTO {
  tankId: string;
  stationId?: string;
  deliveryDate?: string;
  supplierId?: string;
  supplierName: string;
  invoiceNumber: string;
  quantityOrdered: number;
  quantityReceived: number;
  pricePerLitre: number;
  driverName?: string;
  vehicleNumber?: string;
  deliveryNote?: string;
  notes?: string;
}

/**
 * DTO for updating a fuel receipt
 */
export interface UpdateFuelReceiptDTO {
  invoiceNumber?: string;
  quantityReceived?: number;
  pricePerLitre?: number;
  deliveryNote?: string;
  notes?: string;
}

// ============================================
// TANK FILTERS
// ============================================

/**
 * Filter for tank list
 */
export interface TankFilter {
  stationId?: string;
  fuelType?: FuelType;
  status?: TankStatus;
  isActive?: boolean;
  belowReorder?: boolean;
  isCritical?: boolean;
}

/**
 * Filter for dip readings
 */
export interface DipReadingFilter extends DateRangeFilter {
  stationId?: string;
  tankId?: string;
  hasVariance?: boolean;
  isVerified?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Filter for fuel receipts
 */
export interface FuelReceiptFilter extends DateRangeFilter {
  stationId?: string;
  tankId?: string;
  fuelType?: FuelType;
  supplierId?: string;
  page?: number;
  limit?: number;
}

// ============================================
// TANK SUMMARIES
// ============================================

/**
 * Tank inventory summary
 */
export interface TankInventorySummary {
  totalCapacity: number;
  totalCurrentLevel: number;
  totalAvailable: number;
  overallUtilization: number;
  byFuelType: Record<FuelType, {
    capacity: number;
    currentLevel: number;
    available: number;
    tankCount: number;
  }>;
  tanksNeedingReorder: number;
  tanksAtCritical: number;
}

/**
 * Dip reading variance summary
 */
export interface VarianceSummary {
  totalReadings: number;
  readingsWithVariance: number;
  totalVarianceLitres: number;
  varianceValue: number;
  avgVariancePercent: number;
  byFuelType: Record<FuelType, {
    readings: number;
    variance: number;
    varianceValue: number;
  }>;
}

/**
 * Fuel purchase summary
 */
export interface FuelPurchaseSummary {
  totalReceipts: number;
  totalQuantity: number;
  totalAmount: number;
  avgPricePerLitre: number;
  byFuelType: Record<FuelType, {
    quantity: number;
    amount: number;
    avgPrice: number;
    receiptCount: number;
  }>;
  bySupplier: Array<{
    supplierId: string;
    supplierName: string;
    quantity: number;
    amount: number;
    receiptCount: number;
  }>;
}

/**
 * Tank activity log entry
 */
export interface TankActivity {
  id: string;
  tankId: string;
  tankName: string;
  activityType: 'dip_reading' | 'fuel_receipt' | 'fuel_sale' | 'adjustment';
  timestamp: string;
  quantityChange: number;
  levelBefore: number;
  levelAfter: number;
  referenceId?: string;
  performedBy: string;
  notes?: string;
}
