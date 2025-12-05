# APLANN — Actionable Plan for Code Review, Evaluation, and Execution

Purpose
- Provide a concise, repeatable process to review the codebase, evaluate gaps, prioritize fixes, and safely execute changes.

Scope
- Frontend (TypeScript / React) and Backend (Node/Express/Sequelize) in this repository.

High-level steps
1. Static analysis: type-check, lint, and build both frontend and backend.
2. Run automated tests: unit, integration, and any available e2e suites.
3. API & schema audit: compare Sequelize models, migrations, and frontend API expectations.
4. Identify gaps: list bugs, schema mismatches, and UX issues; estimate impact and risk.
5. Fix iteratively: pick highest-impact low-risk items, implement, run tests, and repeat.
6. Prepare deployment: DB migrations, backups, smoke tests, and rollback steps.

Evaluation Criteria
- Compile: `npm run build` for frontend and `npm run build` (or `npm test`) for backend should pass.
- Lint: `npm run lint` should produce no new major issues.
- Tests: All project tests should pass or failures should be categorized as known vs new.
- API contract: Frontend request/response shapes match backend controllers and documented endpoints.
- DB schema: Model fields are backed by migrations in `backend/migrations` and verified in DB.

Quick Commands (PowerShell)
- Frontend build (from repo root):
```
cd "C:\Users\r.kowdampalli\OneDrive - Accenture\Documents\fuel-sync\fuelsync-new"
npm run build
```
- Backend build/test (from `backend` folder):
```
cd "c:\Users\r.kowdampalli\OneDrive - Accenture\Documents\fuel-sync\fuelsync-new\backend"
npm install
npm test
```
- Run TypeScript check (if available): `npm run typecheck` (project-specific).

DB Migration & Production Rollout
- Create a backup before running migrations.
- Run migrations (example with `sequelize-cli`):
```
cd backend
npx sequelize-cli db:migrate --env production
```
- Verify columns added (example SQL):
```
-- connect to the DB and run
SELECT column_name FROM information_schema.columns
WHERE table_name = 'NozzleReadings' AND column_name IN ('credit_amount','creditor_id');
```
- Rollback (if needed):
```
npx sequelize-cli db:migrate:undo --env production
```

Acceptance Criteria
- Payment allocations persist and `GET /stations/:id/daily-sales` returns non-zero paymentSplit for recorded payments.
- UI pages compile without TypeScript errors and show expected data.

Notes & Risks
- Always run migration on a copy or staging DB first.
- Double-check env variables and connection strings before running production migrations.
- If automated tests are sparse, add minimal integration tests for payment allocation flows before deploying.

Contact & Next Steps
- After running static checks and tests, return the test output and any failing files so fixes can be implemented iteratively.

Detailed Next Steps (triage & fix workflow)
1. Gather failing test context
	- Open the Jest output file (backend/jest-results.json) and the console test logs (`backend/test-output.txt` or `backend/test-full-output.txt`).
	- Identify top failing suites and the first failing assertion to triage root cause.

2. Reproduce failing test in isolation
	- Run the failing suite or spec in band to stabilize debugging and reduce interference:
```
cd backend
npx jest tests/integration/admin-journey.test.js --runInBand --detectOpenHandles
```
	- If the test depends on environment variables, ensure `.env` is present with test-friendly values (e.g., `JWT_SECRET`, DB config). The project uses SQLite for tests by default so DB config should be safe locally.

3. Common causes and checks
	- Failing auth/login tests:
	  - Check test fixture creation — ensure the test creates a user and stores a password hashed with the same routine used by the login controller.
	  - Verify `JWT_SECRET` is present and long enough (tests warn when it's <32 chars). Tests may still run with a short secret, but consistent env helps.
	- DB schema mismatches:
	  - If tests fail due to missing columns, verify `backend/migrations` contains the required migration and that the test DB is migrated (or model uses `sync()` in test setup).
	- Third-party mocks and race conditions:
	  - Use `--runInBand --detectOpenHandles` to help reveal leftover async handles.

4. Fix & verify
	- Make the smallest code fix to align test fixtures with auth implementation (e.g., ensure `User.create` uses `hashPassword` or test inserts hashed password directly).
	- Re-run the single test until it passes, then re-run the whole test suite.

5. Repeat for other failing tests and prioritize fixes by impact.

Useful commands (PowerShell)
```
cd "c:\Users\r.kowdampalli\OneDrive - Accenture\Documents\fuel-sync\fuelsync-new\backend"
# Run a single test file with detailed output
npx jest tests/integration/admin-journey.test.js --runInBand --verbose --detectOpenHandles

# Run failing tests filtered by name
npx jest --testNamePattern="Login with valid credentials" --runInBand --detectOpenHandles
```

When to ask for help
- If a test depends on external services (e.g., networked DB, third-party APIs) that cannot be reproduced locally, capture the failing request and share logs.

