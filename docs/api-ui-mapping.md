# API → UI Mapping

Generated: 2025-12-05

This document maps backend API endpoints (see `docs/api-surface.json`) to frontend screens, components, request/response examples, required props/state, and UX notes. Use this as a checklist when updating the frontend to match backend behavior.

Format per UI screen:
- Screen name
- User roles that see it
- Primary API calls (method + path) used by the screen
- Required component(s) and suggested names
- Data model / essential fields (what frontend reads/writes)
- Sample request and response (concise)
- Validation & UX notes (client-side checks and error handling)

---

**Auth / Login Screen**
- Roles: all
- APIs:
  - POST `/api/v1/auth/login` (public)
  - POST `/api/v1/auth/register` (public, optional)
  - GET `/api/v1/auth/me` (protected, to rehydrate session)
- Components: `Auth/LoginForm`, `Auth/RegisterForm`, `Auth/SocialButtons` (optional)
- Essential fields: `email`, `password` (register: `name`, `phone`, optional `role`/`stationId`)
- Sample login request:
  - POST /api/v1/auth/login
  - Body: `{ "email": "admin@fuelsync.com", "password": "demo123" }`
- Sample response excerpt:
  - `{ "success": true, "token": "<jwt>", "user": { "id": "...", "email": "...", "role": "owner", "stations": [...] } }`
- Validation & UX:
  - Basic client checks: required fields, email format.
  - On success: store token in secure storage (localStorage or HttpOnly cookie via server if supported). Rehydrate user by calling `GET /api/v1/auth/me`.
  - Handle 401/401 messages and token expiry gracefully; redirect to `/login` on 401.

---

**Profile Screen (My Profile)**
- Roles: all
- APIs:
  - GET `/api/v1/auth/me` (protected)
  - PUT `/api/v1/users/:id` (protected) — prefer this for updates
  - POST `/api/v1/auth/change-password` (protected)
- Components: `Profile/ViewProfile`, `Profile/EditProfileForm`, `Profile/ChangePasswordModal`
- Data: `id`, `email`, `name`, `phone`, `role`, `stations[]`, `plan` (for owners)
- Sample GET response: `data` from `/auth/me` includes `stations` array for owner/manager
- Validation & UX:
  - Prefer `PUT /api/v1/users/:id` to update profile fields (backend `auth.js` has an alias that looks incorrect). Confirm API usage in code.
  - Show plan info (owners) and station list read-only; owners can manage station settings on station screen.

---

**Users / Staff Management Screen (List + Create/Edit)**
- Roles: `super_admin` (all users), `owner` (their station staff), `manager` (employees in their station)
- APIs:
  - GET `/api/v1/users` (list) — query params: `role`, `stationId`, `isActive`, `search`, `page`, `limit`
  - POST `/api/v1/users` (create) — creator must meet role rules
  - GET `/api/v1/users/:id` (detail)
  - PUT `/api/v1/users/:id` (update)
  - DELETE `/api/v1/users/:id` (deactivate)
  - POST `/api/v1/users/:id/reset-password` (admin reset)
  - GET `/api/v1/stations/:stationId/staff` (station staff list)
- Components: `Users/UserList`, `Users/UserRow`, `Users/UserFormModal`, `Users/UserDetailDrawer`
- Data model (display/edit): `id`, `email`, `name`, `phone`, `role`, `stationId`, `isActive`, `planId`
- Create user rules (frontend enforcements): hide role choices not allowed for the creator. E.g. if currentUser.role === 'manager', only show `employee`.
- Sample create request (manager creating employee):
  - POST /api/v1/users
  - Body: `{ "email": "emp@demo.com", "password": "secret123", "name": "Pump Emp", "role": "employee", "stationId": "..." }`
- Validation & UX:
  - Show server errors: 400 (validation), 403 (insufficient permissions), 409 (email exists).
  - Use pagination and search; show `pagination` data returned by API.
  - Disable delete for self; server returns 400 if attempted.

---

