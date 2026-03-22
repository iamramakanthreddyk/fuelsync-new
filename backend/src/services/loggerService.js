/**
 * Centralized Logger Service
 * Provides consistent logging across the application
 * 
 * Usage:
 * - logger.info('message', data)
 * - logger.warn('warning', data)
 * - logger.error('error', data)
 * - logger.debug('debug', data)
 * 
 * NOTE: This replaces scattered console.log statements throughout the codebase
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

const LOG_LEVEL_HIERARCHY = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Set minimum log level based on environment
const MIN_LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');
const MIN_LEVEL_VALUE = LOG_LEVEL_HIERARCHY[MIN_LOG_LEVEL] || LOG_LEVEL_HIERARCHY.INFO;

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
 * @param {string} message - Log message
 * @param {Object} data - Additional data (optional)
 * @returns {string} - Formatted log message
 */
function formatLogMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const levelStr = `[${level}]`;
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  return `${timestamp} ${levelStr} ${message}${dataStr}`;
}

/**
 * Should log based on current log level
 */
function shouldLog(level) {
  return LOG_LEVEL_HIERARCHY[level] <= MIN_LEVEL_VALUE;
}

/**
 * Log error message
 * @param {string} message - Error message
 * @param {Object|Error} data - Error details or Error object
 * @param {string} context - Optional context (e.g., function name)
 */
function logError(message, data = null, context = null) {
  if (!shouldLog('ERROR')) return;

  const prefix = context ? `[${context}]` : '';
  const logMessage = formatLogMessage(LOG_LEVELS.ERROR, `${prefix} ${message}`, data);
  console.error(logMessage);
}

/**
 * Log warning message
 * @param {string} message - Warning message
 * @param {Object} data - Warning details
 * @param {string} context - Optional context
 */
function logWarn(message, data = null, context = null) {
  if (!shouldLog('WARN')) return;

  const prefix = context ? `[${context}]` : '';
  const logMessage = formatLogMessage(LOG_LEVELS.WARN, `${prefix} ${message}`, data);
  console.warn(logMessage);
}

/**
 * Log info message
 * @param {string} message - Info message
 * @param {Object} data - Info details
 * @param {string} context - Optional context
 */
function logInfo(message, data = null, context = null) {
  if (!shouldLog('INFO')) return;

  const prefix = context ? `[${context}]` : '';
  const logMessage = formatLogMessage(LOG_LEVELS.INFO, `${prefix} ${message}`, data);
  console.log(logMessage);
}

/**
 * Log debug message (verbose, only in development)
 * @param {string} message - Debug message
 * @param {Object} data - Debug details
 * @param {string} context - Optional context
 */
function logDebug(message, data = null, context = null) {
  if (!shouldLog('DEBUG')) return;

  const prefix = context ? `[${context}]` : '';
  const logMessage = formatLogMessage(LOG_LEVELS.DEBUG, `${prefix} ${message}`, data);
  console.log(logMessage);
}

/**
 * Create a contextual logger (binds context to all logs)
 * @param {string} context - Context name (usually Controller/Service name)
 * @returns {Object} - Logger with context-bound methods
 */
function createContextLogger(context) {
  return {
    error: (message, data) => logError(message, data, context),
    warn: (message, data) => logWarn(message, data, context),
    info: (message, data) => logInfo(message, data, context),
    debug: (message, data) => logDebug(message, data, context),
  };
}

module.exports = {
  logError,
  logWarn,
  logInfo,
  logDebug,
  createContextLogger,
  
  // Re-export for direct access if needed
  LOG_LEVELS,
};
