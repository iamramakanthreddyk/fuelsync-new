// Database types matching the backend multi-tenant fuel station schema
// Uses camelCase to match the backend API responses

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'super_admin' | 'owner' | 'manager' | 'employee';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  // For managers/employees - which station they work at
  stationId?: string;
  station?: Station;
  // For owners - their subscription plan
  planId?: string;
  plan?: Plan;
  // For owners - stations they own
  ownedStations?: Station[];
  // Who created this user
  createdBy?: string;
}

export interface Station {
  id: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  ownerId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  // Relations
  owner?: User;
  pumps?: Pump[];
  staff?: User[];
  pumpCount?: number;
  activePumps?: number;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  // Resource limits
  maxStations: number;
  maxPumpsPerStation: number;
  maxNozzlesPerPump: number;
  maxEmployees: number;
  maxCreditors: number;
  // Time limits
  backdatedDays: number;
  analyticsDays: number;
  // Feature flags
  canExport: boolean;
  canTrackExpenses: boolean;
  canTrackCredits: boolean;
  canViewProfitLoss: boolean;
  // Pricing
  priceMonthly: number;
  priceYearly?: number;
  features?: Record<string, boolean>;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
}

export interface Pump {
  id: string;
  stationId: string;
  name: string;
  pumpNumber: number;
  status: 'active' | 'inactive' | 'maintenance';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  nozzles?: Nozzle[];
}

export interface Nozzle {
  id: string;
  pumpId: string;
  nozzleNumber: number;
  fuelType: 'PETROL' | 'DIESEL' | 'SPEED' | 'XTRA_GREEN';
  isActive: boolean;
  lastReading?: number;
  lastReadingDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ManualReading {
  id: string;
  stationId: string;
  nozzleId: string;
  pumpSno?: string;
  readingDate: string;
  readingTime?: string;
  cumulativeVol: number;
  imageUrl?: string | null;
  createdBy?: string | null; // UUID, FK to users
  createdAt: string;
}

export interface FuelPrice {
  id: number;
  station_id: number | null;
  fuel_type: 'petrol' | 'diesel' | 'premium_petrol' | 'premium_diesel' | 'cng' | 'lpg' | 'ev_charging';
  price_per_litre: number;
  valid_from: string;
  created_by: string | null; // UUID
  created_at: string;
}

export interface Sale {
  id: number;
  station_id: number | null;
  nozzle_id: number | null;
  reading_id: number | null;
  delta_volume_l: number | null;
  price_per_litre: number | null;
  total_amount: number | null;
  created_at: string;
}

export interface TenderEntry {
  id: number;
  station_id: number | null;
  entry_date: string;
  type: 'cash' | 'card' | 'upi' | 'credit' | null;
  payer: string | null;
  amount: number | null;
  user_id: number | null;
  created_at: string;
}

export interface Settlement {
  station_id: number;
  date: string;
  sales_total: number | null;
  tender_total: number | null;
  difference: number | null;
  closed_by: number | null;
  closed_at: string;
  notes?: string | null;
}

// Backwards compatibility alias
export type DailyClosure = Settlement;

export interface PlanUsage {
  station_id: number;
  month: string;
  manual_readings_count: number;
  pumps_used: number;
  nozzles_used: number;
  employees_count: number;
}

export interface EventLog {
  id: number;
  user_id: number | null;
  station_id: number | null;
  event_type: string;
  payload: unknown;
  occurred_at: string;
}

// Form data interfaces for UI
export interface ManualEntryData {
  station_id: number;
  nozzle_id: number;
  cumulative_vol: number;
  reading_date: string;
  reading_time: string;
}

export interface TenderEntryData {
  station_id: number;
  entry_date: string;
  type: 'cash' | 'card' | 'upi' | 'credit';
  payer: string;
  amount: number;
}

export interface RefillData {
  station_id: number;
  fuel_type: 'petrol' | 'diesel' | 'premium_petrol' | 'premium_diesel' | 'cng' | 'lpg' | 'ev_charging';
  quantity_l: number;
  filled_at: string;
}
