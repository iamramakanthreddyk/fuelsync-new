# Expense Approval Workflow - Visual Guide

## The Two-Path System

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECORDING AN EXPENSE                         │
│                     (Anyone can do this)                         │
│                                                                  │
│  • Category (Cleaning, Supplies, Salary, Rent, etc.)           │
│  • Description (What was bought/paid)                           │
│  • Amount (₹)                                                   │
│  • Date                                                         │
│  • Frequency (One-time / Daily / Weekly / Monthly)             │
│  • Payment method (Cash / Online / Card)                        │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
                   [System checks role]
                           │
                ┌──────────┴──────────┐
                │                     │
                ↓                     ↓
        ┌─────────────┐       ┌──────────────┐
        │  MANAGER    │       │  EMPLOYEE    │
        │  /OWNER     │       │  /STAFF      │
        │             │       │              │
        │ Own Entry   │       │ Their Entry  │
        └──────┬──────┘       └───────┬──────┘
               │                      │
               │ INSTANT ⚡            │ WAITING ⏳
               │                      │
               ↓                      ↓
        ┌─────────────┐       ┌──────────────┐
        │AUTO_APPROVED│       │   PENDING    │
        │             │       │              │
        │✅ Counted   │       │❌ Not Counted│
        │in reports   │       │in reports yet│
        └──────┬──────┘       └───────┬──────┘
               │                      │
               │                      │ [Manager reviews
               │                      │  at next check]
               │                      │
               │                      ↓
               │              ┌──────────────┐
               │              │  Review Form │
               │              │              │
               │              │ ✅ Approve   │
               │              │ ❌ Reject    │
               │              │              │
               │              └───┬──────┬───┘
               │                  │      │
               │         APPROVED │      │ REJECTED
               │                  │      │
               ↓                  ↓      ↓
        ┌─────────────┐  ┌──────────────┐  ┌────────────┐
        │  APPROVED   │  │  APPROVED    │  │  REJECTED  │
        │             │  │              │  │            │
        │✅ Counted   │  │✅ Counted    │  │❌ Not Count│
        │in reports   │  │in reports    │  │in reports  │
        └─────────────┘  └──────────────┘  └────────────┘
               │                │                 │
               └────────────────┴────────────────┘
                                │
                                ↓
                        FINANCIAL REPORTS
                        (Only approved counted)
```

---

## The Approval Process - Detailed View

```
┌─────────────────────────────────────────────────────────────────┐
│              MANAGER'S APPROVAL DASHBOARD                        │
│                  (Expenses Page)                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────┴────────────┐
                    │                        │
                    ↓                        ↓
            ┌──────────────┐      ┌─────────────────┐
            │  See Pending │      │  Summary Cards  │
            │ Approvals (1)│      │                 │
            │              │      │ ✅ Approved:    │
            │ ₹1,700       │      │    ₹50,000      │
            │ Description  │      │                 │
            │ Category     │      │ ⏳ Pending:     │
            │ Entered By   │      │    ₹1,700       │
            └──────┬───────┘      └────────┬────────┘
                   │                       │
                   │ [Review Info]         │
                   │                       │
                   ↓                       │
        ┌──────────────────┐              │
        │ Choose Approval  │              │
        │ Method           │              │
        └────┬─────┬─────┬─┘              │
             │     │     │                │
        A    │ B   │ C   │                │
        ↓    ↓     ↓     ↓                │
    ┌──────────────────────────────┐     │
    │ A: Manual (1-by-1)            │     │
    │    Click ✅ Approve            │     │
    │                                │     │
    │ B: Safe Auto-Approve           │     │
    │    Auto-approves ≤₹10k         │     │
    │    + common categories         │     │
    │                                │     │
    │ C: Approve All                 │     │
    │    (⚠️ with confirmation!)     │     │
    │                                │     │
    └──────────┬─────────────────────┘     │
               ↓                            │
        ✅ APPROVED!                       │
                                           │
               Now appears in              │
               "Approved Total"            │
               ✅ ₹51,700                  │
