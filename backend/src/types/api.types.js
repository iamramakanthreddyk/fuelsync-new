/**
 * API Type Definitions & Interfaces
 * 
 * Central place for all request/response type definitions
 * Used for documentation, validation, and type checking
 */

// ============================================
// RESPONSE ENVELOPES
// ============================================

/**
 * Standard API Success Response
 * @typedef {Object} ApiSuccessResponse
 * @property {boolean} success - Always true for success
 * @property {*} data - Response payload
 * @property {Object} [metadata] - Optional metadata (pagination, counts, etc)
 * @property {string} [message] - Optional success message
 */

/**
 * Standard API Error Response
 * @typedef {Object} ApiErrorResponse
 * @property {boolean} success - Always false for error
 * @property {Object} error - Error details
 * @property {string} error.code - Error code (NOT_FOUND, VALIDATION_ERROR, etc)
 * @property {string} error.message - Human-readable message
 * @property {string} [error.field] - Field name if field-specific error
 * @property {Array} [error.details] - Additional error details
 */

/**
 * Paginated Response
 * @typedef {Object} PaginatedResponse
 * @property {Array} data - Array of items
 * @property {Object} pagination - Pagination metadata
 * @property {number} pagination.page - Current page (1-indexed)
 * @property {number} pagination.limit - Items per page
 * @property {number} pagination.total - Total count
 * @property {number} pagination.pages - Total pages
 */

// ============================================
// COMMON QUERY PARAMETERS
// ============================================

/**
 * Pagination Query Params
 * @typedef {Object} PaginationQuery
 * @property {number} [page=1] - Page number
 * @property {number} [limit=20] - Items per page
 * @property {string} [sort] - Sort field
 * @property {string} [order=ASC] - Sort order (ASC|DESC)
 */

/**
 * Filter Query Params (Common across resources)
 * @typedef {Object} FilterQuery
 * @property {string} [search] - Search keyword
 * @property {string} [startDate] - Filter start date (YYYY-MM-DD)
 * @property {string} [endDate] - Filter end date (YYYY-MM-DD)
 * @property {string} [status] - Filter by status
 * @property {boolean} [isActive] - Filter active/inactive
 */

// ============================================
// USER & AUTH TYPES
// ============================================

/**
 * @typedef {Object} UserDTO
 * @property {string} id - User ID
 * @property {string} name - User name
 * @property {string} email - User email
 * @property {string} role - User role (super_admin|owner|manager|employee)
 * @property {string} [phone] - Phone number
 * @property {string} [stationId] - Assigned station ID
 * @property {boolean} isActive - Active status
 * @property {Date} createdAt - Created timestamp
 */

/**
 * @typedef {Object} CreateUserRequest
 * @property {string} name - User name
 * @property {string} email - User email
 * @property {string} password - Password (min 8 chars)
 * @property {string} role - User role
 * @property {string} [phone] - Phone number
 * @property {string} [stationId] - Station ID
 */

/**
 * @typedef {Object} LoginRequest
 * @property {string} email - User email
 * @property {string} password - User password
 */

/**
 * @typedef {Object} LoginResponse
 * @property {UserDTO} user - User object
 * @property {string} token - JWT token
 * @property {string} refreshToken - Refresh token
 */

// ============================================
// STATION & ASSET TYPES
// ============================================

/**
 * @typedef {Object} StationDTO
 * @property {string} id - Station ID
 * @property {string} name - Station name
 * @property {string} location - Location address
 * @property {string} ownerId - Owner user ID
 * @property {number} latitude - GPS latitude
 * @property {number} longitude - GPS longitude
 * @property {boolean} isActive - Active status
 * @property {Array} pumps - Associated pumps
 */

/**
 * @typedef {Object} PumpDTO
 * @property {string} id - Pump ID
 * @property {string} name - Pump name
 * @property {string} stationId - Station ID
 * @property {Array} nozzles - Associated nozzles
 * @property {string} status - Status (active|maintenance|inactive)
 */

/**
 * @typedef {Object} NozzleDTO
 * @property {string} id - Nozzle ID
 * @property {string} number - Nozzle number
 * @property {string} fuelType - Fuel type (petrol|diesel|cng)
 * @property {string} pumpId - Pump ID
 * @property {number} pricePerLitre - Current price
 * @property {string} status - Status
 */

// ============================================
// READING & TRANSACTION TYPES
// ============================================

