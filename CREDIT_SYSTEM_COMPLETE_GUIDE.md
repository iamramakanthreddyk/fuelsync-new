# Credit System: Complete Flow

## You (Owner) Perspective

### View 1: Credit Ledger (`/owner/credit-ledger`)
```
Shows all customers who have outstanding credits

Customer            | Credit Limit | Outstanding | Status
================== | ============ | =========== | ===========
Ahmed Transport    | ₹50,000      | ₹18,000    | Active
Maruti Transporters| ₹30,000      | ₹35,000    | Over Limit ⚠️
Fresh Produce Ltd  | ₹20,000      | ₹0         | Settled ✓
```

**This updates when**:
- Employee submits transaction with `creditAllocations`
- You record a payment in DailySettlement

**Can you settle from here?**
- View shows data only
- To settle, go to: `/owner/settlements` (DailySettlement)

---

### View 2: Daily Settlement (`/owner/settlements`)
```
Date: 2025-12-15

Sales by Nozzle:
├─ Nozzle 1 (Petrol): 40L = ₹4000
└─ Nozzle 2 (Diesel): 30L = ₹3000
   Total: ₹7000

Payment Breakdown (what employee says was collected):
├─ Cash: ₹4500
├─ Online: ₹2000
└─ Credit: ₹500 (to Ahmed Transport)

Your Confirmation:
"Did you physically count ₹4500 in cash?"
"Did you verify ₹2000 online payment?"
"Record ₹500 credit against Ahmed Transport"

[SETTLE] ← Records the settlement
```

**What happens after settlement**:
- Ahmed Transport's outstanding increases by ₹500
- Credit Ledger now shows: Ahmed - ₹18,500 outstanding

---

### View 3: Creditor Detail (`/owner/stations/{stationId}/creditors` Tab)
```
Shows each creditor you've set up

Ahmed Transport
├─ Phone: 99999XXXXX
├─ Credit Limit: ₹50,000
├─ Current Balance (Outstanding): ₹18,500 ← Updated from settlements
├─ Available Credit: ₹31,500 ← (Limit - Outstanding)
└─ Last Sale: 2025-12-15

[+ Add Creditor] [Edit] [Delete]
```

**What you can do**:
- View all creditors
- Edit credit limits
- Delete creditors (careful!)
- Add new creditors

