/**
 * Reading Validation Enhanced Service
 * Additional validation checks for reading creation:
 *   - Duplicate detection
 *   - Sequence validation
 *   - Meter specification validation
 */

const { NozzleReading, Nozzle } = require('../models');
const { Op } = require('sequelize');

/**
 * Check whether a very similar reading already exists for the same nozzle/date.
 * Returns { isDuplicate: false } or { isDuplicate: true, existingReading: {...} }
 */
exports.checkDuplicateReading = async ({ nozzleId, readingDate, readingValue, tolerance = 0.01 }) => {
  const value = parseFloat(readingValue);

  const existing = await NozzleReading.findOne({
    where: {
      nozzleId,
      readingDate,
      readingValue: {
        [Op.between]: [value - tolerance, value + tolerance]
      }
    },
    order: [['createdAt', 'DESC']]
  });

  if (!existing) return { isDuplicate: false };

  return {
    isDuplicate: true,
    existingReading: existing.toJSON()
  };
};

/**
 * Validate that the reading value makes sense in sequence.
 * Flags readings that jump by an unusually large amount but still allows them
 * with a warning (rather than a hard block), unless the sequence is clearly wrong.
 * Returns { isValid, error?, details?, warnings? }
 */
exports.validateReadingSequence = async ({ nozzleId, currentValue, readingDate, previousValue }) => {
  const current = parseFloat(currentValue);
  const prev = parseFloat(previousValue) || 0;
  const delta = current - prev;

  // Basic check: meter cannot go backwards (unless it reset to 0)
  if (delta < 0) {
    // Allow a full meter reset (e.g., meter replaced / replaced at 0)
    if (current < 100) {
      return {
        isValid: true,
        warnings: ['Meter reset detected - new meter starts from low value']
      };
    }
    return {
      isValid: false,
      error: 'Reading value is less than previous reading. Meter readings cannot go backwards.',
      details: { previousValue: prev, currentValue: current, delta }
    };
  }

  // Warn for very large daily consumption (>10,000 litres on a single nozzle is unusual)
  const warnings = [];
  if (delta > 10000) {
    warnings.push(`Unusually large meter delta: ${delta.toFixed(2)} litres. Please verify.`);
  }

  return { isValid: true, warnings };
};

/**
 * Validate reading value is within meter limits.
 * Fuel meter odometers typically max out at 99999.99.
 * Returns { isValid, error?, details? }
 */
exports.validateMeterSpecifications = async ({ nozzleId, readingValue, fuelType }) => {
  const value = parseFloat(readingValue);
  const MAX_METER_VALUE = 999999.99;

  if (value < 0) {
    return {
      isValid: false,
      error: 'Meter reading cannot be negative.',
      details: { readingValue: value }
    };
  }

  if (value > MAX_METER_VALUE) {
    return {
      isValid: false,
      error: `Meter reading ${value} exceeds maximum allowed value (${MAX_METER_VALUE}).`,
      details: { readingValue: value, maxAllowed: MAX_METER_VALUE }
    };
  }

  return { isValid: true };
};
