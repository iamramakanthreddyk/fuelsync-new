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

// Delete reading (manager+ or owner or original employee)
router.delete('/:id', readingController.deleteReading);

// Compatibility: daily summary for a station (legacy path used in tests)
router.get('/summary', async (req, res, next) => {
	// stationId & date expected in query
	const { stationId, date } = req.query;
	if (!stationId) return res.status(400).json({ success: false, error: 'stationId is required' });
	req.params.stationId = stationId;
	req.query.date = date;
	return readingController.getDailySummary ? readingController.getDailySummary(req, res, next) : res.status(404).json({ success: false, error: 'Not implemented' });
});

// Compatibility: last reading for a nozzle
router.get('/last', async (req, res, next) => {
	const { nozzleId } = req.query;
	if (!nozzleId) return res.status(400).json({ success: false, error: 'nozzleId is required' });
	req.query.nozzleId = nozzleId;
	return readingController.getLastReading ? readingController.getLastReading(req, res, next) : res.status(404).json({ success: false, error: 'Not implemented' });
});

module.exports = router;
