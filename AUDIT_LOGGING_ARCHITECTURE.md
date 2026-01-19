# Audit Logging System Architecture

## 🔄 Login Flow with Session Limiting

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER LOGIN REQUEST                           │
│              POST /api/v1/auth/login                             │
│         { email, password }                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │  Verify Email & Password     │
            │  (bcryptjs comparison)       │
            └──────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
           Invalid              Valid
              │                    │
              ▼                    ▼
     ┌─────────────────┐   ┌──────────────────┐
     │ Log FAILED      │   │ Check Session    │
     │ LOGIN attempt   │   │ Limit            │
     │ severity:       │   │                  │
     │ warning         │   │ GET active login │
     │                 │   │ count in past N  │
     └────────┬────────┘   │ minutes          │
              │            └────────┬─────────┘
              │                     │
              │            ┌────────┴─────────┐
              │            │                  │
              │       Within Limit      Exceeded
              │            │                  │
              │            ▼                  ▼
              │    ┌──────────────────┐  ┌──────────────┐
              │    │ Create JWT       │  │ Return 429   │
              │    │ Generate token   │  │ Too Many     │
              │    │                  │  │ Requests     │
              │    └────────┬─────────┘  │              │
              │             │            │ Log CRITICAL │
              │             │            │ severity     │
              │             │            │ event        │
              │             │            └──────┬───────┘
              │             │                   │
              │             ▼                   │
              │    ┌──────────────────┐         │
              │    │ Log SUCCESS      │         │
              │    │ LOGIN action     │         │
              │    │ category: auth   │         │
              │    │ severity: info   │         │
              │    │ IP: extracted    │         │
              │    │ UserAgent: set   │         │
              │    └────────┬─────────┘         │
              │             │                   │
              │             ▼                   ▼
              │    ┌──────────────────┐  ┌──────────────┐
              │    │ Return 200 OK    │  │ Return 429   │
              │    │ { token, user }  │  │ { error }    │
              │    └──────────────────┘  └──────────────┘
              │             ▲                   ▲
              └─────────────┘                   │
                            └───────────────────┘
                        AuditLog.create()
                      (immutable record)
```

---

## 📊 Data Flow: CREATE Operation Logging

```
┌──────────────────────────────────┐
│   Controller Action              │
│   e.g., createExpense()          │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ 1. Perform Operation             │
│    expense = await               │
│    Expense.create({...})         │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ 2. Capture Old/New Values        │
│    newValues = {                 │
│      id: expense.id,             │
│      amount: expense.amount,     │
│      category: expense.category  │
│    }                             │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ 3. Call logAudit()               │
│    await logAudit({              │
│      userId,                     │
│      stationId,                  │
│      action: 'CREATE',           │
│      entityType: 'Expense',      │
│      entityId: expense.id,       │
│      newValues: {...},           │
│      category: 'finance',        │
│      severity: 'info'            │
│    })                            │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ 4. Insert into AuditLog          │
│    (Sequelize create)            │
│    INSERT INTO audit_logs        │
│    (userId, stationId, action,   │
│     entityType, entityId,        │
│     newValues, category,         │
│     severity, createdAt)         │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ 5. Return Response               │
│    res.status(201).json({        │
│      success: true,              │
│      data: expense               │
│    })                            │
└──────────────────────────────────┘
```

---

## 🔍 Session Limiting Logic

```
LOGIN ATTEMPT #1
│
├─ User: john_doe
├─ Time: 14:00
│
└─ AuditLog.count({
      where: {
        userId: john_doe,
        action: 'LOGIN',
        createdAt >= (14:00 - 60min)
      }
    })
   └─ Result: 0 logins in past 60 min
      Action: ALLOW LOGIN ✓
      New count: 1


LOGIN ATTEMPT #2 (same user, 14:15)
│
├─ User: john_doe
├─ Time: 14:15
│
└─ AuditLog.count({
      where: {
        userId: john_doe,
        action: 'LOGIN',
        createdAt >= (14:15 - 60min)
      }
    })
   └─ Result: 1 login in past 60 min
      Action: ALLOW LOGIN ✓
      New count: 2


LOGIN ATTEMPT #3 (same user, 14:30)
│
├─ User: john_doe
├─ Time: 14:30
│
└─ AuditLog.count({
      where: {
        userId: john_doe,
        action: 'LOGIN',
        createdAt >= (14:30 - 60min)
      }
    })
   └─ Result: 2 logins in past 60 min
      Action: ALLOW LOGIN ✓
      New count: 3


