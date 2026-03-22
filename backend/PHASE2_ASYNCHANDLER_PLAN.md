# Phase 2: asyncHandler Consolidation - Implementation Plan

**Date:** March 22, 2026  
**Objective:** Eliminate 300+ lines of redundant try-catch boilerplate  
**Scope:** 8 controllers with 25+ try-catch blocks

---

## Files Requiring asyncHandler Consolidation

### Priority 1: creditController.js (810 lines, 8 try-catch blocks)
**Current Pattern (BAD):**
```javascript
const recordCreditSale = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // ... logic
    await t.commit();
    return res.json({ success: true, data: result });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ success: false, error: error.message });
  }
};
```

**Target Pattern (GOOD):**
```javascript
const recordCreditSale = asyncHandler(async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // ... logic
    await t.commit();
    return sendSuccess(res, result);
  } catch (error) {
    await t.rollback();
    throw error; // Let asyncHandler + errorMiddleware handle
  }
});
```

**Functions to refactor:** recordCreditSale, updateCreditSale, settleCredit, reverseCredit, getCreditTransactions, getCreditHistory, adjustCredit, getCreditLedgerForEmployee

**Expected lines saved:** 40+ lines

---

### Priority 2: authController.js (569 lines, 6 try-catch blocks)
**Functions to refactor:** login, refreshToken, logout, changePassword, validateToken, updateProfile

**Current Issues:**
- Manual JWT validation with try-catch
- Manual password hashing with try-catch
- Error handling inconsistent with rest of app

**Expected lines saved:** 30+ lines

---

### Priority 3: transactionController.js (562 lines, 3 try-catch blocks)
**Functions to refactor:** createTransaction, updateTransaction, settleTransaction

**Current Issues:**
- Manual transaction management (good)
- But redundant error handling pattern

**Expected lines saved:** 20+ lines

---

### Priority 4: bulkOperationsController.js (300+ lines, 2 try-catch blocks)
**Functions to refactor:** validateBulkReadings, bulkUpdateReadings

**Expected lines saved:** 15+ lines

---

### Priority 5: stationController.js (2581 lines - LARGEST, 3 try-catch blocks)
**NOTE:** This is the monolithic controller that needs breaking apart anyway

**Functions to refactor:** createStation (partial), updatePumpConfiguration, initiatePumpRebuild

**Also address:** Split this massive file into 5-6 smaller controllers

**Expected lines saved:** 20+ lines (from this phase)

---

### Priority 6-8: Other Controllers (tankController, dbSchemaController, expenseController)
**Combined try-catch blocks:** 3

**Expected lines saved:** 15+ lines

---

## Refactoring Pattern Template

### For Functions WITHOUT asyncHandler:

**BEFORE:**
```javascript
exports.myFunction = async (req, res) => {
  try {
    // ... logic
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
```

**AFTER:**
```javascript
exports.myFunction = asyncHandler(async (req, res) => {
  // ... logic - NO TRY-CATCH NEEDED
  sendSuccess(res, result);
});
```

### For Functions WITH asyncHandler BUT redundant inner try-catch:

**BEFORE:**
```javascript
exports.myFunction = asyncHandler(async (req, res) => {
  try {
    // ... logic
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error:', error.message);
    throw error; // asyncHandler still catches
  }
});
```

**AFTER:**
```javascript
exports.myFunction = asyncHandler(async (req, res) => {
  // ... logic - NO TRY-CATCH NEEDED
  sendSuccess(res, result);
});
```

### Special Case: Transactions with Rollback

**BEFORE:**
```javascript
exports.complexOp = asyncHandler(async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // ... logic
    await t.commit();
    sendSuccess(res, result);
  } catch (error) {
    await t.rollback();
    throw error; // Let asyncHandler handle
  }
});
```

**AFTER (SAME - KEEP THIS PATTERN):**
```javascript
exports.complexOp = asyncHandler(async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // ... logic
    await t.commit();
    sendSuccess(res, result);
  } catch (error) {
    await t.rollback();
    throw error; // Let asyncHandler handle
  }
});
```

---

## Controller-by-Controller Plan

### creditController.js (PRIORITY 1)

#### Function 1: recordCreditSale
- **Current:** Lines 278-470, manually handles errors
- **Change:** Wrap with asyncHandler, remove inner try-catch boilerplate
- **Keep:** try-catch for transaction rollback only
- **Lines saved:** 8

#### Function 2: updateCreditSale
- **Current:** Lines 471-615, manual error handling
- **Change:** Wrap with asyncHandler
- **Lines saved:** 8

#### Function 3-8: Other credit functions
- **Pattern:** Same as above
- **Total lines saved:** ~40

#### Checklist:
- [ ] Add asyncHandler to import if missing
- [ ] Wrap each function definition
- [ ] Remove redundant error handlers
- [ ] Keep transaction rollback logic
- [ ] Test database operations still work
- [ ] Verify error responses still work

---

### authController.js (PRIORITY 2)

#### Function 1: login
- **Current:** Has try-catch for JWT validation
- **Remove:** Redundant error handling for password check
- **Keep:** JWT specific logic needed
- **Lines saved:** 5

#### Function 2: refreshToken
- **Current:** Manual JWT verification try-catch
- **Change:** Remove redundant parts, keep token validation
- **Lines saved:** 5

