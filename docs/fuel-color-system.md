# Fuel Type Color System

## Overview
This document defines the consistent color scheme used throughout the FuelSync application for displaying fuel types.

## Color Scheme

| Fuel Type | Primary Color | Background | Text | Border | Ring | Dot |
|-----------|--------------|------------|------|--------|------|-----|
| **Petrol** | Green | `bg-green-100` | `text-green-800` | `border-green-300` | `ring-green-200` | `bg-green-500` |
| **Diesel** | Blue | `bg-blue-100` | `text-blue-800` | `border-blue-300` | `ring-blue-200` | `bg-blue-500` |
| **CNG** | Purple | `bg-purple-100` | `text-purple-800` | `border-purple-300` | `ring-purple-200` | `bg-purple-500` |
| **EV** | Yellow | `bg-yellow-100` | `text-yellow-800` | `border-yellow-300` | `ring-yellow-200` | `bg-yellow-500` |
| **Default** | Gray | `bg-gray-100` | `text-gray-800` | `border-gray-300` | `ring-gray-200` | `bg-gray-500` |

## Implementation

### Core Utilities

**Location:** `src/lib/fuelColors.ts`

```typescript
// Get full color scheme object
import { getFuelColors } from '@/lib/fuelColors';
const colors = getFuelColors('petrol');
// Returns: { bg, text, border, ring, dot, hover }

// Get badge classes (bg + text + border + hover)
import { getFuelBadgeClasses } from '@/lib/fuelColors';
const classes = getFuelBadgeClasses('diesel');
// Returns: "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200"
```

### FuelBadge Component

**Location:** `src/components/FuelBadge.tsx`

```tsx
import { FuelBadge } from '@/components/FuelBadge';

// Basic usage
<FuelBadge fuelType="petrol" />

// With colored dot indicator
<FuelBadge fuelType="diesel" showDot />

// With additional classes
<FuelBadge fuelType="cng" className="text-sm" />
```

## Updated Components

### 1. Dashboard - Fuel Price Badges
**File:** `src/components/dashboard/FuelPriceCard.tsx`
- Displays compact fuel price badges in header
- Shows colored dot indicator for each fuel type
- Only renders fuels with set prices

### 2. Sales Table
**File:** `src/components/SalesTable.tsx`
- Fuel type column uses colored badges
- Consistent with overall color scheme

### 3. Pumps Page
**File:** `src/pages/Pumps.tsx`
- Nozzle fuel type badges on pump cards
- Removed old `getFuelTypeColor` function
- Uses `getFuelBadgeClasses` utility

### 4. Station Detail (Owner)
**File:** `src/pages/owner/StationDetail.tsx`
- Nozzle fuel type badges in pump listings
- Consistent badge styling

### 5. Data Entry
**File:** `src/pages/DataEntry.tsx`
- Nozzle selection dropdown shows colored dots
- Visual fuel type indicators in form

### 6. Sales Page
**File:** `src/pages/Sales.tsx`
- Nozzle selection with colored fuel dots
- Consistent with DataEntry pattern

## Usage Guidelines

### When to use getFuelColors()
Use when you need individual color properties for custom components:
```tsx
const colors = getFuelColors(fuelType);
<div className={`${colors.bg} ${colors.text}`}>
  <span className={colors.dot} />
  {fuelType}
</div>
```

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

## Design Principles

1. **Consistency**: Same fuel type always uses same color
2. **Accessibility**: Sufficient contrast ratios for readability
3. **Visual Hierarchy**: Dot indicators for compact spaces, full badges for emphasis
4. **Mobile-Friendly**: Colors work well on all screen sizes
5. **Maintainability**: Centralized in `fuelColors.ts` for easy updates

## Future Enhancements

- [ ] Add support for additional fuel types (e.g., Hydrogen, Bio-diesel)
- [ ] Create dark mode color variants
- [ ] Add accessibility tooltips for colorblind users
- [ ] Implement color customization per station/brand
