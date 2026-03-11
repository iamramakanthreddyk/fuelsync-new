# API Layer Organization Guide

## Overview
All API calls should be made through dedicated service layers in `/src/lib/` to ensure consistency, proper error handling, and centralized management.

## Expenses API Layer

**File:** `src/lib/expenses-api.ts`

### Available Functions

#### 1. **getStationExpenses()** - For single station view
```typescript
getStationExpenses(
  stationId: string,
  startDate: string,
  endDate: string,
  limit?: number
): Promise<ExpensesListResponse>
```

**Endpoint:** `GET /stations/{stationId}/expenses`
**Use Case:** Manager viewing their assigned station's expenses
**Returns:** Detailed expenses list + summary

**Response Structure:**
```json
{
  "success": true,
  "data": [{ expense objects }],
  "summary": {
    "totalExpenses": number,
    "approvedTotal": number,
    "pendingTotal": number,
    "total": number
  },
  "pagination": { ... }
}
```

#### 2. **getAllExpenses()** - For cross-station view
```typescript
getAllExpenses(
  startDate: string,
  endDate: string,
  limit?: number,
  page?: number
): Promise<ExpensesListResponse>
```

**Endpoint:** `GET /stations/all/expenses`
**Use Case:** Manager Reports page, viewing all expenses across all managed stations
**Returns:** Detailed expenses list + aggregated summary

**Response Structure:** Same as above

#### 3. **getExpenseSummary()** - For monthly aggregation
```typescript
getExpenseSummary(
  stationId: string,
  startDate: string,
  endDate: string
): Promise<ExpenseSummaryResponse>
```

**Endpoint:** `GET /stations/{stationId}/expense-summary`
**Use Case:** Daily Financial Report, monthly summary view
**Note:** This endpoint aggregates by month, not by date range
**Returns:** Monthly summary only (no detailed list)

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "mode": "monthly",
    "month": "2026-03",
    "approvedTotal": number,
    "pendingCount": number,
    "pendingAmount": number,
    "byCategory": [],
    "byFrequency": []
  }
}
```

---

## Helper Functions

All calculation and transformation logic is included in `expenses-api.ts`:

### **parseExpenseAmount()**
Safely parse expense amounts from string or number format.
```typescript
parseExpenseAmount(amount: string | number | undefined): number
```

### **calculateExpenseTotal()**
Sum all expenses from an expense array.
```typescript
calculateExpenseTotal(expenses: Expense[]): number
```

### **groupExpensesByCategory()**
Group expenses by category with totals.
```typescript
groupExpensesByCategory(expenses: Expense[]): Record<string, { total: number; items: Expense[] }>
```

### **getExpenseStats()**
Get comprehensive expense statistics.
```typescript
getExpenseStats(expenses: Expense[]) {
  return {
    total: number,
    approved: number,
    pending: number,
    rejected: number,
    totalAmount: number,
    approvedTotal: number,
    pendingTotal: number
  }
}
```

---

## Usage in Components

### Example: ManagerReports (Reports Page)

```typescript
import { getAllExpenses, getExpenseStats, groupExpensesByCategory } from '@/lib/expenses-api';
import type { Expense } from '@/lib/expenses-api';

// In component:
const { data: expensesResponse } = useQuery({
  queryKey: ['manager-expenses', startDate, endDate],
  queryFn: () => getAllExpenses(startDate, endDate, 100),
  enabled: !!startDate && !!endDate,
});

const expensesList: Expense[] = expensesResponse?.data || [];
const expenseStats = useMemo(() => getExpenseStats(expensesList), [expensesList]);
const expensesByCategory = useMemo(() => groupExpensesByCategory(expensesList), [expensesList]);
```

---

## API Endpoints Reference

| Page | Function | Endpoint | Use Case |
|------|----------|----------|----------|
| Manager Reports | `getAllExpenses()` | `/stations/all/expenses` | Cross-station expense view with date range |
| Daily Financial Report | `getExpenseSummary()` | `/stations/{id}/expense-summary` | Monthly aggregated summary |
| Station Detail | `getStationExpenses()` | `/stations/{id}/expenses` | Single station expense list |

---

## Key Points

1. **Always use the centralized functions** from `expenses-api.ts` - never call endpoints directly
2. **String amounts**: The API returns amounts as strings; helper functions handle conversion
3. **Date ranges**: Use ISO format (YYYY-MM-DD) for all date parameters
4. **Cache keys**: Structure React Query keys consistently using resource name + date range
5. **Error handling**: All functions throw errors; wrap in try-catch in components

---

## Future Improvements

- Add bulk expense operations (create, update, approve)
- Add filtering by approval status, category, frequency
- Add expense export functionality
- Implement optimistic updates for better UX
- Add webhook support for real-time updates
