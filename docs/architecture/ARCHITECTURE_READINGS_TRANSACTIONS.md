# Architecture: Readings vs Transactions

**Date**: December 15, 2025  
**Status**: FIXED - Separation of concerns implemented

## Problem Solved

Previously, nozzle readings were trying to handle both:
1. **What was sold** (meter readings → liters → sale amount)
2. **How it was paid** (cash/online/credit allocation)

This caused confusion and incorrect data recording. The fix separates these into two distinct APIs.

---

## New Architecture (Dec 2025)

### 1. Nozzle Reading API
**Purpose**: Record **WHAT WAS SOLD**  
**Endpoint**: `POST /api/v1/readings`  
**Payload**:
```json
{
  "stationId": "uuid",
  "nozzleId": "uuid",
  "readingValue": 700.00,
  "readingDate": "2025-12-15"
}
```

**What it calculates**:
- previousReading = 660.00 (fetched from DB)
- litresSold = 700.00 - 660.00 = 40L
- pricePerLitre = 100.00 (from FuelPrice table)
- totalAmount = 40L × 100 = ₹4000

**Response** (what system knows):
```json
{
  "success": true,
  "data": {
    "id": "reading-uuid",
    "readingValue": 700,
    "previousReading": 660,
    "litresSold": 40,
    "pricePerLitre": 100,
    "totalAmount": 4000,
    "cashAmount": 0,           // ← Always 0
    "onlineAmount": 0,         // ← Always 0
    "creditAmount": 0,         // ← Always 0
    "creditorId": null,        // ← Always null
    "paymentBreakdown": {}     // ← Always empty
  },
  "message": "Sale recorded: 40.000L = ₹4000.00. Payment breakdown recorded separately via DailyTransaction."
}
```

**Key Point**: Payment fields are always 0. They're deprecated and kept only for schema compatibility.

---

### 2. Daily Transaction API
**Purpose**: Record **HOW IT WAS PAID**  
**Endpoint**: `POST /api/v1/transactions`  
**Called AFTER readings are saved**

**Payload**:
```json
{
  "stationId": "uuid",
  "transactionDate": "2025-12-15",
  "readingIds": ["reading-uuid-1", "reading-uuid-2"],
  "paymentBreakdown": {
    "cash": 2400,
    "online": 1600,
    "credit": 0
  },
  "creditAllocations": [],
  "notes": "Daily cash entry for 15-Dec"
}
```

**Validations**:
- ✅ paymentBreakdown.cash + .online + .credit = sum of all reading totalAmounts
- ✅ If credit > 0, creditAllocations must be provided
- ✅ Sum of creditAllocations amounts must equal paymentBreakdown.credit

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "transaction-uuid",
    "stationId": "uuid",
    "transactionDate": "2025-12-15",
    "totalLiters": 40,
    "totalSaleValue": 4000,
    "paymentBreakdown": {
      "cash": 2400,
      "online": 1600,
      "credit": 0
    },
    "readingIds": ["reading-uuid-1"],
    "status": "submitted"
  }
}
```

---

## Data Flow

### Employee Entry (Quick Data Entry)
```
Employee enters readings on nozzles
        ↓
[POST /readings] for each nozzle
        ↓
System calculates litres & sale amount
        ↓
Readings saved (payment fields = 0)
        ↓
Employee enters payment allocation (cash/online/credit)
        ↓
[POST /transactions] with payment breakdown
        ↓
Transaction saved with reading references
```

### Owner Settlement
```
Owner sees:
  - Expected Sale (from Readings): ₹4000
  - Actual Cash Entry (from Transaction): Cash ₹2400 + Online ₹1600
        ↓
Owner reviews and settles in DailySettlement
        ↓
Reconciliation complete
```

---

## Code Changes

### Frontend (QuickDataEntryEnhanced.tsx)
**Changed**: Removed payment fields from individual readings
```javascript
// BEFORE (WRONG):
const readingData = {
  nozzleId: "...",
  readingValue: 700,
  readingDate: "2025-12-15",
  cashAmount: 800,           // ← WRONG: per-reading payment
  onlineAmount: 2000,        // ← WRONG: per-reading payment
  creditAllocations: []      // ← WRONG: per-reading payment
};

// AFTER (CORRECT):
const readingData = {
  nozzleId: "...",
  readingValue: 700,
  readingDate: "2025-12-15"
  // NO payment fields
};

// Then submit transaction:
const transactionData = {
  stationId: "...",
  transactionDate: "2025-12-15",
  readingIds: [savedReadingIds],
  paymentBreakdown: {
    cash: 800,
    online: 2000,
    credit: 0
  }
};
```

### Backend (readingController.js)
**Changed**: Clarified that payment fields are always 0
```javascript
// All these are now set to 0 by design:
reading = await NozzleReading.create({
  // ... reading data ...
  cashAmount: 0,
  onlineAmount: 0,
  creditAmount: 0,
  creditorId: null,
  paymentBreakdown: {}
});
```

### Backend (NozzleReading.js)
**Changed**: Added comments marking fields as deprecated
```javascript
// DEPRECATED: Always 0. Use DailyTransaction.paymentBreakdown instead
cashAmount: {
  type: DataTypes.DECIMAL(12, 2),
  defaultValue: 0,
  field: 'cash_amount',
  comment: 'DEPRECATED: Always 0. Use DailyTransaction instead'
}
```

---

## FAQ

### Q: Why split readings and transactions?
**A**: 
- **Readings** = Technical fact: X liters sold
- **Transactions** = Business fact: Paid how
- Separating them allows:
  - ✅ Recording multiple payments for same reading (disputed later)
  - ✅ Clear audit trail of what was vs what was recorded
  - ✅ Multiple employees/shifts on same day
  - ✅ Owner settlement to reconcile differences

### Q: What if payment doesn't match reading?
**A**: That's exactly what settlement is for!
- Reading says ₹4000 should be collected
- Cash entry says only ₹3500 collected
- Owner sees variance and settles it

### Q: Can I have multiple transactions per day?
**A**: Yes! Each employee/shift can submit their readings + one transaction.
- Employee A: 10L readings + cash entry
- Employee B: 15L readings + cash entry
- Owner settlement aggregates both

### Q: What about credit to specific customers?
**A**: Credit is now in DailyTransaction.creditAllocations:
```json
{
  "creditAllocations": [
    {"creditorId": "uuid-1", "amount": 2000},
    {"creditorId": "uuid-2", "amount": 500}
  ]
}
```

### Q: Where's the creditor ledger updated?
**A**: Via creditController.recordSettlement() when transaction is processed
- Transaction credit amount flows to Creditor.outstanding
- Credit Ledger shows current balances
- Settlement updates when paid back

---

## Testing

### Quick Test Flow
```
1. POST /readings 
   → Get reading with totalAmount=4000, payment fields=0
   
2. POST /transactions with same reading
   → paymentBreakdown: {cash: 3000, online: 1000}
   → Transaction created successfully
   
3. GET /credit-ledger
   → Shows outstanding for creditors (if credit allocated)
   
4. Owner reviews in DailySettlement
   → Can see expected vs actual
```

---

## Migration Notes

- **Existing readings**: cashAmount, onlineAmount, creditAmount will be 0 (backward compatible)
- **Old payment data**: Lost during this refactor (acceptable for test/demo data)
- **New flow required**: All payment tracking MUST use DailyTransaction API

---

**Maintainer**: GitHub Copilot  
**Contact**: Use `/owner/credit-ledger` to view credit status  
**Documentation**: See DAILY_SETTLEMENT_QUICK_GUIDE.md for settlement flow
