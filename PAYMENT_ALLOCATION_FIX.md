# Payment Allocation Fix

## Problem
The daily sales report was showing `paymentSplit: { cash: 0, online: 0, credit: 0 }` even though sales were recorded, meaning payment method information was being lost.

## Root Causes
1. **Frontend**: Sending `paymentAllocation` object instead of individual `cashAmount`, `onlineAmount`, `creditAmount` fields
2. **Backend**: Not capturing or aggregating payment method data in getDailySales response
3. **Validation**: No validation that payment breakdown must match total sale value

## Changes Made

### Frontend (`src/pages/owner/QuickDataEntryEnhanced.tsx`)

**Fixed Payment Submission:**
- Changed from sending `paymentAllocation` object to sending individual fields:
  - `cashAmount`: Cash payment amount
  - `onlineAmount`: Online payment amount
  - `creditAmount`: Credit payment amount
  - `creditorId`: Creditor ID (required for credit sales)
  - `notes`: Including payment breakdown details

**Added Validation:**
- Validate that payment total matches sale value before submission
- Throw error if amounts don't match

### Backend (`backend/src/controllers/readingController.js`)

**Updated createReading() method:**
- Added `creditAmount` and `creditorId` to request body destructuring
- Updated payment calculation logic to handle 3 payment types:
  - Cash + Online + Credit must equal total sale value
  - Validate amounts sum correctly
  - Require creditorId when credit > 0

**Updated Reading Creation:**
- Save `creditAmount`, `creditorId` in addition to cash/online amounts
- Store payment breakdown for audit trail

### Backend (`backend/src/controllers/stationController.js`)

**Fixed getDailySales() method:**
- Calculate actual payment split from readings data instead of hardcoding zeros
- Aggregate cash, online, and credit amounts from all readings
- Return accurate `paymentSplit` showing actual payment methods used:
  ```javascript
  paymentSplit: {
    cash: totalCash,
    online: totalOnline,
    credit: totalCredit
  }
  ```

## Result

Now when fetching daily sales data, the response correctly shows:

**Before (Broken):**
```json
"paymentSplit": {
  "cash": 0,
  "online": 0,
  "credit": 0
}
```

**After (Fixed):**
```json
"paymentSplit": {
  "cash": 20000,
  "online": 5000,
  "credit": 5000
}
```

## Validation Rules

✅ Payment breakdown (cash + online + credit) MUST equal total sale value
✅ Credit sales MUST have a creditor selected
✅ Frontend prevents submission without valid payment allocation
✅ Backend validates and rejects invalid payment combinations

## Endpoints Updated

1. **POST `/readings`**
   - Now accepts: `cashAmount`, `onlineAmount`, `creditAmount`, `creditorId`
   - Validates payment breakdown matches total

2. **GET `/stations/:stationId/daily-sales`**
   - Now returns accurate `paymentSplit` from actual readings
   - Shows distribution of cash vs online vs credit sales

## Testing Checklist

- [ ] Submit reading with cash payment → verify paymentSplit shows cash only
- [ ] Submit reading with online payment → verify paymentSplit shows online only
- [ ] Submit reading with credit payment → verify paymentSplit shows credit only
- [ ] Submit reading with mixed payments → verify paymentSplit sums correctly
- [ ] Try to submit without selecting payment type → should be rejected
- [ ] Try to submit credit without creditor → should be rejected
- [ ] Verify daily sales report shows correct payment breakdown
- [ ] Verify settlement page uses correct payment data for reconciliation
