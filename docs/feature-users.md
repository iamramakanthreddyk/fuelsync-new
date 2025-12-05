**Feature: Users**

- **Core DB Table**: `users`
  - Columns (important):
    - `id` (UUID, PK)
    - `email` (VARCHAR, unique)
    - `password` (VARCHAR, hashed)
    - `name` (VARCHAR)
    - `phone` (VARCHAR)
    - `role` (ENUM `user_role`: `super_admin`,`owner`,`manager`,`employee`)
    - `station_id` (UUID, FK -> `stations.id`, nullable for super_admin/owner)
    - `plan_id` (UUID, FK -> `plans.id`)
    - `is_active` (boolean)
    - `last_login_at`, `created_at`, `updated_at`
  - Constraints:
    - Employees/managers must have a `station_id` (check constraint in schema)
    - `email` unique index exists

- **Related Tables**:
  - `stations` (owner relationship)
  - `plans` (subscription/limits)
  - `nozzle_readings` / `fuel_prices` reference `users` via `entered_by` or `updated_by`

- **API Endpoints (backend controllers)**
  - `GET /api/v1/users` — `userController.getUsers`
    - Query params: `role`, `stationId`, `isActive`, `search`, `page`, `limit`
    - Permission: role-based view filtering (super_admin, owner, manager, employee)
    - Response: `{ success: true, data: [User], pagination: { page, limit, total, pages } }`
  - `GET /api/v1/users/:id` — `userController.getUser`
    - Permission: `canAccessUser` logic enforced
    - Response: `{ success: true, data: User }`
  - `POST /api/v1/users` — `userController.createUser`
    - Body: `{ email, password, name, phone?, role, stationId?, planId? }`
    - Permissions: only certain roles can create others (super_admin -> owner, owner -> manager/employee, manager -> employee)
    - Validation: email/password/name/role required; stationId required for manager/employee; enforces employee limits per plan for owners
    - Responses: `201` with created user or error codes `400/403/404/409`
  - `PUT /api/v1/users/:id` — `userController.updateUser`
    - Body: `{ name?, phone?, stationId?, isActive?, planId? }`
    - Permissions: `canAccessUser` logic; super_admin can set owner planId
    - Prevents self-deactivation
  - `DELETE /api/v1/users/:id` — `userController.deactivateUser`
    - Soft-deactivates user (`isActive=false`); permissions enforced; cannot deactivate self
  - `POST /api/v1/users/:id/reset-password` — `userController.resetPassword`
    - Body: `{ newPassword }
    - Can reset own or managed users' password (permissions enforced)
  - `GET /api/v1/stations/:stationId/staff` — `userController.getStationStaff`
    - Returns staff for a station with summary counters (managers/employees)

- **Payload Shapes (frontend DTOs mapping)**
  - CreateUserDTO: `{ email: string, password: string, name: string, phone?: string, role: 'owner'|'manager'|'employee'|'super_admin', stationId?: string, planId?: string }`
  - User (API response): `{ id, email, name, phone?, role, stationId?, planId?, isActive, lastLoginAt?, createdAt, updatedAt, station?: { id, name }, plan?: { id, name } }`

- **Permissions / Business Rules**
  - Role creation rules: only allowed roles per creator role (enforced server-side in `createUser`)
  - Station requirement: `manager` and `employee` must have `stationId`
  - Owner employee limit: owner cannot create more staff than `max_employees` defined in their plan
  - View scope: owners/managers see only their stations/staff; employees see only themselves; super_admin sees all
  - Self-deactivation not allowed; cannot deactivate yourself

- **Frontend mapping & locations**
  - `src/hooks/api/index.ts` — `useCreateUser`, `useGetUsers` etc (React Query hooks)
  - `src/pages/SuperAdmin/UsersPage.tsx` — user management UI for super admins
  - `src/pages/Settings.tsx` — user profile update (name/phone)
  - `src/components/UserForm.tsx` (if present) — reused form for create/edit

- **Gaps & Recommendations**
  - Type mismatches: frontend sometimes uses `snake_case` fields (`station_id`) vs backend/camelCase (`stationId`). Consolidate via API client that normalizes keys.
  - Central types: Missing single `src/types/api.ts` with `User`, `CreateUserDTO`, and shared enums for roles. Add global enums for `user_role` to avoid string mismatches.
  - Validation: Server-side validation exists but frontend should replicate basic checks (email format, password length, required stationId when role is manager/employee) to reduce round-trips.
  - Tests: Add integration tests for `createUser` and permission scenarios (owner limit, manager permissions).
  - UI: Ensure `UsersPage` respects pagination and shows server error messages verbatim or translated.

- **Actionable next steps (short-term)**
  1. Add `docs/feature-users.md` (this file) — done.
  2. Create `src/types/api.ts` with `User`, `CreateUserDTO`, and `UserRole` enum and export used across client and hooks.
  3. Update `src/lib/api-client.ts` to normalize snake_case ↔ camelCase and centrally type responses.
  4. Run frontend type checks and fix places where `station_id` vs `stationId` mismatch causes compile errors.
  5. Add frontend validations in `UsersPage` and `UserForm` to match backend rules (station required for manager/employee, password min length).

- **References**
  - DB schema: `backend/database/schema.sql` (users table)
  - Controller: `backend/src/controllers/userController.js`
  - Frontend usage: `src/pages/SuperAdmin/UsersPage.tsx`, `src/hooks/api/index.ts`

---

## Epics & Process Rule

- **Rule (Epics-First):** Any UX gap or feature change must first be documented as an Epic inside this file (or `OWNER_UI_DOCUMENTATION.md` for owner-specific flows). Do not create new docs.
- **Epic Template:**
  - Epic Name: short
  - Goal: user-facing intent
  - Scope: DB → APIs → UI
  - Access: roles + enforcement points
  - Acceptance: tests and behavioral checks
  - Status: Not started / In-progress / Done (update with PR)

Add epics below as needed and reference them in PRs.

### Epic: User Management (Core)
- Goal: Consistent create/read/update/deactivate flows across roles (super_admin, owner, manager, employee).
- Scope: DB: `users`, `plans`, `stations` → APIs: `GET /api/v1/users`, `POST /api/v1/users`, `PUT /api/v1/users/:id`, `DELETE /api/v1/users/:id`, `POST /api/v1/users/:id/reset-password` → UI: `src/pages/SuperAdmin/UsersPage.tsx`, `src/pages/owner/EmployeesManagement.tsx`, `src/pages/Settings.tsx`, `src/components/UserForm.tsx`.
- Access: creator-role rules (super_admin -> owner; owner -> manager/employee; manager -> employee). Owners/managers limited to their stations; employees self-only.
- Acceptance: integration tests for create/update/deactivate; frontend form validations enforced; `src/types/api.ts` exists and used by hooks.
- Status: Not started

### Epic: Access & Roles (RBAC)
- Goal: Single source of truth for role rules and UI access enforcement so changes cascade predictably.
- Scope: DB: `users.role`, `plans` → APIs: authorization middleware (`canAccessUser`, ownership filters) → UI: `RequireRole` wrappers, route protection for `/owner/*`, `/superadmin/*`.
- Access: define explicit permission matrix in this file (below).
- Acceptance: automated permission tests; PRs modifying permissions must update this epic status and permission matrix.
- Status: Not started

### Epic: Super‑Admin Tools
- Goal: Onboard owners and manage plans and global reports.
- Scope: DB: `users` (owner role), `plans` → APIs/UI: SuperAdmin user management pages, plan CRUD endpoints, tenant analytics.
- Acceptance: end-to-end onboarding test, plan creation tests, admin-only endpoints guarded.
- Status: Not started

### Epic: Common Features (Readings / Payments / Reports)
- Goal: Single canonical flows for quick data entry, payments, and reports usable by multiple roles.
- Scope: DB: `nozzle_readings`, `fuel_prices`, `payments`, `handovers` → APIs: readings endpoint, payments endpoint, reports endpoints → UI: `src/hooks/useReadingManagement.tsx`, `QUICKDATAENTRY_ENHANCED_DOCS.md`, `OWNER_UI_DOCUMENTATION.md`.
- Acceptance: client-side validation, normalized API client for snake_case↔camelCase, one canonical quick entry component.
- Status: Not started

---

## Permission Matrix (Quick)
Role | Read Users | Create Users | Update Users | Deactivate Users
---|---:|---:|---:|---:
super_admin | Yes | Yes (owners) | Yes | Yes
owner | Yes (own stations) | Yes (manager/employee) | Yes (own staff) | Yes (own staff)
manager | Yes (station staff) | Limited (employee) | Limited (employee) | Limited (employee)
employee | Self only | No | Self only | No




