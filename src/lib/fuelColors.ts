/**
 * Consistent fuel type color scheme used throughout the application
 */

export type FuelType = 'petrol' | 'diesel' | 'cng' | 'ev';

export interface FuelColorScheme {
  bg: string;
  text: string;
  border: string;
  ring: string;
  dot: string;
  hover: string;
}

export const FUEL_COLORS: Record<string, FuelColorScheme> = {
  petrol: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    ring: 'ring-green-200',
    dot: 'bg-green-500',
    hover: 'hover:bg-green-200'
  },
  diesel: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    ring: 'ring-blue-200',
    dot: 'bg-blue-500',
    hover: 'hover:bg-blue-200'
  },
  cng: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
    ring: 'ring-purple-200',
    dot: 'bg-purple-500',
    hover: 'hover:bg-purple-200'
  },
  ev: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    ring: 'ring-yellow-200',
    dot: 'bg-yellow-500',
    hover: 'hover:bg-yellow-200'
  }
};

/**
 * Get fuel color scheme by fuel type (case-insensitive)
 */
export function getFuelColors(fuelType?: string): FuelColorScheme {
  if (!fuelType) {
    return {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      ring: 'ring-gray-200',
      dot: 'bg-gray-500',
      hover: 'hover:bg-gray-200'
    };
  }
  
  const normalized = fuelType.toLowerCase();
  return FUEL_COLORS[normalized] || FUEL_COLORS.petrol;
}

/**
 * Get fuel badge classes for consistent styling
 */
export function getFuelBadgeClasses(fuelType?: string): string {
  const colors = getFuelColors(fuelType);
  return `${colors.bg} ${colors.text} ${colors.border} ${colors.hover}`;
}
