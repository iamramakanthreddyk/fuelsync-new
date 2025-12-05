# DB → API Mapping

Generated: 2025-12-05

This document maps database tables (schema) to backend API endpoints and controller logic discovered in `backend/src/controllers` and `backend/src/routes`.

Format per table:
- Brief description
- Columns of interest (primary keys / nullable / foreign keys / important constraints)
- APIs that read/write the table (path, method, controller function)
- Controller-level validations / business rules affecting the table
- UI implications / recommended fields to show/edit

---

## plans
- Description: Subscription plans that control feature limits and pricing.
- Key columns: `id` (UUID PK), `name`, `max_stations`, `max_pumps_per_station`, `max_nozzles_per_pump`, `max_employees`, `backdated_days`, `analytics_days`, `can_export`, `price_monthly`, `features`, `is_active`.
- APIs:
  - (Admin routes / controllers) — plans routes exist (`backend/src/routes/plans.js`) though not fully enumerated in the surface JSON. Controller: `plansController` (expected).
  - `POST /api/v1/users` (user creation): Plan limits used when creating owners (owner plan assignment) and when owner creates staff it's validated against `plan.maxEmployees`.
- Business rules:
  - `backdated_days` is used in `readingController.createReading` to enforce how far back a reading can be entered for a station owner.
  - `max_employees` used in `userController.createUser` when owner tries to add staff.
- UI implications:
  - Admin UI for plan management (create/edit plan fields).
  - Owner onboarding: show plan selection (super_admin only) and display limits on station/pumps/nozzles/employees.

---

## stations
- Description: Multi-tenant fuel stations. Owner linkage via `owner_id` / `ownerId`.
- Key columns: `id` (UUID PK), `name`, `address`, `city`, `state`, `pincode`, `phone`, `email`, `gst_number`, `is_active`, `created_at`, `updated_at`, `code`, `ownerId` (model uses `ownerId`), plus operational settings: `requireShiftForReadings`, `alertOnMissedReadings`, `missedReadingThresholdDays` (accessed/updated in controller).
- APIs:
  - `GET /api/v1/stations` — `stationController.getStations` (role-scoped list). Includes pumps, owner info and calculates today's sales using `NozzleReading`.
  - `POST /api/v1/stations` — `stationController.createStation` (owner/super_admin). Must include `ownerId` if created by super_admin.
  - `GET /api/v1/stations/:id` — `stationController.getStation` (detailed view with pumps/nozzles/fuelPrices/staff and computed `todaySales` and `lastReading`).
  - `PUT /api/v1/stations/:id` — `stationController.updateStation` (owner/super_admin + access check).
  - `GET /api/v1/stations/:id/settings` — `stationController.getStationSettings`.
  - `PUT /api/v1/stations/:id/settings` — `stationController.updateStationSettings`.
  - Nested: `GET /api/v1/stations/:stationId/staff` — `userController.getStationStaff`.
  - Nested pumps/nozzles/prices endpoints handled in station-related controllers and their own route files.
- Business rules:
  - Station creation: `name` required. When super_admin creates station, `ownerId` must be a valid owner user; the controller generates a unique station `code` (prefix from owner name + counter).
  - Access control via `canAccessStation` (owner sees their stations; manager/employee only assigned station; super_admin sees all).
  - Station settings enforce `missedReadingThresholdDays` constraints (1-30) and owner-only update.
- UI implications:
  - Station list (scoped by role) — show `pumpCount`, `activePumps`, `todaySales`, `lastReading`.
  - Station detail: show pumps, nozzles, price history, staff listing, and settings tab for owner.
  - Station creation modal: require `name`; if super_admin allow choosing `owner`.

---

## users
- Description: All user accounts and RBAC.
- Key columns: `id` (UUID PK), `email`, `password`, `name`, `phone`, `role` (`super_admin`/`owner`/`manager`/`employee`), `station_id`, `plan_id`, `is_active`, `last_login_at`, timestamps.
- APIs:
  - Auth endpoints: `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password`, `POST /api/v1/auth/logout`.
  - Users resource: `GET /api/v1/users` (list, role-scoped), `GET /api/v1/users/:id`, `POST /api/v1/users`, `PUT /api/v1/users/:id`, `DELETE /api/v1/users/:id` (deactivate), `POST /api/v1/users/:id/reset-password`.
  - Station staff: `GET /api/v1/stations/:stationId/staff`.
