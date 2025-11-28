/**
 * Audit Log Model
 * Tracks all significant user actions for accountability
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  stationId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'station_id',
    references: {
      model: 'stations',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Action type: CREATE, UPDATE, DELETE, LOGIN, etc.'
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'entity_type',
    comment: 'Entity type: user, station, pump, sale, etc.'
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'entity_id',
    comment: 'ID of the affected entity'
  },
  previousValues: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'previous_values',
    comment: 'State before the change'
  },
  newValues: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'new_values',
    comment: 'State after the change'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional context like IP, user agent, etc.'
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: 'ip_address'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_agent'
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false, // Audit logs are immutable
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['station_id'] },
    { fields: ['entity_type', 'entity_id'] },
    { fields: ['action'] },
    { fields: ['created_at'] }
  ]
});

/**
 * Static method to log an action
 */
AuditLog.logAction = async function(options) {
  const {
    userId,
    stationId,
    action,
    entityType,
    entityId,
    previousValues,
    newValues,
    metadata,
    req
  } = options;

  return this.create({
    userId,
    stationId,
    action,
    entityType,
    entityId,
    previousValues,
    newValues,
    metadata,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.headers?.['user-agent']
  });
};

module.exports = AuditLog;
