# Gap Analysis — DB / API / UI

Generated: 2025-12-05

This document summarizes gaps and mismatches discovered while mapping DB → API → UI and running backend tests. It lists failing tests, likely root causes, priority, recommended fixes (who should own them), and suggested validation or frontend mitigations.

---

## Executive summary
- The backend API surface largely aligns with the DB schema and intended UI flows. Controllers implement most business rules: RBAC, price lookup, shift enforcement, backdate limits, plan limits.
- Test run (`npm test`) exposes several failing integration tests indicating missing/incorrect enforcement on plan limits, station code uniqueness handling, nozzle-limit enforcement, some authorization edge cases, and a few input validation/contract mismatches (shift ID retrieval, creditor endpoints).
- Many controllers provide backward-compatible response keys (e.g., `data` + `reading`), which helps frontend compatibility but also hides places where code paths are duplicated and middleware may be bypassed.

---

## Test results (summary)
- Command: `npm test` (Jest integration tests)
- Location of raw output: `test-results/ci-scan.txt` (generated)
- Notable results:
  - Owner journey: 53 tests, 49 passed, 4 failed (failures mostly around plan-limit and authorization edge cases)
  - Manager journey: several failures (shift retrieval and creditor role enforcement mismatch)
  - Employee journey: passed
  - Several failing assertions: expected 403 or 404 but received 201/200/400 — indicates enforcement not applied or validation differences

Key failing tests (representative):
- Owner Journey
  - "Exceed station limit - Edge Case": expected 403, received 201
  - "Create station with duplicate code - Edge Case": expected 403, received 201
  - "Create nozzle exceeding pump limit - Edge Case": expected 403, received 201
  - Authorization checks: expecting 403/404 in some access scenarios but got 200 or other codes
- Manager Journey
  - "Get shift by ID": expected 200, received 400 (validation failed)
  - Multiple Credit Controller role tests: expectations for 404/403 differ from observed 200/201/403

See `test-results/ci-scan.txt` for full logs and failing stack traces.

---

## Root cause hypotheses
Below are likely causes derived from code inspection and test logs. Each item includes rationale and where to check in code.

1) Plan-limit enforcement not always applied (High)
- Symptom: Owner tests for exceeding station/pump/nozzle/employee limits returned 201 (created) instead of 403.
- Likely causes:
  - `enforcePlanLimit` middleware not applied to all route variants (there are multiple compatibility routes: e.g., `/api/pumps` vs `/api/v1/stations/:id/pumps`). Some routes delegate or set params manually and may bypass middleware.
  - Plan fields mismatch between DB seed and model attribute names (snake_case vs camelCase) causing middleware to read `owner.plan.maxStations` but actual property is `max_stations` or different.
- Files to inspect: `backend/src/middleware/planLimits.js`, route files (`backend/src/routes/*.js`) for missing middleware, `backend/src/models` to verify Plan model attributes.

2) Duplicate station code handling / auto-generation behavior (Medium)
- Symptom: Test expecting failure for duplicate code received 201 created; controller logs show it always generates new code (`UPD00X`), ignoring provided code collision.
- Likely causes:
  - `createStation` auto-generates `station.code` and ensures uniqueness, so test expecting duplicate-code rejection conflicts with this behavior.
  - The test likely expects server to reject explicit duplicate `code` values; controller design prefers canonical internal `code` generation.
- Files to inspect: `backend/src/controllers/stationController.js` (station code generation logic) and tests in `tests/integration/owner-journey.test.js`.

3) Nozzle per-pump limit not enforced at controller level (High)
- Symptom: Creating nozzle beyond pump limit returned 201.
- Likely causes:
  - Middleware `enforcePlanLimit('nozzle')` exists in some routes (e.g., nested under `stations`), but some compatibility endpoints `POST /api/v1/nozzles` or `POST /api/nozzles` may not apply it consistently.
  - Plan definition or pump/nozzle counting logic mismatch.
- Files: `backend/src/routes/nozzles.js`, `backend/src/middleware/planLimits.js`, tests.

4) Shift ID validation failure (Manager test) (Medium)
- Symptom: `Get shift by ID` returned 400 validation error.
- Likely causes:
  - Test supplies shift ID format that backend validation rejects (maybe expecting UUID vs integer). Or shift ID route expects numeric but receives UUID.
  - Validation rules changed after tests written.
- Files: `backend/src/routes/shifts.js`, `backend/src/controllers/shiftController.js`, validators in `backend/src/validators`.

5) Credit Controller role enforcement mismatches (Medium)
- Symptom: Manager Journey tests assert certain endpoints return 404 or 403 but returned 200/201/403.
- Likely causes:
  - Role checks and route permissions for creditor endpoints are inconsistent; some endpoints might be available at multiple paths with different middleware.
  - Tests accept either 403 (forbidden) or 404 (not found). Observed different results indicating inconsistent enforcement.
- Files: `backend/src/routes/credits.js`, `backend/src/controllers/creditController.js`, middleware `requireRole` usage.

