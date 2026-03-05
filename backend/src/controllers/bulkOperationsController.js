/**
 * Bulk Operations Controller
 * Handles batch import/export of readings and other bulk operations
 * Features: CSV parsing, validation batching, transactional creation, export
 * 
 * AUDIT LOGGING:
 * - BULK_CREATE: Batch reading creation is logged with summary
 * - BULK_EXPORT: Export operations are logged
 */

const { NozzleReading, Station, User, sequelize } = require('../models');
const { logAudit } = require('../utils/auditLog');
const bulkOperations = require('../services/bulkOperations');
const readingValidationEnhancedService = require('../services/readingValidationEnhancedService');
const { parseStream } = require('fast-csv');

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
exports.validateBulkReadings = async (req, res, next) => {
  try {
    const { stationId, readings } = req.body;
    const userId = req.userId;

    if (!stationId) {
      return res.status(400).json({
        success: false,
        error: 'stationId is required'
      });
    }

    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'readings array is required and must not be empty'
      });
    }

    // Verify station exists and user has access
    const station = await Station.findByPk(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }

    // Validate all readings
    const validationResult = await bulkOperations.validateBulkReadings({
      stationId,
      readings,
      userId
    });

    const statusCode = validationResult.allValid ? 200 : 400;
    res.status(statusCode).json({
      success: validationResult.allValid,
      message: `Validation complete: ${validationResult.validCount} valid, ${validationResult.invalidCount} invalid`,
      data: {
        totalReadings: validationResult.totalReadings,
        validCount: validationResult.validCount,
        invalidCount: validationResult.invalidCount,
        allValid: validationResult.allValid,
        results: validationResult.results
      }
    });
  } catch (error) {
    console.error('[ERROR] validateBulkReadings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

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
exports.bulkCreateReadings = async (req, res, next) => {
  let t;
  try {
    const userId = req.userId;
    const { stationId } = req.body;

    if (!stationId) {
      return res.status(400).json({
        success: false,
        error: 'stationId is required'
      });
    }

    // Verify station exists
    const station = await Station.findByPk(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }

    let readings = [];

    // Parse readings from file or JSON body
    if (req.file) {
      // CSV file upload
      readings = await bulkOperations.parseCSVForImport(req.file.buffer.toString('utf-8'));
    } else if (req.body.readings) {
      // JSON array in request body
      readings = req.body.readings;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either file upload or readings array in body is required'
      });
    }

    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No readings found to import'
      });
    }

    // Validate all readings first
    const validationResult = await bulkOperations.validateBulkReadings({
      stationId,
      readings,
      userId
    });

    if (!validationResult.allValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed - some readings are invalid',
        data: {
          validCount: validationResult.validCount,
          invalidCount: validationResult.invalidCount,
          results: validationResult.results
        }
      });
    }

    // Create transaction for atomic operation
    t = await sequelize.transaction();

    // Bulk create readings with transaction
    const createResult = await bulkOperations.bulkCreateReadings({
      stationId,
      readings,
      userId,
      transaction: t
    });

    if (!createResult.success) {
      await t.rollback();
      return res.status(500).json({
        success: false,
        error: 'Bulk create failed',
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

    res.status(201).json({
      success: true,
      message: `Successfully imported ${createResult.createdCount} readings`,
      data: {
        createdCount: createResult.createdCount,
        skippedCount: createResult.skippedCount,
        totalLiters: createResult.totalLiters,
        totalAmount: createResult.totalAmount,
        details: createResult.details
      }
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }
    console.error('[ERROR] bulkCreateReadings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

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
exports.exportReadingsToCSV = async (req, res, next) => {
  try {
    const { stationId, startDate, endDate, nozzleIds } = req.query;
    const userId = req.userId;

    if (!stationId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'stationId, startDate, and endDate are required'
      });
    }

    // Verify station exists
    const station = await Station.findByPk(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }

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
  } catch (error) {
    console.error('[ERROR] exportReadingsToCSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

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
exports.bulkUpdateReadings = async (req, res, next) => {
  let t;
  try {
    const { stationId, updates } = req.body;
    const userId = req.userId;

    if (!stationId) {
      return res.status(400).json({
        success: false,
        error: 'stationId is required'
      });
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'updates array is required and must not be empty'
      });
    }

    // Verify station exists
    const station = await Station.findByPk(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }

    // Create transaction for atomic operation
    t = await sequelize.transaction();

    // Bulk update readings with transaction
    const updateResult = await bulkOperations.bulkUpdateReadings({
      stationId,
      updates,
      transaction: t
    });

    if (!updateResult.success) {
      await t.rollback();
      return res.status(500).json({
        success: false,
        error: 'Bulk update failed',
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

    res.status(200).json({
      success: true,
      message: `Successfully updated ${updateResult.updatedCount} readings`,
      data: {
        updatedCount: updateResult.updatedCount,
        skippedCount: updateResult.skippedCount,
        details: updateResult.details
      }
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }
    console.error('[ERROR] bulkUpdateReadings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
