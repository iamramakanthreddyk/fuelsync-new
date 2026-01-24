/**
 * FuelSync UI Constants
 * 
 * Re-exports core enums from @/core/enums (SINGLE SOURCE OF TRUTH)
 * and adds UI-specific helpers (colors, options for selects, etc.)
 * 
 * IMPORTANT: Do NOT duplicate fuel types here!
 * Use FuelTypeEnum from @/core/enums for all fuel type values.
 */

// ============================================
// RE-EXPORT FROM CORE ENUMS (Single Source of Truth)
// ============================================
export { 
  FuelTypeEnum, 
  type FuelType,
  FUEL_TYPE_LABELS,
  TankStatusEnum,
  type TankStatus,
  EquipmentStatusEnum,
  type EquipmentStatus,
  UserRoleEnum,
  type UserRole,
  PaymentMethodEnum,
  type PaymentMethod,
  PAYMENT_METHOD_LABELS,
} from '@/core/enums';

import { FuelTypeEnum, FUEL_TYPE_LABELS } from '@/core/enums';

// ============================================
// UI-SPECIFIC: Select Options (derived from core enums)
// ============================================

/**
 * Common display names used at fuel stations (for reference when setting up tanks)
 */
export const FUEL_TYPE_DISPLAY_NAMES: Record<string, string[]> = {
  [FuelTypeEnum.PETROL]: ['XP 95', 'Speed', 'Regular', 'MS'],
  [FuelTypeEnum.DIESEL]: ['MSD', 'HSD', 'Regular Diesel'],
  [FuelTypeEnum.PREMIUM_PETROL]: ['XP 100', 'Power', 'Extra Premium', 'Speed 97'],
  [FuelTypeEnum.PREMIUM_DIESEL]: ['HSM', 'Turbojet', 'Premium HSD', 'XtraGreen'],
  [FuelTypeEnum.CNG]: ['CNG'],
  [FuelTypeEnum.LPG]: ['Auto LPG'],
  [FuelTypeEnum.EV_CHARGING]: ['EV Charging', 'Electric'],
};

/**
 * Ready-to-use options for UI select components
 * Derived from FuelTypeEnum - no duplication!
 */
export const FUEL_TYPE_OPTIONS = Object.values(FuelTypeEnum).map(value => ({
  value,
  label: FUEL_TYPE_LABELS[value] || value,
  displayNames: FUEL_TYPE_DISPLAY_NAMES[value] || [],
}));

/**
 * Get all fuel type values as an array
 */
export const FUEL_TYPE_VALUES = Object.values(FuelTypeEnum);

/**
 * Helper: Get label for a fuel type value
 */
export function getFuelTypeLabel(fuelType: string): string {
  return FUEL_TYPE_LABELS[fuelType as keyof typeof FUEL_TYPE_LABELS] || fuelType;
}

/**
 * Helper: Check if a value is a valid fuel type
 */
export function isValidFuelType(value: string): boolean {
  return FUEL_TYPE_VALUES.includes(value as any);
}

// ============================================
// TANK STATUS UI (extends core TankStatusEnum with UI colors)
// ============================================

/**
 * Tank status badge colors (UI-specific)
 * Note: TankStatusEnum from core has: active, inactive, maintenance, empty, low, critical
 * We add extra UI states: normal, negative, overflow for display purposes
 */
export const TANK_STATUS_COLORS: Record<string, string> = {
  normal: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  low: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-orange-100 text-orange-800',
  empty: 'bg-red-100 text-red-800',
  negative: 'bg-red-100 text-red-800 animate-pulse',
  overflow: 'bg-blue-100 text-blue-800',
  inactive: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-purple-100 text-purple-800',
};

// ============================================
// OTHER UI CONSTANTS
// ============================================

export const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function getSourceBadgeClasses(source?: string) {
  if (!source) return 'bg-gray-100 text-gray-800';
  const s = source.toLowerCase();
  if (s === 'manual') return 'bg-orange-100 text-orange-700';
  if (s === 'refill') return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-800';
}

import { Shield, Home, UserCheck, User, Briefcase, Crown as CrownIcon } from 'lucide-react';

export const ROLE_ICONS: Record<string, any> = {
  super_admin: CrownIcon,
  superadmin: CrownIcon,
  owner: Home,
  manager: Briefcase,
  employee: User,
};
