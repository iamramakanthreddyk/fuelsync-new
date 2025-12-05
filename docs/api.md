
# FuelSync API Documentation

## Overview

The FuelSync API is a RESTful API that provides endpoints for managing fuel station operations, including user authentication, uploads/processing, sales tracking, pump management, and reporting.

**Base URL:** `http://localhost:3000/api`

**Authentication:** JWT Bearer tokens

**Content Type:** `application/json`

## Authentication

### POST /auth/login
Login with email and password.

**Request Body:**
```json
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
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "Pump Owner",
      "plan": "Basic",
      "stationId": "uuid"
    },
    "token": "jwt-token"
  }
}
```

### GET /auth/me
Get current user information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "Pump Owner",
    "plan": "Basic",
    "stationId": "uuid"
  }
}
```

### POST /auth/refresh
Refresh JWT token.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new-jwt-token"
  }
}
```

### POST /auth/logout
Logout user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Uploads

### GET /uploads
Get user's uploads with pagination.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "filename": "receipt-001.jpg",
      "status": "success",
      "amount": 2450.00,
      "litres": 45.6,
      "fuelType": "Petrol",
      "uploadedAt": "2024-06-02T10:30:00Z",
      "processedAt": "2024-06-02T10:31:00Z",
      "processedData": {
        "amount": 2450.00,
        "litres": 45.6,
        "fuelType": "Petrol",
        "pumpId": "pump-1",
        "timestamp": "2024-06-02T10:25:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### POST /uploads
Upload a receipt or manual data payload for processing.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Form Data:**
- `receipt`: Image file (JPG, PNG, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "filename": "receipt-001.jpg",
    "status": "pending",
    "amount": 0,
    "litres": 0,
    "fuelType": "Petrol",
    "uploadedAt": "2024-06-02T10:30:00Z"
  }
}
```

### PUT /uploads/:id
Update processed upload data manually.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 2450.00,
  "litres": 45.6,
  "fuelType": "Petrol",
  "pumpId": "pump-1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "amount": 2450.00,
    "litres": 45.6,
    "fuelType": "Petrol",
    "processedData": {
      "amount": 2450.00,
      "litres": 45.6,
      "fuelType": "Petrol",
      "pumpId": "pump-1",
      "timestamp": "2024-06-02T10:25:00Z",
      "editedManually": true
    }
  }
}
```

### DELETE /uploads/:id
Delete an upload.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Upload deleted successfully"
}
```

## Sales

### GET /sales
Get sales data with filtering and pagination.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (optional): Filter start date (ISO string)
- `endDate` (optional): Filter end date (ISO string)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "pumpId": "uuid",
      "fuelType": "Petrol",
      "litres": 45.6,
      "pricePerLitre": 105.50,
      "totalAmount": 4810.80,
      "timestamp": "2024-06-02T10:25:00Z",
      "shift": "morning",
      "pump": {
        "name": "Pump 1"
      },
      "user": {
        "name": "John Doe"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### GET /sales/daily/:date
Get daily sales summary for a specific date.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `date`: Date in YYYY-MM-DD format

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2024-06-02",
    "totalRevenue": 456789999.50,
    "totalLitres": 1234.5,
    "totalTransactions": 89,
    "fuelTypeBreakdown": {
      "petrol": {
        "litres": 734.2,
        "revenue": 27890.30,
        "transactions": 52
      },
      "diesel": {
        "litres": 500.3,
        "revenue": 17788.20,
        "transactions": 37
      }
    }
  }
}
```

## Pumps

### GET /pumps
Get all pumps with nozzle information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Pump 1",
      "status": "active",
      "lastMaintenanceDate": "2024-05-15",
      "totalSalesToday": 12500.00,
      "nozzles": [
        {
          "id": "uuid",
          "pumpId": "uuid",
          "number": 1,
          "fuelType": "Petrol",
          "status": "active"
        },
        {
          "id": "uuid",
          "pumpId": "uuid",
          "number": 2,
          "fuelType": "Petrol",
          "status": "active"
        }
      ]
    }
  ]
}
```

### PUT /pumps/:id/status
Update pump status.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "status": "maintenance"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Pump 1",
    "status": "maintenance"
  }
}
```

