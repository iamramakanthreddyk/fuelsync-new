# Audit Logging Quick Reference

## 🎯 Quick Start: Adding Audit Logging to a New Controller

### Step 1: Import the utility
```javascript
const { logAudit } = require('../utils/auditLog');
```

### Step 2: Log CREATE operations
```javascript
const newEntity = await Entity.create({...});

await logAudit({
  userId: req.user.id,
  userEmail: req.user.email,
  userRole: req.user.role,
  stationId: req.params.stationId,
  action: 'CREATE',
  entityType: 'Entity',
  entityId: newEntity.id,
  newValues: {
    id: newEntity.id,
    name: newEntity.name,
    value: newEntity.value
  },
  category: 'data',  // or 'finance', 'auth', 'system'
  severity: 'info',
  description: `Created entity: ${newEntity.name}`
});
```

### Step 3: Log UPDATE operations
```javascript
const oldValues = entity.toJSON();

// Make changes
entity.name = updates.name;
await entity.save();

const newValues = {
  name: updates.name,
  // Only include changed fields
};

await logAudit({
  userId: req.user.id,
  userEmail: req.user.email,
  userRole: req.user.role,
  stationId: entity.stationId,
  action: 'UPDATE',
  entityType: 'Entity',
  entityId: entity.id,
  oldValues: oldValues,
  newValues: newValues,
  category: 'data',
  severity: 'info',
  description: `Updated entity: ${entity.name}`
});
```

### Step 4: Log DELETE operations
```javascript
const entityData = entity.toJSON();
await entity.destroy();

await logAudit({
  userId: req.user.id,
  userEmail: req.user.email,
  userRole: req.user.role,
  stationId: entity.stationId,
  action: 'DELETE',
  entityType: 'Entity',
  entityId: entity.id,
  oldValues: entityData,
  category: 'data',
  severity: 'warning',  // Note: use 'warning' for deletions
  description: `Deleted entity: ${entityData.name}`
});
```

---

## 📊 Session Limiting Helper Functions

### Check if user has hit concurrent login limit
```javascript
const LIMITED = require('../utils/auditLog').checkConcurrentLoginLimit;

const limitExceeded = await LIMIT(
  userId,
  parseInt(process.env.MAX_CONCURRENT_LOGINS || '3'),
  parseInt(process.env.LOGIN_TIME_WINDOW_MINUTES || '60')
);

if (limitExceeded) {
  return res.status(429).json({
    success: false,
    error: 'Too many concurrent logins. Maximum 3 sessions allowed.'
  });
}
```

### Get user's active sessions count
```javascript
const { getActiveSessionCount } = require('../utils/auditLog');

const activeCount = await getActiveSessionCount(userId, 1); // Last 1 hour
console.log(`User has ${activeCount} active sessions`);
```

### Get user's login history
```javascript
const { getLoginHistory } = require('../utils/auditLog');

const history = await getLoginHistory(userId, 20); // Last 20 logins
history.forEach(login => {
  console.log(`${login.createdAt}: ${login.ipAddress}`);
});
```

---

## 🏷️ Category Reference

| Category | Use Cases | Severity |
|----------|-----------|----------|
| **auth** | LOGIN, LOGOUT, CHANGE_PASSWORD, FAILED_LOGIN | info, warning, critical |
| **data** | CREATE/UPDATE/DELETE for entities (stations, users, tanks) | info, warning |
| **finance** | CREATE/UPDATE for transactions, expenses, refills, settlements | info, warning |
| **system** | Configuration changes, maintenance, migrations | info, critical |

---

## ⚠️ Severity Reference

| Level | Color | Use Cases |
|-------|-------|-----------|
| **info** | 🟢 | Successful operations, normal activities |
| **warning** | 🟡 | Failed attempts, deletions, limit exceeded (soft) |
| **critical** | 🔴 | Concurrent login exceeded, security events, system errors |

---

## 🔍 Querying Audit Logs

### Get all actions by a user
```javascript
const AuditLog = require('../models').AuditLog;

const userActions = await AuditLog.findAll({
  where: { userId: userId },
  order: [['createdAt', 'DESC']],
  limit: 100
});
```

### Get all operations on a station
```javascript
const stationOps = await AuditLog.findAll({
  where: { stationId: stationId },
  order: [['createdAt', 'DESC']]
});
```

### Get failed login attempts
```javascript
const failedLogins = await AuditLog.findAll({
  where: {
    action: 'LOGIN',
    success: false
  },
  order: [['createdAt', 'DESC']],
  limit: 50
});
```

### Get operations in a date range
```javascript
const { Op } = require('sequelize');

const ops = await AuditLog.findAll({
  where: {
    createdAt: {
      [Op.between]: ['2024-01-01', '2024-01-31']
    }
  }
});
```

### Get critical severity events
```javascript
const criticalEvents = await AuditLog.findAll({
  where: { severity: 'critical' },
  order: [['createdAt', 'DESC']]
});
```

---

## 💡 Common Patterns

### Pattern 1: Capture changed fields only (UPDATE)
```javascript
const oldValues = entity.toJSON();
const newValues = {};

// Only capture what changed
if (updates.name !== undefined) {
  entity.name = updates.name;
  newValues.name = updates.name;
}

if (updates.status !== undefined) {
  entity.status = updates.status;
  newValues.status = updates.status;
}

await entity.save();

// Log with only changed fields
await logAudit({
  // ... other params ...
  oldValues: oldValues,
  newValues: newValues  // Only {name: ..., status: ...}
});
```

