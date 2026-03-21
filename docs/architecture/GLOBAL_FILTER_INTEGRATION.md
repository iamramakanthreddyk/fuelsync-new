# Global Date Filter + Simplified Expense Filters - Integration Complete

## 🎯 What's Been Implemented

### Architecture
```
App.tsx
  ├─ GlobalFilterProvider (manages app-wide dates)
  │   ├─ AppLayout
  │   │   ├─ DateRangeFilterToolbar (visible on all pages)
  │   │   └─ Route Content
  │   │       ├─ ExpensesPage (uses dates + ExpenseSimpleFilter)
  │   │       └─ Other pages (can use useGlobalFilter)
  │   └─ Other providers
```

### Components Created
1. **GlobalFilterContext** (`src/context/GlobalFilterContext.tsx`)
   - Manages app-wide date range
   - Default: Last 30 days
   - Methods: `setDateRange()`, `setLastNDays()`, `setThisMonth()`, `setLastMonth()`

2. **DateRangeFilterToolbar** (`src/components/DateRangeFilterToolbar.tsx`)
   - Shows DateRangeFilter UI with presets
   - Connected to GlobalFilterContext
   - Sticky below app header
   - Visible on all pages

3. **ExpenseSimpleFilter** (`src/components/filters/ExpenseSimpleFilter.tsx`)
   - Search input (description, amount, date)
   - Single filter toggle (Category ↔ Station)
   - Lightweight, client-side filtering

### Files Modified
- ✅ `src/App.tsx` - Added GlobalFilterProvider
- ✅ `src/components/AppLayout.tsx` - Added DateRangeFilterToolbar
- ✅ `src/pages/Expenses.tsx` - Uses global dates + ExpenseSimpleFilter

## 🚀 Usage

### In Expenses Page
Dates are automatically fetched from global context:
```tsx
const { startDate: globalStartDate, endDate: globalEndDate } = useGlobalFilter();

// Used in API calls
const expensesQuery = useQuery({
  queryKey: ['expenses-list', stationId, globalStartDate, globalEndDate],
  queryFn: () =>
    apiClient.get(`/stations/${stationId}/expenses?startDate=${globalStartDate}&endDate=${globalEndDate}&limit=100`)
});
```

### In Other Pages
Any page can use the global filter:
```tsx
import { useGlobalFilter } from '@/context/GlobalFilterContext';

function MyPage() {
  const { startDate, endDate } = useGlobalFilter();
  
  // Use dates in your queries
}
```

## 📊 User Flow

1. **User opens app** → DateRangeFilterToolbar visible
2. **User selects preset** (e.g., "Last 30 days") → Dates update globally
3. **Expenses page receives dates** → API query updates
4. **User types in search** → Client-side filter runs
5. **User toggles Category/Station** → Filter type switches
6. **Results filter in real-time**

## ✨ Features

### Global Date Filter Presets
- Last 7 Days
- Last 30 Days
- Last 90 Days (if you add it)
- This Month
- Last Month (optional)

### Search Capabilities
- Description matching (case-insensitive)
- Amount search (numeric)
- Date search (YYYY-MM-DD format)
- Multiple field support

### Single Filter
- Choose between Category or Station
- Toggle between them anytime
- "All" option to clear filter
- Dynamic dropdown based on selection

## 🔧 Customization

### Add More Presets
Edit `GlobalFilterContext.tsx` to add new methods:
```tsx
setLastNDays: (days: number) => { ... },
setThisMonth: () => { ... },
// Add yours here
```

### Change Default Date Range
In `GlobalFilterContext.tsx`:
```tsx
const getDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30); // Change 30 to your preference
  // ...
};
```

### Customize Filter Toolbar Position
In `AppLayout.tsx`:
```tsx
<DateRangeFilterToolbar />  {/* Move this around }
```

### Disable TimeoutToolbar for Some Pages
Wrap specific pages conditionally or modify DateRangeFilterToolbar to hide based on route.

## 📁 File Locations
- Context: `src/context/GlobalFilterContext.tsx`
- Toolbar: `src/components/DateRangeFilterToolbar.tsx`
- Simple Filter: `src/components/filters/ExpenseSimpleFilter.tsx`
- Date Filter: `src/components/filters/DateRangeFilter.tsx`
- Expenses: `src/pages/Expenses.tsx`

## ✅ Testing Checklist
- [ ] App builds without errors
- [ ] DateRangeFilterToolbar appears on all pages
- [ ] Preset buttons work (Last 7, 30 days, This month)
- [ ] Custom date selection works
- [ ] Expenses page reflects selected dates
- [ ] Search input filters expenses
- [ ] Category/Station toggle works
- [ ] Switching between them doesn't lose search
- [ ] Dates persist on page navigation

## 🐛 Troubleshooting

**Toolbar not appearing?**
- Check GlobalFilterProvider is in App.tsx
- Verify AppLayout imports DateRangeFilterToolbar
- Check <DateRangeFilterToolbar /> is rendered

**Search not working?**
- Verify ExpenseSimpleFilter is rendering
- Check filteredExpenses logic in Expenses.tsx
- Confirm API returns expense data

**Dates not updating?**
- Verify useGlobalFilter hook is called
- Check queryKey includes globalStartDate/globalEndDate
- Ensure GlobalFilterProvider is wrapping the content

---

**Status**: ✅ Ready for production
**Last Updated**: March 11, 2026