6) `PUT /api/v1/auth/profile` mapping anomaly (Low) — previously noted
- Symptom: `auth.js` maps `PUT /profile` to `authController.getCurrentUser` (likely bug). Tests may rely on `PUT /api/auth/profile` behavior in older flows.
- Files: `backend/src/routes/auth.js` — fix mapping to `authController.updateProfile` or route to `userController.updateUser`.

7) Validation errors surfaced (e.g., negative fuel price) (Low/Informational)
- Symptom: Sequelize validation error thrown when negative price attempted; tests may expect a 403 or a 400 with custom message.
- Likely causes:
  - The DB/model validation prevents saving negative price; global error handler logs SequelizeValidationError. Tests may assert specific status codes/messages. Add consistent error translation to standardized 400/403 messages.
- Files: `backend/src/models/FuelPrice.js`, `src/app.js` error handler.

---

## Prioritized fixes & recommended owners
High-priority (blockers — fix ASAP)
1. Ensure plan-limit enforcement is applied consistently across all routes (stations, pumps, nozzles, employees).
   - Owner: Backend
   - Files: `backend/src/middleware/planLimits.js`, all route files (`backend/src/routes/*.js`) — ensure `enforcePlanLimit` is used consistently for creation endpoints and compatibility routes.
   - Acceptance: Tests that previously failed for plan-limit errors should pass (403 when attempting to create beyond limits). Unit tests for middleware added.

2. Nozzle limit enforcement (per pump) — controller should check pump's current nozzle count vs allowed plan before creating.
   - Owner: Backend
   - Files: `stationController.createNozzle` and route entry points (`nozzles.js`) — add explicit count check if middleware not sufficient.
   - Acceptance: Test `Create nozzle exceeding pump limit` returns 403.

Medium-priority (consistency & correctness)
3. Align station creation behavior with tests or update tests/docs: decide whether duplicate `code` should be rejected or silently re-generated.
   - Owner: Product + Backend
   - Options: (A) Reject explicit `code` duplicate input with 409/403; (B) Keep auto-generate behavior but update tests and docs to expect unique code generation. I recommend rejecting explicit duplicate `code` if `code` provided by client.
   - Files: `stationController.createStation`.

4. Fix shift ID validation mismatch causing 400 responses when tests expect 200.
   - Owner: Backend
   - Files: `shiftController` and validators. Add tests ensuring supported ID formats.

5. Normalize error responses for validation errors (SequelizeValidationError) to return consistent HTTP codes and messages used by frontend/tests.
   - Owner: Backend
   - Files: `src/app.js` central error handler — map validation errors to `400 Bad Request` with JSON `{ success:false, error: '...' }`.

Low-priority
6. Fix `PUT /api/v1/auth/profile` route mapping.
   - Owner: Backend
   - Files: `backend/src/routes/auth.js` — map `PUT /profile` to appropriate controller or remove alias.

7. Improve logging and remove noisy console output in controllers (optional) to reduce CI log noise.
   - Owner: Backend

---

## Frontend recommendations (to avoid repeated backend changes)
- Implement robust client-side validation for plan limits (informational only), but always rely on server for enforcement.
- Use canonical endpoints found in `docs/api-surface.json` and prefer `PUT /api/v1/users/:id` for profile update.
- Implement global API client that normalizes `data` and backward-compatible keys and handles 401/403 redirects.
- Add feature flagging for export buttons using `user.plan.canExport` from `/auth/me`.

---

## Quick action plan (next 7 days)
1. Backend: Add unit tests for `enforcePlanLimit` and ensure it's applied to all create endpoints (1 day).
2. Backend: Add explicit pump/nozzle count checks in controllers where middleware cannot determine context (1 day).
3. Backend: Decide station code policy and implement chosen behavior + tests (0.5 day).
4. Backend: Investigate shift ID validation and ensure route validators accept test-supplied IDs (0.5 day).
5. Backend: Normalize error handler responses for Sequelize validation errors (0.5 day).
6. Frontend: Implement API client wrapper and update profile edit to use `/api/v1/users/:id` (1 day).
7. CI: Re-run `npm test` and iterate until green (remaining time).

---

## Where I left artifacts
- `docs/api-surface.json` — full API surface JSON
- `docs/db-api-mapping.md` — DB → API mapping
- `docs/api-ui-mapping.md` — API → UI mapping (components & payloads)
- `docs/gap-analysis.md` — this file
- `test-results/ci-scan.txt` — raw test run output from `npm test`

---

If you want, I can now start implementing the highest-priority backend fixes (apply small, focused patches) or create PR branches for each fix. I can also implement the frontend API client and initially update the auth/profile flow to reduce coupling while backend fixes are merged.

Which area should I work on next?
- A: Apply backend fixes for plan limit & nozzle limit (recommended first)
- B: Fix `PUT /api/v1/auth/profile` route and normalize error handler
- C: Implement frontend API client and profile update (no backend changes)
- D: Re-run tests after small, iterative fixes