**What you should monitor**:
- ⚠️ Customers going over limit
- 📅 Last sale date (if haven't bought in X days, maybe stop credit)
- 💰 Total outstanding per creditor

---

## Data Flow: How Credit Gets Recorded

### Step 1: Employee Enters Reading
```
Employee: "I sold 40L of petrol"
POST /readings {
  nozzleId: "...",
  readingValue: 700,
  readingDate: "2025-12-15"
}

Backend calculates:
- litresSold = 40L
- totalAmount = ₹4000
```

### Step 2: Employee Says How It Was Paid
```
Employee: "Customer paid ₹2000 cash, ₹2000 on credit"
POST /transactions {
  stationId: "...",
  transactionDate: "2025-12-15",
  readingIds: ["reading-uuid"],
  paymentBreakdown: {
    cash: 2000,
    credit: 2000
  },
  creditAllocations: [
    {
      creditorId: "ahmed-uuid",
      amount: 2000
    }
  ]
}

Transaction recorded but PENDING owner approval
```

### Step 3: You (Owner) Review & Settle
```
You: "I physically verified:"
- Cash drawer has ₹2000
- Payment receipt for online: ₹2000
- Credit note signed for Ahmed: ₹2000

DailySettlement:
[SETTLE] ← This confirms the transaction

Backend updates:
- Creditor (Ahmed) outstanding += ₹2000
- Settlement created & linked
- Credit Ledger shows new balance
```

### Step 4: Customer Pays Back Credit
```
Ahmed: "I'm paying ₹2000 of my credit"

You go to Settlement page:
Payment Recording section:
├─ Select creditor: Ahmed Transport
├─ Amount: ₹2000
└─ [Record Payment]

Backend updates:
- Creditor (Ahmed) outstanding -= ₹2000
- New balance: ₹18,500 → ₹16,500
- Payment recorded in transaction history
```

---

## Credit Ledger Details

### What It Shows
```
creditService.getCreditLedger(search, stationId)

Returns for each creditor:
{
  id: "uuid",
  name: "Ahmed Transport",
  mobile: "99999XXXXX",
  creditLimit: 50000,
  outstanding: 18500,              ← What they owe YOU
  lastSaleDate: "2025-12-15"       ← When they last bought on credit
}
```

### How Outstanding Gets Updated
```
Timeline:
2025-12-01: Ahmed buys ₹5000 on credit
           outstanding: 0 → 5000

2025-12-05: Ahmed buys ₹3000 on credit
           outstanding: 5000 → 8000

2025-12-10: Ahmed pays ₹2000 cash
           outstanding: 8000 → 6000

2025-12-15: Ahmed buys ₹2000 on credit
           outstanding: 6000 → 8000

Credit Ledger shows: 8000 outstanding
```

### Over Limit Alert
```
If outstanding > creditLimit:
Status: "Over Limit" ⚠️

Example:
Ahmed creditLimit: ₹50,000
Ahmed outstanding: ₹52,000 ← BAD!

Action: You should:
1. Check with Ahmed (maybe payment not recorded?)
2. Adjust credit limit if business is growing
3. Stop allowing credit until they pay down
4. Review settlement variance (might be recording error)
```

---

## Income Report: Creditor Settlements Section

```
/owner/reports → Income Tab → "Creditor Settlements"

Shows for each creditor:
┌─ Ahmed Transport
│  ├─ Total Credited (amount given on credit): ₹18,500
│  ├─ Total Settled (amount paid back): ₹8,000
│  └─ Outstanding (owed): ₹10,500
│
└─ Other creditors...

This is the LONG-TERM view
vs Credit Ledger which is SNAPSHOT
```

---

## Troubleshooting

### Q: Why is Credit Ledger not updating?
**A**: Transaction needs to be settled first
```
Steps:
1. Employee submits reading + transaction
2. YOU settle it in DailySettlement page
3. THEN Credit Ledger updates

If Credit Ledger shows 0:
- Check DailySettlement for unsettled transactions
- Settle them [SETTLE] button
- Ledger updates after settlement
```

### Q: Why does customer show over limit?
**A**: Either they bought more or payment wasn't recorded
```
Ahmed:
- Limit: ₹50,000
- Outstanding: ₹52,000

Check:
1. Did they just buy ₹2000 more? (explains +2000)
2. Did they pay ₹5000? (check DailySettlement for unsettled payment)
3. Is there a settlement variance? (reading vs actual mismatch)
```

### Q: How do I remove a creditor?
**A**: Via Station Detail → Creditors Tab → Delete button
```
Warning: This only works if:
- Outstanding = ₹0
- No pending transactions referencing them

If they have outstanding:
- Must settle all credits first
- OR record final payment
- THEN delete
```

### Q: Can I see payment history for one creditor?
**A**: Currently in Income Report → Creditor Settlements → Transactions list
```
Future: Will add detail page per creditor
For now:
/owner/reports → Creditor Settlements
Shows all transactions for each creditor
```

---

## System Architecture (How It Works)

### Three Tables
```
1. Creditor (master list)
   └─ id, name, creditLimit, status
   
2. DailyTransaction (payment breakdown)
   └─ creditAllocations: [{creditorId, amount}]
   
3. CreditTransaction (when settlement processes)
   └─ creditorId, amount, type: CREDIT/PAYMENT
   └─ This updates Creditor.outstanding
```

### Three APIs
```
1. GET /creditors/ledger
   → Shows current outstanding per creditor
   
2. POST /transactions
   → Records payment breakdown (cash/credit split)
   
3. POST /settlements/{id}
   → Processes transaction, updates creditor balance
```

### Three Views
```
1. Credit Ledger (/owner/credit-ledger)
   → Real-time outstanding snapshot
   
2. Daily Settlement (/owner/settlements)
   → Day-by-day reconciliation
   
3. Income Report (/owner/reports)
   → Historical creditor settlements
```

---

## Next Steps for You

1. **Set up creditors**: Go to Station Detail → Creditors Tab → Add First Creditor
2. **Monitor daily**: Use Daily Settlement to record credits when employees submit them
3. **Check status**: Review Credit Ledger weekly to monitor outstanding
4. **Collect payments**: Record payments in DailySettlement when customers pay
5. **Analyze**: Use Income Report to see creditor trends

---

**Status**: Credit system fully functional  
**Last Updated**: December 15, 2025  
**Maintained by**: GitHub Copilot AI Assistant

---

## Future Schema Improvements

### Invoice/Document Reference
If you need to support invoice-level tracking (for legal/tax), consider adding an `invoiceNumber` or similar field to the `CreditTransaction` model. This allows each credit sale or settlement to be linked to a specific invoice or document, improving traceability and compliance.

### Partial Settlements
If settlements can be partial against specific credits, consider introducing a join table or reference to link settlements to specific credit transactions. Currently, settlements are just aggregated per creditor. A join table (e.g., `CreditSettlementLink`) would allow you to track which settlement payments are applied to which credit transactions, supporting more granular reconciliation and reporting.
