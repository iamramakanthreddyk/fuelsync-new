// Global type aliases for legacy or convenience imports
// These map to the canonical types defined in `src/types/api.ts`
import type {
  Pump as PumpType,
  Nozzle as NozzleType,
  FuelPrice as FuelPriceType,
  Station as StationType,
  Creditor as CreditorType,
  // Optional: import User and Plan if present in `api.ts`
  User as UserType,
  Plan as PlanType
} from './api';

declare global {
  // Simplified global names for components or legacy code
  type Pump = PumpType;
  type Nozzle = NozzleType;
  type FuelPrice = FuelPriceType;
  type Station = StationType;
  type Creditor = CreditorType;
  // If `User` and `Plan` are exported from `src/types/api.ts`, these map to those.
  // Otherwise, we fall back to locally declared minimal interfaces below.
  type User = UserType;
  type Plan = PlanType;
}
// Fallback local declarations if the canonical api types do not export User/Plan
declare global {
  interface Plan {
    id: string;
    name: string;
    priceMonthly: number;
    maxStations?: number;
    maxEmployees?: number;
  }

  interface User {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: 'super_admin' | 'owner' | 'manager' | 'employee';
    isActive: boolean;
    createdAt?: string;
    stationId?: string;
    planId?: string;
    station?: { id: string; name: string };
    plan?: { id: string; name: string; priceMonthly: number };
    ownedStations?: Array<{ id: string; name: string }>;
  }
}

export {};
