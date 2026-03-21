/**
 * Centralized Error Classes and Utilities
 * Provides a consistent error handling mechanism across the application
 */

/**
 * Base AppError class
 * All custom errors should extend this class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.message = message;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serialize error to JSON format
   */
  toJSON() {
    return {
      name: this.name,
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * ValidationError - 400
 * Used when request validation fails
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, details);
  }
}

/**
 * AuthenticationError - 401
 * Used when authentication fails or token is invalid
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details = null) {
    super(message, 401, details);
  }
}

/**
 * AuthorizationError - 403
 * Used when user lacks permissions
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied', details = null) {
    super(message, 403, details);
  }
}

/**
 * NotFoundError - 404
 * Used when a resource is not found
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, details);
  }
}

/**
 * ConflictError - 409
 * Used when there's a conflict (e.g., duplicate entry, unique constraint)
 */
class ConflictError extends AppError {
  constructor(message = 'Conflict detected', details = null) {
    super(message, 409, details);
  }
}

/**
 * BusinessLogicError - 400
 * Used when business logic constraints are violated
 */
class BusinessLogicError extends AppError {
  constructor(message = 'Business logic error', details = null) {
    super(message, 400, details);
  }
}

/**
 * InternalServerError - 500
 * Used for unexpected server errors
 */
class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details = null) {
    super(message, 500, details);
  }
}

/**
 * Convert various error types to AppError
 * Handles Sequelize errors, JWT errors, and generic errors
 *
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
    return new AuthenticationError('Invalid token');
  }

  // Handle JWT Token Expired Error
  if (error.name === 'TokenExpiredError') {
    const details = {
      expiredAt: error.expiredAt,
    };

    return new AuthenticationError('Token expired', details);
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

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessLogicError,
  InternalServerError,

  // Utility function
  convertError,
};
