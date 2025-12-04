# QuickDataEntryEnhanced Documentation

## Overview
`QuickDataEntryEnhanced.tsx` is the **main Quick Entry page** used by operators for fast nozzle reading entry with automatic sale calculations and payment allocation.

**Route:** `/owner/quick-entry`
**File Location:** `src/pages/owner/QuickDataEntryEnhanced.tsx`

## Features

### 1. Station & Date Selection
- Dropdown to select active station
- Date picker with max date = today
- Station data automatically resets on selection

### 2. Per-Nozzle Reading Entry
- Display all pumps and nozzles for selected station
- Input meter reading values
- Automatic validation:
  - Only accepts numbers greater than last reading
  - Shows green checkmark when valid reading entered
  - Disables input if nozzle inactive or fuel price missing
  - Red warning if fuel price not set

### 3. Real-Time Sale Calculation
- **Automatic calculation:** (New Reading - Last Reading) × Fuel Price = Sale Value
- Live updates as user enters readings
- Summary display of total liters and total sale value
- Breakdown by fuel type showing liters and value for each

### 4. Payment Allocation with Creditor Binding
#### Default Behavior
- All sale value allocated to Cash by default
- Can be manually adjusted to Online/Digital or Credit

#### Credit Sales (Enhanced)
- **Requires Creditor Selection:**
  - User cannot enter credit amount without selecting creditor
  - Dropdown shows all station creditors
  - Each creditor displays:
    - Name and Business Name
    - Current Balance
    - Credit Limit
  
- **Credit Limit Validation:**
  - Prevents crediting beyond creditor's limit
  - Displays red warning if amount exceeds limit
  - Clear feedback on creditor's available balance

#### Payment Allocation Validation
- Total of Cash + Online + Credit must equal Total Sale Value
- Submit button disabled until payment is balanced
- Shows remaining amount if not fully allocated

### 5. Data Submission
Two-step submission process:

#### Step 1: Save Readings
```javascript
POST /readings {
  nozzleId: string,
  readingValue: number,
  readingDate: string,
  paymentType: 'cash',
  paymentAllocation: {
    cash: number,
    online: number,
    credit: number,
    creditorId?: string
  }
}
```

#### Step 2: Create Credit Transaction (if credit allocated)
```javascript
POST /stations/{stationId}/credits {
  creditorId: string,
  amount: number,
  transactionDate: string,
  notes: string
}
```

## Component Integration

### SaleValueSummary Component
- Displays payment allocation UI
- Enforces creditor selection for credit
- Shows credit limit validation
- Props include creditors list

### ReadingSaleCalculation Component
- Shows per-nozzle calculation breakdown
- Displays in calculation format: (New - Last) = Liters → Liters × Price = Sale Value
- Only shown when reading is valid and entered

## Data Flow

```
User selects station & date
    ↓
Pumps & nozzles loaded (with last readings)
Fuel prices fetched
Creditors list fetched
    ↓
User enters meter readings
    ↓
For each reading:
  ├─ Calculate: liters = reading - lastReading
  ├─ Calculate: saleValue = liters × price
  └─ Update summary (total liters, total value, by fuel type)
    ↓
System auto-allocates to Cash (default)
    ↓
User can adjust:
  ├─ Cash amount
  ├─ Online amount
  └─ Credit amount (requires creditor selection)
    ↓
Validation before submit:
  ├─ At least one reading entered
  ├─ Payment allocation equals sale value
  ├─ Credit requires creditor selection
  └─ All fuel types have prices set
    ↓
Submit:
  ├─ Save all readings
  └─ Create credit transaction (if applicable)
    ↓
Success:
  ├─ Clear form
  ├─ Reset payment allocation
  └─ Refetch pumps data
```

## Key Validations

### Pre-Submit Checks
✅ At least one reading must be entered
✅ Readings must be greater than last reading
✅ All fuel types used must have prices set
✅ Total payment must equal sale value
✅ Credit sales require creditor selection

### During Submission
✅ Readings saved atomically
✅ Credit transaction created with creditor association
✅ Creditor balance updated on backend

### Error Handling
- Clear error messages for all validation failures
- Toast notifications for success/error
- Form not cleared on error (preserves data)
- Proper error messaging for API failures

