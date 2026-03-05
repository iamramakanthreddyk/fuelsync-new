/**
 * API Response Formatter
 * Standardizes all API responses across the application
 * 
 * Usage:
 *   const response = new ApiResponse(data, { executionMs: 123 });
 *   res.json(response);
 */

class ApiResponse {
  constructor(data, metadata = {}) {
    this.success = true;
    this.data = data;
    this.metadata = {
      timestamp: new Date().toISOString(),
      requestId: metadata.requestId || this.generateRequestId(),
      executionMs: metadata.executionMs || 0,
      ...(metadata.startDate && { startDate: metadata.startDate }),
      ...(metadata.endDate && { endDate: metadata.endDate }),
      ...(metadata.metrics && { metrics: metadata.metrics }),
      ...(metadata.groupBy && { groupBy: metadata.groupBy }),
      ...metadata
    };
  }

  /**
   * Create error response
   */
  static error(message, statusCode = 500, details = {}) {
    return {
      success: false,
      error: message,
      statusCode,
      ...(Object.keys(details).length > 0 && { details }),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create validation error response
   */
  static validationError(errors) {
    return {
      success: false,
      error: 'Validation failed',
      statusCode: 400,
      validationErrors: errors,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate unique request ID for debugging
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = ApiResponse;
