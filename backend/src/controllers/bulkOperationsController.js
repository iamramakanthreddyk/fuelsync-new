/**
 * Bulk Operations Controller
 * Handles batch import/export of readings and other bulk operations
 * Features: CSV parsing, validation batching, transactional creation, export
 * 
 * AUDIT LOGGING:
 * - BULK_CREATE: Batch reading creation is logged with summary
 * - BULK_EXPORT: Export operations are logged
 */

// ===== MODELS & DATABASE =====
const { NozzleReading, Station, User, sequelize } = require('../models');
const bulkOperations = require('../services/bulkOperations');
const readingValidationService = require('../services/readingValidationService');

// ===== ERROR & RESPONSE HANDLING =====
const { asyncHandler, NotFoundError, ValidationError } = require('../utils/errors');
const { sendSuccess, sendError, sendCreated } = require('../utils/apiResponse');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');

/**
 * Validate bulk readings before import
 * POST /api/v1/readings/bulk/validate
 * 
 * Request body:
 * {
 *   stationId: UUID,
 *   readings: [
 *     { nozzleId, readingDate, readingValue, notes }
 *   ]
 * }
 */
exports.validateBulkReadings = asyncHandler(async (req, res, next) => {
  const { stationId, readings } = req.body;
  const userId = req.user.id;

  if (!stationId) {
    return sendError(res, 'MISSING_FIELD', 'stationId is required', 400);
  }

  if (!Array.isArray(readings) || readings.length === 0) {
    return sendError(res, 'INVALID_ARRAY', 'readings array is required and must not be empty', 400);
  }

  // Verify station exists and user has access
  const station = await Station.findByPk(stationId);
  if (!station) throw new NotFoundError('Station', stationId);

  // Validate all readings
  const validationResult = await bulkOperations.validateBulkReadings({
    stationId,
    readings,
    userId
  });

  const statusCode = validationResult.allValid ? 200 : 400;
  
  return sendSuccess(res, {
    totalReadings: validationResult.totalReadings,
    validCount: validationResult.validCount,
    invalidCount: validationResult.invalidCount,
    allValid: validationResult.allValid,
    results: validationResult.results,
    message: `Validation complete: ${validationResult.validCount} valid, ${validationResult.invalidCount} invalid`
  }, statusCode);
});

/**
 * Create readings in bulk via CSV or JSON
 * POST /api/v1/readings/bulk
 * 
 * Content-Type: multipart/form-data
 * Form fields:
 * - stationId: UUID
 * - file: CSV file (columns: nozzleId, readingDate, readingValue, notes, pricePerLitre)
 * 
 * OR Content-Type: application/json
 * Request body:
 * {
 *   stationId: UUID,
 *   readings: [...]
 * }
 */
exports.bulkCreateReadings = asyncHandler(async (req, res, next) => {
  const { stationId } = req.body;
  const userId = req.user.id;

  if (!stationId) {
    return sendError(res, 'MISSING_FIELD', 'stationId is required', 400);
  }

  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) throw new NotFoundError('Station', stationId);

  let readings = [];

  // Parse readings from file or JSON body
  if (req.file) {
    // CSV file upload
    readings = await bulkOperations.parseCSVForImport(req.file.buffer.toString('utf-8'));
  } else if (req.body.readings) {
    // JSON array in request body
    readings = req.body.readings;
  } else {
    return sendError(res, 'INVALID_INPUT', 'Either file upload or readings array in body is required', 400);
  }

  if (!Array.isArray(readings) || readings.length === 0) {
    return sendError(res, 'INVALID_ARRAY', 'No readings found to import', 400);
  }

  // Validate all readings first
  const validationResult = await bulkOperations.validateBulkReadings({
    stationId,
    readings,
    userId
  });

  if (!validationResult.allValid) {
    return sendError(res, 'VALIDATION_FAILED', 'Validation failed - some readings are invalid', 400, {
      validCount: validationResult.validCount,
      invalidCount: validationResult.invalidCount,
      results: validationResult.results
    });
  }

  // Create transaction for atomic operation
  const t = await sequelize.transaction();

  try {
    // Bulk create readings with transaction
    const createResult = await bulkOperations.bulkCreateReadings({
      stationId,
      readings,
      userId,
      transaction: t
    });

    if (!createResult.success) {
      await t.rollback();
      return sendError(res, 'BULK_CREATE_FAILED', 'Bulk create failed', 500, {
        details: createResult.details
      });
    }

    // Audit log
    const currentUser = await User.findByPk(userId);
    await logAudit({
      userId,
      userEmail: currentUser?.email,
      userRole: currentUser?.role,
      stationId,
      action: 'BULK_CREATE',
      entityType: 'NozzleReading',
      newValues: {
        count: createResult.createdCount,
        totalLiters: createResult.totalLiters.toFixed(2),
        totalAmount: createResult.totalAmount.toFixed(2)
      },
      category: 'data',
      severity: 'info',
      description: `Bulk imported ${createResult.createdCount} readings: ${createResult.totalLiters.toFixed(2)}L, ₹${createResult.totalAmount.toFixed(2)}`
    });

    await t.commit();

    return sendCreated(res, {
      createdCount: createResult.createdCount,
      skippedCount: createResult.skippedCount,
      totalLiters: createResult.totalLiters,
      totalAmount: createResult.totalAmount,
      details: createResult.details
    }, { message: `Successfully imported ${createResult.createdCount} readings` });
  } catch (error) {
    await t.rollback();
    throw error;
  }
});

