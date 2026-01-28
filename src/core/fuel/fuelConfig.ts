/**
 * Fuel Type Configuration - SINGLE SOURCE OF TRUTH
 *
 * This file contains ALL fuel type related configuration including:
 * - Enums and types
 * - Display labels and names
 * - Color schemes (hex, Tailwind, chart colors)
 * - UI configuration
 * - Helper functions
 *
 * DO NOT duplicate fuel type data elsewhere in the codebase.
 * Import from this file for all fuel-related constants and utilities.
 */

import { FuelTypeEnum, type FuelType } from '@/core/enums';

// ============================================
// FUEL TYPE CONFIGURATION
// ============================================

export interface FuelTypeConfig {
  /** Primary display label */
  label: string;
  /** Short label for compact displays */
  shortLabel: string;
  /** Common brand/display names used at stations */
  displayNames: string[];
  /** Hex color for charts and raw CSS */
  hexColor: string;
  /** Tailwind color classes */
  tailwind: {
    bg: string;
    text: string;
    border: string;
    ring: string;
    dot: string;
    hover: string;
  };
  /** Chart color (may differ from primary hex for better contrast) */
  chartColor: string;
  /** Icon or emoji representation */
  icon?: string;
}

/**
 * Complete fuel type configuration - SINGLE SOURCE OF TRUTH
 */
export const FUEL_TYPE_CONFIG: Record<FuelType, FuelTypeConfig> = {
  [FuelTypeEnum.PETROL]: {
    label: 'Petrol',
    shortLabel: 'P',
    displayNames: ['XP 95', 'Speed', 'Regular', 'MS'],
    hexColor: '#22c55e', // green-500
    chartColor: '#22c55e',
    tailwind: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
      ring: 'ring-green-200',
      dot: 'bg-green-500',
      hover: 'hover:bg-green-200'
    }
  },
  [FuelTypeEnum.DIESEL]: {
    label: 'Diesel',
    shortLabel: 'D',
    displayNames: ['MSD', 'HSD', 'Regular Diesel'],
    hexColor: '#3b82f6', // blue-500
    chartColor: '#3b82f6',
    tailwind: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      ring: 'ring-blue-200',
      dot: 'bg-blue-500',
      hover: 'hover:bg-blue-200'
    }
  },
  [FuelTypeEnum.PREMIUM_PETROL]: {
    label: 'Premium Petrol',
    shortLabel: 'PP',
    displayNames: ['XP 100', 'Power', 'Extra Premium', 'Speed 97'],
    hexColor: '#f59e0b', // amber-500
    chartColor: '#f59e0b',
    tailwind: {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      ring: 'ring-orange-200',
      dot: 'bg-orange-500',
      hover: 'hover:bg-orange-200'
    }
  },
  [FuelTypeEnum.PREMIUM_DIESEL]: {
    label: 'Premium Diesel',
    shortLabel: 'PD',
    displayNames: ['HSM', 'Turbojet', 'Premium HSD', 'XtraGreen'],
    hexColor: '#14b8a6', // teal-500
    chartColor: '#14b8a6',
    tailwind: {
      bg: 'bg-teal-100',
      text: 'text-teal-800',
      border: 'border-teal-300',
      ring: 'ring-teal-200',
      dot: 'bg-teal-500',
      hover: 'hover:bg-teal-200'
    }
  },
  [FuelTypeEnum.CNG]: {
    label: 'CNG',
    shortLabel: 'CNG',
    displayNames: ['CNG'],
    hexColor: '#a855f7', // violet-500
    chartColor: '#a855f7',
    tailwind: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-300',
      ring: 'ring-purple-200',
      dot: 'bg-purple-500',
      hover: 'hover:bg-purple-200'
    }
  },
  [FuelTypeEnum.LPG]: {
    label: 'LPG',
    shortLabel: 'LPG',
    displayNames: ['Auto LPG'],
    hexColor: '#ec4899', // pink-500
    chartColor: '#ec4899',
    tailwind: {
      bg: 'bg-pink-100',
      text: 'text-pink-800',
      border: 'border-pink-300',
      ring: 'ring-pink-200',
      dot: 'bg-pink-500',
      hover: 'hover:bg-pink-200'
    }
  },
  [FuelTypeEnum.EV_CHARGING]: {
    label: 'EV Charging',
    shortLabel: 'EV',
    displayNames: ['EV Charging', 'Electric'],
    hexColor: '#eab308', // yellow-500
    chartColor: '#eab308',
    tailwind: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-300',
      ring: 'ring-yellow-200',
      dot: 'bg-yellow-500',
      hover: 'hover:bg-yellow-200'
    }
  }
};

