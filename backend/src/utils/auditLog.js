/**
 * Audit Log Utility
 * Centralized audit logging for all critical operations
 * Tracks: CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, etc.
 */

const { AuditLog } = require('../models');

/**
 * Log an audit event
 * @param {Object} params
 * @param {string} params.userId - User ID (null for system)
 * @param {string} [params.userEmail] - User email (for cache)
 * @param {string} [params.userRole] - User role for context
 * @param {string} params.stationId - Station context (optional)
 * @param {string} params.action - CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
 * @param {string} params.entityType - User, Station, Reading, Creditor, etc.
 * @param {string} [params.entityId] - ID of affected entity
 * @param {Object} [params.oldValues] - Previous state (for updates/deletes)
 * @param {Object} [params.newValues] - New state (for creates/updates)
 * @param {string} [params.description] - Human-readable description
 * @param {string} [params.ip] - IP address
 * @param {string} [params.userAgent] - User agent string
 * @param {string} [params.category] - auth, data, finance, system
 * @param {string} [params.severity] - info, warning, critical
 * @param {boolean} [params.success] - Success flag
 * @param {string} [params.errorMessage] - Error details if failed
 */
async function logAudit({
  userId,
  userEmail,
  userRole,
  stationId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
  description,
  ip,
  userAgent,
  category = 'general',
  severity = 'info',
  success = true,
  errorMessage
}) {
  try {
    if (!action || !entityType) {
      console.warn('⚠️ [AUDIT] Missing required fields: action and entityType');
      return;
    }

    await AuditLog.create({
      userId: userId || null,
      userEmail: userEmail || null,
      userRole: userRole || null,
      stationId: stationId || null,
      action: action.toUpperCase(),
      entityType,
      entityId,
      oldValues: oldValues || null,
      newValues: newValues || null,
      description: description || null,
      ipAddress: ip || null,
      userAgent: userAgent || null,
      category,
      severity,
      success,
      errorMessage: errorMessage || null
    });
  } catch (err) {
    // Don't block main flow on audit log failure
    console.error('❌ [AUDIT LOG] Error logging event:', err.message);
  }
}

/**
 * Get active sessions for a user (login count)
 * @param {string} userId
 * @param {number} [maxHours=24] - How many hours back to look
 * @returns {Promise<number>}
 */
async function getActiveSessionCount(userId, maxHours = 24) {
  try {
    const since = new Date(Date.now() - maxHours * 60 * 60 * 1000);
    
    const count = await AuditLog.count({
      where: {
        userId,
        action: 'LOGIN',
        category: 'auth',
        createdAt: { [require('sequelize').Op.gte]: since }
      }
    });
    
    return count;
  } catch (err) {
    console.error('❌ [SESSION] Error counting active sessions:', err.message);
    return 0;
  }
}

/**
 * Get login history for a user
 * @param {string} userId
 * @param {number} [limit=10]
 * @returns {Promise<Array>}
 */
async function getLoginHistory(userId, limit = 10) {
  try {
    const history = await AuditLog.findAll({
      where: {
        userId,
        action: 'LOGIN',
        category: 'auth'
      },
      order: [['createdAt', 'DESC']],
      limit,
      attributes: ['id', 'createdAt', 'ipAddress', 'userAgent', 'success', 'description'],
      raw: true
    });
    
    return history;
  } catch (err) {
    console.error('❌ [SESSION] Error fetching login history:', err.message);
    return [];
  }
}

/**
 * Check if user exceeds concurrent login limit
 * @param {string} userId
 * @param {number} maxConcurrentLogins - Max allowed (default 3)
 * @param {number} [timeWindowMinutes=60] - Time window to check (default 1 hour)
 * @returns {Promise<boolean>} true if limit exceeded
 */
async function checkConcurrentLoginLimit(userId, maxConcurrentLogins = 3, timeWindowMinutes = 60) {
  try {
    const since = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    
    const recentLogins = await AuditLog.count({
      where: {
        userId,
        action: 'LOGIN',
        category: 'auth',
        success: true,
        createdAt: { [require('sequelize').Op.gte]: since }
      }
    });
    
    return recentLogins >= maxConcurrentLogins;
  } catch (err) {
    console.error('❌ [SESSION] Error checking login limit:', err.message);
    return false;
  }
}

module.exports = {
  logAudit,
  getActiveSessionCount,
  getLoginHistory,
  checkConcurrentLoginLimit
};