#### Function 3-6: Other auth functions
- **Pattern:** Consistent async handler wrapping
- **Total lines saved:** ~30

#### Checklist:
- [ ] Ensure JWT errors thrown properly
- [ ] Test auth flow end-to-end
- [ ] Verify token validation still works
- [ ] Test error messages consistent with rest of app

---

### transactionController.js (PRIORITY 3)

#### Refactoring scope:
- createTransaction: Wrap with asyncHandler
- updateTransaction: Wrap with asyncHandler
- settleTransaction: Wrap with asyncHandler

**Total lines saved:** ~20

---

## Expected Outcomes

### Before
```
- creditController: 810 lines (with 8 try-catch blocks)
- authController: 569 lines (with 6 try-catch blocks)
- transactionController: 562 lines (with 3 try-catch blocks)
- Other controllers: 1500+ lines (with 8 try-catch blocks)
-------
Total: 3441+ lines with 25+ try-catch blocks
```

### After
```
- creditController: 770 lines (40 lines removed)
- authController: 540 lines (29 lines removed)  
- transactionController: 542 lines (20 lines removed)
- Other controllers: 1480+ lines (20 lines removed)
-------
Total: 3332 lines (109 lines removed directly)
Plus: Eliminated 25+ try-catch blocks = ~75 more lines cleaner code
NET SAVINGS: ~150 lines of boilerplate
```

### Quality Improvements
- ✅ Consistent error handling across all controllers
- ✅ Single error handler middleware processes all errors
- ✅ Easier to add global error logging
- ✅ Reduced code duplication by 80%
- ✅ Easier to add error tracking (Sentry, etc.)
- ✅ Better consistency with CONTROLLER_TEMPLATE.js

---

## Testing Strategy

### Unit Tests to Add
```javascript
// Test that asyncHandler properly catches thrown errors
test('asyncHandler catches thrown errors and passes to next()', async () => {
  const mockReq = {};
  const mockRes = {};
  const mockNext = jest.fn();
  
  const handler = asyncHandler(async (req, res) => {
    throw new Error('Test error');
  });
  
  await handler(mockReq, mockRes, mockNext);
  expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
});

// Test that routes still work after asyncHandler wrapping
test('creditController.recordCreditSale works with asyncHandler', async () => {
  // ... test that credit sale creation still works
});
```

### Integration Tests
- Test credit sale creation/update flows with asyncHandler
- Test auth flows (login, token refresh) with asyncHandler
- Test transaction creation with asyncHandler
- Verify error responses still formatted consistently

---

## Implementation Checklist

- [ ] **Phase 2.1:** creditController.js - Wrap with asyncHandler
  - [ ] recordCreditSale function
  - [ ] updateCreditSale function
  - [ ] settleCredit function
  - [ ] reverseCredit function
  - [ ] getCreditTransactions function
  - [ ] getCreditHistory function
  - [ ] adjustCredit function
  - [ ] getCreditLedgerForEmployee function
  - [ ] Test credit flows

- [ ] **Phase 2.2:** authController.js - Wrap with asyncHandler
  - [ ] login function
  - [ ] refreshToken function
  - [ ] logout function
  - [ ] changePassword function
  - [ ] validateToken function
  - [ ] updateProfile function
  - [ ] Test auth flows

- [ ] **Phase 2.3:** transactionController.js - Wrap with asyncHandler
  - [ ] createTransaction function
  - [ ] updateTransaction function
  - [ ] settleTransaction function
  - [ ] Test transaction flows

- [ ] **Phase 2.4:** Remaining controllers
  - [ ] bulkOperationsController.js (2 functions)
  - [ ] stationController.js (3 functions)
  - [ ] tankController.js (1 function)
  - [ ] dbSchemaController.js (1 function)
  - [ ] expenseController.js (1 function)
  - [ ] Test all flows

- [ ] **Phase 2.5:** Documentation
  - [ ] Update CONTROLLER_TEMPLATE.js to show no try-catch needed
  - [ ] Update coding guidelines
  - [ ] Create PR with all changes

---

## Risk Mitigation

**Risk:** Removing try-catch might lose important error context  
**Mitigation:** asyncHandler + errorMiddleware provides complete context in logs

**Risk:** Transaction rollback logic might be affected  
**Mitigation:** Keep try-catch ONLY for transaction rollback, rest delegated to asyncHandler

**Risk:** Database operation errors might not be handled  
**Mitigation:** All database errors thrown correctly, caught by asyncHandler

**Risk:** JWT token validation might lose specific error info  
**Mitigation:** Create JWT-specific error classes that asyncHandler knows how to handle

---

## Success Criteria

- [ ] All 25+ try-catch blocks removed or consolidated
- [ ] All 40+ controller functions use asyncHandler
- [ ] All tests pass
- [ ] Error handling remains consistent
- [ ] No reduction in logging detail
- [ ] 150+ lines of boilerplate removed
- [ ] All controllers follow same pattern as CONTROLLER_TEMPLATE.js

---

## Estimated Effort

- **creditController.js:** 30 minutes
- **authController.js:** 20 minutes
- **transactionController.js:** 15 minutes
- **bulkOperationsController.js:** 10 minutes
- **Other controllers:** 15 minutes
- **Testing:** 30 minutes
- **Documentation:** 15 minutes

**Total: ~2.5-3 hours**