- Business rules / validations:
  - Creation rules enforced in `userController.createUser`: which roles a creator can create depends on the creator role (super_admin -> owner; owner -> manager/employee; manager -> employee).
  - For manager/employee creation, `stationId` is required and validated against ownership (owner) or assigned station (manager).
  - Owners may have `planId` assigned; if missing, controllers try to pick a default plan (Free/Basic) or auto-create a Free plan when none exists.
  - Email uniqueness enforced; password length & hashing handled by model hooks.
  - `requireMinRole('manager')` middleware is applied on POST `/api/v1/users` and DELETE `/api/v1/users/:id` (so employees cannot create or delete users).
- UI implications:
  - Login/Register flows must integrate with `auth` endpoints; store token and user object.
  - User list: incorporate pagination & search (`/api/v1/users` query params).
  - Create user flows should disable role options not allowed for the current logged-in role.
  - Profile edit: prefer `PUT /api/v1/users/:id` instead of `PUT /api/v1/auth/profile` due to a suspected route mapping issue.

---

## pumps
- Description: Physical pumps assigned to stations.
- Key columns: `id` (UUID PK), `station_id`, `name`, `pump_number`, `status` (equipment_status), `notes`, timestamps.
- APIs:
  - `GET /api/v1/stations/:stationId/pumps` and `GET /api/v1/pumps?stationId=...` (both delegate to `stationController.getPumps`).
  - `POST /api/v1/stations/:stationId/pumps` and `POST /api/v1/pumps` (compatibility) — create pump (owner/super_admin). Middleware `enforcePlanLimit('pump')` checks plan.
  - `PUT /api/v1/stations/pumps/:id` and `PUT /api/v1/pumps/:id` — update pump (owner/super_admin).
  - `DELETE /api/v1/pumps/:id` — `stationController.deletePump` may exist; requires manager+/owner/super_admin.
- Business rules:
  - Unique constraint on `(station_id, pump_number)` — controller handles conflict with 409.
  - When pump status changes to non-active, controller marks associated nozzles inactive.
  - Access control via `canAccessStation`.
- UI implications:
  - Pump list in station detail; show pumpNumber, status, associated nozzle summary.
  - Create pump flow needs `pumpNumber` uniqueness checks (client-side can call GET pumps and verify, but server-side will enforce).

---

## nozzles
- Description: Nozzles belong to pumps and carry fuel type, initial reading and status.
- Key columns: `id` (UUID PK), `pump_id`, `nozzle_number`, `fuel_type`, `status`, `initial_reading`, `created_at`, `updated_at`, plus denormalized `stationId` and `last_reading`/`last_reading_date` in models.
- APIs:
  - `GET /api/v1/nozzles?pumpId=...` or `?stationId=...` — `stationController.getNozzles`.
  - `POST /api/v1/nozzles` — create nozzle (owner/super_admin). Uses `pumpId` and sets `stationId` from pump.
  - `PUT /api/v1/nozzles/:id` — update nozzle details.
  - `DELETE /api/v1/nozzles/:id` — delete nozzle (owner/manager/super_admin) if implemented.
  - `GET /api/v1/nozzles/:id` — get nozzle details via `stationController.getNozzle`.
- Business rules:
  - Unique `(pump_id, nozzle_number)` enforced at DB and handled by controller returning 409.
  - `initial_reading` used if there is no previous reading.
  - Nozzle `status` must be `active` for readings to be accepted (`readingController.createReading` checks nozzle.status).
- UI implications:
  - Nozzle list per pump, show `fuelType`, `lastReading`, `status`.
  - Nozzle creation requires selecting `pump` and a `nozzleNumber` (client should display available numbers based on existing nozzles).

---

## fuel_prices (model name: FuelPrice)
- Description: Historical fuel prices per station and fuel type.
- Key columns: `id` (UUID), `station_id`, `fuel_type`, `price`, `effective_from`, `updated_by`, `created_at`.
- APIs:
  - `GET /api/v1/stations/:stationId/prices` — `stationController.getFuelPrices` returns `current` and `history`.
  - `POST /api/v1/stations/:stationId/prices` — `stationController.setFuelPrice` (manager+). Middleware `requireMinRole('manager')` used.
  - `GET /api/v1/stations/:stationId/prices/check?fuelType=petrol&date=YYYY-MM-DD` — `stationController.checkPriceSet` (used by UI before allowing sales/readings for a date)
