# Cash & Sales Reconciliation System Design

## Executive Summary

This document outlines the design for a comprehensive cash management and sales reconciliation system for FuelSync. The solution leverages the **existing robust backend** while building missing frontend features.

**✅ IMPLEMENTATION STATUS: COMPLETE (Dec 2024)**

---

## Current State Analysis

### ✅ What Already Exists (Backend)

| Component | Status | Notes |
|-----------|--------|-------|
| `Shift` model | ✅ Complete | Has `expectedCash`, `cashCollected`, `cashDifference`, `status` |
| `NozzleReading` model | ✅ Complete | Has `paymentBreakdown` JSONB, links to `shiftId` |
| `CashHandover` model | ✅ Complete | 4-stage workflow with approval status |
| Shift API | ✅ Complete | Start, end, cancel, reconciliation endpoints |
| Cash Handover API | ✅ Complete | Create, confirm, resolve, bank deposit |
| Reading API | ✅ Complete | CRUD with previous reading lookup |

### ✅ Frontend Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| Shift Management UI | ✅ Complete | `src/pages/shifts/ShiftManagement.tsx` |
| Cash Entry at Reading | ✅ Complete | `src/components/readings/PaymentSplit.tsx` |
| Sale Calculation Display | ✅ Complete | `src/components/readings/SaleCalculation.tsx` |
| DataEntry with Payment | ✅ Complete | `src/pages/DataEntry.tsx` (enhanced) |
| Handover Confirmation UI | ✅ Complete | `src/pages/cash/CashHandoverConfirmation.tsx` |
| Cash Reconciliation Report | ✅ Complete | `src/pages/cash/CashReconciliationReport.tsx` |
| Navigation Integration | ✅ Complete | `src/components/owner/QuickEntryCardsGrid.tsx` |
| Routes Configuration | ✅ Complete | `src/components/AppWithQueries.tsx` |

---

## Proposed Solution

### Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DAILY OPERATIONS FLOW                           │
└─────────────────────────────────────────────────────────────────────────┘

1. SHIFT START (Employee)
   └── Employee logs in → System auto-starts shift OR manual start
   └── Opening cash recorded (if any)

2. METER READINGS (Employee) ← THIS IS THE KEY CHANGE
   └── Enter previous/current reading
   └── System auto-calculates: litres = current - previous
   └── System auto-calculates: saleValue = litres × fuelPrice
   └── Employee enters: cashReceived (defaults to saleValue)
   └── System calculates: onlinePayment = saleValue - cashReceived
   └── Optional: creditAmount for credit customers
   └── Submit → Reading saved with payment breakdown

3. SHIFT END (Employee)
   └── View shift summary: total sales, expected cash, readings count
   └── Enter: actualCashCollected (total cash in hand)
   └── System calculates: difference = expectedCash - actualCashCollected
   └── Submit → Shift ends, CashHandover auto-created

4. MANAGER CONFIRMATION (Manager)
   └── View pending handovers
   └── Count received cash, enter actualReceived
   └── System detects discrepancy → Mark as confirmed OR disputed
   └── Creates next-level handover (manager_to_owner)

5. OWNER CONFIRMATION (Owner)
   └── Confirm manager handover
   └── Record bank deposit with receipt
   └── Resolve any disputed amounts

6. REPORTING
   └── Daily/Weekly/Monthly views
   └── Sales vs Cash vs Online vs Credit breakdown
   └── Discrepancy tracking and analysis