```

---

## Real-World Example Timeline

```
MARCH 10, 2026 - 3:00 PM
┌─────────────────────────────────────────────────────────────────┐
│ STAFF MEMBER (Pumps Attendant) Records Expense                  │
├─────────────────────────────────────────────────────────────────┤
│ Expense: Cleaning supplies                                       │
│ Amount: ₹1,700                                                   │
│ Category: Supplies                                               │
│ Date: March 10, 2026                                             │
│ Payment: Cash                                                    │
│                                                                  │
│ ⚠️ System: "You're entering as EMPLOYEE"                        │
│ ⚠️ System: "This will be PENDING until manager approves"        │
│                                                                  │
│ Click: Record Expense                                            │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                    ✅ Expense Created!

PENDING EXPENSES LIST:
  1. ₹1,700 - Cleaning supplies - Pumps attendant - PENDING


MARCH 11, 2026 - 9:00 AM
┌─────────────────────────────────────────────────────────────────┐
│ MANAGER Logs Into FuelSync                                       │
├─────────────────────────────────────────────────────────────────┤
│ Sees: "Pending Approvals (1)  —  ⏳ Awaiting Review"            │
│       ₹1,700 - Cleaning supplies - Pumps attendant             │
│                                                                  │
│ Options:                                                         │
│ • ✅ Approve (individual)                                       │
│ • ❌ Reject (individual)                                        │
│ • 🚀 Safe Auto-Approve (bulk)                                   │
│ • ⚠️  Approve All (bulk - careful!)                             │
│                                                                  │
│ Manager chooses: "Safe Auto-Approve"                            │
│ (₹1,700 is under ₹10k limit = safe)                            │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                    ✅ Auto-Approved!

APPROVED EXPENSES:
  ✅ Previous: ₹50,000
  ✅ New: ₹1,700
  ═══════════════════════
  ✅ TOTAL: ₹51,700


MARCH 11, 2026 - 9:01 AM
┌─────────────────────────────────────────────────────────────────┐
│ FINANCIAL REPORTS UPDATED                                        │
├─────────────────────────────────────────────────────────────────┤
│ Profit & Loss for March 2026:                                    │
│                                                                  │
│ Revenue (Fuel Sales):        ₹200,000                           │
│ Cost of Goods:               -₹120,000                          │
│ Approved Expenses:           -₹51,700  ← NOW INCLUDES ₹1,700   │
│ ────────────────────────────────────────                        │
│ NET PROFIT:                  ₹28,300                            │
│                                                                  │
│ Note: Pending expenses (if any) not included until approved    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Status Color Key

```
🟢 GREEN: APPROVED / AUTO_APPROVED
   ✅ Counted in reports
   ✅ Final status
   ✅ Locked in

🟡 YELLOW: PENDING
   ⏳ Waiting for review
   ❌ Not counted yet
   ⏳ Pending manager approval

🔴 RED: REJECTED
   ❌ Not counted
   ✖️  Final rejection
   ❌ Removed from calculations
```

---

## Permission Matrix

```
┌─────────────────────┬──────────┬──────────┬────────────┐
│ Action              │ Employee │ Manager  │ Owner      │
├─────────────────────┼──────────┼──────────┼────────────┤
│ CREATE EXPENSE      │ ✅       │ ✅       │ ✅         │
│ Status When Created │ PENDING  │ AUTO_APP │ AUTO_APP   │
├─────────────────────┼──────────┼──────────┼────────────┤
│ APPROVE INDIVIDUAL  │ ❌       │ ✅       │ ✅         │
│ BULK APPROVE        │ ❌       │ ✅       │ ✅         │
│ REJECT EXPENSE      │ ❌       │ ✅       │ ✅         │
├─────────────────────┼──────────┼──────────┼────────────┤
│ EDIT/DELETE         │ ❌*      │ ✅       │ ✅         │
│ VIEW OWN EXPENSES   │ ✅       │ ✅       │ ✅         │
│ VIEW ALL EXPENSES   │ ❌       │ ✅       │ ✅         │
└─────────────────────┴──────────┴──────────┴────────────┘

* Employees can't edit, but can resubmit if rejected
```