**Stations List & Detail Screens**
- Roles: owner, manager, employee (scoped), super_admin (all)
- APIs:
  - GET `/api/v1/stations` (list) — returns pumps summary and `todaySales`/`lastReading` enrichment
  - POST `/api/v1/stations` (create) — owner or super_admin; super_admin must pass `ownerId`
  - GET `/api/v1/stations/:id` (detail)
  - PUT `/api/v1/stations/:id` (update)
  - GET `/api/v1/stations/:id/settings` and PUT `/api/v1/stations/:id/settings`
  - Nested: `GET /api/v1/stations/:stationId/pumps`, `GET /api/v1/stations/:stationId/pumps` POST, etc.
- Components: `Stations/StationList`, `Stations/StationCard`, `Stations/StationDetail`, `Stations/StationSettingsForm`
- Key fields: `id`, `name`, `code`, `ownerId`, `address`, `city`, `phone`, `pumpCount`, `activePumps`, `todaySales`, `lastReading`, `settings` (requireShiftForReadings, missedReadingThresholdDays)
- Sample create body (owner): `{ "name": "New Station", "city": "Hyderabad" }` (super_admin: include `ownerId`).
- Validation & UX:
  - For super_admin creation require owner selection (fetch owner list via `GET /api/v1/users?role=owner`).
  - Show owner-only settings edit; block access to non-owner roles at UI level and handle 403.
  - Station list: show `todaySales` and `lastReading` with a tooltip that values are computed server-side.

---

**Pumps Screen (Station → Pumps)**
- Roles: owner, super_admin can create/update/delete; managers can view; employees view only
- APIs:
  - GET `/api/v1/stations/:stationId/pumps` or `GET /api/v1/pumps?stationId=...`
  - POST `/api/v1/stations/:stationId/pumps` (create)
  - PUT `/api/v1/stations/pumps/:id` (update)
  - DELETE `/api/v1/pumps/:id` (delete) — if implemented
- Components: `Pumps/PumpList`, `Pumps/PumpRow`, `Pumps/PumpFormModal`
- Fields: `id`, `name`, `pumpNumber`, `status`, `notes`, `nozzles[]` (each nozzle: `id`, `nozzleNumber`, `fuelType`, `lastReading`)
- UX:
  - When creating pump, frontend can pre-check uniqueness by fetching existing pumps and validating `pumpNumber` locally (server will enforce uniqueness and return 409 if violated).
  - If pump status set to `repair` or `inactive`, UI should visually mark associated nozzles disabled.

---

**Nozzles Screen (Pump → Nozzles)**
- Roles: owner/super_admin manage; manager view; employee view
- APIs:
  - GET `/api/v1/nozzles?pumpId=...` or `?stationId=...`
  - POST `/api/v1/nozzles` (create)
  - PUT `/api/v1/nozzles/:id` (update)
  - GET `/api/v1/nozzles/:id` (detail)
- Components: `Nozzles/NozzleList`, `Nozzles/NozzleRow`, `Nozzles/NozzleForm`
- Fields: `id`, `pumpId`, `nozzleNumber`, `fuelType`, `initialReading`, `status`, `lastReading`
- UX/Validation:
  - Show `initial_reading` on nozzle creation; if none, block reading entries until initial set.
  - When creating nozzle, check available nozzle numbers by fetching existing nozzles for the pump.

---

**Fuel Prices Screen**
- Roles: manager (set), owner (view/manage), super_admin
- APIs:
  - GET `/api/v1/stations/:stationId/prices` (get current & history)
  - POST `/api/v1/stations/:stationId/prices` (set price, manager+)
  - GET `/api/v1/stations/:stationId/prices/check` (used by reading entry to ensure price exists for date)
- Components: `Prices/PriceList`, `Prices/PriceFormModal`, `Prices/PriceHistory` (chart)
- Fields: `fuelType`, `price`, `effectiveFrom`, `updatedBy`
- Sample set request:
  - POST /api/v1/stations/:stationId/prices
  - Body: `{ "fuelType": "petrol", "price": 103.5, "effectiveFrom": "2025-12-05" }`
