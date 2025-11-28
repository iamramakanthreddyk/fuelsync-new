# FuelSync API Specification

> **Version:** 1.0.0  
> **Base URL:** `http://localhost:3001/api/v1`  
> **Last Updated:** November 2025

## Table of Contents

1. [Overview](#overview)
2. [Data Formats](#data-formats)
3. [Authentication](#authentication)
4. [Response Format](#response-format)
5. [Error Codes](#error-codes)
6. [Endpoints](#endpoints)

---

## Overview

FuelSync is a fuel station management API. All requests must include appropriate authentication headers, and responses follow a consistent JSON format.

### API Conventions

| Convention | Description |
|------------|-------------|
| Protocol | HTTPS (HTTP in development) |
| Content-Type | `application/json` |
| Authentication | Bearer Token (JWT) |
| Date Format | ISO 8601 (`YYYY-MM-DD` or full ISO) |
| UUID Format | UUIDv4 (lowercase) |
| Currency | INR (Indian Rupee) |

---

## Data Formats

### Date Formats

| Type | Format | Example | Usage |
|------|--------|---------|-------|
| Date Only | `YYYY-MM-DD` | `"2025-11-27"` | `readingDate`, `effectiveFrom`, `expenseDate` |
| DateTime | ISO 8601 | `"2025-11-27T14:30:00.000Z"` | `createdAt`, `updatedAt` |
| Time Only | `HH:mm` | `"14:30"` | `startTime`, `endTime` |

**Frontend Implementation:**
```typescript
// Sending dates TO API
const readingDate = "2025-11-27"; // YYYY-MM-DD format

// Parsing dates FROM API
const createdAt = new Date(response.data.createdAt);
const displayDate = createdAt.toLocaleDateString('en-IN');
```

### UUID Format

All entity IDs use UUIDv4 format (except Shift which uses integer).

| Format | Pattern | Example |
|--------|---------|---------|
| UUID | `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` | `"550e8400-e29b-41d4-a716-446655440000"` |
| Integer (Shift only) | Positive integer | `1`, `42`, `156` |

**Validation Regex:**
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

### Password Requirements

| Requirement | Value |
|-------------|-------|
| Minimum Length | 6 characters |
| Maximum Length | 128 characters |
| Allowed Characters | Any printable characters |

**Recommended (optional):**
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Phone Number Format

| Type | Format | Example |
|------|--------|---------|
| Indian Mobile | 10 digits (starting 6-9) | `"9876543210"` |
| With Country Code | `+91XXXXXXXXXX` | `"+919876543210"` |

### Monetary Values

| Property | Value |
|----------|-------|
| Currency Code | `INR` |
| Symbol | `₹` |
| Decimal Places | 2 |
| Format | Number (not string) |

**Examples:**
```json
{
  "amount": 1500.50,
  "pricePerLitre": 96.72,
  "totalSales": 125000.00
}
```

---

## Authentication

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "owner"
    }
  }
}
```

### Using the Token

Include the token in all subsequent requests:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Token Expiration

| Token Type | Expiration |
|------------|------------|
| Access Token | 24 hours |

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasMore": true
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": [
      { "field": "email", "message": "Email is required" }
    ]
  }
}
```

---

## Error Codes

Use these codes for frontend error handling:

### Authentication Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `auth_invalid_credentials` | 401 | Invalid email or password |
| `auth_token_expired` | 401 | JWT token has expired |
| `auth_token_invalid` | 401 | JWT token is malformed |
| `auth_unauthorized` | 401 | No token provided |

### Validation Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `validation_failed` | 400 | Request body validation failed |
| `invalid_uuid` | 400 | Invalid UUID format |
| `invalid_date_format` | 400 | Date must be YYYY-MM-DD |

### Resource Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `not_found` | 404 | Resource not found |
| `already_exists` | 409 | Resource already exists |

### Business Logic Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `credit_limit_exceeded` | 400 | Creditor's credit limit exceeded |
| `shift_required` | 400 | Active shift required to perform action |
| `shift_already_active` | 400 | User already has an active shift |
| `reading_must_increase` | 400 | New reading must be >= previous |
| `price_not_set` | 400 | Fuel price not set for date |
| `nozzle_inactive` | 400 | Nozzle is inactive/maintenance |
| `tank_insufficient` | 400 | Insufficient fuel in tank |

### Plan Limit Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `plan_limit_stations` | 403 | Station limit reached |
| `plan_limit_pumps` | 403 | Pump limit reached |
| `plan_limit_nozzles` | 403 | Nozzle limit reached |
| `plan_limit_employees` | 403 | Employee limit reached |
| `plan_limit_creditors` | 403 | Creditor limit reached |

### Access Control Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `access_denied` | 403 | User lacks permission |
| `role_insufficient` | 403 | Role doesn't have access |
| `station_access_denied` | 403 | Cannot access this station |

---

## Endpoints

### Configuration Endpoints (No Auth Required for Public)

#### Get All Config Options
```http
GET /config
```
Returns all dropdown options for the frontend.

**Response:**
```json
{
  "success": true,
  "data": {
    "fuelTypes": ["petrol", "diesel", "premium_petrol", ...],
    "paymentMethods": ["cash", "upi", "card", "credit"],
    "expenseCategories": ["salary", "electricity", "rent", ...],
    "roles": ["super_admin", "owner", "manager", "employee"],
    "pumpStatuses": ["active", "inactive", "maintenance"],
    "oilCompanies": ["IOCL", "BPCL", "HPCL", ...],
    "states": ["Andhra Pradesh", "Maharashtra", ...]
  }
}
```

### Station Endpoints

#### List Stations
```http
GET /stations
Authorization: Bearer <token>
```

#### Get Station
```http
GET /stations/:id
Authorization: Bearer <token>
```

#### Create Station
```http
POST /stations
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Fuel Station",
  "code": "MFS001",
  "address": "123 Main St",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "phone": "9876543210",
  "gstNumber": "27XXXXX0000X1ZX",
  "oilCompany": "IOCL"
}
```

#### Update Station
```http
PUT /stations/:id
Authorization: Bearer <token>
```

#### Get Station Settings
```http
GET /stations/:id/settings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Station Name",
    "settings": {
      "requireShiftForReadings": false,
      "alertOnMissedReadings": true,
      "missedReadingThresholdDays": 1
    }
  }
}
```

#### Update Station Settings
```http
PUT /stations/:id/settings
Authorization: Bearer <token>

{
  "requireShiftForReadings": true,
  "alertOnMissedReadings": true,
  "missedReadingThresholdDays": 2
}
```

### Pump Endpoints

#### List Pumps
```http
GET /stations/:stationId/pumps
```

#### Create Pump
```http
POST /stations/:stationId/pumps
{
  "name": "Pump 1",
  "pumpNumber": 1,
  "status": "active"
}
```

### Nozzle Endpoints

#### List Nozzles
```http
GET /stations/pumps/:pumpId/nozzles
```

#### Create Nozzle
```http
POST /stations/pumps/:pumpId/nozzles
{
  "nozzleNumber": 1,
  "fuelType": "petrol",
  "initialReading": 0
}
```

### Fuel Price Endpoints

#### Get Prices
```http
GET /stations/:stationId/prices
```

#### Check if Price Set
```http
GET /stations/:stationId/prices/check?fuelType=petrol&date=2025-11-27
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fuelType": "petrol",
    "date": "2025-11-27",
    "priceSet": true,
    "price": 96.72,
    "message": "Price for petrol on 2025-11-27: ₹96.72"
  }
}
```

#### Set Price
```http
POST /stations/:stationId/prices
{
  "fuelType": "petrol",
  "price": 96.72,
  "effectiveFrom": "2025-11-27"
}
```

### Reading Endpoints

#### Get Previous Reading
```http
GET /readings/nozzles/:nozzleId/previous?date=2025-11-27
```

**Response:**
```json
{
  "success": true,
  "data": {
    "previousReading": 12500.50,
    "lastReadingDate": "2025-11-26",
    "fuelType": "petrol",
    "currentPrice": 96.72,
    "priceSet": true
  }
}
```

#### Submit Reading
```http
POST /readings
{
  "nozzleId": "uuid",
  "readingDate": "2025-11-27",
  "readingValue": 12650.75,
  "cashAmount": 12500.00,
  "onlineAmount": 2025.67,
  "notes": "End of day reading"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nozzleId": "uuid",
    "readingDate": "2025-11-27",
    "previousReading": 12500.50,
    "currentReading": 12650.75,
    "litresSold": 150.25,
    "fuelType": "petrol",
    "pricePerLitre": 96.72,
    "totalAmount": 14530.59,
    "cashAmount": 12500.00,
    "onlineAmount": 2030.59
  }
}
```

#### Get Daily Readings
```http
GET /readings/daily?stationId=uuid&date=2025-11-27
```

### Shift Endpoints

#### Start Shift
```http
POST /shifts
{
  "stationId": "uuid",
  "shiftDate": "2025-11-27",
  "startTime": "06:00",
  "shiftType": "morning"
}
```

#### End Shift
```http
PUT /shifts/:id/end
{
  "endTime": "14:00",
  "cashCollected": 50000.00,
  "onlineCollected": 25000.00,
  "endNotes": "Smooth shift"
}
```

#### Get Active Shift
```http
GET /shifts/my/active
```

### Credit Endpoints

#### List Creditors
```http
GET /credits/creditors?stationId=uuid
```

#### Create Creditor
```http
POST /credits/creditors
{
  "name": "ABC Transport",
  "contactPerson": "John Doe",
  "phone": "9876543210",
  "creditLimit": 100000,
  "creditPeriodDays": 30
}
```

#### Add Credit Sale
```http
POST /credits/creditors/:id/sales
{
  "fuelType": "diesel",
  "litres": 100.5,
  "pricePerLitre": 89.50,
  "vehicleNumber": "MH12AB1234"
}
```

#### Settle Credit
```http
POST /credits/creditors/:id/settlements
{
  "amount": 50000,
  "referenceNumber": "NEFT123456"
}
```

### Expense Endpoints

#### List Expenses
```http
GET /expenses?stationId=uuid&startDate=2025-11-01&endDate=2025-11-27
```

#### Add Expense
```http
POST /expenses
{
  "stationId": "uuid",
  "category": "electricity",
  "amount": 15000,
  "description": "November electricity bill",
  "expenseDate": "2025-11-27",
  "paymentMethod": "upi",
  "referenceNumber": "UPI123456"
}
```

### Dashboard Endpoints

#### Get Summary
```http
GET /dashboard/summary?stationId=uuid&startDate=2025-11-01&endDate=2025-11-27
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSales": 1500000.00,
    "litresSold": {
      "petrol": 5000.5,
      "diesel": 8000.75
    },
    "cashCollection": 1000000.00,
    "onlineCollection": 500000.00,
    "creditSales": 150000.00,
    "expenses": 75000.00,
    "netIncome": 1275000.00
  }
}
```

---

## Models Reference

### User
```typescript
interface User {
  id: string;           // UUID
  email: string;
  name: string;
  phone?: string;
  role: 'super_admin' | 'owner' | 'manager' | 'employee';
  stationId?: string;   // UUID - assigned station
  planId?: string;      // UUID - subscription plan (owners)
  isActive: boolean;
  lastLoginAt?: string; // ISO datetime
  createdAt: string;    // ISO datetime
  updatedAt: string;    // ISO datetime
}
```

### Station
```typescript
interface Station {
  id: string;           // UUID
  ownerId: string;      // UUID
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  gstNumber?: string;
  oilCompany?: string;
  isActive: boolean;
  requireShiftForReadings: boolean;
  alertOnMissedReadings: boolean;
  missedReadingThresholdDays: number;
  createdAt: string;
  updatedAt: string;
}
```

### NozzleReading
```typescript
interface NozzleReading {
  id: string;           // UUID
  nozzleId: string;     // UUID
  stationId: string;    // UUID
  shiftId?: number;     // Integer (optional)
  userId: string;       // UUID
  readingDate: string;  // YYYY-MM-DD
  previousReading: number;
  currentReading: number;
  litresSold: number;
  fuelType: string;
  pricePerLitre: number;
  totalAmount: number;
  cashAmount: number;
  onlineAmount: number;
  creditAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Shift
```typescript
interface Shift {
  id: number;           // Integer (auto-increment)
  employeeId: string;   // UUID
  stationId: string;    // UUID
  shiftDate: string;    // YYYY-MM-DD
  startTime: string;    // HH:mm
  endTime?: string;     // HH:mm
  shiftType: 'morning' | 'evening' | 'night' | 'full_day' | 'custom';
  status: 'active' | 'completed' | 'cancelled';
  cashCollected?: number;
  onlineCollected?: number;
  totalSales?: number;
  discrepancy?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## Frontend TypeScript Types

```typescript
// api-types.ts - Copy this to your frontend

// Date format helpers
type DateString = string;  // YYYY-MM-DD format
type DateTimeString = string;  // ISO 8601 format
type TimeString = string;  // HH:mm format
type UUID = string;  // UUIDv4 format

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: { field: string; message: string }[];
  };
}

interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Enum types
type FuelType = 'petrol' | 'diesel' | 'premium_petrol' | 'premium_diesel' | 'cng' | 'lpg';
type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit' | 'fleet_card' | 'wallet';
type UserRole = 'super_admin' | 'owner' | 'manager' | 'employee';
type PumpStatus = 'active' | 'inactive' | 'maintenance';
type ShiftType = 'morning' | 'evening' | 'night' | 'full_day' | 'custom';
type ShiftStatus = 'active' | 'completed' | 'cancelled';
```

---

## Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| Auth endpoints | 5 requests/15 minutes |
| General API | 100 requests/15 minutes |

**Rate limit headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1732723200
```

---

## Changelog

### v1.0.0 (November 2025)
- Initial API specification
- Standardized date/time formats
- UUID validation for all entities
- Comprehensive error codes
- Configuration endpoints for dropdowns