---

## Quick Decision Tree

```
I just created an expense.
What's its status?

         │
    Is your role:
         │
    ┌────┴────┐
    │          │
 MANAGER    EMPLOYEE
    │          │
    ↓          ↓
AUTO_APP   PENDING
    │          │
    ↓          ↓
Counted   NOT Counted
immediately  (yet)
    │          │
    ↓          ↓
  DONE!    Wait for
           manager
               │
               ↓
          Manager
          reviews
               │
             ↙ ↘
         APPROVE REJECT
             │      │
             ↓      ↓
         Counted Resubmit
         in      with
         reports corrections


Can I edit a pending expense?
         │
        NO
        │
   Ask manager to REJECT it
        │
   Then resubmit with corrections
```

---

## Bulk Approval Smart Filtering

```
BULK APPROVE: "SAFE" MODE

Looking at pending expenses:

1. ₹800 - Cleaning supplies
   ↓ Amount ≤ ₹10,000? YES
   ↓ Category = Cleaning? YES
   → ✅ APPROVED

2. ₹2,500 - Supplies
   ↓ Amount ≤ ₹10,000? YES  
   ↓ Category = Supplies? YES
   → ✅ APPROVED

3. ₹15,000 - Equipment
   ↓ Amount ≤ ₹10,000? NO
   ↓ Category ≠ Safe? YES
   → ⚠️  SKIPPED (manual review needed)

4. ₹5,000 - Maintenance
   ↓ Amount ≤ ₹10,000? YES
   ↓ Category = Maintenance? YES
   → ✅ APPROVED

5. ₹50,000 - Salary
   ↓ Amount ≤ ₹10,000? NO
   ↓ Category ≠ Safe? YES (SALARY)
   → ⚠️  SKIPPED (manual review needed)

RESULTS:
├─ Approved: 3 (₹800 + ₹2,500 + ₹5,000 = ₹8,300)
├─ Skipped: 2 (₹15,000 + ₹50,000 = ₹65,000)
└─ Review skipped items manually
```

---

## Workflow Comparison: Before vs After

### BEFORE (Broken System)
```
Employee tries to record expense
        ↓
❌ Route blocks them!
"Insufficient permissions"
        ↓
Employee cannot contribute
"""
        
Manager records expense
        ↓
✅ Auto-approved
        ↓
But unclear workflow...
```

### AFTER (Fixed System)
```
Employee records expense
        ↓
✅ Accepted! Goes to PENDING
        ↓
Manager sees it in "Pending Approvals"
        ↓
Manager chooses:
• Manual approve (review first)
• Safe bulk approve (auto low-risk)
• Approve all (if confident)
        ↓
✅ Clear workflow, full transparency
✅ Audit trail recorded
✅ Reports accurate
```

---

## FAQs at a Glance

| Q | A |
|---|---|
| **Why is my expense pending?** | You're not a manager. Staff entries need review. |
| **Can I edit my pending expense?** | No, but manager can reject it. Then resubmit. |
| **How long until approval?** | Usually < 24 hours. Check daily. |
| **What if I bulk-approve wrong items?** | Approvals are final. Be careful. Review first. |
| **Can I see who approved my expense?** | Yes, approval info is logged with timestamp. |
| **Do pending expenses count in profit/loss?** | No, only approved expenses count. |
| **Can I reject my own expense?** | No, only managers can reject. |
| **What's Safe Auto-Approve?** | Smart filtering for low-risk items. |

---

**Last Updated:** March 11, 2026  
**Visual Guide v2.0** - Complete & Ready
