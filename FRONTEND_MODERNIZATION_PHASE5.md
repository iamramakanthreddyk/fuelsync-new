# Frontend Modernization - Phase 5: Service-Driven Hook Architecture

## 🎯 Overview

Apply the same **service layer extraction pattern** used in backend refactoring to the frontend. Transform hooks from "API-calling" functions into **pure React Query wrappers** that delegate to organized domain-specific services.

---

## 📊 Current State Assessment

### Frontend Structure
```
src/
├── services/          (14 domain-specific service files)
│   ├── stationService.ts
│   ├── readingService.ts
│   ├── fuelPriceService.ts
│   ├── shiftService.ts
│   ├── dataService.ts (unified)
│   └── ... (more)
│
├── hooks/            (35+ custom hooks)
│   ├── useDataQueries.ts (good: delegates to dataService)
│   ├── useDashboardQueries.ts (mixed: inline API calls)
│   ├── useReadingManagement.tsx (bad: all API calls inline)
│   └── ... (more)
│
├── lib/
│   ├── api-client.ts (HTTP client)
│   ├── api-utils.ts (helpers)
│   └── ...
└── components/ (129 files)
```

### Current Hook Patterns (Mixed Quality)

**✅ GOOD Pattern (Already Following Best Practice)**
```typescript
// useDataQueries.ts
export function useReadings(filters: ReadingFilters = {}) {
  return useQuery({
    queryKey: ['readings', filters],
    queryFn: () => dataService.getReadings(filters), // ← Delegates to service
    staleTime: 1000 * 60 * 5,
  });
}
```

**❌ BAD Pattern (Needs Refactoring)**
```typescript
// useReadingManagement.tsx
export const useReadingManagement = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  const uploadReceiptForParsing = async (file: File) => {
    // ❌ Direct API call in hook
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post('/readings/upload', formData); // BAD
    // ... error handling, state management mixed in
  };
};
```

**⚠️ MIXED Pattern (Inline API Calls)**
```typescript
// useDashboardQueries.ts
export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      // ❌ Inline API calls instead of service delegation
      const [usersRes, stationsRes] = await Promise.all([
        apiClient.get<User[]>('/users'), // Should be dashboardService.getAdminStats()
        apiClient.get<Station[]>('/stations'),
      ]);
      // ... manual response unwrapping and transformation
    },
  });
}
```

---

## 🗂️ Modernization Strategy

### Phase 5a: Audit & Plan (Quick Discovery)
**Goal:** Catalog all hooks and identify refactoring patterns

**Tasks:**
1. Audit all 35+ hooks in src/hooks/
   - Which delegate to services? ✅
   - Which have inline API calls? ❌
   - Which mix state management with data fetching? ⚠️

2. Analyze service coverage
   - Do services exist for all API domains?
   - Are services comprehensive or partial?
   - What's missing?

3. Identify refactoring batches
   - Batch 1: Pure useQuery transformation (easiest)
   - Batch 2: useMutation extraction (medium)
   - Batch 3: Complex hook decomposition (hardest)

**Expected Output:** Prioritized refactoring queue with metrics

---

### Phase 5b: Service Layer Completion (2-3 hours)
**Goal:** Ensure every API endpoint has a service wrapper

**Service Domains to Enhance:**

```typescript
// Domain: Station Management
stationService.ts
  ✅ getStations()
  ✅ getStationById()
  ❌ createStation() - MISSING
  ❌ updateStation() - MISSING
  
// Domain: Pump Management
pumpService.ts (CREATE if missing)
  ❌ getPumps()
  ❌ createPump()
  ❌ updatePump()
  
// Domain: Fuel Pricing
fuelPriceService.ts
  ✅ getFuelPrices()
  ✅ setFuelPrice()
  ❌ getPriceHistory() - might be in service
  
// Domain: Readings & Entries
readingService.ts
  ✅ getReadings()
  ✅ createReading()
  ❌ uploadReceiptForParsing() - MISSING
  ❌ importBulkReadings() - MISSING
  
// Domain: Shifts
shiftService.ts
  ✅ getActiveShift()
  ✅ startShift()
  ✅ endShift()
  
// Domain: Analytics
analyticsService.ts (CREATE if missing OR consolidate with dataService)
  ❌ getDailySummary()
  ❌ getSalesBreakdown()
  ❌ getVarianceSummary()
```

---

### Phase 5c: Hook Refactoring (2-3 hours)
**Goal:** Transform all hooks into pure React Query wrappers

**Pattern to Apply (Identical to Backend Service Pattern):**

```typescript
// BEFORE (Bad - Inline API calls)
export const useReadingManagement = () => {
  const [isLoading, setIsLoading] = useState(false);
  const uploadReceiptForParsing = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/readings/upload', formData);
    // ... complex error handling
  };
  return { uploadReceiptForParsing, isLoading, error, ... };
};

// AFTER (Good - Delegates to service)
export function useCreateReadingFromReceipt() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: UploadReceiptDto) =>
      readingService.uploadReceiptForParsing(data), // ← Service delegates
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['readings'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'summary'] });
    },
    onError: (error) => {
      // Consistent error handling
      toast.error(error.message);
    },
  });
}
```

**Hook Categories to Create:**

#### 1️⃣ Query Hooks (Read-Only)
```typescript
// Pattern: useXQuery / useXData
useReadings(filters)
useStations()
useShifts()
useFuelPrices(stationId)
useAnalyticsSummary(date)
// Each delegates to corresponding service
```

