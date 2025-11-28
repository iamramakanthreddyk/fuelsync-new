# FuelSync API Reference

## Base URL
```
http://localhost:3001/api/v1
```

## Authentication

All endpoints (except login/register) require JWT token:
```
Authorization: Bearer <token>
```

---

## Auth Endpoints

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@fuelsync.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "admin@fuelsync.com",
      "name": "Super Admin",
      "role": "super_admin",
      "station": null,
      "plan": { "name": "Premium" }
    }
  }
}
```

### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

### Register (Self-signup as Owner)
```http
POST /auth/register
Content-Type: application/json

{
  "email": "owner@station.com",
  "password": "securepass",
  "name": "Station Owner",
  "phone": "+91-9876543210"
}
```

---

## User Management

### List Users
```http
GET /users?role=employee&stationId=uuid&page=1&limit=20
Authorization: Bearer <token>
```

**Permissions:** Results filtered by role:
- Super Admin: All users
- Owner: Staff at their stations
- Manager: Employees at their station

### Create User
```http
POST /users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "employee@station.com",
  "password": "pass123",
  "name": "Ramesh Kumar",
  "phone": "+91-9876543210",
  "role": "employee",
  "stationId": "station-uuid"
}
```

**Who can create whom:**
| Creator      | Can Create        |
|--------------|-------------------|
| super_admin  | owner             |
| owner        | manager, employee |
| manager      | employee          |

### Update User
```http
PUT /users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "phone": "+91-9999999999",
  "isActive": true
}
```

### Deactivate User
```http
DELETE /users/:id
Authorization: Bearer <token>
```

### Reset Password
```http
POST /users/:id/reset-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "newPassword": "newSecurePass123"
}
```

---

## Station Management

### List Stations
```http
GET /stations
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Bharat Petroleum - Indiranagar",
      "city": "Bangalore",
      "state": "Karnataka",
      "pumpCount": 4,
      "activePumps": 4,
      "owner": { "id": "uuid", "name": "Owner Name" }
    }
  ]
}
```

### Create Station
```http
POST /stations
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "HP Station - Koramangala",
  "code": "HP-BLR-001",
  "address": "100 Feet Road",
  "city": "Bangalore",
  "state": "Karnataka",
  "pincode": "560034",
  "phone": "+91-80-12345678",
  "gstNumber": "29AABCT1234F1ZN"
}
```

### Get Station Details
```http
GET /stations/:id
Authorization: Bearer <token>
```

**Response includes:** pumps, nozzles, fuel prices, staff

### Get Station Staff
```http
GET /stations/:stationId/staff?role=employee
Authorization: Bearer <token>
```

---

## Pump Management

### List Pumps
```http
GET /stations/:stationId/pumps
Authorization: Bearer <token>
```

### Create Pump
```http
POST /stations/:stationId/pumps
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Pump 1",
  "pumpNumber": 1,
  "notes": "Near entrance"
}
```

### Update Pump
```http
PUT /stations/pumps/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Pump 1 - Updated",
  "status": "active"
}
```

**Status values:** `active`, `inactive`, `maintenance`

---

## Nozzle Management

### List Nozzles
```http
GET /stations/pumps/:pumpId/nozzles
Authorization: Bearer <token>
```

### Create Nozzle
```http
POST /stations/pumps/:pumpId/nozzles
Authorization: Bearer <token>
Content-Type: application/json

{
  "nozzleNumber": 1,
  "fuelType": "petrol",
  "initialReading": 12345.67
}
```

**Fuel Types:** `petrol`, `diesel`, `premium_petrol`, `premium_diesel`, `cng`, `lpg`

---

## Fuel Prices

### Get Current Prices
```http
GET /stations/:stationId/prices
Authorization: Bearer <token>
```

### Set Fuel Price
```http
POST /stations/:stationId/prices
Authorization: Bearer <token>
Content-Type: application/json

{
  "fuelType": "petrol",
  "price": 102.50,
  "effectiveFrom": "2025-11-27"
}
```

---

## Nozzle Readings (Core Feature)

### Get Form Data
```http
GET /readings/form/:nozzleId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nozzle": {
      "id": "uuid",
      "nozzleNumber": 1,
      "fuelType": "petrol"
    },
    "pump": { "id": "uuid", "name": "Pump 1" },
    "previousReading": 12345.67,
    "currentPrice": 102.50,
    "creditors": [
      { "id": "uuid", "name": "ABC Transporters" }
    ]
  }
}
```

### Submit Reading
```http
POST /readings
Authorization: Bearer <token>
Content-Type: application/json

{
  "nozzleId": "nozzle-uuid",
  "currentReading": 12400.50,
  "readingDate": "2025-11-27",
  "cashAmount": 3500.00,
  "onlineAmount": 1500.00,
  "creditAmount": 636.27,
  "creditorId": "creditor-uuid",
  "notes": "Morning shift"
}
```

**Auto-calculated:**
- `litresSold = currentReading - previousReading`
- `totalAmount = litresSold × currentPrice`
- Validates: `cashAmount + onlineAmount + creditAmount = totalAmount`

### Get Daily Readings
```http
GET /readings/daily/2025-11-27
Authorization: Bearer <token>
```

### Update Payment Split
```http
PUT /readings/:id/payment
Authorization: Bearer <token>
Content-Type: application/json