// ============================================
// LEGACY COMPATIBILITY (will be removed)
// ============================================

/**
 * @deprecated Use FUEL_TYPE_CONFIG instead
 */
export const FUEL_CONFIG = Object.fromEntries(
  Object.entries(FUEL_TYPE_CONFIG).map(([key, config]) => [
    key.toUpperCase().replace('_', '_'),
    {
      label: config.label,
      shortLabel: config.shortLabel,
      color: config.hexColor
    }
  ])
);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get fuel type configuration by fuel type (case-insensitive)
 */
export function getFuelTypeConfig(fuelType?: string): FuelTypeConfig | null {
  if (!fuelType) return null;
  const normalized = fuelType.toLowerCase();
  return FUEL_TYPE_CONFIG[normalized as FuelType] || null;
}

/**
 * Get fuel color scheme (Tailwind classes) - replaces getFuelColors
 */
export function getFuelColorScheme(fuelType?: string) {
  const config = getFuelTypeConfig(fuelType);
  return config?.tailwind || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-300',
    ring: 'ring-gray-200',
    dot: 'bg-gray-500',
    hover: 'hover:bg-gray-200'
  };
}

/**
 * Get fuel badge classes for consistent styling - replaces getFuelBadgeClasses
 */
export function getFuelBadgeClasses(fuelType?: string): string {
  const colors = getFuelColorScheme(fuelType);
  return `${colors.bg} ${colors.text} ${colors.border} ${colors.hover}`;
}

/**
 * Get hex color for fuel type - for charts and raw CSS
 */
export function getFuelHexColor(fuelType?: string): string {
  return getFuelTypeConfig(fuelType)?.hexColor || '#6b7280';
}

/**
 * Get chart color for fuel type
 */
export function getFuelChartColor(fuelType?: string): string {
  return getFuelTypeConfig(fuelType)?.chartColor || '#6b7280';
}

/**
 * Get display label for fuel type
 */
export function getFuelTypeLabel(fuelType?: string): string {
  return getFuelTypeConfig(fuelType)?.label || fuelType || 'Unknown';
}

/**
 * Get short label for fuel type
 */
export function getFuelTypeShortLabel(fuelType?: string): string {
  return getFuelTypeConfig(fuelType)?.shortLabel || fuelType?.charAt(0).toUpperCase() || '?';
}

/**
 * Get display names for fuel type
 */
export function getFuelTypeDisplayNames(fuelType?: string): string[] {
  return getFuelTypeConfig(fuelType)?.displayNames || [];
}

/**
 * Normalize fuel type to enum value (case-insensitive)
 */
export function normalizeFuelType(fuelType: string): FuelType | null {
  if (!fuelType) return null;
  const normalized = fuelType.toLowerCase();
  const found = Object.keys(FUEL_TYPE_CONFIG).find(
    key => key.toLowerCase() === normalized
  );
  return found as FuelType || null;
}

/**
 * Check if a value is a valid fuel type
 */
export function isValidFuelType(value: string): boolean {
  return normalizeFuelType(value) !== null;
}

/**
 * Get all fuel types as array
 */
export function getAllFuelTypes(): FuelType[] {
  return Object.keys(FUEL_TYPE_CONFIG) as FuelType[];
}

/**
 * Get fuel type options for UI selects
 */
export function getFuelTypeOptions() {
  return getAllFuelTypes().map(fuelType => ({
    value: fuelType,
    label: getFuelTypeLabel(fuelType),
    displayNames: getFuelTypeDisplayNames(fuelType)
  }));
}