## User Experience Improvements

### Visual Feedback
- Reading validity indicated with green checkmark
- Invalid inputs highlighted in red
- Sticky submit button shows progress
- Badge shows number of pending readings
- Color-coded icons for different sections

### Smart Defaults
- Reading date defaults to today
- Cash allocation defaults to full sale value
- UI guides user through required selections

### Accessibility
- All inputs properly labeled
- Clear indication of required fields
- Disabled states clear
- Mobile-friendly responsive design

## Backend Requirements

### Endpoints Used
- `GET /stations` - List stations
- `GET /stations/{id}/pumps` - Get pumps with nozzles
- `GET /stations/{id}/prices` - Get fuel prices
- `GET /stations/{id}/creditors` - Get creditors list
- `POST /readings` - Save nozzle readings
- `POST /stations/{id}/credits` - Create credit transaction

### Data Structures

**Pump with Nozzles:**
```typescript
interface Pump {
  id: string;
  pumpNumber: number;
  name: string;
  status: 'active' | 'inactive' | 'maintenance';
  nozzles: {
    id: string;
    nozzleNumber: number;
    fuelType: string;
    status: string;
    lastReading?: number;
    initialReading?: number;
  }[];
}
```

**Creditor:**
```typescript
interface Creditor {
  id: string;
  name: string;
  businessName?: string;
  currentBalance: number;
  creditLimit: number;
}
```

**Fuel Price:**
```typescript
interface FuelPrice {
  id: string | number;
  station_id: string;
  fuel_type: 'PETROL' | 'DIESEL' | 'CNG' | 'EV';
  price_per_litre: number;
  valid_from: string;
  created_at: string;
}
```

## Future Enhancements

1. **Batch Upload:** Support CSV/Excel upload of readings
2. **Offline Mode:** Save readings offline, sync when online
3. **Camera Input:** Barcode scanning for nozzle/pump selection
4. **Notes Field:** Add notes per reading (breakdowns, adjustments)
5. **Photo Capture:** Attach photos to readings for verification
6. **Approval Workflow:** Route to manager for approval before settlement
7. **Recurring Readings:** Schedule automatic readings at set times
8. **Analytics Preview:** Show daily trend while entering readings

## Testing Scenarios

### Scenario 1: Basic Reading Entry
1. Select station and date
2. Enter reading for one nozzle
3. Verify calculation shows correctly
4. Verify cash allocated by default
5. Submit

### Scenario 2: Multiple Fuel Types
1. Select station with multiple fuel types
2. Enter readings for different fuel types
3. Verify breakdown by fuel type is correct
4. Verify total matches sum of fuel types
5. Submit

### Scenario 3: Credit Sales with Creditor
1. Enter readings
2. Allocate some amount to credit
3. Verify credit field disabled until creditor selected
4. Select creditor
5. Verify credit limit shown
6. Enter credit amount within limit
7. Verify payment balanced
8. Submit
9. Verify credit transaction created

### Scenario 4: Credit Limit Exceeded
1. Enter readings
2. Select creditor with low credit limit
3. Try to allocate more than limit
4. Verify red warning appears
5. Reduce amount below limit
6. Verify warning clears
7. Submit successfully

## Troubleshooting

### Readings not appearing
- Verify station has pumps configured
- Verify pumps have nozzles
- Check network connection

### Fuel prices missing
- Navigate to station settings
- Verify fuel prices are set
- Confirm fuel types match nozzle types

### Credit not working
- Verify creditors exist for station
- Check creditor is marked active
- Verify creditor has credit limit > 0

### Submit button disabled
- Verify all inputs are valid
- Check payment allocation totals sale value
- If credit used, verify creditor selected
- Verify all fuel types have prices

## Related Files

- **SaleValueSummary.tsx** - Payment allocation UI with creditor binding
- **ReadingSaleCalculation.tsx** - Per-nozzle calculation display
- **useFuelPricesData.ts** - Hook to fetch fuel prices
- **useStations.ts** - Hook to fetch stations
- **usePumps.ts** - Hook to fetch pumps and nozzles

## Status
✅ **Production Ready**
- Build: Successful
- Tests: Passing
- Validations: Comprehensive
- Error Handling: Complete
