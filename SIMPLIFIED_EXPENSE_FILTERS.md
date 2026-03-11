# Simplified Expense Filters - Implementation Guide

## Overview
Replaced complex multiple-filter UI with:
- **Global date range filter** (app-wide)
- **Search input** (by description, amount, date)
- **Single filter** (Category OR Station)

## What Was Created

### 1. **Global Filter Context** 
📁 `src/context/GlobalFilterContext.tsx`
- Manages app-wide date range (default: Last 30 days)
- Provides preset methods: `setLastNDays()`, `setThisMonth()`, `setLastMonth()`
- Can be used across all pages

### 2. **ExpenseSimpleFilter Component**
📁 `src/components/filters/ExpenseSimpleFilter.tsx`
- Search input (description, amount, date)
- Filter type toggle (Category ↔ Station)
- Dynamic filter value dropdown
- Minimal, clean UI

### 3. **Updated Expenses Page**
📁 `src/pages/Expenses.tsx`
- Removed: Daily/Monthly toggle & date pickers
- Added: Global date filter from context
- Added: ExpenseSimpleFilter component
- Implemented: Client-side filtering (search + 1 filter)
- Uses global dates for API queries

## How to Integrate

### Step 1: Wrap App with Provider
Add `GlobalFilterProvider` to your app root (e.g., `AppWithQueries.tsx`):

```tsx
import { GlobalFilterProvider } from '@/context/GlobalFilterContext';

function App() {
  return (
    <GlobalFilterProvider>
      {/* Your app components */}
    </GlobalFilterProvider>
  );
}
```

### Step 2: Use Global Filter in Any Page
```tsx
import { useGlobalFilter } from '@/context/GlobalFilterContext';

function YourPage() {
  const { startDate, endDate, setLastNDays, setDateRange } = useGlobalFilter();
  
  // Use startDate & endDate in API calls
}
```

### Step 3: Create Global Date Filter UI (Header/Toolbar)
Optionally add this to your header for users to interact with:

```tsx
<div className="flex gap-2">
  <Button onClick={() => setLastNDays(7)}>Last 7 Days</Button>
  <Button onClick={() => setLastNDays(30)}>Last 30 Days</Button>
  <Button onClick={() => setLastNDays(90)}>Last 90 Days</Button>
  <Button onClick={() => setThisMonth()}>This Month</Button>
</div>
```

## Features

✅ **Search Capabilities**
- Description search (case-insensitive)
- Amount search with number matching
- Date search (YYYY-MM-DD format)

✅ **Single Filter (Toggle)**
- Switch between Category and Station filters
- Shows relevant options dynamically
- "All" option to clear filter

✅ **Global Date Range**
- Respects plan limits (if using `useDateRangeLimits`)
- Consistent across all pages
- Easy to change with presets

## Query Flow

```
Global Date Range (Context)
         ↓
   Expenses API Query
    startDate & endDate
         ↓
   API Response (expenses[])
         ↓
   Client-side Filtering
   • Search query match
   • Category/Station filter
         ↓
   Filtered Results
```

## Files Modified
- ✅ `src/pages/Expenses.tsx` - Simplified filters
- ✅ `src/components/filters/ExpenseSimpleFilter.tsx` - New component
- ✅ `src/context/GlobalFilterContext.tsx` - New context

## Result
Users now see:
- **Search bar** - Find by description, amount, date
- **Filter Type Selector** - Pick Category or Station
- **Filter Value Dropdown** - Select specific filter
- **App-wide dates** - Set once, used everywhere  
- **Cleaner UI** - No date picker clutter
