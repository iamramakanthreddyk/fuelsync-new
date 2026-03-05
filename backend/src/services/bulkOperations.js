/**
 * Bulk Operations Service (Issue #12 fix)
 * 
 * Provides batch import capabilities for readings and transactions
 * Validates all records before importing
 * Rolls back on any errors
 */

const { NozzleReading, Nozzle, sequelize } = require('../models');
const readingValidationEnhanced = require('./readingValidationEnhancedService');

/**
 * Bulk validate readings before import
 */
exports.validateBulkReadings = async (readings, stationId) => {
  const validationResults = [];
  const errors = [];

  for (let i = 0; i < readings.length; i++) {
    const reading = readings[i];

    try {
      // Basic required fields
      if (!reading.nozzleId || !reading.readingValue || !reading.readingDate) {
        errors.push({
          index: i,
          error: 'Missing required fields: nozzleId, readingValue, readingDate'
        });
        continue;
      }

      // Validate nozzle exists
      const nozzle = await Nozzle.findByPk(reading.nozzleId);
      if (!nozzle) {
        errors.push({
          index: i,
          nozzleId: reading.nozzleId,
          error: 'Nozzle not found'
        });
        continue;
      }

      // Validate nozzle is active
      if (nozzle.status !== 'active') {
        errors.push({
          index: i,
          nozzleId: reading.nozzleId,
          error: `Nozzle is ${nozzle.status}, not active`
        });
        continue;
      }

      // Run enhanced validation
      const validation = await readingValidationEnhanced.validateReadingEnhanced(
        reading.nozzleId,
        reading.readingDate,
        reading.readingValue,
        reading.previousReading || 0
      );

      validationResults.push({
        index: i,
        valid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      });

      if (!validation.isValid) {
        validation.errors.forEach(err => {
          errors.push({
            index: i,
            nozzleId: reading.nozzleId,
            readingDate: reading.readingDate,
            ...err
          });
        });
      }
    } catch (err) {
      errors.push({
        index: i,
        error: err.message
      });
    }
  }

  return {
    totalRecords: readings.length,
    validRecords: readings.length - errors.length,
    errorRecords: errors.length,
    errors,
    canImport: errors.length === 0,
    message: errors.length === 0
      ? `All ${readings.length} readings are valid`
      : `${errors.length} validation errors found`
  };
};

/**
 * Bulk create readings
 * Wraps in transaction with rollback on error
 */
exports.bulkCreateReadings = async (readings, stationId, userId, transaction = null) => {
  const t = transaction || await sequelize.transaction();
  const createdReadings = [];

  try {
    // First validate all
    const validation = await this.validateBulkReadings(readings, stationId);

    if (!validation.canImport) {
      throw new Error(`Validation failed: ${validation.message}`);
    }

    // Create all readings
    for (const reading of readings) {
      const created = await NozzleReading.create({
        nozzleId: reading.nozzleId,
        stationId,
        readingDate: reading.readingDate,
        readingValue: reading.readingValue,
        previousReading: reading.previousReading,
        enteredBy: userId,
        notes: reading.notes || '',
        pricePerLitre: reading.pricePerLitre || 0,
        totalAmount: reading.totalAmount || 0,
        litresSold: reading.litresSold || 0,
        isSample: reading.isSample || false,
        isInitialReading: reading.isInitialReading || false,
        // Legacy fields
        cashAmount: 0,
        onlineAmount: 0,
        creditAmount: 0,
        paymentBreakdown: {}
      }, { transaction: t });

      createdReadings.push(created);
    }

    if (!transaction) {
      await t.commit();
    }

    return {
      success: true,
      created: createdReadings.length,
      readings: createdReadings,
      message: `Successfully bulk imported ${createdReadings.length} readings`
    };
  } catch (err) {
    if (!transaction) {
      await t.rollback();
    }

    console.error('[bulkCreateReadings] Error:', err);

    return {
      success: false,
      created: createdReadings.length,
      error: err.message,
      message: `Bulk import failed: ${err.message}. Rolled back all changes.`
    };
  }
};

/**
 * Parse CSV and prepare for import
 */
exports.parseCSVForImport = (csvContent, delimiter = ',') => {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return {
      success: false,
      error: 'CSV must have header row and at least one data row'
    };
  }

  // Parse header
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
  const requiredFields = ['nozzleid', 'readingvalue', 'readingdate'];

  const missing = requiredFields.filter(f => !headers.includes(f));
  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required columns: ${missing.join(', ')}`
    };
  }

  // Parse data rows
  const readings = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim());

    if (values.length !== headers.length) {
      errors.push({
        row: i + 1,
        error: `Column count mismatch (expected ${headers.length}, got ${values.length})`
      });
      continue;
    }

    const reading = {};
    headers.forEach((header, idx) => {
      reading[header] = values[idx];
    });

    readings.push(reading);
  }

  return {
    success: errors.length === 0,
    readings,
    parseErrors: errors,
    totalRows: lines.length - 1,
    validRows: readings.length,
    message: errors.length === 0
      ? `Parsed ${readings.length} readings from CSV`
      : `Parsed with ${errors.length} errors`
  };
};

/**
 * Export readings to CSV
 */
exports.exportReadingsToCSV = (readings) => {
  if (!readings || readings.length === 0) {
    return '';
  }

  // Headers
  const headers = [
    'ID',
    'Nozzle ID',
    'Reading Date',
    'Reading Value',
    'Previous Reading',
    'Litres Sold',
    'Price Per Litre',
    'Total Amount',
    'Is Initial',
    'Created At'
  ];

  // Data rows
  const rows = readings.map(r => [
    r.id,
    r.nozzleId,
    r.readingDate,
    r.readingValue,
    r.previousReading,
    r.litresSold,
    r.pricePerLitre,
    r.totalAmount,
    r.isInitialReading ? 'Yes' : 'No',
    r.createdAt
  ]);

  // CSV format
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
  ].join('\n');

  return csv;
};

/**
 * Bulk update readings
 */
exports.bulkUpdateReadings = async (updates) => {
  // updates: [{ id, changes: {...} }, ...]

  const t = await sequelize.transaction();
  const updated = [];

  try {
    for (const update of updates) {
      const reading = await NozzleReading.findByPk(update.id, { transaction: t });

      if (!reading) {
        throw new Error(`Reading ${update.id} not found`);
      }

      await reading.update(update.changes, { transaction: t });
      updated.push(reading);
    }

    await t.commit();

    return {
      success: true,
      updated: updated.length,
      message: `Updated ${updated.length} readings`
    };
  } catch (err) {
    await t.rollback();
    console.error('[bulkUpdateReadings] Error:', err);

    return {
      success: false,
      updated: updated.length,
      error: err.message,
      message: `Bulk update failed: ${err.message}. Rolled back changes.`
    };
  }
};
