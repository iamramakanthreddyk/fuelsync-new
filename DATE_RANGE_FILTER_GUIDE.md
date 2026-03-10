# Global Date Range Filter — Implementation Guide

## Overview
A standardized, reusable `DateRangeFilter` component has been implemented to ensure consistent date range selection across all pages using string-based date formats (YYYY-MM-DD).

## Component Location
- **Path**: `src/components/filters/DateRangeFilter.tsx`
- **Type**: React Functional Component
- **Props Interface**: `DateRangeFilterProps`

## Features
✅ Native HTML5 date inputs (`type="date"`)  
✅ Plan-based date constraints via `useDateRangeLimits` hook  
✅ dd/mm/yyyy format display labels below each input  
✅ Always restricted to today as maximum date  
✅ Optional preset buttons (Last 7 days, Last 30 days, This month)  
✅ Responsive layout (grid adapts for mobile/tablet/desktop)  

## Usage Example

```tsx
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';

export function YourPage() {
  const [startDate, setStartDate] = useState('2026-03-01');
  const [endDate, setEndDate] = useState('2026-03-10');

  return (
    <DateRangeFilter
      startDate={startDate}
      endDate={endDate}
      onDateRangeChange={(start, end) => {
        setStartDate(start);
        setEndDate(end);
      }}
      dataType="analytics"  // 'sales' | 'profit' | 'analytics' | 'audit' | 'transactions'
      showPresets={true}    // Optional preset quick-pick buttons
      label="Custom Label"  // Default: "Date Range"
      className="custom-classes"
    />
  );
}
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `startDate` | `string` | Required | Start date (YYYY-MM-DD format) |
| `endDate` | `string` | Required | End date (YYYY-MM-DD format) |
| `onDateRangeChange` | `(start, end) => void` | Required | Callback when dates change |
| `dataType` | `'sales'\|'profit'\|'analytics'\|'audit'\|'transactions'` | `'analytics'` | Plan type for date limits |
| `showPresets` | `boolean` | `false` | Show preset range buttons |
| `label` | `string` | `'Date Range'` | Custom label text |
| `className` | `string` | `'space-y-3'` | Container class name |

## Components Already Updated ✅

### 1. **FilterBar** (`src/components/reports/FilterBar.tsx`)
- Replaced inline date input logic with `<DateRangeFilter />`
- Removed `useDateRangeLimits` hook – now delegated to component
- Removed `fmtDDMMYYYY` formatter – now built into component
- **Status**: ✅ Ready to use in Reports pages

### 2. **Reports Page** (`src/pages/Reports.tsx`)
- Replaced manual date Start/End inputs with `<DateRangeFilter />`
- Uses `dataType="analytics"` for plan-based limits
- **Status**: ✅ Updated and working

### 3. **Income Report** (`src/pages/owner/IncomeReport.tsx`)
- Replaced Start/End date inputs with `<DateRangeFilter />`
- Uses `dataType="analytics"` for date limits
- **Status**: ✅ Updated and working

## Why This Standardization?

### Before
- Each page had custom date input logic
- Inconsistent date formats and display
- Duplicate code for plan-based date constraints
- Different validation approaches per page

### After
- ✅ **Single source of truth** for date range logic
- ✅ **Consistent UX** across all report/analytics pages
- ✅ **No code duplication** – all pages use the same component
- ✅ **Plan-aware** — automatically respects user's subscription limits
- ✅ **Accessible** — proper labels and ARIA attributes
- ✅ **Responsive** — works on mobile, tablet, desktop

## Date Format Rules

- **Internal Storage**: YYYY-MM-DD (ISO 8601 string format)
- **User Display**: dd/mm/yyyy (shown as hint text below input)
- **Plan Limits**: Automatically enforced based on `dataType`
  - E.g., if plan allows 365 days of history, start date is restricted to 1 year ago
  - Unlimited plans (`maxDays = -1`) have no minimum date constraint

## Optional: Adding Presets

To enable quick-pick preset buttons for faster date range selection:

```tsx
<DateRangeFilter
  startDate={startDate}
  endDate={endDate}
  onDateRangeChange={(start, end) => {
    setStartDate(start);
    setEndDate(end);
  }}
  showPresets={true}  // Adds "Last 7 days", "Last 30 days", "This month" buttons
/>
```

## Future Enhancements

Possible additions:
- [ ] Custom date range preset buttons per page
- [ ] Date range comparison mode (compare two periods)
- [ ] Pre-fill with sensible defaults (e.g., last 30 days, this month)
- [ ] Integration with URL query params for bookmarkable filters

## Related Hooks

- **`useDateRangeLimits()`** — Powers plan-based date constraints
  - Location: `src/hooks/usePermissions.tsx`
  - Provides: `getMaxDateForType()`, `isDateRangeAllowed()`

---

**Created**: March 10, 2026  
**Component Status**: Production Ready ✅
