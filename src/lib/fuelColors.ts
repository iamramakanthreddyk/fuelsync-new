/**
 * Fuel Colors - DEPRECATED
 *
 * This file is deprecated. Use @/core/fuel/fuelConfig instead.
 * All fuel color and configuration data has been moved to the centralized fuel configuration.
 *
 * @deprecated Import from @/core/fuel/fuelConfig instead
 */

// Re-export from centralized config for backward compatibility
export {
  getFuelColorScheme as getFuelColors,
  getFuelBadgeClasses,
  getFuelHexColor,
  getFuelChartColor,
  type FuelType
} from '@/core/fuel/fuelConfig';

// Legacy type for backward compatibility
export type FuelColorScheme = ReturnType<typeof getFuelColorScheme>;

// Legacy exports for backward compatibility
export const FUEL_COLORS = {} as const; // Empty - use FUEL_TYPE_CONFIG instead
