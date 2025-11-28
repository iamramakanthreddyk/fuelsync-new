/**
 * Standardized Formatters for FuelSync API
 * 
 * USAGE: Import these utilities for consistent formatting across the API
 * 
 * FRONTEND CONTRACT:
 * - All dates sent TO the API must be in ISO format (YYYY-MM-DD or ISO 8601)
 * - All dates returned FROM the API are in ISO 8601 format
 * - All UUIDs are lowercase v4 format
 * - All monetary values are numbers with 2 decimal precision
 */

const { v4: uuidv4, validate: uuidValidate, version: uuidVersion } = require('uuid');

// ============================================
// DATE/TIME FORMATS
// ============================================

/**
 * Standard date formats used by the API
 * Frontend should use these exact formats when sending/parsing dates
 */
const DATE_FORMATS = {
  // For date-only fields (readingDate, effectiveFrom, etc.)
  DATE_ONLY: 'YYYY-MM-DD',           // ISO date: "2025-11-27"
  
  // For timestamp fields (createdAt, updatedAt, etc.)
  ISO_DATETIME: 'ISO 8601',          // Full ISO: "2025-11-27T14:30:00.000Z"
  
  // For time-only fields (startTime, endTime, etc.)
  TIME_ONLY: 'HH:mm',                // 24-hour: "14:30"
  TIME_WITH_SECONDS: 'HH:mm:ss',     // With seconds: "14:30:00"
  
  // Display formats (for UI, not API)
  DISPLAY_DATE: 'DD MMM YYYY',       // "27 Nov 2025"
  DISPLAY_DATETIME: 'DD MMM YYYY, hh:mm A', // "27 Nov 2025, 02:30 PM"
  DISPLAY_TIME: 'hh:mm A'            // "02:30 PM"
};

/**
 * Parse and validate a date string
 * Accepts: YYYY-MM-DD, ISO 8601 datetime, or Date object
 * Returns: ISO date string (YYYY-MM-DD) or null if invalid
 */
function parseDate(input) {
  if (!input) return null;
  
  // Already a Date object
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return input.toISOString().split('T')[0];
  }
  
  // String input
  if (typeof input === 'string') {
    // Try YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const date = new Date(input + 'T00:00:00Z');
      if (isNaN(date.getTime())) return null;
      return input;
    }
    
    // Try ISO 8601 datetime
    const date = new Date(input);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  return null;
}

/**
 * Format date for API response
 * Returns ISO date string (YYYY-MM-DD)
 */
function formatDate(date) {
  if (!date) return null;
  const parsed = parseDate(date);
  return parsed;
}

/**
 * Format datetime for API response
 * Returns full ISO 8601 string
 */
function formatDateTime(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Parse time string (HH:mm or HH:mm:ss)
 * Returns: { hours, minutes, seconds } or null if invalid
 */
function parseTime(input) {
  if (!input) return null;
  
  const match = input.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  if (seconds < 0 || seconds > 59) return null;
  
  return { hours, minutes, seconds };
}

/**
 * Format time for API response
 * Returns HH:mm format
 */
function formatTime(hours, minutes) {
  if (hours === undefined || minutes === undefined) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current datetime in ISO 8601 format
 */
function getCurrentDateTime() {
  return new Date().toISOString();
}

// ============================================
// UUID FORMATS
// ============================================

/**
 * UUID Format specification:
 * - All entity IDs are UUIDv4
 * - Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (lowercase)
 * - Example: "550e8400-e29b-41d4-a716-446655440000"
 */

/**
 * Generate a new UUIDv4
 */
function generateUUID() {
  return uuidv4();
}

/**
 * Validate a UUID string
 * Returns true only for valid UUIDv4
 */
function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  return uuidValidate(id) && uuidVersion(id) === 4;
}

/**
 * Normalize UUID to lowercase
 */
function normalizeUUID(id) {
  if (!id || typeof id !== 'string') return null;
  const normalized = id.toLowerCase().trim();
  return isValidUUID(normalized) ? normalized : null;
}

// ============================================
// PASSWORD REQUIREMENTS
// ============================================

/**
 * Password requirements for the API
 */
const PASSWORD_REQUIREMENTS = {
  minLength: 6,
  maxLength: 128,
  // Recommended (not enforced by default):
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSpecialChars: false
};

/**
 * Validate password meets requirements
 * Returns { valid: boolean, errors: string[] }
 */
function validatePassword(password) {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }
  
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }
  
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }
  
  // Optional requirements (can enable if needed)
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// MONETARY FORMATS
// ============================================

/**
 * Currency specification for the API
 */
const CURRENCY = {
  code: 'INR',
  symbol: '₹',
  decimalPlaces: 2
};

/**
 * Format monetary value for API response
 * Always returns number with 2 decimal precision
 */
function formatMoney(value) {
  if (value === null || value === undefined) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

/**
 * Parse monetary value from input
 * Handles strings with currency symbols, commas, etc.
 */
function parseMoney(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return formatMoney(input);
  
  // Remove currency symbol, commas, spaces
  const cleaned = String(input).replace(/[₹$€£,\s]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return formatMoney(num);
}

// ============================================
// PHONE NUMBER FORMATS
// ============================================

/**
 * Phone number specification:
 * - Indian mobile: 10 digits starting with 6-9
 * - With country code: +91 prefix
 */
const PHONE_PATTERNS = {
  INDIA_MOBILE: /^[6-9]\d{9}$/,
  INDIA_WITH_CODE: /^\+91[6-9]\d{9}$/,
  INTERNATIONAL: /^\+?[\d\s-]{10,15}$/
};

/**
 * Normalize phone number
 * Returns cleaned 10-digit Indian number or original if international
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  
  // Remove spaces, dashes
  let cleaned = phone.replace(/[\s-]/g, '');
  
  // Remove +91 or 91 prefix for Indian numbers
  if (cleaned.startsWith('+91')) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.slice(2);
  
  // Validate Indian mobile
  if (PHONE_PATTERNS.INDIA_MOBILE.test(cleaned)) {
    return cleaned;
  }
  
  // Return original if seems international
  if (PHONE_PATTERNS.INTERNATIONAL.test(phone)) {
    return phone.replace(/\s/g, '');
  }
  
  return null;
}

// ============================================
// API RESPONSE FORMATTERS
// ============================================

/**
 * Standard success response format
 */
function successResponse(data, message = null) {
  const response = {
    success: true,
    data
  };
  if (message) response.message = message;
  return response;
}

/**
 * Standard error response format
 */
function errorResponse(message, code = null, details = null) {
  const response = {
    success: false,
    error: {
      message,
      code
    }
  };
  if (details) response.error.details = details;
  return response;
}

/**
 * Pagination response wrapper
 */
function paginatedResponse(data, pagination) {
  return {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasMore: pagination.page * pagination.limit < pagination.total
    }
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Date/Time
  DATE_FORMATS,
  parseDate,
  formatDate,
  formatDateTime,
  parseTime,
  formatTime,
  getCurrentDate,
  getCurrentDateTime,
  
  // UUID
  generateUUID,
  isValidUUID,
  normalizeUUID,
  
  // Password
  PASSWORD_REQUIREMENTS,
  validatePassword,
  
  // Money
  CURRENCY,
  formatMoney,
  parseMoney,
  
  // Phone
  PHONE_PATTERNS,
  normalizePhone,
  
  // Response formatters
  successResponse,
  errorResponse,
  paginatedResponse
};