LOGIN ATTEMPT #4 (same user, 14:45)
│
├─ User: john_doe
├─ Time: 14:45
│
└─ AuditLog.count({
      where: {
        userId: john_doe,
        action: 'LOGIN',
        createdAt >= (14:45 - 60min)
      }
    })
   └─ Result: 3 logins in past 60 min (14:00, 14:15, 14:30)
      Count (3) >= Limit (3)
      Action: BLOCK LOGIN ✗
      Response: 429 Too Many Requests
      Log: CRITICAL severity event
```

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   CONTROLLER LAYER                      │
│  ┌──────────┬──────────┬──────────┬───────────────┐    │
│  │ auth     │ station  │ credit   │ expense  ...  │    │
│  │ Controller│Controller│Controller│ Controller    │    │
│  └──────────┴──────────┴──────────┴───────────────┘    │
│                        │                                │
│                        │ imports                        │
│                        ▼                                │
├────────────────────────────────────────────────────────┤
│                   UTILITY LAYER                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ backend/src/utils/auditLog.js                   │   │
│  │                                                  │   │
│  │ logAudit() ─────────────────────────────────┐   │   │
│  │ getActiveSessionCount()               ┐     │   │   │
│  │ getLoginHistory()                     │     │   │   │
│  │ checkConcurrentLoginLimit() ◄─────────┘     │   │   │
│  │                                             │   │   │
│  └──────────────────────────────────────┬──────┘   │   │
│                                          │          │   │
│                                          │ uses     │   │
└────────────────────────────────────────────────────┤──┘
                                          │
                ┌─────────────────────────┴─────────────────┐
                │                                           │
                ▼                                           ▼
    ┌──────────────────────┐               ┌──────────────────────┐
    │   ORM: Sequelize     │               │  Database: PostgreSQL │
    │                      │               │     (or SQLite dev)    │
    │  AuditLog.create()   │               │                        │
    │  AuditLog.findAll()  │               │  Table: audit_logs     │
    │  AuditLog.count()    │               │                        │
    └──────────────────────┘               └──────────────────────┘
```

---

## 📝 Audit Log Entry Structure

```
┌─────────────────────────────────────────┐
│        AUDIT LOG ENTRY                  │
├─────────────────────────────────────────┤
│                                         │
│  WHO DID IT:                            │
│  ├─ userId: "uuid-of-user"              │
│  ├─ userEmail: "user@example.com"       │
│  └─ userRole: "manager"                 │
│                                         │
│  WHERE/WHAT CONTEXT:                    │
│  ├─ stationId: "uuid-of-station"        │
│  ├─ action: "CREATE" | "UPDATE"         │
│  ├─ entityType: "Expense"               │
│  └─ entityId: "uuid-of-entity"          │
│                                         │
│  WHAT CHANGED:                          │
│  ├─ oldValues: { name: "...", ... }     │
│  ├─ newValues: { amount: "...", ... }   │
│  └─ description: "Created expense: ..." │
│                                         │
│  HOW IT WENT:                           │
│  ├─ success: true | false               │
│  ├─ errorMessage: "if failed"           │
│  ├─ category: "finance"                 │
│  └─ severity: "info" | "warning"        │
│                                         │
│  WHEN:                                  │
│  └─ createdAt: "2024-01-15 14:30:45"    │
│                                         │
│  HOW (SECURITY):                        │
│  ├─ ipAddress: "192.168.1.100"          │
│  └─ userAgent: "Mozilla/5.0 ..."        │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔗 Multi-Controller Flow

```
API CLIENT REQUEST
│
├─► authController.login()
│   ├─ Validate credentials
│   ├─ checkConcurrentLoginLimit()
│   ├─ logAudit() → AuditLog
│   └─ Return JWT + User
│
├─► stationController.createStation()
│   ├─ Create Station record
│   ├─ logAudit() → AuditLog
│   └─ Return Station
│
├─► creditController.recordCreditSale()
│   ├─ Create CreditTransaction
│   ├─ Update Creditor balance
│   ├─ logAudit() → AuditLog (2x)
│   └─ Return Transaction
│
├─► expenseController.createExpense()
│   ├─ Create Expense record
│   ├─ logAudit() → AuditLog
│   └─ Return Expense
│
├─► tankController.recordRefill()
│   ├─ Create TankRefill record
│   ├─ Update Tank level
│   ├─ logAudit() → AuditLog
│   └─ Return Refill
│
├─► readingController.createReading()
│   ├─ Create NozzleReading record
│   ├─ logAudit() → AuditLog
│   └─ Return Reading
│
├─► shiftController.startShift()
│   ├─ Create Shift record
│   ├─ logAudit() → AuditLog
│   └─ Return Shift
│
├─► userController.createUser()
│   ├─ Create User record
│   ├─ logAudit() → AuditLog
│   └─ Return User
│
└─► transactionController.createTransaction()
    ├─ Create DailyTransaction
    ├─ logAudit() → AuditLog
    └─ Return Transaction

                    ALL PARALLEL
                        │
                        ▼
              AuditLog (immutable)
         9 controllers, 45+ operations
         Complete audit trail maintained