#### 2️⃣ Mutation Hooks (Write Operations)
```typescript
// Pattern: useCreate/Update/Delete + { mutate, isPending, error }
useCreateReading()
useUpdateReading()
useDeleteReading()

useCreateShift()
useEndShift()

useSetFuelPrice()
useUpdateFuelPrice()
```

#### 3️⃣ Composed Hooks (Multiple Operations)
```typescript
// Pattern: useXFlow or useXWorkflow
useReadingEntry() // Combines: validate → submit → refetch
useShiftClockIn() // Combines: check availability → create → broadcast
useFuelPriceUpdate() // Combines: validate → update → audit → notify
```

---

### Phase 5d: Component Integration (1-2 hours)
**Goal:** Refactor components to use refactored hooks consistently

**Current Component Usage (Mixed Patterns):**
```typescript
// BAD: Multiple hooks + manual state
const component = () => {
  const { data, isLoading } = useReadings();
  const [filter, setFilter] = useState();
  const [error, setError] = useState();
  const { uploadReceiptForParsing } = useReadingManagement(); // Old hook
};

// GOOD: Single hook + derived state
const component = () => {
  const { data, isLoading, error } = useReadings(filter);
  const createReading = useCreateReadingFromReceipt(); // New hook
};
```

**Component Refactoring Pattern:**
1. Replace old hooks with new query/mutation hooks
2. Remove useState for data (use hook state instead)
3. Consolidate error handling (use hook error + toast)
4. Simplify component logic

---

## 📋 Refactoring Checklist

### Phase 5a: Audit (30-45 min)
- [ ] List all 35+ hooks by category
- [ ] Mark which delegate to services vs have inline API calls  
- [ ] Identify missing service methods
- [ ] Create prioritized refactoring queue
- [ ] Document patterns found

### Phase 5b: Service Layer (2-3 hours)
- [ ] Identify missing service files
- [ ] Create/complete service files for all domains
- [ ] Extract all API call logic from hooks into services
- [ ] Add proper error handling to services
- [ ] Add TypeScript types to services
- [ ] Test service layer

### Phase 5c: Hook Refactoring (2-3 hours)
- [ ] Batch 1: Pure query hooks (easy) - 15-20 hooks
- [ ] Batch 2: Mutation hooks (medium) - 10-15 hooks
- [ ] Batch 3: Composed/complex hooks (hard) - 5-10 hooks
- [ ] Update hook documentation
- [ ] Test all hooks

### Phase 5d: Component Update (1-2 hours)
- [ ] Identify components using old hooks
- [ ] Update imports to new hooks
- [ ] Simplify component logic
- [ ] Test component integration
- [ ] Verify error handling

---

## 🎯 Success Criteria

✅ **Metrics:**
- All 35+ hooks analyzed and categorized
- 100% of API calls in services (0 inline in hooks)
- All hooks follow 2 patterns: Query or Mutation (no custom logic)
- Service coverage: 100% API endpoints wrapped
- Type safety: 100% TypeScript coverage in services
- Error handling: Consistent across all hooks
- Tests: Service layer 100% covered

✅ **Code Quality:**
- Hook file sizes: Average < 50 lines (currently 100+ for some)
- Service file sizes: Average 200-300 lines (good abstraction)
- Duplication: Zero (all API calls centralized in services)
- Testability: Services independently testable without React

✅ **Developer Experience:**
- Adding new API call: Service method + hook (2 files, 10 min)
- No React context/ state bloat in hooks
- Clear separation: Data fetching (hooks) ↔ Business logic (services)
- Easy to mock services in component tests

---

## 🏗️ Architecture After Phase 5

```
Component (Presentation Layer)
    ↓
Hook (Data Fetching Layer)
    ├── useQuery() [React Query]
    └── delegated to Service
        ↓
Service (Business Logic Layer)
    └── API calls via apiClient
        ↓
API Client
    ↓
Backend API
```

**Before:** Component → [Hook with inline API calls + state] → apiClient
**After:** Component → [Pure Hook] → Service → apiClient

---

## 📚 Comparison: Backend vs Frontend Patterns

| Aspect | Backend | Frontend |
|--------|---------|----------|
| **Controller** | HTTP handlers | Components |
| **Service** | Business logic | Service layer |
| **Pattern** | Controller → Service → DB | Component → Hook → Service → API |
| **State** | N/A | React Query (cache) |
| **Error** | Custom classes | Toast notifications |
| **Tests** | Service unit tests | Service + Hook integration tests |

---

## 🚀 Next Steps

### Immediate (This Session)
1. **Phase 5a:** Audit all hooks - Create inventory + queue
2. **Start Phase 5b:** Consolidate service layer
3. **Quick wins:** Refactor pure query hooks (Batch 1)

### Follow-up (Next Session)
4. **Phase 5c:** Complete hook mutations + composed hooks
5. **Phase 5d:** Update components
6. **Testing:** Add comprehensive test suite

### Future
7. **Documentation:** Update dev guidelines
8. **Code generation:** Consider templates for new hooks
9. **Optimization:** Add smart caching strategies

---

## 💡 Key Insights

**Why This Matters:**
- Frontend hooks are mirrors of backend controllers
- Service extraction improves: testability, reusability, maintainability
- Consistent patterns reduce cognitive load when adding features
- Makes codebase more scalable as it grows

**Expected Improvements:**
- **Bug Reduction:** 30-40% fewer data-fetching bugs (centralized logic)
- **Development Speed:** 25-30% faster to add new features (follow pattern)
- **Code Quality:** 50%+ reduction in duplicate API calls
- **Testing:** Services independently testable without React framework

