# Core Architecture

This is the centralized core module for the FuelSync Hub application. It provides standardized, reusable, and decoupled components following the MVC (Model-View-Controller) pattern with clear separation of concerns.

## 📁 Structure

```
src/core/
├── models/          # TypeScript interfaces and types
├── enums/           # Centralized enum definitions
├── constants/       # Application-wide constants
├── hooks/           # Reusable React hooks
├── components/      # Shared UI components
├── utils/           # Utility functions
├── i18n/            # Internationalization
└── index.ts         # Central exports
```

## 🏗️ Architecture Principles

### 1. **Separation of Concerns**
- **Models**: Define data structures (what data looks like)
- **Enums**: Define constant values with type safety
- **Constants**: API endpoints, routes, configuration
- **Hooks**: Encapsulate stateful logic
- **Components**: Reusable UI building blocks
- **Utils**: Pure utility functions

### 2. **Single Responsibility**
Each module has one clear purpose and doesn't mix concerns.

### 3. **DRY (Don't Repeat Yourself)**
Common functionality is centralized and imported where needed.

### 4. **Type Safety**
Everything is strictly typed with TypeScript for compile-time error checking.

---

## 📦 Models (`/models`)

Centralized type definitions organized by domain:

| File | Description |
|------|-------------|
| `base.model.ts` | Base interfaces (BaseEntity, Activatable, Notable, pagination) |
| `user.model.ts` | User, authentication, session types |
| `station.model.ts` | Fuel station entities |
| `pump.model.ts` | Pump and nozzle types |
| `reading.model.ts` | Meter readings |
| `shift.model.ts` | Shift management |
| `financial.model.ts` | Credits, expenses, cash handover |
| `tank.model.ts` | Tank and inventory |
| `dashboard.model.ts` | Dashboard and analytics |
| `api.model.ts` | API response wrappers |

### Usage Pattern
```typescript
import { User, CreateUserDTO, UserFilter } from '@/core/models';

// Entity type
const user: User = { ... };

// Create DTO (omits auto-generated fields)
const createData: CreateUserDTO = { email, name, password };

// Filter for queries
const filter: UserFilter = { role: 'manager', isActive: true };
```

---

## 🔢 Enums (`/enums`)

Type-safe constant definitions:

| Enum | Values |
|------|--------|
| `UserRoleEnum` | super_admin, owner, manager, employee |
| `FuelTypeEnum` | petrol, diesel, premium_petrol, premium_diesel, cng, lpg |
| `PumpStatusEnum` | active, inactive, maintenance, offline |
| `TankStatusEnum` | active, inactive, maintenance, empty, low, critical |
| `ShiftTypeEnum` | morning, evening, night, full_day, custom |
| `PaymentMethodEnum` | cash, upi, card, credit, fleet_card, wallet |
| `ExpenseCategoryEnum` | salary, electricity, rent, maintenance, etc. |
| `AlertSeverityEnum` | info, warning, error, critical |

### Usage Pattern
```typescript
import { UserRoleEnum, UserRole, ROLE_HIERARCHY } from '@/core/enums';

// Use enum value
if (user.role === UserRoleEnum.MANAGER) { ... }

// Type alias for flexibility
function hasAccess(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= 50;
}
```

---

## ⚙️ Constants (`/constants`)

Application-wide configuration:

### `api.constants.ts`
- `API_BASE_URL` - Base URL for API calls
- `API_ENDPOINTS` - All API endpoint paths
- `HTTP_STATUS` - HTTP status codes
- `QUERY_KEYS` - TanStack Query cache keys
- `API_DEFAULTS` - Timeout, retry settings

### `app.constants.ts`
- `ROUTES` - Application route paths
- `STORAGE_KEYS` - localStorage keys
- `DATE_FORMATS` - Date format strings
- `CURRENCY` - Currency settings (INR)
- `VALIDATION` - Form validation rules
- `UI_CONFIG` - UI configuration

### Usage Pattern
```typescript
import { API_ENDPOINTS, ROUTES, QUERY_KEYS } from '@/core/constants';

// API call
await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`);

// Navigation
navigate(ROUTES.DASHBOARD);