{
  "cashAmount": 4000.00,
  "onlineAmount": 1136.27,
  "creditAmount": 500.00
}
```

### Delete Reading
```http
DELETE /readings/:id
Authorization: Bearer <token>
```
**Permissions:** Manager or above

---

## Credit Management

### List Creditors
```http
GET /stations/:stationId/creditors?isActive=true&search=ABC
Authorization: Bearer <token>
```

### Create Creditor
```http
POST /stations/:stationId/creditors
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "ABC Transporters",
  "contactPerson": "Mr. Sharma",
  "phone": "+91-9876543210",
  "email": "abc@transport.com",
  "businessName": "ABC Transport Pvt Ltd",
  "gstNumber": "29AABCT1234F1ZN",
  "creditLimit": 100000,
  "notes": "Regular customer"
}
```

### Get Creditor with Transactions
```http
GET /creditors/:id
Authorization: Bearer <token>
```

### Record Credit Sale
```http
POST /stations/:stationId/credits
Authorization: Bearer <token>
Content-Type: application/json

{
  "creditorId": "creditor-uuid",
  "fuelType": "diesel",
  "litres": 100,
  "pricePerLitre": 95.50,
  "vehicleNumber": "KA-01-AB-1234",
  "notes": "Regular supply"
}
```

### Record Settlement
```http
POST /stations/:stationId/creditors/:creditorId/settle
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 50000,
  "referenceNumber": "NEFT123456",
  "notes": "Partial payment"
}
```

### Get Credit Summary
```http
GET /stations/:stationId/credit-summary
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalOutstanding": 150000,
      "totalCreditors": 25,
      "creditorsWithBalance": 18
    },
    "topCreditors": [...],
    "recentTransactions": [...]
  }
}
```

---

## Expense Management

### Get Expense Categories
```http
GET /expense-categories
Authorization: Bearer <token>
```

**Categories:** `salary`, `electricity`, `rent`, `maintenance`, `supplies`, `taxes`, `insurance`, `transportation`, `miscellaneous`

### List Expenses
```http
GET /stations/:stationId/expenses?month=2025-11&category=salary
Authorization: Bearer <token>
```

### Create Expense
```http
POST /stations/:stationId/expenses
Authorization: Bearer <token>
Content-Type: application/json

{
  "category": "electricity",
  "description": "November electricity bill",
  "amount": 15000,
  "expenseDate": "2025-11-27",
  "receiptNumber": "EB-2025-11-1234"
}
```

### Set Cost of Goods (Owner Only)
```http
POST /stations/:stationId/cost-of-goods
Authorization: Bearer <token>
Content-Type: application/json

{
  "month": "2025-11",
  "fuelType": "petrol",
  "litresPurchased": 50000,
  "totalCost": 4750000,
  "supplierName": "IOCL",
  "invoiceNumbers": ["INV-001", "INV-002"]
}
```

### Get Profit/Loss Statement (Owner Only)
```http
GET /stations/:stationId/profit-loss?month=2025-11
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "month": "2025-11",
    "revenue": {
      "totalSales": 1500000,
      "cashReceived": 1000000,
      "onlineReceived": 350000,
      "creditSettlements": 100000,
      "totalReceived": 1450000
    },
    "credits": {
      "givenThisMonth": 80000,
      "settledThisMonth": 100000,
      "totalOutstanding": 150000
    },
    "costs": {
      "costOfGoods": 1350000,
      "expenses": 75000,
      "totalCosts": 1425000
    },
    "profit": {
      "grossProfit": 150000,
      "netProfit": 75000,
      "margin": "5.0"
    }
  }
}
```

---

## Dashboard Analytics

### Today's Summary
```http
GET /dashboard/summary
Authorization: Bearer <token>
```

### Daily Breakdown
```http
GET /dashboard/daily?startDate=2025-11-01&endDate=2025-11-27
Authorization: Bearer <token>
```

### Fuel Type Breakdown
```http
GET /dashboard/fuel-breakdown?startDate=2025-11-01&endDate=2025-11-27
Authorization: Bearer <token>
```

### Pump Performance
```http
GET /dashboard/pump-performance?startDate=2025-11-01&endDate=2025-11-27
Authorization: Bearer <token>
```

### Nozzle Breakdown (Owner Only)
```http
GET /dashboard/nozzle-breakdown?startDate=2025-11-01&endDate=2025-11-27&pumpId=uuid
Authorization: Bearer <token>
```

### Financial Overview (Owner Only)
```http
GET /dashboard/financial-overview?month=2025-11
Authorization: Bearer <token>
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400  | Bad Request - Invalid input |
| 401  | Unauthorized - No/invalid token |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource doesn't exist |
| 409  | Conflict - Duplicate entry |
| 429  | Too Many Requests - Rate limited |
| 500  | Internal Server Error |

---

## Rate Limits

- **Default:** 100 requests per 15 minutes per IP
- **Auth endpoints:** Same limit

---

## Pagination

List endpoints support pagination:
```
?page=1&limit=20
```

Response includes:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## Filtering & Search

Common query parameters:
- `?search=term` - Text search
- `?isActive=true` - Filter by status
- `?startDate=2025-11-01&endDate=2025-11-30` - Date range
- `?stationId=uuid` - Filter by station
- `?role=employee` - Filter by role
