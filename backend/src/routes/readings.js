/**
 * Reading Routes
 * Core API for nozzle readings
 */

const express = require('express');
const router = express.Router();
const readingController = require('../controllers/readingController');
const { authenticate, requireMinRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get previous reading for a nozzle (for UI)
router.get('/previous/:nozzleId', readingController.getPreviousReading);

// Get latest readings for multiple nozzle IDs (must come BEFORE /:id route)
router.get('/latest', readingController.getLatestReadingsForNozzles);

// Get today's readings for current user stations
router.get('/today', readingController.getTodayReadings);

// Create new reading (all authenticated users)
router.post('/', readingController.createReading);

// Get readings list (filtered by role)
router.get('/', readingController.getReadings);

// Get single reading
router.get('/:id', readingController.getReadingById);

// Update reading (manager+ only, same day)
router.put('/:id', requireMinRole('manager'), readingController.updateReading);

module.exports = router;