### PUT /pumps/nozzles/:nozzleId/fuel-type
Update nozzle fuel type.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "fuelType": "Diesel"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "pumpId": "uuid",
    "number": 1,
    "fuelType": "Diesel",
    "status": "active"
  }
}
```

## Fuel Prices

### GET /prices
Get current fuel prices.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fuelType": "Petrol",
      "price": 105.50,
      "updatedAt": "2024-06-01T08:00:00Z",
      "updatedByUser": {
        "name": "John Doe"
      }
    },
    {
      "id": "uuid",
      "fuelType": "Diesel",
      "price": 98.75,
      "updatedAt": "2024-06-01T08:00:00Z",
      "updatedByUser": {
        "name": "John Doe"
      }
    }
  ]
}
```

### PUT /prices
Update fuel price.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "fuelType": "Petrol",
  "price": 106.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fuelType": "Petrol",
    "price": 106.00,
    "updatedAt": "2024-06-02T10:00:00Z",
    "updatedBy": "uuid"
  }
}
```

## Reports

### POST /reports/generate
Generate sales report.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "type": "daily",
  "startDate": "2024-06-01",
  "endDate": "2024-06-02"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "daily",
    "startDate": "2024-06-01",
    "endDate": "2024-06-02",
    "generatedAt": "2024-06-02T10:00:00Z",
    "totalRevenue": 156789.50,
    "totalLitres": 4567.3,
    "totalTransactions": 234,
    "fuelTypeBreakdown": {
      "petrol": {
        "litres": 2890.1,
        "revenue": 95234.20,
        "transactions": 145
      },
      "diesel": {
        "litres": 1677.2,
        "revenue": 61555.30,
        "transactions": 89
      }
    },
    "pumpBreakdown": {
      "Pump 1": {
        "litres": 1234.5,
        "revenue": 45678.90,
        "transactions": 67
      }
    },
    "shiftBreakdown": {
      "morning": {
        "litres": 1523.4,
        "revenue": 52345.60,
        "transactions": 78
      },
      "afternoon": {
        "litres": 1678.9,
        "revenue": 58234.70,
        "transactions": 89
      },
      "night": {
        "litres": 1365.0,
        "revenue": 46209.20,
        "transactions": 67
      }
    },
    "downloadUrl": "/api/reports/download/daily-1717315200000.pdf"
  }
}
```

## Health Check

### GET /health
Check API health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-06-02T10:00:00Z",
  "service": "FuelSync API",
  "version": "1.0.0"
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting

API requests are limited to 100 requests per 15-minute window per IP address.

## File Upload Limits

- Maximum file size: 10MB
- Supported formats: JPG, PNG, JPEG
- Daily upload limits based on user plan:
  - Free: 4 uploads/day
  - Basic: 10 uploads/day
  - Premium: Unlimited

## Environment Variables

The API requires the following environment variables:

```env
# Database Configuration
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=fuelsync_db
DB_HOST=localhost
DB_PORT=5432

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRATION=1h

# Azure Services
AZURE_STORAGE_CONNECTION_STRING=your_azure_storage_connection
AZURE_VISION_ENDPOINT=your_azure_vision_endpoint
AZURE_VISION_KEY=your_azure_vision_key

# Server Configuration
PORT=3000
NODE_ENV=production
CLIENT_URL=http://localhost:5173
```

## Database Setup

1. Create PostgreSQL database
2. Run migration scripts in order:
   - `sql/001_initial_schema.sql`
   - `sql/002_seed_data.sql`
   - `sql/003_views_and_functions.sql`

## Deployment

1. Install dependencies: `npm install`
2. Set environment variables
3. Run migrations: `npm run migrate`
4. Start server: `npm start` (production) or `npm run dev` (development)

## Support

For API support, contact: support@fuelsync.com