```

---

## 🔒 Security Event Logging

```
┌──────────────────────────────────────┐
│     SECURITY CRITICAL EVENTS         │
└──────────────────────────────────────┘

1. FAILED LOGIN ATTEMPT
   ├─ Severity: WARNING
   ├─ Category: auth
   ├─ Logged: email, IP, time
   └─ Alert: Multiple failures in X mins

2. CONCURRENT LOGIN LIMIT EXCEEDED
   ├─ Severity: CRITICAL
   ├─ Category: auth
   ├─ Logged: userId, count, limit
   └─ Alert: User exceeded max sessions

3. UNAUTHORIZED ACCESS ATTEMPT
   ├─ Severity: WARNING
   ├─ Category: auth
   ├─ Logged: userId, resource, reason
   └─ Alert: Potential breach attempt

4. USER DEACTIVATION
   ├─ Severity: WARNING
   ├─ Category: data
   ├─ Logged: who deactivated, when, who was deactivated
   └─ Alert: Access revocation event

5. EXPENSE DELETION
   ├─ Severity: WARNING
   ├─ Category: finance
   ├─ Logged: amount, who deleted, old values
   └─ Alert: Financial record deletion

6. CREDITOR LIMIT EXCEEDED
   ├─ Severity: WARNING
   ├─ Category: finance
   ├─ Logged: creditor, amount, limit
   └─ Alert: Credit limit breach attempt
```

---

## 📈 Query Patterns

```
┌─────────────────────────────────────────────────────┐
│  COMMON AUDIT LOG QUERIES                           │
└─────────────────────────────────────────────────────┘

QUERY 1: User Activity Timeline
  SELECT * FROM audit_logs
  WHERE userId = 'user-uuid'
  ORDER BY createdAt DESC
  LIMIT 100
  │
  └─ Result: User's action history (last 100 actions)

QUERY 2: Station Audit Trail
  SELECT * FROM audit_logs
  WHERE stationId = 'station-uuid'
  AND createdAt >= '2024-01-01'
  ORDER BY createdAt DESC
  │
  └─ Result: All operations on station since date

QUERY 3: Failed Logins (Last 24 Hours)
  SELECT * FROM audit_logs
  WHERE action = 'LOGIN'
  AND success = false
  AND createdAt >= NOW() - INTERVAL '24 hours'
  ORDER BY createdAt DESC
  │
  └─ Result: Failed login attempts in last 24h

QUERY 4: Critical Events (Last 7 Days)
  SELECT * FROM audit_logs
  WHERE severity = 'critical'
  AND createdAt >= NOW() - INTERVAL '7 days'
  ORDER BY createdAt DESC
  │
  └─ Result: All critical severity events

QUERY 5: Financial Operations (By User)
  SELECT * FROM audit_logs
  WHERE category = 'finance'
  AND userId = 'user-uuid'
  ORDER BY createdAt DESC
  │
  └─ Result: All money-related operations

QUERY 6: Concurrent Login Count
  SELECT COUNT(*) as active_sessions
  FROM audit_logs
  WHERE userId = 'user-uuid'
  AND action = 'LOGIN'
  AND createdAt >= NOW() - INTERVAL '60 minutes'
  │
  └─ Result: Current active session count
```

---

## ✅ Status Legend

```
✅ COMPLETE   - Fully implemented and tested
⏳ PENDING    - Scheduled for next session
🔧 MAINTENANCE - Performance/optimization
📋 OPTIONAL  - Enhancement, not critical
```

---

**Last Updated:** Current Session  
**Architecture Version:** 1.0  
**Status:** ✅ PRODUCTION READY