// Query key
useQuery({ queryKey: [QUERY_KEYS.STATIONS] });
```

---

## 🪝 Hooks (`/hooks`)

Reusable React hooks:

### `useApi`
Generic hook for API calls with loading/error states.

```typescript
const { data, loading, error, execute } = useApi<User[]>(
  () => fetchUsers(),
  { immediate: true }
);
```

### `useLocalStorage`
Persistent state with localStorage.

```typescript
const [theme, setTheme] = useLocalStorage('theme', 'light');
```

### `useDebounce`
Debounced value for search inputs.

```typescript
const debouncedSearch = useDebounce(searchTerm, 300);
```

### `usePagination`
Pagination state management.

```typescript
const { page, limit, offset, setPage, nextPage, prevPage } = usePagination({
  initialPage: 1,
  initialLimit: 10,
  total: 100
});
```

---

## 🧩 Components (`/components`)

Reusable UI building blocks:

### Layout Components
- **Container** - Centered content container
- **Stack** - Flexbox stack (horizontal/vertical)
- **Card** - Card with header, body, footer

### Form Components
- **FormField** - Label + input wrapper with error handling
- **Input** - Styled text input
- **Select** - Dropdown select

### Feedback Components
- **LoadingSpinner** - Loading indicator
- **EmptyState** - Empty state placeholder
- **ErrorBoundary** - Error boundary wrapper

### Data Display
- **StatCard** - Statistics card with trend
- **DataTable** - Table with sorting and pagination

### Usage Pattern
```typescript
import { Card, FormField, Input, StatCard } from '@/core/components';

<Card title="User Profile">
  <FormField label="Email" error={errors.email}>
    <Input value={email} onChange={setEmail} />
  </FormField>
</Card>

<StatCard
  title="Total Sales"
  value="₹1,25,000"
  trend={12.5}
  icon={<CurrencyIcon />}
/>
```

---

## 🛠️ Utils (`/utils`)

Pure utility functions:

### Formatting
- `formatCurrency(value)` - Format as INR (₹1,25,000)
- `formatNumber(value, decimals)` - Number formatting
- `formatVolume(value)` - Volume with L unit
- `formatDate(date, format)` - Date formatting
- `formatRelativeTime(date)` - "2 hours ago"

### Validation
- `isValidEmail(email)` - Email validation
- `isValidPhone(phone)` - Indian phone validation
- `isValidGST(gst)` - GST number validation
- `isValidVehicleNumber(vehicle)` - Vehicle plate validation

### String Utils
- `capitalize(str)` - Capitalize first letter
- `toTitleCase(str)` - Title Case
- `truncate(str, maxLength)` - Truncate with ellipsis
- `getInitials(name)` - Get name initials
- `slugify(str)` - URL-safe slug

### Object Utils
- `deepClone(obj)` - Deep clone
- `isEmpty(obj)` - Check if empty
- `pick(obj, keys)` - Pick properties
- `omit(obj, keys)` - Omit properties
- `compact(obj)` - Remove null/undefined

### Array Utils
- `groupBy(array, key)` - Group by property
- `sum(numbers)` - Sum array
- `sumBy(array, key)` - Sum by property
- `unique(array)` - Unique values
- `sortBy(array, key, direction)` - Sort by property

---

## 🌐 Internationalization (`/i18n`)

Multi-language support with react-i18next:

### Supported Languages
| Code | Language | Native Name |
|------|----------|-------------|
| `en` | English | English |
| `hi` | Hindi | हिन्दी |
| `te` | Telugu | తెలుగు |
| `ta` | Tamil | தமிழ் |

### Usage Pattern
```typescript
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/core/i18n';

function Component() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <button onClick={() => changeLanguage('hi')}>
        Switch to Hindi
      </button>
    </div>
  );
}
```

### Translation Keys Structure
```json
{
  "common": { "save": "Save", "cancel": "Cancel" },
  "auth": { "login": "Login", "logout": "Logout" },
  "navigation": { "dashboard": "Dashboard" },
  "dashboard": { "title": "Dashboard" },
  "stations": { "title": "Fuel Stations" },
  "pumps": { "title": "Pumps" },
  "readings": { "title": "Meter Readings" },
  "shifts": { "title": "Shifts" },
  "credits": { "title": "Credits" },
  "expenses": { "title": "Expenses" },
  "settings": { "title": "Settings" },
  "errors": { "notFound": "Not Found" },
  "validation": { "required": "Required" },
  "units": { "liters": "Litres" }
}
```

---

## 📥 Importing

### Single Import Point
```typescript
// Import everything from core
import { 
  User, 
  UserRoleEnum, 
  ROUTES, 
  useApi, 
  Card, 
  formatCurrency 
} from '@/core';
```

### Module-Specific Imports
```typescript
// Import from specific modules
import { User, CreateUserDTO } from '@/core/models';
import { UserRoleEnum, FuelTypeEnum } from '@/core/enums';
import { API_ENDPOINTS, ROUTES } from '@/core/constants';
import { useApi, useDebounce } from '@/core/hooks';
import { Card, StatCard } from '@/core/components';
import { formatCurrency, isValidEmail } from '@/core/utils';
```

---

## 📋 Required Dependencies

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

---

## ✅ Best Practices

1. **Always import from `/core`** - Don't create duplicate types
2. **Use enums for constants** - Type-safe and refactor-friendly
3. **Use DTOs for API** - CreateDTO, UpdateDTO patterns
4. **Use hooks for state** - Encapsulate complex state logic
5. **Use utils for logic** - Keep components clean
6. **Use i18n for text** - All user-facing strings should be translatable
