# Expense Approval Workflow — Complete Guide

## Overview
FuelSync has a two-tier expense approval system to balance transparency with control:
- **Staff** can submit expenses for review
- **Managers** can instantly approve their own entries or review staff submissions
- **Owners** have full oversight and can bulk-approve a batch of expenses

---

## Who Can Do What?

### Anyone (Employee/Staff)
✅ **Create Expenses**
- Submit daily, weekly, or monthly expenses
- Entry status: **PENDING** (waiting for manager approval)
- Examples: Supplies, maintenance, repairs entered by team members

### Managers / Owners / Super Admin
✅ **Create Expenses** (Auto-approved instantly)
- Entry status: **AUTO_APPROVED** (immediately counted in reports)
- No waiting period required
- Counts toward approved expenses immediately

✅ **Approve Individual Expenses**
- Review individual pending expenses one-by-one
- Click **Approve** → moves to approved
- Click **Reject** → moves to rejected

✅ **Bulk Approve Expenses**
- **Safe Mode**: Auto-approves low-risk expenses (₹0-10k or common categories)
- **Approve All**: Manually approve every pending expense

✅ **View Expense History**
- See all expenses with approval status and who entered them
- Filter by date, category, frequency

---

## Expense Status Lifecycle

```
PENDING EXPENSES (Staff Entry)
         ↓
    [Manager Reviews]
         ↙     ↘
    APPROVED   REJECTED
      (✅)       (❌)
```

### Status Definitions

| Status | Who | Created By | Counts in Reports | Next Action |
|--------|-----|-----------|-------------------|-------------|
| **pending** | Staff/Employees | Anyone | ❌ No | Needs manager approval |
| **auto_approved** | Managers/Owners | Manager/Owner/Super Admin | ✅ Yes | Done (auto-approval) |
| **approved** | Manually entered | Manager/Owner/Super Admin | ✅ Yes | Done (manual approval) |
| **rejected** | Rejected by manager | Manager/Owner/Super Admin | ❌ No | Cannot be used |

---

## Step-by-Step: Recording an Expense

### For Team Members (Staff)

1. **Go to** Expenses page
2. **Click** "Add Expense"
3. **Fill in:**
   - Category (Cleaning, Supplies, Salary, Rent, etc.)
   - Description (e.g., "Detergent and wipes")
   - Amount (₹)
   - Date
   - Payment method (Cash/Online/Card)
   - Frequency (One-time / Daily / Weekly / Monthly)
   - Receipt number (optional)
   - Tags (optional)

4. **Click** "Record Expense"
5. **Status:** Goes to **PENDING** 
   - ⏳ Awaiting manager approval
   - Shows in "Pending Approvals" section
   - Not counted in Approved Total yet

### For Managers

1. **Go to** Expenses page
2. **Look for** "Pending Approvals" section at top
3. **Review each expense:**
   - Amount, Date, Category, Who entered it
   - Click **Approve** ✅ → Approved
   - Click **Reject** ❌ → Rejected

Or **Bulk Approve:**
- Click **"Safe Auto-Approve"** → Approves ≤₹10,000 + common items
- Click **"Approve All"** → Approves every pending expense (⚠️ Careful!)

---

## Example: Real-World Scenario

### Scenario: ₹1,700 Pending Expense

**Initial State:**
- Retail Outlet 1 has 1 pending expense: ₹1,700
- Entered by: Pumps attendant (role: employee)
- Description: "Weekly cleaning supplies purchase"

**Why Pending?**
- Employee can record expenses, but they need manager confirmation
- Prevents accidental or inflated entries
- Gives you control over spending

**To Process:**

**Option A: Individual Approval**
1. Manager logs in → Expenses page
2. See "Pending Approvals (1)"
3. Review the expense
4. Click ✅ **Approve**
5. Result: Moves to "Approved Total", counts in reports

