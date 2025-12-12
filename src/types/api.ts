/**
 * FuelSync API Types
 * Type definitions aligned with backend API
 */

// ============================================
// ENUMS (imported from core/enums)
// ============================================

import type {
  UserRole,
  FuelType,
  PaymentMethod,
  PumpStatus,
  ShiftType,
  ShiftStatus,
  // CreditStatus,
  HandoverStatus,
  ExpenseCategory,
} from '@/core/enums';

// ============================================
// BASE ENTITIES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  stationId?: string;
  planId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  // Extended for frontend
  stations?: Station[];
  plan?: Plan;
}

export interface Plan {
  id: string;
  name: string;
  maxStations: number;
  maxPumpsPerStation: number;
  maxNozzlesPerPump: number;
  maxEmployees: number;
  maxCreditors: number;
  backdatedDays: number;
  analyticsDays: number;
  canExport: boolean;
  canTrackExpenses: boolean;
  priceMonthly: number;
  priceYearly: number;
  isActive: boolean;
}

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
  email?: string;
  gstNumber?: string;
  oilCompany?: string;
  isActive: boolean;
  requireShiftForReadings: boolean;
  alertOnMissedReadings: boolean;
  missedReadingThresholdDays: number;
  createdAt: string;
  updatedAt: string;
  // Relations
  owner?: User;
  pumps?: Pump[];
  staff?: User[];
  pumpCount?: number;
  activePumps?: number;
  plan?: Plan;
  // Frontend helper fields
  lastReading?: string | null;
  todaySales?: number;
}

export interface StationSettings {
  requireShiftForReadings: boolean;
  alertOnMissedReadings: boolean;
  missedReadingThresholdDays: number;
}

export interface Pump {
  id: string;
  stationId: string;
  pumpNumber: number;
  // Legacy compatibility
  pump_sno?: number;
  name: string;
  status: PumpStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  nozzles?: Nozzle[];
}

export interface Nozzle {
  id: string;
  pumpId: string;
  stationId: string;
  nozzleNumber: number;
  // Legacy compatibility
  nozzle_number?: number;
  fuel_type?: FuelType;
  fuelType: FuelType;
  status: PumpStatus;
  initialReading: number;
  lastReading?: number;
  lastReadingDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FuelPrice {
  id: string;
  stationId: string;
  fuelType: FuelType;
  price: number;
  effectiveFrom: string;
  updatedBy: string;
  createdAt: string;
}

export interface NozzleReading {
  id: string;
  nozzleId: string;
  stationId: string;
  shiftId?: number;
  userId: string;
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
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  nozzle?: Nozzle;
  user?: User;
}

export interface Shift {
  id: number;
  employeeId: string;
  stationId: string;
  shiftDate: string;
  startTime: string;
  endTime?: string;
  shiftType: ShiftType;
  status: ShiftStatus;
  cashCollected?: number;
  onlineCollected?: number;
  totalSales?: number;
  discrepancy?: number;
  notes?: string;
  endNotes?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  employee?: User;
  station?: Station;
  readings?: NozzleReading[];
}

export interface Tank {
  id: string;
  stationId: string;
  fuelType: FuelType;
  name?: string;
  capacity: number;
  currentLevel: number;
  lowLevelWarning: number;
  criticalLevelWarning: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TankRefill {
  id: string;
  tankId: string;
  stationId: string;
  litres: number;
  previousLevel: number;
  newLevel: number;
  refillDate: string;
  refillTime?: string;
  costPerLitre?: number;
  totalCost?: number;
  invoiceNumber?: string;
  supplierName?: string;
  vehicleNumber?: string;
  driverName?: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface Creditor {
  id: string;
  stationId: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  businessName?: string;
  gstNumber?: string;
  creditLimit: number;
  currentBalance: number;
  creditPeriodDays: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  creditorId: string;
  stationId: string;
  type: 'sale' | 'payment';
  amount: number;
  fuelType?: FuelType;
  litres?: number;
  pricePerLitre?: number;
  vehicleNumber?: string;
  transactionDate: string;
  referenceNumber?: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  stationId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  vendorName?: string;
  isRecurring: boolean;
  recurringFrequency?: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: true;
  data: {
    token: string;
    user: User;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

// Readings
export interface SubmitReadingRequest {
  nozzleId: string;
  readingDate: string;
  readingValue: number;
  cashAmount?: number;
  onlineAmount?: number;
  notes?: string;
}

export interface PreviousReadingResponse {
  success: true;
  data: {
    previousReading: number;
    lastReadingDate?: string;
    fuelType: FuelType;
    currentPrice?: number;
    priceSet: boolean;
  };
}

// Shifts
export interface StartShiftRequest {
  stationId?: string;
  shiftDate?: string;
  startTime?: string;
  shiftType?: ShiftType;
  notes?: string;
}

export interface EndShiftRequest {
  endTime?: string;
  cashCollected?: number;
  onlineCollected?: number;
  endNotes?: string;
}

// Dashboard
export interface DashboardSummary {
  totalSales: number;
  litresSold: Record<FuelType, number>;
  cashCollection: number;
  onlineCollection: number;
  creditSales: number;
  expenses: number;
  netIncome: number;
}

// Config
export interface ConfigResponse {
  success: true;
  data: {
    fuelTypes: string[];
    paymentMethods: string[];
    expenseCategories: string[];
    roles: string[];
    pumpStatuses: string[];
    oilCompanies: string[];
    states: string[];
  };
}

// Price Check
export interface PriceCheckResponse {
  success: true;
  data: {
    fuelType: FuelType;
    date: string;
    priceSet: boolean;
    price: number | null;
    message: string;
  };
}

// Remove duplicate ApiResponse and PaginatedResponse interfaces to resolve export ambiguity.
// Standard API Response
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Paginated Response
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Error Response
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: Array<{ field: string; message: string }>;
  };
}

// ============================================
// UTILITY TYPES
// ============================================

export type CreateRequest<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateRequest<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

// Legacy compatibility aliases
export type Sale = NozzleReading;
export interface DailySummary {
  date: string;
  totalRevenue: number;
  totalLitres: number;
  totalTransactions: number;
  fuelTypeBreakdown: {
    petrol: { litres: number; revenue: number; transactions: number };
    diesel: { litres: number; revenue: number; transactions: number };
  };
}

export interface Upload {
  id: string;
  userId: string;
  filename: string;
  status: 'processing' | 'success' | 'failed';
  amount: number;
  litres: number;
  fuelType: 'Petrol' | 'Diesel';
  uploadedAt: string;
  processedAt?: string;
  processedData?: Record<string, unknown>;
}

