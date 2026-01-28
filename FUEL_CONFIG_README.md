# Fuel Type Configuration - Single Source of Truth

## Overview

The fuel type system has been completely refactored to eliminate duplication and provide a single source of truth for all fuel-related configuration. This ensures consistency across the entire application and makes maintenance much easier.

## Architecture

### Core Configuration (`src/core/fuel/fuelConfig.ts`)

This is the **SINGLE SOURCE OF TRUTH** for all fuel type data:

```typescript
// Complete fuel type configuration
export const FUEL_TYPE_CONFIG: Record<FuelType, FuelTypeConfig>

// Helper functions
export function getFuelTypeConfig(fuelType?: string)
export function getFuelColorScheme(fuelType?: string)
export function getFuelBadgeClasses(fuelType?: string)
export function getFuelHexColor(fuelType?: string)
export function getFuelChartColor(fuelType?: string)
export function getFuelTypeLabel(fuelType?: string)
export function normalizeFuelType(fuelType: string)
export function isValidFuelType(value: string)
```

### What Each Fuel Type Includes

```typescript
interface FuelTypeConfig {
  label: string;           // Display label ("Petrol", "Diesel", etc.)
  shortLabel: string;      // Short form ("P", "D", etc.)
  displayNames: string[];  // Brand names (["XP 95", "Speed", "Regular"])
  hexColor: string;        // Hex color for charts/raw CSS
  chartColor: string;      // Chart-specific color (may differ for contrast)
  tailwind: {              // Tailwind CSS classes
    bg: string;
    text: string;
    border: string;
    ring: string;
    dot: string;
    hover: string;
  };
}
```

## Usage Examples

### Basic Usage

```typescript
import {
  getFuelTypeLabel,
  getFuelBadgeClasses,
  getFuelHexColor,
  FUEL_TYPE_CONFIG
} from '@/core/fuel/fuelConfig';

// Get display label
const label = getFuelTypeLabel('petrol'); // "Petrol"

// Get CSS classes for badges
const classes = getFuelBadgeClasses('diesel'); // "bg-blue-100 text-blue-800..."

// Get hex color for charts
const color = getFuelHexColor('cng'); // "#a855f7"

// Access full configuration
const config = FUEL_TYPE_CONFIG.petrol;
```

### Components

```typescript
import { FuelBadge } from '@/components/FuelBadge';

// Basic usage
<FuelBadge fuelType="petrol" />

// With dot indicator
<FuelBadge fuelType="diesel" showDot />

// Short label
<FuelBadge fuelType="cng" short />
```

### Charts and Visualizations

```typescript
import { getFuelChartColor } from '@/core/fuel/fuelConfig';

const chartData = fuelTypes.map(fuelType => ({
  name: getFuelTypeLabel(fuelType),
  value: sales[fuelType],
  color: getFuelChartColor(fuelType)
}));
```

## Migration Guide

### Before (Multiple Sources)

```typescript
// ❌ OLD: Multiple sources, inconsistent
import { FUEL_CONFIG } from '@/core/constants/app.constants';
import { getFuelColors } from '@/lib/fuelColors';
import { FUEL_TYPE_LABELS } from '@/core/enums';

// Different color systems, manual mapping
const color = FUEL_CONFIG.PETROL.color; // "#ef4444"
const classes = getFuelColors('petrol'); // Tailwind classes
const label = FUEL_TYPE_LABELS.petrol; // "Petrol"
```

### After (Single Source)

```typescript
// ✅ NEW: Single source, consistent
import {
  getFuelHexColor,
  getFuelBadgeClasses,
  getFuelTypeLabel
} from '@/core/fuel/fuelConfig';

// Consistent API, guaranteed to match
const color = getFuelHexColor('petrol'); // "#22c55e"
const classes = getFuelBadgeClasses('petrol'); // "bg-green-100 text-green-800..."
const label = getFuelTypeLabel('petrol'); // "Petrol"
```

## Files Changed

### ✅ Updated to Use Centralized Config

- `src/components/FuelBadge.tsx` - Now uses centralized config
- `src/lib/fuelColors.ts` - Deprecated, re-exports from centralized config
- `src/lib/constants.ts` - Re-exports from centralized config
- `src/core/constants/app.constants.ts` - FUEL_CONFIG now deprecated
- `src/hooks/useFuelPricesData.tsx` - Uses centralized normalizeFuelType
- `src/pages/owner/Analytics.tsx` - Uses centralized chart colors

### ✅ New Files Created

- `src/core/fuel/fuelConfig.ts` - **MAIN CONFIGURATION FILE**
- `src/core/fuel/index.ts` - Central export

## Benefits

1. **Single Source of Truth** - All fuel data in one place
2. **Consistency** - Same colors, labels everywhere
3. **Maintainability** - Change fuel config in one place
4. **Type Safety** - Full TypeScript support
5. **Extensibility** - Easy to add new fuel types or properties
6. **Backward Compatibility** - Old imports still work (with deprecation warnings)

## Adding New Fuel Types

To add a new fuel type, simply update `FUEL_TYPE_CONFIG` in `fuelConfig.ts`:

```typescript
[FuelTypeEnum.NEW_FUEL]: {
  label: 'New Fuel',
  shortLabel: 'NF',
  displayNames: ['Brand A', 'Brand B'],
  hexColor: '#123456',
  chartColor: '#123456',
  tailwind: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    // ... etc
  }
}
```

Everything else updates automatically!

## Future Enhancements

- [ ] Add support for custom fuel type colors per station
- [ ] Dark mode color variants
- [ ] Accessibility color contrast validation
- [ ] Fuel type icons/emoji support