**Option B: Bulk Approve**
1. Manager logs in → Expenses page
2. See "Pending Approvals (1)"
3. Click **"Safe Auto-Approve"** (it's ₹1,700, under ₹10k limit)
4. Result: Automatically approved

---

## Approval Rules

### Auto-Approval (Managers/Owners)
When a **manager, owner, or super admin** creates an expense:
- ✅ Automatically approved
- ✅ Counted in Approved Total immediately
- ✅ No waiting period
- **Reason:** Managers are responsible for accuracy

### Pending Approval (Employees)
When an **employee** creates an expense:
- ⏳ Requires manager confirmation
- ❌ Not counted in Approved Total yet
- ⏳ Appears in "Pending Approvals"
- **Reason:** Extra validation layer for cost control

### Safe Bulk Approve Rules
When using **"Safe Auto-Approve"**:
✅ **Will Approve:**
- Cleaning items
- Supplies
- Maintenance & repairs
- Amounts ≤ ₹10,000

⚠️ **Will Skip (need manual review):**
- Salary payments
- Equipment purchases
- Loan EMI payments
- High-value items (> ₹10,000)

---

## Financial Reporting

### What's Counted?
**Approved Total** (in reports):
- ✅ `auto_approved` expenses (from managers)
- ✅ `approved` expenses (manually approved)
- ❌ `pending` expenses (waiting for review)
- ❌ `rejected` expenses (not used)

### Example Calculation
```
Approved Expenses:  ₹50,000
Pending Expenses:    ₹1,700
───────────────────────────
Reported Expenses:  ₹50,000
(Pending NOT included in profit/loss yet)
```

---

## Tips for Smooth Approval Flow

### For Managers
1. **Check Daily** - Keep pending list clear
2. **Use Safe Bulk Approve** - For routine small items
3. **Review Manually** - For large or unusual expenses
4. **Keep Audit Trail** - Every approval is logged

### For Team Members
1. **Be Accurate** - Double-check amounts and descriptions
2. **Provide Details** - Add notes or receipt numbers
3. **Be Patient** - Manager will approve within 24 hours typically
4. **Use Tags** - Help manager find related expenses

---

## Common Questions

### Q: Why is my expense pending?
**A:** You're not a manager. Staff entries need manager approval before they count.

### Q: Can I edit a pending expense?
**A:** No, manager must approve or reject first. Contact your manager to reject, then submit amended version.

### Q: Why are manager entries auto-approved?
**A:** Managers are accountable, so their entries are trusted immediately. Higher oversight layer.

### Q: Can I reject an expense?
**A:** Only if you're a manager/owner. Click "Reject" next to the pending expense.

### Q: What if I bulk-approve wrong expenses?
**A:** Rejected expenses can't be undone. Review carefully. For critical issues, contact owner.

### Q: Where do old expenses go?
**A:** Approvals are permanent and logged. History is always visible in "All Expenses" table.

---

## Audit & Compliance

All expense actions are logged:
- ✅ Who created the expense
- ✅ When it was approved/rejected
- ✅ Who approved it
- ✅ Date and time of action

This creates a complete audit trail for financial compliance.

---

## Technical Details (For Developers)

### Backend Endpoints

**Get Expenses** (with approval status filter)
```
GET /api/v1/stations/:stationId/expenses?approvalStatus=pending
```

**Create Expense** (auto-detects role for approval)
```
POST /api/v1/stations/:stationId/expenses
← Sets approvalStatus: 'pending' (employee) or 'auto_approved' (manager)
```

**Approve Individual**
```
PATCH /api/v1/expenses/:id/approve
{ action: 'approve' | 'reject' }
```

**Bulk Approve**
```
PATCH /api/v1/stations/:stationId/expenses/bulk-approve
{ approvalMode: 'safe' | 'all' }
```

### Database Schema
- `approval_status`: pending | approved | auto_approved | rejected
- `approved_by`: User ID who approved
- `approved_at`: Timestamp of approval

---

## Next Steps

1. **For Owners:** Check "Pending Approvals" regularly to keep expenses flowing
2. **For Managers:** Use "Safe Auto-Approve" for routine items
3. **For Staff:** Record expenses + wait for manager approval
4. **For Finance:** Review "Approved Expenses" in reports (pending not included)

---

**Last Updated:** March 2026
**Status:** Active ✅
**Version:** 2.0 (Complete approval workflow)