/**
 * Export readings to CSV
 * GET /api/v1/readings/bulk/export
 * 
 * Query parameters:
 * - stationId: UUID (required)
 * - startDate: YYYY-MM-DD (required)
 * - endDate: YYYY-MM-DD (required)
 * - nozzleIds: comma-separated UUIDs (optional, filter by specific nozzles)
 */
exports.exportReadingsToCSV = asyncHandler(async (req, res, next) => {
  const { stationId, startDate, endDate, nozzleIds } = req.query;
  const userId = req.user.id;

  if (!stationId || !startDate || !endDate) {
    return sendError(res, 'MISSING_FIELDS', 'stationId, startDate, and endDate are required', 400);
  }

  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) throw new NotFoundError('Station', stationId);

  // Parse nozzle IDs filter if provided
  const nozzleFilter = nozzleIds ? nozzleIds.split(',').map(id => id.trim()) : null;

  // Export to CSV
  const csvContent = await bulkOperations.exportReadingsToCSV({
    stationId,
    startDate,
    endDate,
    nozzleIds: nozzleFilter
  });

  // Audit log
  const currentUser = await User.findByPk(userId);
  await logAudit({
    userId,
    userEmail: currentUser?.email,
    userRole: currentUser?.role,
    stationId,
    action: 'BULK_EXPORT',
    entityType: 'NozzleReading',
    newValues: {
      startDate,
      endDate,
      nozzleCount: nozzleFilter ? nozzleFilter.length : 'all'
    },
    category: 'data',
    severity: 'info',
    description: `Exported readings from ${startDate} to ${endDate}`
  });

  // Return CSV file
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="readings_${stationId}_${startDate}_${endDate}.csv"`);
  res.send(csvContent);
});

/**
 * Update readings in bulk
 * PUT /api/v1/readings/bulk
 * 
 * Request body:
 * {
 *   stationId: UUID,
 *   updates: [
 *     { id: UUID, readingValue: number, notes?: string }
 *   ]
 * }
 */
exports.bulkUpdateReadings = asyncHandler(async (req, res, next) => {
  const { stationId, updates } = req.body;
  const userId = req.user.id;

  if (!stationId) {
    return sendError(res, 'MISSING_FIELD', 'stationId is required', 400);
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return sendError(res, 'INVALID_ARRAY', 'updates array is required and must not be empty', 400);
  }

  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) throw new NotFoundError('Station', stationId);

  // Create transaction for atomic operation
  const t = await sequelize.transaction();

  try {
    // Bulk update readings with transaction
    const updateResult = await bulkOperations.bulkUpdateReadings({
      stationId,
      updates,
      transaction: t
    });

    if (!updateResult.success) {
      await t.rollback();
      return sendError(res, 'BULK_UPDATE_FAILED', 'Bulk update failed', 500, {
        details: updateResult.details
      });
    }

    // Audit log
    const currentUser = await User.findByPk(userId);
    await logAudit({
      userId,
      userEmail: currentUser?.email,
      userRole: currentUser?.role,
      stationId,
      action: 'BULK_UPDATE',
      entityType: 'NozzleReading',
      newValues: {
        count: updateResult.updatedCount
      },
      category: 'data',
      severity: 'info',
      description: `Bulk updated ${updateResult.updatedCount} readings`
    });

    await t.commit();

    return sendSuccess(res, {
      updatedCount: updateResult.updatedCount,
      skippedCount: updateResult.skippedCount,
      details: updateResult.details
    }, 200, { message: `Successfully updated ${updateResult.updatedCount} readings` });
  } catch (error) {
    await t.rollback();
    throw error;
  }
});
