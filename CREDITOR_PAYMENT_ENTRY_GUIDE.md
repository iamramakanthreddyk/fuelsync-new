# Creditor Payment Entry Flow - Complete Guide

## Where to Enter Creditor Payments in the UI

### **STEP 1: Go to Station Detail**
- Navigate to: **Owner Dashboard** → **Stations** 
- Click on the station name to open **Station Detail**
- You should see multiple tabs at the top

### **STEP 2: Click on "Creditors" Tab**
Path in UI:
```
Station Detail 
    ↓
[Creditors] Tab (shows credit icon and "Creditors" text)
```

### **STEP 3: View All Creditors**
In the Creditors tab you'll see:
- **Cards for each creditor** with:
  - Creditor name
  - Phone number
  - Vehicle number (if added)
  - **Credit Limit** (blue box)
  - **Outstanding Balance** (red box) - amount they owe
  - **Available Credit** (green box) - remaining credit available
  - **"Settle" or "Pay" Button** (orange button in top-right of card)

### **STEP 4: Click "Settle" Button**
When you click the Settle/Pay button:
- An **inline form appears below** with:
  - **Amount** field (required) - how much they're paying
  - **Reference Number** field (optional) - reference like check number, UPI ref, etc
  - **Notes** field (optional) - any notes about the payment
  - **Settle button** to submit

### **STEP 5: Enter Payment Details**
Fill in the form:
1. Enter the **amount they're paying** (e.g., ₹5000)
2. Enter **reference number** if paying by check/bank transfer (optional)
3. Add any **notes** (optional)
4. Click **Settle** button

### **STEP 6: Payment Recorded**
- System shows success message
- Outstanding balance updates automatically
- Available credit increases

---

## Example Scenario

**Creditor:** Ramesh Fuel Supply  
**Credit Limit:** ₹50,000  
**Outstanding:** ₹8,000  
**Available:** ₹42,000  

**Ramesh pays ₹3,000 via bank transfer**

Steps:
1. Click **"Pay"** button on Ramesh's card
2. Enter **Amount:** 3000
3. Enter **Reference:** Bank Transfer / Ref 12345678
4. Click **Settle**

Result:
- Outstanding becomes: ₹5,000
- Available becomes: ₹45,000

---

## Current Features

✅ **Payment Recording:**
- Records payment amount
- Tracks reference number (for audit trail)
- Stores notes
- Updates balance immediately

✅ **Payment Visibility:**
- Shows all creditors with outstanding balance
- Shows credit limit vs current usage
- Shows available credit remaining
- Only shows creditors with balance > 0

✅ **How Outstanding Balance Decreases:**
- When creditor pays → outstanding balance decreases
- Available credit increases
- Automatic update in UI

---

## Missing/Future Features

❌ **Payment History** 
- No way to see past payments made
- No payment receipt/record view
- No settlement date tracking

❌ **Payment Methods**
- Cannot specify payment method (cash, check, bank transfer, etc)
- All treated the same

❌ **Partial Payments**
- No indication if payment is partial vs full settlement
- No way to mark if payment is pending/confirmed

❌ **Multiple Stations**
- Can only settle per station
- No station selector in payment form
- Total creditor balance across all stations not visible

❌ **Creditor Portal/Self-Service**
- Creditor cannot see their balance
- Creditor cannot make payment directly
- All payments must be entered by owner

---

## Route Structure

```
/owner/stations/:id                      → Station detail page
    ↓
[Creditors Tab]                          → Shows list of creditors
    ↓
[Settle Button on Creditor Card]         → Inline settle form
    ↓
POST /stations/:id/creditors/:cid/settle → Backend endpoint
```

## API Endpoint Used

```
POST /stations/:stationId/creditors/:creditorId/settle

Request Body:
{
  "amount": 5000,                    // Required
  "referenceNumber": "CHQ12345",     // Optional
  "notes": "Full payment"            // Optional
}

Response:
{
  "success": true,
  "data": {
    "settlementId": "uuid",
    "creditorId": "uuid", 
    "amount": 5000,
    "newBalance": 3000,
    "settledAt": "2026-01-13T12:30:00Z"
  }
}
```

---

## Key Points for Creditors/Owners

1. **Outstanding Balance = Money Owed**
   - Creditor bought fuel on credit
   - This shows how much they still owe

2. **Payment = Reduce Outstanding**
   - When creditor pays, outstanding goes down
   - Available credit goes up

3. **Credit Limit = Max Credit**
   - Once they owe credit limit, no more credit
   - Must pay to get more available credit

4. **Reference Number = Audit Trail**
   - Record check/bank transfer reference
   - Helpful for reconciliation

---

## Summary: Quick Steps to Enter Creditor Payment

```
1. Owner Dashboard
        ↓
2. Click Station Name
        ↓
3. Click "Creditors" Tab
        ↓
4. Find Creditor Card
        ↓
5. Click "Settle" / "Pay" Button
        ↓
6. Enter Amount
        ↓
7. Click "Settle"
        ↓
8. Done! Balance Updates
```

Currently, this is the **ONLY place in the UI** where creditor payments can be recorded.
