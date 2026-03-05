/**
 * Bulk Operations Routes
 * Handles batch import/export of readings and other bulk operations
 */

const express = require('express');
const router = express.Router();
const bulkOperationsController = require('../controllers/bulkOperationsController');
const { authenticate, requireMinRole } = require('../middleware/auth');
const multer = require('multer');

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// All routes require authentication
router.use(authenticate);

/**
 * Validate bulk readings before import
 * POST /api/v1/readings/bulk/validate
 */
router.post('/validate', bulkOperationsController.validateBulkReadings);

/**
 * Create readings in bulk
 * POST /api/v1/readings/bulk
 * 
 * Accepts either:
 * - CSV file upload (multipart/form-data with file field)
 * - JSON array in request body with readings field
 */
router.post('/', upload.single('file'), bulkOperationsController.bulkCreateReadings);

/**
 * Update readings in bulk
 * PUT /api/v1/readings/bulk
 */
router.put('/', bulkOperationsController.bulkUpdateReadings);

/**
 * Export readings to CSV
 * GET /api/v1/readings/bulk/export
 */
router.get('/export', bulkOperationsController.exportReadingsToCSV);

module.exports = router;
