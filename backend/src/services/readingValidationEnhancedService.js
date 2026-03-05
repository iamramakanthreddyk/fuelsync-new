/**
 * Enhanced Reading Validation Service (Issue #6 & #7 fix)
 * 
 * Validates:
 * - No duplicate readings
 * - Reading values are ascending
 * - Reading stays within meter specifications
 * - No unreasonable daily increases
 */

const { NozzleReading, Nozzle, FuelPrice, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Issue #6: Check for duplicate readings (same nozzle, date, value)
 */
exports.checkDuplicateReading = async (nozzleId, readingDate, readingValue, excludeReadingId = null) => {
  try {
    const where = {
      nozzleId,
      readingDate,
      deletedAt: null
    };

    if (excludeReadingId) {
      where.id = { [Op.ne]: excludeReadingId };
    }

    const existing = await NozzleReading.findOne({
      where,
      attributes: ['id', 'readingValue', 'createdAt', 'enteredBy'],
      order: [['createdAt', 'DESC']]
    });

    if (!existing) {
      return { isDuplicate: false };
    }

    // Check if values match (within tolerance of 0.01 for decimal rounding)
    const valueDifference = Math.abs(parseFloat(existing.readingValue) - parseFloat(readingValue));

    if (valueDifference <= 0.01) {
      return {
        isDuplicate: true,
        existingReading: {
          id: existing.id,
          readingValue: existing.readingValue,
          createdAt: existing.createdAt
        },
        message: `Duplicate reading detected: value ${readingValue} already exists for ${readingDate}`
      };
    }

    return { isDuplicate: false };
  } catch (err) {
    console.error('[checkDuplicateReading] Error:', err);
    throw err;
  }
};

/**
 * Issue #7: Validate reading values are strictly ascending
 * A fuel pump meter can only move forward
 */
exports.validateReadingSequence = async (nozzleId, readingDate, readingValue) => {
  try {
    // Get all readings for this nozzle in chronological order
    const readings = await NozzleReading.findAll({
      where: {
        nozzleId,
        deletedAt: null
      },
      attributes: ['id', 'readingDate', 'readingValue', 'isInitialReading'],
      order: [['readingDate', 'ASC'], ['createdAt', 'ASC']],
      raw: true
    });

    if (readings.length === 0) {
      return { isValid: true, message: 'First reading for nozzle' };
    }

    const newValue = parseFloat(readingValue);
    const newDate = new Date(readingDate);

    // Find where this reading would be inserted chronologically
    let insertIndex = readings.length;
    for (let i = 0; i < readings.length; i++) {
      const readingDateObj = new Date(readings[i].readingDate);
      if (readingDateObj >= newDate) {
        insertIndex = i;
        break;
      }
    }

    // Check against immediately previous reading
    if (insertIndex > 0) {
      const prevReading = readings[insertIndex - 1];
      const prevValue = parseFloat(prevReading.readingValue);

      if (newValue < prevValue) {
        return {
          isValid: false,
          error: `Reading value (${newValue}) cannot be less than previous reading (${prevValue} on ${prevReading.readingDate}). Meter can only move forward.`,
          previousReading: {
            readingDate: prevReading.readingDate,
            readingValue: prevValue
          }
        };
      }

      if (newValue === prevValue) {
        return {
          isValid: false,
          error: `Reading value must be greater than previous reading (${prevValue}). No fuel was dispensed.`,
          previousReading: {
            readingDate: prevReading.readingDate,
            readingValue: prevValue
          }
        };
      }
    }

    // Check against immediately next reading (if backdating)
    if (insertIndex < readings.length) {
      const nextReading = readings[insertIndex];
      const nextDate = new Date(nextReading.readingDate);

      // Only check if dates are the same (not inserting between two days)
      if (nextReading.readingDate === readingDate) {
        const nextValue = parseFloat(nextReading.readingValue);

        if (newValue > nextValue) {
          return {
            isValid: false,
            error: `Reading value (${newValue}) cannot be greater than next reading on same date (${nextValue}). Check meter reading order.`,
            nextReading: {
              readingDate: nextReading.readingDate,
              readingValue: nextValue
            }
          };
        }
      }
    }

    return { isValid: true };
  } catch (err) {
    console.error('[validateReadingSequence] Error:', err);
    throw err;
  }
};

/**
 * Issue #7: Check for unreasonable daily increases
 * If today's sale is 3x the average, flag for review
 */
exports.checkUnusualIncrease = async (nozzleId, readingValue, previousReading, readingDate) => {
  try {
    const litresSold = parseFloat(readingValue) - parseFloat(previousReading);

    if (litresSold <= 0) {
      return { isUnusual: false };
    }

    // Get last 30 days of readings to calculate average
    const thirtyDaysAgo = new Date(readingDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentReadings = await NozzleReading.findAll({
      where: {
        nozzleId,
        readingDate: {
          [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0],
          [Op.lt]: readingDate
        },
        deletedAt: null,
        isSample: false
      },
      attributes: ['litresSold'],
      raw: true
    });

    if (recentReadings.length < 5) {
      return { 
        isUnusual: false, 
        message: 'Not enough historical data for comparison'
      };
    }

    const totalLitres = recentReadings.reduce((sum, r) => sum + parseFloat(r.litresSold || 0), 0);
    const avgLitres = totalLitres / recentReadings.length;

    // Flag if more than 3x average
    if (litresSold > avgLitres * 3) {
      return {
        isUnusual: true,
        litresSold,
        averageDaily: parseFloat(avgLitres.toFixed(2)),
        multiple: parseFloat((litresSold / avgLitres).toFixed(2)),
        requiresManagerApproval: true,
        message: `Unusually high increase: ${litresSold.toFixed(2)} litres sold (${(litresSold / avgLitres).toFixed(1)}x average of ${avgLitres.toFixed(2)}). Manager approval recommended.`
      };
    }

    return { isUnusual: false };
  } catch (err) {
    console.error('[checkUnusualIncrease] Error:', err);
    // Don't throw - this is just a warning
    return { isUnusual: false };
  }
};

/**
 * Check meter specifications (if meter tracking exists)
 */
exports.validateMeterSpecifications = async (nozzleId, readingValue) => {
  try {
    const nozzle = await Nozzle.findByPk(nozzleId, {
      attributes: ['id', 'label', 'fuelType']
    });

    if (!nozzle) {
      return { isValid: false, error: 'Nozzle not found' };
    }

    // Most fuel pump meters max out around 999,999.99 litres
    // If we see such high values, flag it (meter likely rolled over or needs replacement)
    const maxMeterCapacity = 999999.99;

    if (parseFloat(readingValue) > maxMeterCapacity) {
      return {
        isValid: false,
        error: `Reading value (${readingValue}) exceeds typical meter capacity (${maxMeterCapacity}). Meter may need replacement.`,
        suggestion: 'Contact meter manufacturer'
      };
    }

    return { isValid: true };
  } catch (err) {
    console.error('[validateMeterSpecifications] Error:', err);
    throw err;
  }
};

/**
 * Comprehensive enhanced reading validation
 */
exports.validateReadingEnhanced = async (nozzleId, readingDate, readingValue, previousReading, excludeReadingId = null) => {
  try {
    // Run all checks in parallel
    const [
      duplicateCheck,
      sequenceCheck,
      unusualCheck,
      meterCheck
    ] = await Promise.all([
      this.checkDuplicateReading(nozzleId, readingDate, readingValue, excludeReadingId),
      this.validateReadingSequence(nozzleId, readingDate, readingValue),
      this.checkUnusualIncrease(nozzleId, readingValue, previousReading, readingDate),
      this.validateMeterSpecifications(nozzleId, readingValue)
    ]);

    const errors = [];
    const warnings = [];

    if (duplicateCheck.isDuplicate) {
      errors.push({
        type: 'DUPLICATE_READING',
        ...duplicateCheck
      });
    }

    if (!sequenceCheck.isValid) {
      errors.push({
        type: 'SEQUENCE_INVALID',
        ...sequenceCheck
      });
    }

    if (!meterCheck.isValid) {
      errors.push({
        type: 'METER_INVALID',
        ...meterCheck
      });
    }

    if (unusualCheck.isUnusual) {
      warnings.push({
        type: 'UNUSUAL_INCREASE',
        ...unusualCheck
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiresApproval: unusualCheck.isUnusual,
      message: errors.length === 0 
        ? (warnings.length > 0 ? 'Valid with warnings' : 'Valid')
        : `Validation failed: ${errors.map(e => e.type).join(', ')}`
    };
  } catch (err) {
    console.error('[validateReadingEnhanced] Error:', err);
    throw err;
  }
};
