**Summary:**
- **Source reviewed:** `backend/database/schema.sql` and `docs/database-schema.md`
- **Outcome:** SQL schema is concise and focused on core entities (`plans`, `stations`, `users`, `pumps`, `nozzles`, `fuel_prices`, `nozzle_readings`). Docs are more expansive and describe additional tables/flows that the SQL does not implement.

**Key Findings (gaps / mismatches):**
- **Missing tables in SQL:** `sales`, `tender_entries`, `daily_closure`, `user_stations`, `pump_assignments`, `nozzle_assignments`, `station_plans`, `plan_usage`, `user_activity_log` — some present in docs but absent in SQL.
- **Fields mismatch:** docs show `stations.owner_id`, `stations.brand`, and other plan fields (`allow_manual_entry`) not in SQL.
- **Fields mismatch:** docs show `stations.owner_id`, `stations.brand`, and other plan fields (`max_manual_monthly`, `allow_manual_entry`) not in SQL.
- Generate SQL migration patches to add `owner_id`, `user_stations`, and other missing audit tables (e.g., `sales`, `tender_entries`).
- Update `docs/database-schema.md` to match the current SQL (or vice-versa).
- Produce a visual PNG of the ER diagram (requires external mermaid CLI or online rendering).

**Risks / Consequences:**
- API and backend code expecting the documented tables/columns will fail or behave incorrectly with the current SQL.
- Migration or multi-tenant features (owner transfer, multi-station employees) are harder to implement without history/mapping tables.
- Enum/value mismatches can lead to invalid inserts or bugs when moving between environments.

**Recommendations (prioritized):**
1. Align docs and schema: choose the canonical model (SQL or docs). I recommend updating docs to match the current SQL or updating SQL to include the missing entities depending on feature needs.
2. If ownership must be explicit per docs, add `owner_id` on `stations` (UUID REFERENCES users(id)) and/or a `user_stations` join table for many-to-many assignments.
3. Add `sales`, `tender_entries`, and `daily_closure` if reconciliation and tender tracking are required by the product.
4. Harmonize enum values (`user_role`, `fuel_type`) across SQL and docs to one agreed set.
5. Add history tables (`pump_assignments`, `nozzle_assignments`, `station_plans`) if equipment/station changes must be audited.
6. Update docs to reference exact column names, constraints, and sample queries to reduce confusion.
7. Add a short migration plan (backfill owner mapping, create new tables, populate from existing columns) before deploying schema changes to production.

**Suggested next steps (small incremental):**
- Add `owner_id` to `stations` (nullable) and backfill from users with role='owner' where appropriate.
- Create `user_stations` join table and update user assignment logic; keep the existing `users.station_id` for backward compatibility during migration.
- Add `sales` table with migration scripts that populate `sales` from existing `nozzle_readings` where possible.
- Update `docs/database-schema.md` to reflect the exact SQL and include the ER diagram (`docs/ER_diagram.md`).

If you want, I can:
- Generate SQL migration patches to add `owner_id`, `user_stations`, and other missing audit tables (e.g., `sales`, `tender_entries`).
- Update `docs/database-schema.md` to match the current SQL (or vice-versa).
- Produce a visual PNG of the ER diagram (requires external mermaid CLI or online rendering).

Choose which of the actions above you'd like me to take next.
