# FuelSync Backend - Development Brain 🧠

This document serves as the "brain" for AI agents and developers working on the FuelSync backend. It contains architecture decisions, patterns used, and important context for future development.

## Last Updated
**Date:** Session 2024 - Backend Improvements Phase

---

## Architecture Overview

### Tech Stack
- **Runtime:** Node.js (Express.js)
- **ORM:** Sequelize v6
- **Database:** PostgreSQL with UUID primary keys
- **Authentication:** JWT with token blacklisting
- **Validation:** Joi schemas
- **Security:** Helmet, CORS, rate limiting

### Multi-Tenant Model
The system uses **station-based multi-tenancy**:
- Data is isolated by `stationId` at the application layer
- Super admins can access all stations
- Owners/managers/employees are scoped to their assigned station

---

## Role Hierarchy

```
super_admin (highest)
    └── owner
        └── manager
            └── employee (lowest)
```

| Role | Scope | Capabilities |
|------|-------|--------------|
| `super_admin` | All stations | Full system access, user management, plan management |
| `owner` | Own station(s) | All station operations, employee management |
| `manager` | Assigned station | Daily operations, closures, reporting |
| `employee` | Assigned station | Sales entry, readings, basic operations |

---

## Database Models

### Core Models (in `/models/index.js`)

```javascript
// Model imports - USE THESE (not duplicates)
const User = require('./MultiTenantUser');        // NOT User.js
const Pump = require('./MultiTenantPump');        // NOT Pump.js
const Nozzle = require('./MultiTenantNozzle');    // NOT Nozzle.js
const FuelPrice = require('./MultiTenantFuelPrice');
const Sale = require('./MultiTenantSale');
const ManualReading = require('./MultiTenantManualReading');
```

### Model Relationships
```
User ──belongs_to──> Station
User ──belongs_to──> Plan
Station ──has_many──> Pump ──has_many──> Nozzle
Station ──has_many──> FuelTank ──has_many──> FuelDelivery
Station ──has_many──> Sale
Station ──has_many──> DailyClosure
User ──has_many──> AuditLog
```

### Key Models Added (Session 2024)

1. **FuelTank** - Tank inventory with dip readings
2. **FuelDelivery** - Delivery tracking with verification
3. **DailyClosure** - Shift reconciliation with approval workflow
4. **AuditLog** - Immutable action log
5. **TokenBlacklist** - JWT invalidation
6. **PasswordResetToken** - Password recovery

---

## Controllers Pattern

All controllers follow this structure:

```javascript
/**
 * Controller documentation
 * Endpoints: what this handles
 */

// Create
exports.createEntity = async (req, res, next) => {
  try {
    // 1. Validate permissions (already done by middleware)
    // 2. Extract data from req.body
    // 3. Create record
    // 4. Return with success: true
    res.status(201).json({
      success: true,
      data: newEntity,
      message: 'Created successfully'
    });
  } catch (error) {
    next(error);
  }
};
```

### Controllers Created (Session 2024)

| Controller | Purpose | Key Methods |
|------------|---------|-------------|
| `stationController.js` | Station CRUD | create, list, get, update, delete, summary |
| `nozzleController.js` | Nozzle management | CRUD + bulkUpsert |
| `dashboardController.js` | Analytics | summary, trends, breakdown |
| `inventoryController.js` | Tank/delivery management | tanks CRUD, deliveries, dip readings |
| `closureController.js` | Shift reconciliation | prepare, create, submit, review |

---

## Routes Pattern

```javascript
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/roleAuth');
const controller = require('../controllers/entityController');

// All routes require authentication
router.use(authenticate);

// CRUD routes with role checks
router.get('/', controller.list);
router.post('/', requireMinRole('manager'), controller.create);
router.get('/:id', controller.getById);
router.put('/:id', requireMinRole('manager'), controller.update);
router.delete('/:id', requireRole(['owner', 'super_admin']), controller.delete);

module.exports = router;
```

### Routes Created (Session 2024)

| Route File | Base Path | Description |
|------------|-----------|-------------|
| `stations.js` | `/api/v1/stations` | Station management |
| `nozzles.js` | `/api/v1/pumps/:pumpId/nozzles` | Nested nozzle routes |
| `nozzlesDirect.js` | `/api/v1/nozzles` | Direct nozzle access |
| `dashboard.js` | `/api/v1/dashboard` | Analytics endpoints |
| `inventory.js` | `/api/v1/inventory` | Tanks and deliveries |
| `closures.js` | `/api/v1/closures` | Daily closures |

---

## Middleware

### Authentication Flow
```
Request → rateLimiter → authenticate → roleAuth → controller
```

### Middleware Files

| File | Purpose |
|------|---------|
| `auth.js` | JWT verification, sets `req.userId`, `req.user` |
| `roleAuth.js` | Role-based access (requireRole, requireMinRole, requireStationAccess) |
| `errorHandler.js` | Global error handling |
| `rateLimiter.js` | Rate limiting (100 req/min) |
| `auditLogger.js` | Automatic mutation logging |