- UX:
  - Before allowing reading/sale entry for a date, call `prices/check` to confirm price exists. If not, prompt the manager to set the price.
  - Show current price per fuel type prominently on station dashboards.

---

**Readings Entry Screen (Core business flow)**
- Roles: manager, employee (create), managers/owner (edit/approve)
- APIs:
  - GET `/api/v1/readings/previous/:nozzleId` — prefill previous reading, current price
  - POST `/api/v1/readings` — create reading
  - GET `/api/v1/readings/today` — show today readings
  - GET `/api/v1/readings` — history / search
  - PUT `/api/v1/readings/:id` — update (manager+)
  - DELETE `/api/v1/readings/:id` — delete per permissions
- Components: `Readings/EntryForm`, `Readings/PreviousReadingPanel`, `Readings/Today'sList`, `Readings/ReadingDetail`
- Entry form fields (required): `nozzleId`, `readingDate` (YYYY-MM-DD), `readingValue` (number). Optional: `previousReading`, `cashAmount`, `onlineAmount`, `creditAmount`, `notes`.
- Sample previous GET response snippet:
  - `{ data: { previousReading: 15000, previousDate: "2025-12-04", currentPrice: 103.5 } }
- Sample create request:
  - POST /api/v1/readings
  - Body: `{ "nozzleId": "uuid", "readingDate": "2025-12-05", "readingValue": 15050, "cashAmount": 1000, "onlineAmount": 250 }`
- Validation & UX:
  - Client should prefetch previous reading and current price.
  - Validate `readingValue > previousReading` (unless `initialReading` case). If client provides `litresSold` or `totalAmount`, ensure consistency and ask user to confirm if there's a small rounding difference.
  - Check `prices/check` before submission to ensure price exists for that date or allow manager to supply `pricePerLitre`/`totalAmount` explicitly.
  - If station requires shifts (`requireShiftForReadings`), prompt the user to start a shift or show an error returned from server (server returns `requiresShift: true` in error body).
  - For backdated entries, show owner plan backdate limit and warn if beyond allowed days (server enforces it). Optionally show remaining allowable backdated days using `owner.plan.backdatedDays` from `/auth/me`.

---

**Readings History & Reporting Screens**
- Roles: owner, manager, super_admin
- APIs:
  - GET `/api/v1/readings` (filters: date range, stationId, pumpId, nozzleId, pagination)
  - GET `/api/v1/stations/:stationId/daily-sales` (station-level summary)
  - GET `/api/v1/readings/summary?stationId=...&date=...` (legacy compatibility)
- Components: `Reports/ReadingsTable`, `Reports/DailySummary`, `Reports/ExportButtons`
- UX:
  - Use server pagination; show CSV/Export button only if owner.plan.canExport === true (pulled from `/auth/me`).

---

## Implementation guidance for frontend devs
- Use a centralized API client wrapper that attaches `Authorization: Bearer <token>` and handles 401 globally (redirect to login). Put this wrapper in `src/lib/apiClient.ts` (or `.js`).
- Map backend `success`/`data` structure to client models in one place (normalize `data` vs legacy top-level keys like `readings`/`reading`/`nozzles`). A small adapter function `normalizeApiResponse(response)` helps.
- Prefer server truth for critical validations (unique pump numbers, backdate limits, plan limits). Do lightweight client validation for UX but show server error messages verbatim as needed.
- Error handling: show field-specific errors when server returns 400 with message; show a generic toasts for 403/401/500.
- Feature flags: use `user.plan` data from `/auth/me` to toggle UI features (export, max counts, etc.). Always reflect server limits in UI messaging.

---

## Next steps
1. Implement API client and normalize responses.
2. Update auth flow to use `/api/v1/auth/login` and rehydrate via `/api/v1/auth/me`.
3. Update profile edit to use `PUT /api/v1/users/:id` (not `PUT /api/v1/auth/profile`).
4. Implement or adapt components listed above iteratively: Auth → Users → Stations → Pumps/Nozzles → Prices → Readings.