```

---

## Database Schema Validation

The existing schema is **sufficient**. Key fields already exist:

### NozzleReading (existing)
```sql
payment_breakdown JSONB DEFAULT '{"cash": 0, "online": 0, "credit": 0}'
cash_amount DECIMAL(12,2)      -- redundant but useful for queries
online_amount DECIMAL(12,2)
credit_amount DECIMAL(12,2)
shift_id UUID                   -- links to active shift
```

### Shift (existing)
```sql
cash_collected DECIMAL(12,2)    -- actual cash from employee
expected_cash DECIMAL(12,2)     -- sum of cash from readings
cash_difference DECIMAL(12,2)   -- expected - collected
online_collected DECIMAL(12,2)
status ENUM('active', 'ended', 'cancelled')
```

### CashHandover (existing)
```sql
handover_type ENUM('shift_collection', 'employee_to_manager', 'manager_to_owner', 'deposit_to_bank')
expected_amount DECIMAL(12,2)
actual_amount DECIMAL(12,2)     -- filled on confirm
discrepancy DECIMAL(12,2)
status ENUM('pending', 'confirmed', 'disputed', 'resolved')
confirmed_by UUID
confirmed_at DATE
```

### ⚠️ One Enhancement Needed: Reading Approval Status

Add to `NozzleReading`:
```sql
approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'
approved_by UUID
approved_at TIMESTAMP
rejection_reason TEXT
```

This allows managers to approve/reject individual readings before they're locked.

---

## Implementation Plan

### Phase 1: Enhanced Reading Entry with Cash Split (Priority: HIGH)

**Goal:** When entering a meter reading, automatically calculate sales and allow cash/online split.

**Changes to DataEntry.tsx / QuickEntry:**

```typescript
// Current flow:
// 1. Select nozzle
// 2. Enter current reading
// 3. Submit

// New flow:
// 1. Select nozzle
// 2. System shows: previousReading, fuelPrice
// 3. Enter: currentReading
// 4. System auto-calculates: 
//    - litresSold = currentReading - previousReading
//    - saleValue = litresSold × fuelPrice
// 5. Enter: cashReceived (defaults to saleValue)
// 6. System auto-calculates: onlinePayment = saleValue - cashReceived
// 7. Optional: creditAmount (deducted from cash/online)
// 8. Submit with payment breakdown
```

**UI Wireframe:**
```
┌─────────────────────────────────────────────┐
│ METER READING ENTRY                         │
├─────────────────────────────────────────────┤
│ Station: [Dropdown]                         │
│ Pump: [Dropdown]                            │
│ Nozzle: [Dropdown]                          │
├─────────────────────────────────────────────┤
│ Fuel Type: Petrol (₹102.50/L)              │
│ Previous Reading: 45,230.50 L              │
├─────────────────────────────────────────────┤
│ Current Reading: [___45,280.00___] L       │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ CALCULATED VALUES                       │ │
│ ├─────────────────────────────────────────┤ │
│ │ Litres Sold:     49.50 L                │ │
│ │ Sale Value:      ₹5,073.75              │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ PAYMENT COLLECTION                          │
├─────────────────────────────────────────────┤
│ Cash Received:  [___₹5,000.00___]          │
│ Online/Card:    ₹73.75 (auto-calculated)   │
│ Credit Given:   [___₹0.00___]              │
│                                             │
│ ☑ Total matches: ₹5,073.75 ✓               │
├─────────────────────────────────────────────┤
│        [Cancel]    [Submit Reading]         │
└─────────────────────────────────────────────┘
```

### Phase 2: Shift Management UI (Priority: HIGH)

**New Component:** `ShiftManagement.tsx`

**Features:**
- Start shift (auto or manual)
- View active shift status
- End shift with cash reconciliation
- View shift history

**UI for Shift End:**
```
┌─────────────────────────────────────────────┐
│ END SHIFT - CASH RECONCILIATION             │
├─────────────────────────────────────────────┤
│ Shift: Morning | Started: 6:00 AM           │
│ Employee: John Doe                          │
├─────────────────────────────────────────────┤
│ SHIFT SUMMARY                               │
├─────────────────────────────────────────────┤
│ Total Readings:     12                      │
│ Total Litres:       850.75 L                │
│ Total Sales:        ₹87,201.88              │
├─────────────────────────────────────────────┤
│ EXPECTED COLLECTION                         │
├─────────────────────────────────────────────┤
│ Cash Sales:         ₹75,000.00              │
│ Online Sales:       ₹10,201.88              │
│ Credit Sales:       ₹2,000.00               │
├─────────────────────────────────────────────┤
│ ACTUAL COLLECTION                           │
├─────────────────────────────────────────────┤
│ Cash in Hand:       [___₹74,500.00___]     │
│                                             │
│ ⚠️ Shortage: ₹500.00                        │
│ Reason: [Dropdown: Counting error/Theft/   │
│          Customer dispute/Other]            │
│ Notes: [_________________________]          │
├─────────────────────────────────────────────┤
│        [Cancel]    [End Shift]              │
└─────────────────────────────────────────────┘
```

### Phase 3: Manager Confirmation UI (Priority: MEDIUM)

**New Component:** `CashHandoverConfirmation.tsx`

**Features:**
- List pending handovers
- Confirm with actual amount
- Mark disputes
- View history

### Phase 4: Reporting Dashboard (Priority: MEDIUM)

**Enhanced Reports:**
- Daily cash flow
- Discrepancy trends
- Employee performance
- Reconciliation status

---

## API Contracts (Already Exist)

### Shift Endpoints
```
POST /api/shifts                    - Start shift
GET  /api/shifts/active?stationId=  - Get active shift
POST /api/shifts/:id/end            - End shift with cash
GET  /api/shifts/:id/summary        - Shift summary
```

### Reading Endpoints (to enhance)
```
POST /api/nozzle-readings           - Create with paymentBreakdown
GET  /api/nozzle-readings/previous  - Get previous reading
```

### Cash Handover Endpoints
```
GET  /api/cash-handovers/pending    - Pending for user
POST /api/cash-handovers/:id/confirm - Confirm with actual amount
POST /api/cash-handovers/:id/resolve - Resolve dispute
```

---

## File Changes Required

### Frontend Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/DataEntry.tsx` | Modify | Add cash/online split to reading form |
| `src/pages/shifts/ShiftManagement.tsx` | Create | Shift start/end UI |
| `src/pages/shifts/ShiftEndReconciliation.tsx` | Create | Shift end form |
| `src/pages/cash/CashHandoverList.tsx` | Create | Pending handovers |
| `src/pages/cash/HandoverConfirmation.tsx` | Create | Confirm handover |
| `src/components/readings/ReadingForm.tsx` | Create | Reusable reading form |
| `src/components/readings/PaymentSplit.tsx` | Create | Cash/online split UI |
| `src/services/tenderService.ts` | Modify | Add shift management calls |
| `src/hooks/useShift.ts` | Create | Shift state management |

