# Canonical Data Model — fuelsync-new

Purpose: provide a single, durable source of truth for where key domain data lives, who owns it, and how to extend it safely.

Design principles
- Prefer canonical tables already in the schema over adding duplicates.
- Avoid embedding transient or derived snapshots in the primary schema; prefer views or scheduled snapshot jobs.
- Keep migration references non-volatile: do not hard-code migration filenames here. All migrations live in `backend/migrations`.

Core canonical tables and guidance

- `nozzle_readings`
  - Purpose: Source of truth for per-nozzle dispenser readings (volumes, amount, timestamps).
  - Usage: Written by reading ingestion controllers/services; read by reporting and reconciliation flows.
  - Guidance: Treat this as the authoritative sales input when reconciling totals.

- `cash_handovers` (Model: `CashHandover`)
  - Purpose: Records tender collections, handovers, bank deposits, and shift handovers.
  - Usage: Used for reconciliation, handover reports, and financial summaries.
  - Guidance: Use `cash_handovers` for tender and handover records; do not create parallel `tender_entries` tables unless you have a strong compatibility reason.

- `settlements` (Model: `Settlement`)
  - Purpose: Persist station end-of-day reconciliations and settlement metadata (totals, differences, closed_by, notes).
  - Usage: Written by settlement APIs and read by owner/manager UIs and reporting.
  - Guidance: Store only final reconciliation/snapshot metadata here; derive detailed sales from `nozzle_readings` when needed.

- `audit_logs`
  - Purpose: Centralized audit trail for user actions and system events.
  - Guidance: Prefer writing to `audit_logs` from middleware or controllers instead of creating ad-hoc activity tables.

Ownership and relationships
- Owner → Stations
  - Owners are associated to stations via `stations.owner_id` (one owner can own many stations).
  - Managers and employees are assigned to a station via `users.station_id`.
  - Guidance: Do not introduce many-to-many owner/station mappings unless a business need emerges; prefer the simpler `owner_id` and `station_id` fields.

Derived data and snapshots
- Avoid adding `sales` as a primary persisted table for raw sales data; instead:
  - Derive reports from `nozzle_readings` (source-of-truth) when possible.
  - If persistent snapshots are required for performance/legacy reasons, use materialized views or scheduled snapshot jobs and document the retention/backfill plan.

When to add a new table
- Check `backend/src/models` and existing migrations first.
- If adding a table, document in this file: purpose, owning controller(s), read/write patterns, and migration/backfill plan (including rollback strategy).

Where to look when adding features
- Models: `backend/src/models/` — confirm an existing model.
- Controllers: `backend/src/controllers/` — identify existing endpoints that cover the domain.
- Frontend services: `src/services/` — reuse existing endpoints when possible.
- Migrations: `backend/migrations/` — add new migrations here; reference them in release notes, not in this canonical file.

Maintenance guidance
- Keep this file focused on stable domain concepts; avoid including exact migration filenames or ephemeral implementation details here.
- If a table is deprecated, add a short deprecation note and reference the migration/backfill scripts kept under `backend/migrations`.
- Add or update this file when you create or deprecate tables — treat it as the human-readable contract for the data model.

Action items for maintainers
- When creating a migration: add a one-paragraph entry here describing why the new table is required and where to find the migration script.
- When deprecating a table: document the deprecation, backfill, and cleanup steps here.
- Keep `docs/database-schema.md` and `docs/schema_review.md` aligned with this canonical file; prefer references rather than copy-paste of schema details.

Questions? Add them as comments below the most-relevant section or open a short PR referencing this file.
