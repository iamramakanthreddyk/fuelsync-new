# Canonical Data Model — fuelsync-new

Purpose: provide a single source of truth for where domain data is stored, which controllers write/read it, and migration sources. Use this file when adding features or migrations to avoid duplication.

Guidelines
- Prefer existing canonical tables over adding new tables for the same concept.
- If a new table is needed, document why and add references in this file.
- Migrations should live in `backend/migrations` (see `.sequelizerc`).

Canonical Tables

- `nozzle_readings`
  - Purpose: Source-of-truth for dispenser readings (per nozzle). Holds litresSold, totalAmount, cash/online/credit splits, timestamps.
  - Written by: `src/controllers/nozzleReadingController` (or equivalent), ingestion services.
  - Read by: `salesController`, reporting/dashboard controllers.
  - Migration: `backend/migrations/20251202114000-baseline-schema.js` (baseline schema)

- `cash_handovers` / Model: `CashHandover`
  - Purpose: Records tender/collection entries, handovers, bank deposits, and shift collections.
  - Written by: `backend/src/controllers/cashHandoverController.js` (endpoints `/api/v1/handovers`, station subroutes)
  - Used by: Dashboard summaries, shift flows, reconciliation.
  - Migration: `backend/migrations/20251202114000-baseline-schema.js`
  - Note: Do NOT add a separate `tender_entries` table — use `cash_handovers`.

- `settlements` / Model: `Settlement`
  - Purpose: Persist station end-of-day reconciliations / settlements.
  - Written by: `backend/src/controllers/stationController.recordSettlement` (POST `/stations/:id/settlements`)
  - Read by: `stationController.getSettlements` and owner UI.
  - Migration: `backend/migrations/20251209-create-settlements.js` (moved to `backend/migrations`)

- `sales`
  - Purpose: Historically a snapshot/summary of sales. Prefer deriving from `nozzle_readings`. If you must persist snapshots for reporting, clearly document the reason and use a materialized view or scheduled snapshot job.
  - Recommendation: Do not create `sales` table in migrations unless a clear snapshot/backfill plan exists.

- `audit_logs`
  - Purpose: Central application audit trail. Use this for user activity/audit needs instead of creating `user_activity_log` duplicate tables.
  - Written by: Audit middleware / controllers.

- **Owner→Stations (current behavior)**
  - Purpose: Owners own multiple stations via the `stations.owner_id` column. Managers and employees are assigned to a single station via `users.station_id`.
  - Enforcement: Backend access control and controllers use `Station.ownerId` to scope owner queries and `User.stationId` for manager/employee assignments.
  - Note: The `user_stations` many-to-many mapping was considered but intentionally omitted from migrations and runtime; add it only if you need managers/employees assigned to multiple stations.

- `station_plans`, `plan_usage` (omitted)
  - Purpose: These were considered for historical plan assignments and monthly usage snapshots.
  - Decision: Omitted from migrations — the application uses `stations.plan_id` for current plan and `cash_handovers`/`nozzle_readings` for activity. Add a new table only if you need historical billing or precomputed monthly usage.

Where to look when adding features
- Models: `backend/src/models/` — check for an existing model first.
- Controllers: `backend/src/controllers/` — identify existing endpoints that perform the domain function.
- Frontend services: `src/services/` — avoid adding new endpoints if an existing controller covers the flow.
- Migrations: `backend/migrations/` — add migrations here and avoid duplicating tables already created in baseline migrations.

Action items for maintainers
- When creating a new migration or model: add an entry here documenting the change and why a new table was required.
- When deprecating an old table, document the migration and backfill steps.
- Keep docs (`docs/database-schema.md`, `docs/schema_review.md`, `docs/superadmin-api.md`) aligned with this canonical file.

Questions? Add them as comments below the relevant table section.