### Backend Files to Modify (minimal)

| File | Action | Description |
|------|--------|-------------|
| `backend/src/models/NozzleReading.js` | Modify | Add approval_status fields |
| `backend/src/controllers/readingController.js` | Modify | Add approval endpoints |

---

## Implementation Order

```
Week 1: Phase 1 - Reading Entry with Cash Split
├── Day 1-2: Modify DataEntry.tsx form
├── Day 3-4: Add PaymentSplit component
└── Day 5: Testing and refinement

Week 2: Phase 2 - Shift Management
├── Day 1-2: ShiftManagement.tsx
├── Day 3-4: ShiftEndReconciliation.tsx
└── Day 5: Integration testing

Week 3: Phase 3 - Manager Confirmation
├── Day 1-2: CashHandoverList.tsx
├── Day 3: HandoverConfirmation.tsx
└── Day 4-5: Testing

Week 4: Phase 4 - Reporting
├── Day 1-3: Enhanced reports
└── Day 4-5: Final testing and documentation
```

---

## Key Design Decisions

### 1. Cash Entry at Reading Level (Not Shift Level)
**Why:** More accurate tracking. Each reading knows exactly how much was cash vs online.

### 2. Auto-Calculate Online as Remainder
**Why:** Simplifies entry. Employee just enters cash received, online is calculated.

### 3. Manager Approval Before Lock
**Why:** Allows correction of mistakes before data is finalized.

### 4. Discrepancy Tracking at Multiple Levels
**Why:** Track where discrepancies occur (reading, shift, handover).

### 5. Use Existing Backend
**Why:** Backend is well-designed. Minimal changes needed.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Cash reconciliation accuracy | >99% |
| Time to end-of-day close | <15 minutes |
| Discrepancy detection rate | 100% |
| Manager approval turnaround | <2 hours |

---

## Next Steps

1. ✅ Design complete
2. 🔄 Implement Phase 1: Reading Entry with Cash Split
3. ⏳ Implement Phase 2: Shift Management
4. ⏳ Implement Phase 3: Manager Confirmation
5. ⏳ Implement Phase 4: Reporting