- Business rules:
  - `price` must be > 0 (DB check). Unique constraint ensures one price per (station,fuel_type,effective_from).
  - Controllers group by fuel type and pick latest per fuel type as `current`.
- UI implications:
  - Price management UI (manager/owner): set new prices with `effectiveFrom` (default today).
  - Reading entry UI should call `prices/check` to ensure price is set before accepting sales entries.

---

## nozzle_readings (model name: NozzleReading)
- Description: Core readings table tracking meter values and calculated sales.
- Key columns: `id` (UUID), `nozzle_id`, `station_id`, `entered_by` (user), `reading_date`, `reading_value`, `previous_reading`, `litres_sold`, `price_per_litre`, `total_amount`, `cash_amount`, `online_amount`, `credit_amount`, `is_initial_reading`, `notes`, `created_at`, `updated_at`.
- APIs:
  - `POST /api/v1/readings` — `readingController.createReading` (core). Validates `nozzleId`, readingDate, readingValue; enforces nozzle active, access (station), optional shift requirement, backdate limit (`plan.backdatedDays`), payment breakdown equals total amount (if provided), and calculates litresSold/price/total.
  - `GET /api/v1/readings/previous/:nozzleId` — `readingController.getPreviousReading` returns previous reading or nozzle initialReading and current price for the date.
  - `GET /api/v1/readings` — `readingController.getReadings` (filters by station/pump/nozzle/date range, paginated) with role-scoped access.
  - `GET /api/v1/readings/today` — `readingController.getTodayReadings` returning today's readings for the user scope.
  - `GET /api/v1/readings/:id` — `readingController.getReadingById`.
  - `PUT /api/v1/readings/:id` — `readingController.updateReading` (manager+). Updates reading and recalculates subsequent readings for that nozzle.
  - `DELETE /api/v1/readings/:id` — `readingController.deleteReading` (manager+/owner/super_admin or who entered it).
- Business rules:
  - Reading must be > previous reading unless marked initial reading.
  - Litres sold calculated as delta; optional validation if client provides `litresSold`.
  - Price resolution: use `FuelPrice.getPriceForDate` (fallback to client-provided price or derive from total when possible).
  - Backdate enforcement based on owner's plan `backdatedDays`.
  - Shift requirement: if station setting `requireShiftForReadings` is true, user must have an active shift for readings.
  - After insertion, nozzle's lastReading cache updated (`nozzle.updateLastReading`).
- UI implications:
  - Reading entry form must pre-fetch `GET /api/v1/readings/previous/:nozzleId` to prefill previousReading, initialReading, and currentPrice.
  - Validate readingValue > previousReading on client too, but rely on server errors for enforcement.
  - If price not set for date, prompt user to set price or block entry (use `prices/check`).
  - For edit flows (manager): update reading requires recalculation; UI should warn that updates will affect subsequent readings/sales figures.

---

## Other tables referenced
- `tanks` / `tankRefills` (controllers exist) — map to `tankController` endpoints in `stations` routers.
- `shifts` — shift management is used by reading flows (`Shift.getActiveShift(userId)`); shift creation and close endpoints exist elsewhere (`/api/v1/stations/:stationId/shifts`).
- `handovers`, `settlements`, `credits`, `expenses`, `reports` — controllers/routes exist and map to station-scoped endpoints; they often depend on `nozzle_readings` and `tender_entries` or a `settlements` table (some features are partially implemented/placeholder).

---

## Notes & Observations (for gap analysis)
- Many controllers return both `data` and a backwards-compatible top-level alias (`reading`, `readings`, `nozzles`, `pumps`, `fuelPrices`) — frontends should accept either.
- There are minor route anomalies (e.g., `PUT /api/v1/auth/profile` maps to `getCurrentUser` in `auth.js`) — consider backend fix or enforce frontend to use `PUT /api/v1/users/:id`.
- Business logic is dispersed: plan limits, shift enforcement, and backdate validations are in controllers; UI must replicate only thin validation (helpful UX) and rely on server for canonical validation.
- Several endpoints provide both `data` and legacy keys (`reading`, `readings`) — keep client compatibility.

---

## Next steps
1. Create `docs/api-ui-mapping.md` mapping each endpoint to UI screens and data contracts (fields, sample requests/responses, required auth). (I'll start this next.)
2. Produce `docs/gap-analysis.md` listing mismatches and prioritized fixes.
3. Optionally run backend tests and include failing tests in the gap analysis (task 7).