/**
 * @typedef {Object} NozzleReadingDTO
 * @property {string} id - Reading ID
 * @property {string} nozzleId - Nozzle ID
 * @property {string} stationId - Station ID
 * @property {Date} readingDate - Date of reading
 * @property {number} readingValue - Meter reading value
 * @property {number} previousReading - Previous meter value
 * @property {number} litresSold - Litres sold (calculated)
 * @property {number} saleValue - Total sale value
 * @property {string} enteredBy - User who entered reading
 * @property {boolean} isSample - Is sample reading
 * @property {string} status - Status (pending|approved|settled)
 */

/**
 * @typedef {Object} CreateReadingRequest
 * @property {string} nozzleId - Nozzle ID
 * @property {number} readingValue - Current meter reading
 * @property {number} [pricePerLitre] - Override price
 * @property {string} [notes] - Additional notes
 * @property {boolean} [isSample] - Is sample
 */

/**
 * @typedef {Object} DailyTransactionDTO
 * @property {string} id - Transaction ID
 * @property {string} stationId - Station ID
 * @property {Date} transactionDate - Transaction date
 * @property {Object} paymentBreakdown - Payment breakdown
 * @property {number} paymentBreakdown.cash - Cash amount
 * @property {number} paymentBreakdown.online - Online amount
 * @property {number} paymentBreakdown.credit - Credit amount
 * @property {Array} readingIds - Associated reading IDs
 * @property {string} status - Status (draft|finalized)
 */

/**
 * @typedef {Object} SettlementDTO
 * @property {string} id - Settlement ID
 * @property {string} stationId - Station ID
 * @property {Date} date - Settlement date
 * @property {number} expectedCash - Expected cash amount
 * @property {number} actualCash - Actual cash counted
 * @property {number} variance - Variance amount
 * @property {string} status - Status (draft|final)
 * @property {boolean} isFinal - Is finalized
 * @property {Array} readingIds - Associated reading IDs
 */

// ============================================
// FINANCIAL TYPES
// ============================================

/**
 * @typedef {Object} CreditDTO
 * @property {string} id - Credit ID
 * @property {string} creditorName - Creditor name
 * @property {string} stationId - Station ID
 * @property {number} totalAmount - Total credit amount
 * @property {number} usedAmount - Amount used
 * @property {number} remainingBalance - Remaining balance
 * @property {Date} startDate - Credit start date
 * @property {Date} [dueDate] - Due date
 * @property {string} status - Status (active|paid|expired)
 */

/**
 * @typedef {Object} ExpenseDTO
 * @property {string} id - Expense ID
 * @property {string} stationId - Station ID
 * @property {string} description - Expense description
 * @property {number} amount - Expense amount
 * @property {string} category - Category (maintenance|fuel|salary|etc)
 * @property {Date} expenseDate - Expense date
 * @property {string} paymentMethod - Payment method
 * @property {string} [receiptUrl] - Receipt image URL
 * @property {string} status - Status (pending|approved|rejected)
 */

// ============================================
// EMPLOYEE & ANALYTICS TYPES
// ============================================

/**
 * @typedef {Object} EmployeeSalesDTO
 * @property {string} employeeId - Employee ID
 * @property {string} employeeName - Employee name
 * @property {number} totalSales - Total sales amount
 * @property {number} totalLitres - Total litres sold
 * @property {number} averagePerReading - Average per reading
 * @property {number} readingCount - Number of readings
 * @property {Date} firstReading - First reading date
 * @property {Date} lastReading - Last reading date
 */

/**
 * @typedef {Object} EmployeeShortfallDTO
 * @property {string} employeeId - Employee ID
 * @property {string} employeeName - Employee name
 * @property {number} shortfallAmount - Shortfall amount
 * @property {number} salesReported - Sales reported
 * @property {number} settlementAmount - Settlement amount
 * @property {Array} affectedReadings - Reading IDs
 * @property {Date} settlementDate - Settlement date
 */

/**
 * @typedef {Object} DashboardSummaryDTO
 * @property {number} totalSales - Total sales today
 * @property {number} totalLitres - Total litres sold
 * @property {number} readingCount - Number of readings
 * @property {number} activeEmployees - Active employees
 * @property {Object} paymentBreakdown - Payment method breakdown
 * @property {number} paymentBreakdown.cash - Cash sales
 * @property {number} paymentBreakdown.online - Online sales
 * @property {number} paymentBreakdown.credit - Credit sales
 * @property {number} variance - Cash variance
 * @property {Array} topPerformers - Top employees by sales
 */

// ============================================
// COMMON ERROR CODES
// ============================================

/**
 * Standard error codes
 * @enum {string}
 */
const ERROR_CODES = {
  // 4xx Client Errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',

  // 5xx Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  OPERATION_FAILED: 'OPERATION_FAILED',
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  ERROR_CODES,
};
