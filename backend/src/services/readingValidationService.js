/**
 * Reading Validation Service
 * Centralized validation logic for nozzle readings
 */

const { VALIDATION_ERRORS: READING_ERRORS } = require('../config/transactionConstants');

/**
 * Normalize reading input (handle both camelCase and snake_case)
 * @param {Object} input - Raw request body
 * @returns {Object} - Normalized reading data
 */
exports.normalizeReadingInput = (input) => {
  return {
    nozzleId: input.nozzleId || input.nozzle_id,
    readingDate: input.readingDate || input.reading_date,
    readingValue: input.readingValue !== undefined ? input.readingValue : input.reading_value,
    notes: input.notes,
    pricePerLitre: input.pricePerLitre !== undefined ? input.pricePerLitre : input.price_per_litre,
    totalAmount: input.totalAmount !== undefined ? input.totalAmount : input.total_amount,
    litresSold: input.litresSold !== undefined ? input.litresSold : input.litres_sold,
    previousReading: input.previousReading !== undefined ? input.previousReading : input.previous_reading,
    isSample: input.isSample !== undefined ? input.isSample : (input.is_sample || false),
    // Req #1: Reading attribution - manager/owner enters on behalf of employee
    assignedEmployeeId: input.assignedEmployeeId || input.assigned_employee_id || null,
  };
};

/**
 * Validate reading is present and required fields are provided
 * @param {Object} normalizedInput - Normalized reading data
 * @returns {Object} - { isValid, error }
 */
exports.validateRequiredFields = (normalizedInput) => {
  const { nozzleId, readingDate, readingValue } = normalizedInput;
  
  if (!nozzleId || !readingDate || readingValue === undefined) {
    return {
      isValid: false,
      error: 'nozzleId, readingDate, and readingValue are required'
    };
  }

  return { isValid: true };
};

/**
 * Validate reading value is greater than previous (unless initial)
 * @param {number} currentValue - Current reading value
 * @param {number} previousValue - Previous reading value
 * @param {boolean} isInitialReading - Whether this is the initial reading
 * @returns {Object} - { isValid, error, previousReading }
 */
exports.validateReadingValue = (currentValue, previousValue, isInitialReading) => {
  const current = parseFloat(currentValue);
  const prev = parseFloat(previousValue);

  // Allow equal for initial readings (first entry uses initialReading)
  if (!isInitialReading && current <= prev) {
    return {
      isValid: false,
      error: `Reading must be greater than previous reading (${prev}). Meter readings only go forward.`,
      previousReading: prev
    };
  }

  return { isValid: true };
};

/**
 * Validate litres sold matches meter delta
 * @param {number} providedLitres - Client-provided litres (if any)
 * @param {number} meterDelta - Calculated from meter readings
 * @returns {Object} - { isValid, error, details }
 */
exports.validateLitresSoldMatch = (providedLitres, meterDelta) => {
  if (providedLitres === undefined || providedLitres === null) {
    return { isValid: true };
  }

  const provided = parseFloat(providedLitres) || 0;
  if (Math.abs(provided - meterDelta) > 0.01) {
    return {
      isValid: false,
      error: 'Provided litresSold does not match meter delta',
      details: {
        meterDelta,
        provided,
        difference: Math.abs(provided - meterDelta)
      }
    };
  }

  return { isValid: true };
};

/**
 * Validate backdated reading is allowed based on plan
 * @param {string} readingDate - Reading date (YYYY-MM-DD)
 * @param {number} allowedBackdatedDays - Max days allowed from plan
 * @returns {Object} - { isValid, error }
 */
exports.validateBackdatedReading = (readingDate, allowedBackdatedDays = 3) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const today = new Date().toISOString().split('T')[0];
  
  const readingDateObj = new Date(readingDate + 'T00:00:00Z');
  const todayObj = new Date(today + 'T00:00:00Z');
  const diffDays = Math.floor((todayObj - readingDateObj) / msPerDay);

  if (diffDays > allowedBackdatedDays) {
    return {
      isValid: false,
      error: `Backdated readings older than ${allowedBackdatedDays} days are not allowed`
    };
  }

  return { isValid: true };
};

/**
 * Determine if reading is initial (no previous reading found)
 * @param {Object} previousReadingRecord - Previous reading record (or null)
 * @param {number} providedPreviousReading - If client provided previous reading
 * @returns {boolean}
 */
exports.determineIsInitial = (previousReadingRecord, providedPreviousReading) => {
  return !previousReadingRecord && (providedPreviousReading === undefined);
};

/**
 * Check if nozzle is active
 * @param {Object} nozzle - Nozzle model instance
 * @returns {Object} - { isValid, error }
 */
exports.validateNozzleActive = (nozzle) => {
  if (!nozzle) {
    return { isValid: false, error: 'Nozzle not found' };
  }

  if (nozzle.status !== 'active') {
    return {
      isValid: false,
      error: `Nozzle is ${nozzle.status}. Cannot enter reading.`
    };
  }

  return { isValid: true };
};
