/**
 * Shift Model
 * 
 * Types and interfaces for shift management and cash handover.
 * 
 * @module core/models/shift
 */

import { BaseEntity, Notable, DateRangeFilter } from './base.model';
import { ShiftType, ShiftStatus, HandoverStatus } from '../enums';

// ============================================
// SHIFT ENTITY
// ============================================

/**
 * Shift entity - represents an employee work shift
 */
export interface Shift extends BaseEntity, Notable {
  employeeId: string;
  stationId: string;
  shiftDate: string;
  startTime: string;
  endTime?: string;
  shiftType: ShiftType;
  status: ShiftStatus;
  openingCash?: number;
  expectedCash?: number;
  actualCash?: number;
  expectedOnline?: number;
  actualOnline?: number;
  totalSales?: number;
  discrepancy?: number;
  endNotes?: string;
}

/**
 * Shift with related data
 */
export interface ShiftWithRelations extends Shift {
  employee?: {
    id: string;
    name: string;
    email: string;
  };
  station?: {
    id: string;
    name: string;
  };
  readings?: Array<{
    id: string;
    nozzleId: string;
    litresSold: number;
    totalAmount: number;
  }>;
}

// ============================================
// SHIFT DTOs
// ============================================

/**
 * DTO for starting a shift
 */
export interface StartShiftDTO {
  stationId?: string;
  shiftDate?: string;
  startTime?: string;
  shiftType?: ShiftType;
  openingCash?: number;
  notes?: string;
}

/**
 * DTO for ending a shift
 */
export interface EndShiftDTO {
  endTime?: string;
  actualCash?: number;
  actualOnline?: number;
  endNotes?: string;
}

/**
 * DTO for cancelling a shift
 */
export interface CancelShiftDTO {
  reason: string;
}

// ============================================
// HANDOVER DTOs
// ============================================

/**
 * DTO for confirming a handover
 */
export interface ConfirmHandoverDTO {
  notes?: string;
}

/**
 * DTO for disputing a handover
 */
export interface DisputeHandoverDTO {
  disputeReason: string;
}

/**
 * DTO for resolving a dispute
 */
export interface ResolveDisputeDTO {
  resolutionNotes: string;
  adjustedCash?: number;
  adjustedOnline?: number;
}

/**
 * DTO for bank deposit
 */
export interface BankDepositDTO {
  stationId: string;
  date: string;
  amount: number;
  depositSlipNumber?: string;
  bankName?: string;
  notes?: string;
}

// ============================================
// SHIFT FILTERS
// ============================================

/**
 * Filter options for shift list
 */
export interface ShiftFilter extends DateRangeFilter {
  stationId?: string;
  employeeId?: string;
  shiftType?: ShiftType;
  status?: ShiftStatus;
  page?: number;
  limit?: number;
}

/**
 * Filter for handover list
 */
export interface HandoverFilter extends DateRangeFilter {
  stationId?: string;
  employeeId?: string;
  status?: HandoverStatus;
  page?: number;
  limit?: number;
}

// ============================================
// SHIFT SUMMARIES
// ============================================

/**
 * Shift summary for dashboard
 */
export interface ShiftSummary {
  shiftId: number;
  employeeName: string;
  shiftType: ShiftType;
  status: ShiftStatus;
  startTime: string;
  endTime?: string;
  totalSales: number;
  totalLitres: number;
  readingCount: number;
  hasDiscrepancy: boolean;
  discrepancyAmount?: number;
}

/**
 * Active shift info
 */
export interface ActiveShiftInfo {
  hasActiveShift: boolean;
  shift?: ShiftWithRelations;
  canStartNewShift: boolean;
  message?: string;
}

/**
 * Shift performance metrics
 */
export interface ShiftPerformance {
  shiftId: number;
  employeeId: string;
  employeeName: string;
  totalShifts: number;
  totalSales: number;
  averageSalesPerShift: number;
  totalDiscrepancies: number;
  discrepancyRate: number;
  onTimeRate: number;
}
