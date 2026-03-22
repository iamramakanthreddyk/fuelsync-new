/**
 * Centralized Error Classes and Utilities
 * Provides consistent error handling across the application
 */

const { createContextLogger } = require('../services/loggerService');
const logger = createContextLogger('ErrorUtils');

// ============================================
// BASE ERROR CLASS
// ============================================

/**
 * Base AppError class
 * All custom errors should extend this class
 */
class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.message = message;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to API response format
   */
  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
        ...(this.details && { details: this.details }),
      },
    };
  }

  /**
   * Serialize error to JSON format
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// ============================================
// VALIDATION ERRORS (422/400)
// ============================================

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 'VALIDATION_ERROR', 422, details);
  }
}

class RequiredFieldError extends ValidationError {
  constructor(fieldName) {
    super(`${fieldName} is required`, [{ field: fieldName, message: `${fieldName} is required` }]);
  }
}

class InvalidFormatError extends ValidationError {
  constructor(fieldName, expectedFormat) {
    super(`${fieldName} has invalid format. Expected: ${expectedFormat}`, [
      { field: fieldName, message: `Expected ${expectedFormat}` },
    ]);
  }
}

class InvalidValueError extends ValidationError {
  constructor(fieldName, allowedValues) {
    const values = Array.isArray(allowedValues) ? allowedValues.join(', ') : allowedValues;
    super(`${fieldName} must be one of: ${values}`, [
      { field: fieldName, message: `Must be one of: ${values}` },
    ]);
  }
}

// ============================================
// AUTHENTICATION ERRORS (401)
// ============================================

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details = null) {
    super(message, 'UNAUTHORIZED', 401, details);
  }
}

class InvalidTokenError extends AuthenticationError {
  constructor() {
    super('Invalid or expired token');
  }
}

class TokenExpiredError extends AuthenticationError {
  constructor(expiredAt = null) {
    super('Token expired', { expiredAt });
  }
}

// ============================================
// AUTHORIZATION ERRORS (403)
// ============================================

class AuthorizationError extends AppError {
  constructor(message = 'Access denied', details = null) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

class PermissionDeniedError extends AuthorizationError {
  constructor(resource = 'resource', action = 'access') {
    super(`You do not have permission to ${action} this ${resource}`);
  }
}

// ============================================
// NOT FOUND ERRORS (404)
// ============================================

class NotFoundError extends AppError {
  constructor(resourceName, identifier = null) {
    let message = `${resourceName} not found`;
    if (identifier) {
      const identifierStr = typeof identifier === 'object' 
        ? JSON.stringify(identifier) 
        : identifier;
      message = `${resourceName} with ${identifierStr} not found`;
    }
    super(message, 'NOT_FOUND', 404);
    this.resourceName = resourceName;
  }
}

// ============================================
// CONFLICT ERRORS (409)
// ============================================

class ConflictError extends AppError {
  constructor(message = 'Conflict detected', details = null) {
    super(message, 'CONFLICT', 409, details);
  }
}

class AlreadyExistsError extends ConflictError {
  constructor(resourceName, identifier = null) {
    let message = `${resourceName} already exists`;
    if (identifier) {
      const identifierStr = typeof identifier === 'object' 
        ? JSON.stringify(identifier) 
        : identifier;
      message = `${resourceName} with ${identifierStr} already exists`;
    }
    super(message);
  }
}

// ============================================
// BUSINESS LOGIC ERRORS (400/422)
// ============================================

class BusinessLogicError extends AppError {
  constructor(message = 'Business logic error', statusCode = 400, details = null) {
    super(message, 'OPERATION_FAILED', statusCode, details);
  }
}

class InsufficientBalanceError extends BusinessLogicError {
  constructor(available, required) {
    super(
      `Insufficient balance. Available: ${available}, Required: ${required}`,
      422,
      { available, required }
    );
  }
}

class InvalidStatusTransitionError extends BusinessLogicError {
  constructor(currentStatus, attemptedStatus) {
    super(
      `Cannot transition from ${currentStatus} to ${attemptedStatus}`,
      422,
      { currentStatus, attemptedStatus }
    );
  }
}

class DuplicateEntryError extends BusinessLogicError {
  constructor(message = 'Duplicate entry detected', details = null) {
    super(message, 409, details);
  }
}

// ============================================
// DATABASE ERRORS (500)
// ============================================

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}

// ============================================
// INTERNAL SERVER ERRORS (500)
// ============================================

class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details = null) {
    super(message, 'INTERNAL_ERROR', 500, details);
  }
}

// ============================================
// SERVICE UNAVAILABLE (503)
// ============================================

class ServiceUnavailableError extends AppError {
  constructor(serviceName = 'Service') {
    super(`${serviceName} is currently unavailable`, 'SERVICE_UNAVAILABLE', 503);
  }
}

// ============================================
// ERROR CONVERSION
// ============================================

/**
 * Convert various error types to AppError
 * Handles Sequelize errors, JWT errors, and generic errors
 * @param {Error} error - The error to convert
 * @returns {AppError} - Converted AppError instance
 */
