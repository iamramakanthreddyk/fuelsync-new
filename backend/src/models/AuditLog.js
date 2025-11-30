/**
 * AuditLog Model
 * Track all critical operations for compliance and debugging
 */

const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    
    // Who did it
    userId: {
      type: DataTypes.UUID,
      allowNull: true, // Null for system actions
      references: { model: 'users', key: 'id' }
    },
    
    userEmail: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Cached email for deleted users'
    },
    
    userRole: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    
    // What station (multi-tenant context)
    stationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'stations', key: 'id' }
    },
    
    // Action details
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.'
    },
    
    entityType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'User, Station, Reading, Creditor, etc.'
    },
    
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    
    // Change details
    oldValues: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Previous state (for updates/deletes)'
    },
    
    newValues: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'New state (for creates/updates)'
    },
    
    // Additional context
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Human-readable description'
    },
    
    // Request metadata
    ipAddress: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    
    // Severity/category
    severity: {
      type: DataTypes.ENUM('info', 'warning', 'critical'),
      defaultValue: 'info'
    },
    
    category: {
      type: DataTypes.STRING(30),
      defaultValue: 'general',
      comment: 'auth, data, finance, system'
    },
    
    // Success/failure
    success: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false, // Audit logs are immutable
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['station_id'] },
      { fields: ['entity_type'] },
      { fields: ['entity_type', 'entity_id'] },
      { fields: ['action'] },
      { fields: ['created_at'] },
      { fields: ['station_id', 'created_at'] },
      { fields: ['category'] },
      { fields: ['severity'] }
    ]
  });

  // ============================================
  // CLASS METHODS
  // ============================================

  /**
   * Log an action
   */
  AuditLog.log = async function(data) {
    const {
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
      ipAddress,
      userAgent,
      severity = 'info',
      category = 'general',
      success = true,
      errorMessage
    } = data;

    try {
      return await this.create({
        userId,
        userEmail,
        userRole,
        stationId,
        action,
        entityType,
        entityId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        description,
        ipAddress,
        userAgent,
        severity,
        category,
        success,
        errorMessage
      });
    } catch (error) {
      // Don't let audit logging errors break the main flow
      console.error('Audit log error:', error);
      return null;
    }
  };

  /**
   * Log authentication event
   */
  AuditLog.logAuth = async function(action, user, req, success = true, errorMessage = null) {
    return this.log({
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role,
      action,
      entityType: 'Auth',
      description: `${action}: ${user?.email || 'Unknown'}`,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
      category: 'auth',
      severity: success ? 'info' : 'warning',
      success,
      errorMessage
    });
  };

  /**
   * Log data change
   */
  AuditLog.logChange = async function(action, entityType, entityId, user, oldValues, newValues, req, stationId = null) {
    // Sanitize sensitive data
    const sanitize = (obj) => {
      if (!obj) return null;
      const sanitized = { ...obj };
      delete sanitized.password;
      delete sanitized.token;
      return sanitized;
    };

    return this.log({
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role,
      stationId,
      action,
      entityType,
      entityId,
      oldValues: sanitize(oldValues),
      newValues: sanitize(newValues),
      description: `${action} ${entityType} #${entityId}`,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
      category: 'data'
    });
  };

  /**
   * Log financial transaction
   */
  AuditLog.logFinancial = async function(action, entityType, entityId, amount, user, stationId, description = null) {
    return this.log({
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role,
      stationId,
      action,
      entityType,
      entityId,
      newValues: { amount },
      description: description || `${action} ${entityType}: ₹${amount}`,
      category: 'finance',
      severity: 'info'
    });
  };

  /**
   * Get audit trail for an entity
   */
  AuditLog.getEntityHistory = async function(entityType, entityId, options = {}) {
    const { page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

    return this.findAndCountAll({
      where: { entityType, entityId },
      include: [
        { model: sequelize.models.User, as: 'user', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
  };

  /**
   * Get user activity log
   */
  AuditLog.getUserActivity = async function(userId, options = {}) {
    const { startDate, endDate, page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

    const where = { userId };
    
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [startDate, endDate] };
    }

    return this.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
  };

  /**
   * Get station activity log
   */
  AuditLog.getStationActivity = async function(stationId, options = {}) {
    const { startDate, endDate, category, page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

    const where = { stationId };
    
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [startDate, endDate] };
    }
    
    if (category) {
      where.category = category;
    }

    return this.findAndCountAll({
      where,
      include: [
        { model: sequelize.models.User, as: 'user', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
  };

  /**
   * Get security alerts (failed logins, critical actions)
   */
  AuditLog.getSecurityAlerts = async function(stationId = null, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const where = {
      createdAt: { [Op.gte]: since },
      [Op.or]: [
        { severity: 'critical' },
        { success: false, category: 'auth' }
      ]
    };

    if (stationId) where.stationId = stationId;

    return this.findAll({
      where,
      include: [
        { model: sequelize.models.User, as: 'user', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100
    });
  };

  /**
   * Cleanup old audit logs (retention policy)
   */
  AuditLog.cleanup = async function(retentionDays = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await this.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate },
        severity: { [Op.ne]: 'critical' } // Keep critical logs forever
      }
    });

    return deleted;
  };

  return AuditLog;
};
