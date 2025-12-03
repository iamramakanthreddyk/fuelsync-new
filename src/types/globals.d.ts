// Global type aliases for legacy or convenience imports
// These map to the canonical types defined in `src/types/api.ts`
import type {
  Pump as PumpType,
  Nozzle as NozzleType,
  FuelPrice as FuelPriceType,
  Station as StationType,
  Creditor as CreditorType
} from './api';

declare global {
  // Simplified global names for components or legacy code
  type Pump = PumpType;
  type Nozzle = NozzleType;
  type FuelPrice = FuelPriceType;
  type Station = StationType;
  type Creditor = CreditorType;
}

export {};