function convertError(error) {
  // If already an AppError, return as-is
  if (error instanceof AppError) {
    return error;
  }

  // Handle Sequelize Validation Error
  if (error.name === 'SequelizeValidationError') {
    const details = error.errors
      ? error.errors.map((e) => ({
          field: e.path,
          message: e.message,
          type: e.type,
        }))
      : null;

    return new ValidationError('Validation failed', details);
  }

  // Handle Sequelize Unique Constraint Error
  if (error.name === 'SequelizeUniqueConstraintError') {
    const field = error.fields ? Object.keys(error.fields)[0] : 'field';
    const details = {
      field,
      constraint: 'unique',
      value: error.fields?.[field],
    };

    return new ConflictError(
      `${field} already exists`,
      details
    );
  }

  // Handle Sequelize Foreign Key Constraint Error
  if (error.name === 'SequelizeForeignKeyConstraintError') {
    const details = {
      table: error.table,
      fields: error.fields,
      constraint: error.constraint,
    };

    return new ValidationError(
      'Invalid reference to related resource',
      details
    );
  }

  // Handle JWT Errors
  if (error.name === 'JsonWebTokenError') {
    return new InvalidTokenError();
  }

  // Handle JWT Token Expired Error
  if (error.name === 'TokenExpiredError') {
    const details = {
      expiredAt: error.expiredAt,
    };

    return new TokenExpiredError(details.expiredAt);
  }

  // Handle generic errors
  if (error instanceof SyntaxError) {
    return new ValidationError('Invalid JSON in request body');
  }

  // Handle TypeError (e.g., null reference)
  if (error instanceof TypeError) {
    return new InternalServerError('A processing error occurred');
  }

  // Default: wrap in InternalServerError
  return new InternalServerError(
    error.message || 'An unexpected error occurred'
  );
}

// ============================================
// ERROR HANDLER MIDDLEWARE
// ============================================

/**
 * Express error handler middleware
 * Catches all errors and formats them consistently
 */
const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const appError = convertError(err);

  // Log error
  logger.error('Request error', {
    name: appError.name,
    code: appError.code,
    statusCode: appError.statusCode,
    message: appError.message,
    path: req.path,
    method: req.method,
    timestamp: appError.timestamp,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });

  // Send response
  return res.status(appError.statusCode).json(appError.toResponse());
};

/**
 * Async error wrapper for route handlers
 * Catches promise rejections and forwards to error handler
 * @param {Function} fn - Async function
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  RequiredFieldError,
  InvalidFormatError,
  InvalidValueError,
  AuthenticationError,
  InvalidTokenError,
  TokenExpiredError,
  AuthorizationError,
  PermissionDeniedError,
  NotFoundError,
  ConflictError,
  AlreadyExistsError,
  BusinessLogicError,
  InsufficientBalanceError,
  InvalidStatusTransitionError,
  DuplicateEntryError,
  DatabaseError,
  InternalServerError,
  ServiceUnavailableError,

  // Utilities
  convertError,
  errorHandler,
  asyncHandler,
};
