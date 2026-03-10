// Canonical DB-aligned TypeScript types for FuelSync backend
// Generated from backend/database/schema.sql

export type UUID = string;
export type DateString = string; // YYYY-MM-DD
export type DateTimeString = string; // ISO 8601

// Enum types (mirror DB ENUMs)
export type UserRole = 'super_admin' | 'owner' | 'manager' | 'employee';
export type FuelType = 'petrol' | 'diesel';
export type EquipmentStatus = 'active' | 'repair' | 'inactive';
export type ShiftStatus = 'active' | 'ended' | 'cancelled';
export type CreditTransactionType = 'credit' | 'settlement' | 'adjustment';

// Plans
export interface Plan {
  id: UUID;
  name: string;
  maxStations: number;
  maxPumpsPerStation: number;
  maxNozzlesPerPump: number;
  maxEmployees: number;
  backdatedDays: number;
  analyticsDays: number;
  canExport: boolean;
  priceMonthly: number;
  features?: Record<string, unknown> | null;
  isActive?: boolean;
  createdAt?: DateTimeString;
  updatedAt?: DateTimeString | null;
  deletedAt?: DateTimeString | null;
}

// Stations
export interface Station {
  id: UUID;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  gstNumber?: string | null;
  isActive?: boolean;
  createdAt?: DateTimeString;
  updatedAt?: DateTimeString | null;
  deletedAt?: DateTimeString | null;
}

// Users
export interface User {
  id: UUID;
  email: string;
  password?: string; // hashed password (not returned to clients)
  name: string;
  phone?: string | null;
  role: UserRole;
  stationId?: UUID | null;
  planId?: UUID | null;
  isActive?: boolean;
  lastLoginAt?: DateTimeString | null;
  createdAt?: DateTimeString;
  updatedAt?: DateTimeString | null;
  deletedAt?: DateTimeString | null;
}

// Pumps
export interface Pump {
  id: UUID;
  stationId: UUID;
  name: string;
  pumpNumber: number;
  status: EquipmentStatus;
  notes?: string | null;
  createdAt?: DateTimeString;
  updatedAt?: DateTimeString | null;
}

// Nozzles
export interface Nozzle {
  id: UUID;
  pumpId: UUID;
  nozzleNumber: number;
  fuelType: FuelType;
  status: EquipmentStatus;
  initialReading?: number;
  notes?: string | null;
  createdAt?: DateTimeString;
  updatedAt?: DateTimeString | null;
}

// Fuel Prices (historical)
export interface FuelPrice {
  id: UUID;
  stationId: UUID;
  fuelType: FuelType;
  price: number;
  effectiveFrom: DateString;
  updatedBy?: UUID | null;
  createdAt?: DateTimeString;
}

// Nozzle Readings (core)
export interface NozzleReading {
  id: UUID;
  nozzleId: UUID;
  stationId: UUID;
  enteredBy: UUID;
  readingDate: DateString;
  readingValue: number;
  previousReading?: number | null;
  litresSold?: number;
  pricePerLitre?: number | null;
  totalAmount?: number;
  cashAmount?: number;
  onlineAmount?: number;
  isInitialReading?: boolean;
  notes?: string | null;
  createdAt?: DateTimeString;
  updatedAt?: DateTimeString | null;
}

// Creditors
export interface Creditor {
  id: UUID;
  stationId: UUID;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  businessName?: string | null;
  gstNumber?: string | null;
  creditLimit?: number;
  creditPeriodDays?: number;
  currentBalance?: number;
  lastTransactionDate?: DateTimeString | null;
  lastPaymentDate?: DateTimeString | null;
  isFlagged?: boolean;
  isActive?: boolean;
  notes?: string | null;
  createdBy?: UUID | null;
  createdAt?: DateTimeString;
  updatedAt?: DateTimeString | null;
}

// Credit Transactions
export interface CreditTransaction {
  id: UUID;
  stationId: UUID;
  creditorId: UUID;
  transactionType: CreditTransactionType;
  fuelType?: FuelType | null;
  litres?: number | null;
  pricePerLitre?: number | null;
  amount: number;
  transactionDate?: DateString;
  vehicleNumber?: string | null;
  referenceNumber?: string | null;
  nozzleReadingId?: UUID | null;
  notes?: string | null;
  enteredBy?: UUID | null;
  createdAt?: DateTimeString;
  updatedAt?: DateTimeString | null;
}

// Shifts
export interface Shift {
  id: UUID;
  stationId: UUID;
  employeeId?: UUID | null;
  shiftDate?: DateString;
  startTime?: string; // HH:mm
  endTime?: string | null;
  shiftType?: string;
  cashCollected?: number | null;
  onlineCollected?: number | null;
  expectedCash?: number | null;
  cashDifference?: number | null;
  openingCash?: number | null;
  managerId?: UUID | null;
  readingsCount?: number;
  totalLitresSold?: number;
  totalSalesAmount?: number;
  status?: ShiftStatus;
  endedBy?: UUID | null;
  notes?: string | null;
  endNotes?: string | null;
  createdAt?: DateTimeString;
  updatedAt?: DateTimeString | null;
}

// Cash Handovers
export interface CashHandover {
  id: UUID;
  shiftId?: UUID | null;
  stationId: UUID;
  handedBy?: UUID | null;
  receivedBy?: UUID | null;
  amount: number;
  status?: string;
  notes?: string | null;
  createdAt?: DateTimeString;
  updatedAt?: DateTimeString | null;
}

export default {};
