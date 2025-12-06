// Audit log utility for controllers
const { AuditLog } = require('../models');

/**
 * Log an audit event
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.stationId
 * @param {string} params.action
 * @param {Object} params.details
 * @param {string} [params.ip]
 */
async function logAudit({ userId, stationId, action, details, ip }) {
  try {
    await AuditLog.create({
      userId,
      stationId,
      action,
      details,
      ipAddress: ip || null
    });
  } catch (err) {
    // Don't block main flow on audit log failure
    console.error('Audit log error:', err);
  }
}

module.exports = { logAudit };