### Role Authorization Functions

```javascript
// Require specific role(s)
requireRole(['owner', 'super_admin'])

// Require minimum role level
requireMinRole('manager')  // manager, owner, super_admin

// Require station access
requireStationAccess(req.params.stationId)
```

---

## Validation (Joi Schemas)

Location: `/utils/validationSchemas.js`

### Usage Pattern

```javascript
const { validate, schemas } = require('../utils/validationSchemas');

// In route
router.post('/', validate(schemas.station.create), controller.create);
```

### Available Schemas

- `station.create`, `station.update`
- `pump.create`, `pump.update`
- `nozzle.create`, `nozzle.update`, `nozzle.bulkUpsert`
- `tank.create`, `tank.update`, `tank.dipReading`
- `delivery.create`, `delivery.verify`
- `closure.create`, `closure.submit`, `closure.review`
- `user.create`, `user.update`
- `common.pagination`, `common.dateRange`, `common.uuid`

---

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 100,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": { ... }
  }
}
```

---

## Database Queries

### Station-Scoped Queries

Always filter by station access:

```javascript
// For non-super-admin users
const whereClause = {
  ...(req.user.role !== 'super_admin' && { stationId: req.user.stationId })
};

const records = await Model.findAll({ where: whereClause });
```

### Date Range Queries

```javascript
const { startDate, endDate } = req.query;
const dateFilter = {
  ...(startDate && endDate && {
    createdAt: {
      [Op.between]: [new Date(startDate), new Date(endDate)]
    }
  })
};
```

---

## Files to Ignore/Delete

These are legacy duplicates - the MultiTenant versions should be used:

- ❌ `/models/User.js` → Use `MultiTenantUser.js`
- ❌ `/models/Pump.js` → Use `MultiTenantPump.js`
- ❌ `/models/Nozzle.js` → Use `MultiTenantNozzle.js`
- ❌ `/models/FuelPrice.js` → Use `MultiTenantFuelPrice.js`
- ❌ `/models/Sale.js` → Use `MultiTenantSale.js`
-- ❌ `/models/NozzleReading.js` → Use `MultiTenantManualReading.js`
- ❌ `/models/multiTenantIndex.js` → Use `index.js`

---

## Important Patterns

### 1. Plan-Based Limits
Owners are limited by their plan:
```javascript
const planLimits = {
  free: { maxStations: 1, maxPumps: 2, maxEmployees: 2 },
  basic: { maxStations: 3, maxPumps: 10, maxEmployees: 10 },
  premium: { maxStations: 10, maxPumps: 50, maxEmployees: 50 }
};
```

### 2. Soft Deletes
Use `isActive: false` instead of hard deletes:
```javascript
await station.update({ isActive: false });
```

### 3. Audit Trail
The `auditLogger` middleware automatically logs:
- All POST, PUT, PATCH, DELETE requests
- User ID, station ID, IP address
- Request body (new values)

### 4. Timezone Handling
All dates stored in UTC. Frontend converts to user's timezone.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | ✅ | PostgreSQL host |
| `DB_PORT` | ✅ | PostgreSQL port |
| `DB_USER` | ✅ | Database user |
| `DB_PASSWORD` | ✅ | Database password |
| `DB_NAME` | ✅ | Database name |
| `JWT_SECRET` | ✅ | JWT signing key |
| `JWT_EXPIRATION` | ❌ | Token TTL (default: 24h) |
| `PORT` | ❌ | Server port (default: 3001) |
| `NODE_ENV` | ❌ | development/production |
| `AZURE_VISION_KEY` | ❌ | For optional receipt parsing feature |
| `AZURE_VISION_ENDPOINT` | ❌ | For optional receipt parsing feature |

---

## Next Steps / TODO

1. **Database Migrations** - Create proper Sequelize migrations for new models
2. **Test Coverage** - Add unit tests for new controllers
3. **Manual Reading Flow** - Ensure manual reading endpoints and device integrations are complete
4. **Notifications** - Add email/SMS notifications for low stock, closures
5. **Reports** - Implement report generation and export
6. **Frontend Sync** - Update frontend to use new endpoints

---

## Troubleshooting

### Common Issues

1. **"Cannot find module"** - Check imports in `/models/index.js`
2. **"relation does not exist"** - Run `npm run setup-db`
3. **"Invalid token"** - Check JWT_SECRET matches
4. **"Rate limited"** - Wait 1 minute or adjust rateLimiter

### Debug Commands

```bash
# Check DB connection
npm run test:db

# Reset database
npm run setup-db

# View logs
NODE_ENV=development npm run dev
```

---

## Contact / Ownership

This backend is part of the FuelSync project, consolidating:
- `fuel-hub-frontend` (frontend-only, has tests)
- `fuelsync-hub` (full-stack, this backend)

The goal is to merge the best of both into a single, well-structured application.