### Pattern 2: Non-blocking audit logging
```javascript
try {
  // Main operation
  const user = await User.create({...});
  
  // Non-blocking audit
  logAudit({...}).catch(err => {
    console.warn('Audit log failed (non-critical):', err);
  });
  
  res.json({success: true, data: user});
} catch (error) {
  // Audit failure doesn't affect main operation
  res.status(500).json({success: false, error: error.message});
}
```

### Pattern 3: Multi-operation logging (transaction)
```javascript
const t = await sequelize.transaction();

try {
  // Multiple operations
  const creditor = await Creditor.create({...}, {transaction: t});
  const sale = await CreditTransaction.create({...}, {transaction: t});
  
  // Log both
  await logAudit({
    action: 'CREATE',
    entityType: 'Creditor',
    entityId: creditor.id,
    // ...
  });
  
  await logAudit({
    action: 'CREATE',
    entityType: 'CreditTransaction',
    entityId: sale.id,
    // ...
  });
  
  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

### Pattern 4: Error logging
```javascript
try {
  await riskyOperation();
  
  await logAudit({
    action: 'OPERATION',
    success: true,
    // ...
  });
} catch (error) {
  await logAudit({
    action: 'OPERATION',
    success: false,
    errorMessage: error.message,
    severity: 'warning'
  });
  
  throw error;
}
```

---

## 🔐 Session Limiting Environment Setup

### Configure in .env
```bash
# Maximum concurrent sessions per user
MAX_CONCURRENT_LOGINS=3

# Time window for counting sessions (minutes)
LOGIN_TIME_WINDOW_MINUTES=60
```

### How it works
1. User logs in → LOGIN audit entry created
2. `checkConcurrentLoginLimit()` counts LOGIN entries in past N minutes
3. If count >= MAX_CONCURRENT_LOGINS → Returns true (limit exceeded)
4. Return 429 response to client

### Test concurrent login limiting
```bash
# Session 1: Login succeeds
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}'
# Response: 200 OK, token returned

# Session 2: Login succeeds
# (use different client/browser)

# Session 3: Login succeeds

# Session 4: Login fails
# Response: 429 Too Many Requests
# Error: "Too many concurrent logins. Maximum 3 sessions allowed."
```

---

## ❌ Common Mistakes to Avoid

### ❌ Don't: Forget the import
```javascript
// WRONG - will cause ReferenceError
await logAudit({...});
```

### ✅ Do: Always import first
```javascript
// CORRECT
const { logAudit } = require('../utils/auditLog');
await logAudit({...});
```

---

### ❌ Don't: Log before commit in transactions
```javascript
// WRONG - if transaction rolls back, audit record remains
const t = await sequelize.transaction();
await Entity.create({...}, {transaction: t});
await logAudit({...});  // Called before commit!
await t.commit();
```

### ✅ Do: Log after commit or outside transaction
```javascript
// CORRECT
const t = await sequelize.transaction();
const entity = await Entity.create({...}, {transaction: t});
await t.commit();
await logAudit({...});  // Called after successful commit
```

---

### ❌ Don't: Expose sensitive data
```javascript
// WRONG - password in newValues
newValues: {
  email: user.email,
  password: hashedPassword  // Don't expose password!
}
```

### ✅ Do: Exclude sensitive fields
```javascript
// CORRECT - safe fields only
newValues: {
  email: user.email,
  isActive: user.isActive
  // Exclude: password, authToken, etc.
}
```

---

### ❌ Don't: Make audit logging block main operation
```javascript
// WRONG - will fail if audit fails
await logAudit({...});  // No error handling
res.json({success: true});
```

### ✅ Do: Use non-blocking logging
```javascript
// CORRECT - main operation always succeeds
logAudit({...}).catch(err => {
  console.warn('Audit failed:', err);
});
res.json({success: true});
```

---

## 📈 Monitoring Tips

### Check audit log volume
```javascript
const AuditLog = require('../models').AuditLog;
const count = await AuditLog.count({
  where: {
    createdAt: {
      [Op.gte]: new Date(Date.now() - 24*60*60*1000) // Last 24h
    }
  }
});
console.log(`${count} audit logs in last 24 hours`);
```

### Find suspicious activities
```javascript
// Multiple failed logins
const suspiciousLogins = await AuditLog.findAll({
  attributes: ['userId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
  where: {
    action: 'LOGIN',
    success: false,
    createdAt: {[Op.gte]: new Date(Date.now() - 60*60*1000)}
  },
  group: ['userId'],
  having: sequelize.where(sequelize.fn('COUNT', sequelize.col('id')), Op.gt, 5),
  raw: true
});
```

---

## 🚀 Deployment Checklist

- [ ] All 9 controllers have audit logging
- [ ] logAudit import in each controller
- [ ] CREATE/UPDATE/DELETE operations logged
- [ ] category and severity correctly set
- [ ] description is human-readable
- [ ] oldValues/newValues captured for UPDATE
- [ ] Non-blocking error handling (.catch)
- [ ] MAX_CONCURRENT_LOGINS in .env
- [ ] LOGIN_TIME_WINDOW_MINUTES in .env
- [ ] Tests passing for audit logging
- [ ] No sensitive data in audit logs
- [ ] Performance acceptable (non-blocking)

---

**Last Updated:** Current Session  
**Status:** ✅ Ready for Production
