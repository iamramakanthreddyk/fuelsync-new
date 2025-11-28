/**
 * Activity Logs Routes
 * Optional logging of user activity for audit purposes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/v1/activity-logs
 * Log a user activity (optional - fails silently on frontend)
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { user_id, station_id, activity_type, details } = req.body;
    
    // For now, just log to console in development
    // In production, you could store this in a database
    if (process.env.NODE_ENV === 'development') {
      console.log('[Activity]', {
        userId: user_id || req.user.id,
        stationId: station_id,
        activityType: activity_type,
        details,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Activity logged'
    });
  } catch (error) {
    console.error('Activity log error:', error);
    // Still return success - this is optional logging
    res.json({
      success: true,
      message: 'Activity logging skipped'
    });
  }
});

/**
 * GET /api/v1/activity-logs
 * Get activity logs for a user or station
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { userId, stationId, limit = 50 } = req.query;
    
    // For now, return empty array
    // In production, you could query from a database
    res.json({
      success: true,
      data: [],
      message: 'Activity logs feature not fully implemented'
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
