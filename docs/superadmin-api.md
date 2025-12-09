# FuelSync Superadmin API Documentation

## Overview

The FuelSync Superadmin API provides comprehensive management capabilities for super administrators to manage users, stations, pumps, nozzles, and analytics across the entire system.

All superadmin endpoints require JWT authentication with `role=superadmin` in the user record.

## Base URL

All endpoints are available at:
```
https://untzkhbbsowpkmwrxdws.supabase.co/functions/v1/
```

## Authentication

Include the JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Owner + Station Management

#### POST /superadmin-owners
Create an owner user and their station in one transaction.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+91-9876543210",
  "password": "temporaryPassword123",
  "stationName": "Green Valley IOCL",
  "brand": "IOCL",
  "address": "123 Main Street, City, State, PIN"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "owner": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "owner",
      "is_active": true
    },
    "station": {
      "id": 1,
      "name": "Green Valley IOCL",
      "brand": "IOCL",
      "address": "123 Main Street, City, State, PIN",
      "owner_id": 1,
      "is_active": true
    }
  }
}
```

### 2. User Management

#### GET /superadmin-users
List all users (optionally filtered).

#### POST /superadmin-users
Create a user.
- To create an employee, supply existing `station_id`
- To create a new owner (always), supply required owner fields and station details to create the station
- To assign an owner to a new (extra) station, call this endpoint again with new station fields

#### PUT /superadmin-users/{userId}/edit
Edit user profile fields: name, email, phone, role, is_active.

**Body:**
```json
{
  "name": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "role": "superadmin | owner | employee (optional)",
  "is_active": "boolean (optional)"
}
```

#### PUT /superadmin-users/{userId}/role
Change user's role.

#### PUT /superadmin-users/{userId}/status
Activate/deactivate user.

#### DELETE /superadmin-users/{userId}
Delete user. Deletes from both "users" and "auth" system if possible.

**Response:**
```json
{ "success": true, "message": "User deleted successfully" }
```

### 3. Station Management

#### GET /superadmin-stations
List all stations with optional filtering.

**Query Parameters:**
- `ownerId` (optional): Filter by owner ID
- `brand` (optional): Filter by brand (`IOCL`, `BPCL`, `HPCL`)
- `active` (optional): Filter by active status (`true`, `false`)

**Examples:**
```
GET /superadmin-stations
GET /superadmin-stations?brand=IOCL
GET /superadmin-stations?ownerId=1
GET /superadmin-stations?active=true
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Green Valley IOCL",
      "brand": "IOCL",
      "address": "123 Main Street, City, State, PIN",
      "is_active": true,
      "created_at": "2023-12-15T10:30:00Z",
      "users": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
      },
      "plans": {
        "id": 1,
        "name": "Basic",
        "price_monthly": 999
      },
      "pumps": { "count": 3 },
      "nozzles": { "count": 6 }
    }
  ]
}
```

#### POST /superadmin-stations
Create a new station (standalone, without owner creation).

**Request Body:**
```json
{
  "name": "Highway Express BPCL",
  "brand": "BPCL",
  "address": "456 Highway Road, City, State, PIN",
  "owner_id": 2,
  "current_plan_id": 1
}
```

### 4. User & Station Actions

#### PUT /superadmin-actions/users/{id}/activate
Toggle user activation status.

**Request Body:**
```json
{
  "is_active": false
}
```

#### PUT /superadmin-actions/stations/{id}/deactivate
Toggle station activation status.

**Request Body:**
```json
{
  "is_active": false
}
```

#### PUT /superadmin-actions/stations/{id}/plan
Update station subscription plan.

**Request Body:**
```json
{
  "planId": 2,
  "isPaid": true
}
```

### 5. Equipment Assignment

#### PUT /superadmin-actions/pumps/{id}/assign
Assign pump to a different station.

**Request Body:**
```json
{
  "stationId": 2
}
```

#### PUT /superadmin-actions/nozzles/{id}/assign
Assign nozzle to a different station.

**Request Body:**
```json
{
  "stationId": 2
}
```

### 6. Cross-Station Analytics

#### GET /superadmin-analytics
Get system-wide sales analytics.

**Query Parameters:**
- `startDate` (optional): Start date filter (ISO 8601)
- `endDate` (optional): End date filter (ISO 8601)
- `stationId` (optional): Station filter (use `all` for all stations)

**Examples:**
```
GET /superadmin-analytics
GET /superadmin-analytics?stationId=all
GET /superadmin-analytics?startDate=2023-12-01&endDate=2023-12-31
GET /superadmin-analytics?stationId=1&startDate=2023-12-01
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRevenue": 150000,
      "totalVolume": 12500,
      "totalTransactions": 450,
      "stationBreakdown": {
        "Green Valley IOCL": {
          "revenue": 75000,
          "volume": 6250,
          "transactions": 225
        },
        "Highway Express BPCL": {
          "revenue": 75000,
          "volume": 6250,
          "transactions": 225
        }
      },
      "fuelTypeBreakdown": {
        "PETROL": {
          "revenue": 90000,
          "volume": 7500,
          "transactions": 270
        },
        "DIESEL": {
          "revenue": 60000,
          "volume": 5000,
          "transactions": 180
        }
      }
    },
    "transactions": [
      {
        "id": 1,
        "total_amount": 1500,
        "delta_volume_l": 25.5,
        "created_at": "2023-12-15T10:30:00Z",
        "stations": {
          "id": 1,
          "name": "Green Valley IOCL",
          "brand": "IOCL"
        },
        "nozzles": {
          "id": 1,
          "fuel_type": "PETROL"
        }
      }
    ]
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (insufficient permissions)
- `400`: Bad Request (invalid parameters)
- `404`: Not Found (resource not found)
- `500`: Internal Server Error

## Authentication Flow

1. User logs in with superadmin credentials
2. Frontend receives JWT token
3. Include token in `Authorization: Bearer <token>` header
4. Backend validates token and checks `role=superadmin`
5. If valid, proceed with operation

## Database Tables Used

The superadmin API interacts with these main tables:
- `users` - User accounts and roles
- `stations` - Fuel stations
-- `user_stations` - (Not used by runtime) Many-to-many user-station assignments. Managers/employees are assigned via `users.station_id` in the current schema.
- `pumps` - Fuel pumps
- `nozzles` - Fuel nozzles
- `pump_assignments` - Pump assignment history
- `nozzle_assignments` - Nozzle assignment history
- `station_plans` - Station subscription history
- `plans` - Available subscription plans
- `sales` - Sales transactions
- `tender_entries` - Payment collections

## Rate Limiting

All endpoints are subject to standard Supabase rate limiting. For high-volume operations, implement appropriate retry logic with exponential backoff.

## Security Considerations

- All endpoints require superadmin role verification
- Sensitive operations (user creation, station deactivation) are logged
- Password fields are excluded from response data
- CORS is configured for web application access
