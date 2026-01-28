# Fuel Type Configuration - SINGLE SOURCE OF TRUTH

## Overview

All fuel type related configuration has been consolidated into a single source of truth at `@/core/fuel/fuelConfig.ts`. This eliminates duplication and ensures consistency across the application.

## Implementation

### Core Configuration (`src/core/fuel/fuelConfig.ts`)

This file contains ALL fuel type configuration:

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

### FuelBadge Component (`src/components/FuelBadge.tsx`)

Updated to use centralized configuration:

```tsx
import { FuelBadge } from '@/components/FuelBadge';

// Basic usage
<FuelBadge fuelType="petrol" />

// With colored dot indicator
<FuelBadge fuelType="diesel" showDot />

// With short label
<FuelBadge fuelType="cng" short />
```

### Central Export (`src/core/fuel/index.ts`)

Import everything fuel-related from one place:

```typescript
import {
  FUEL_TYPE_CONFIG,
  getFuelTypeConfig,
  getFuelBadgeClasses,
  FuelBadge
} from '@/core/fuel';
```

## Migration Guide

### Before (Multiple Sources)
```typescript
// ❌ OLD - Multiple sources
import { FUEL_TYPE_LABELS } from '@/core/enums';
import { FUEL_TYPE_DISPLAY_NAMES } from '@/lib/constants';
import { getFuelColors } from '@/lib/fuelColors';
import { FUEL_CONFIG } from '@/core/constants/app.constants';
```

### After (Single Source)
```typescript
// ✅ NEW - Single source
import {
  FUEL_TYPE_CONFIG,
  getFuelTypeLabel,
  getFuelBadgeClasses,
  FuelBadge
} from '@/core/fuel';
```

## Color Scheme

| Fuel Type | Primary Color | Background | Text | Border | Ring | Dot |
|-----------|--------------|------------|------|--------|------|-----|
| **Petrol** | Green | `bg-green-100` | `text-green-800` | `border-green-300` | `ring-green-200` | `bg-green-500` |
| **Diesel** | Blue | `bg-blue-100` | `text-blue-800` | `border-blue-300` | `ring-blue-200` | `bg-blue-500` |
| **Premium Petrol** | Orange | `bg-orange-100` | `text-orange-800` | `border-orange-300` | `ring-orange-200` | `bg-orange-500` |
| **Premium Diesel** | Teal | `bg-teal-100` | `text-teal-800` | `border-teal-300` | `ring-teal-200` | `bg-teal-500` |
| **CNG** | Purple | `bg-purple-100` | `text-purple-800` | `border-purple-300` | `ring-purple-200` | `bg-purple-500` |
| **LPG** | Pink | `bg-pink-100` | `text-pink-800` | `border-pink-300` | `ring-pink-200` | `bg-pink-500` |
| **EV Charging** | Yellow | `bg-yellow-100` | `text-yellow-800` | `border-yellow-300` | `ring-yellow-200` | `bg-yellow-500` |

## Usage Guidelines

### When to use getFuelBadgeClasses()
Use when applying colors to Badge components:
```tsx
<Badge className={getFuelBadgeClasses(fuelType)}>
  {fuelType}
</Badge>
```

### When to use FuelBadge
Use for quick, consistent fuel type display:
```tsx
<FuelBadge fuelType={nozzle.fuel_type} showDot />
```

### When to use getFuelChartColor()
Use for chart colors:
```tsx
const color = getFuelChartColor(fuelType);
```

## Design Principles

1. **Single Source of Truth**: All fuel configuration in one place
2. **Consistency**: Same fuel type always uses same color and label
3. **Maintainability**: Easy to update colors, add fuel types, or modify behavior
4. **Backward Compatibility**: Old imports still work but point to new system
5. **Type Safety**: Full TypeScript support with proper enums and types

## Future Enhancements

- [ ] Add support for additional fuel types (e.g., Hydrogen, Bio-diesel)
- [ ] Create dark mode color variants
- [ ] Add accessibility tooltips for colorblind users
- [ ] Implement color customization per station/brand
