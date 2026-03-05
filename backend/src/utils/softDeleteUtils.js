/**
 * Soft Delete Utilities (Issue #5 fix)
 * 
 * Provides helper methods for soft delete operations
 * Adds deletedAt, deletedBy, deletionReason fields to models
 * Provides scopes to filter active/deleted records
 */

const { Op } = require('sequelize');

/**
 * Add soft delete functionality to a model
 * Call this in model definition after basic fields
 */
exports.addSoftDeleteFields = (modelAttributes) => {
  return {
    ...modelAttributes,
    deletedAt: {
      type: require('sequelize').DataTypes.DATE,
      field: 'deleted_at',
      allowNull: true,
      defaultValue: null,
      comment: 'Timestamp when record was deleted (null = active)'
    },
    deletedBy: {
      type: require('sequelize').DataTypes.UUID,
      field: 'deleted_by',
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'User who deleted this record'
    },
    deletionReason: {
      type: require('sequelize').DataTypes.TEXT,
      field: 'deletion_reason',
      allowNull: true,
      comment: 'Reason for deletion (required in production)'
    }
  };
};

/**
 * Add soft delete scopes to a model
 * Call this in model.addScope() section
 */
exports.addSoftDeleteScopes = (model) => {
  // Default scope: only active records
  model.addDefaultScope({
    where: { deletedAt: null }
  });

  // Scope to get deleted records only
  model.addScope('deleted', {
    where: { deletedAt: { [Op.ne]: null } }
  });

  // Scope to include deleted records
  model.addScope('withDeleted', {
    where: {} // Override default scope, include all
  });

  // Scope to only get records deleted by specific user
  model.addScope('deletedBy', (userId) => ({
    where: {
      deletedAt: { [Op.ne]: null },
      deletedBy: userId
    }
  }));

  // Scope for audit trail
  model.addScope('auditTrail', {
    attributes: {
      include: ['deletedAt', 'deletedBy', 'deletionReason']
    }
  });
};

/**
 * Soft delete a record
 * @param {Model instance} record - The record to soft delete
 * @param {UUID} userId - User performing the deletion
 * @param {string} reason - Reason for deletion
 * @returns {Model instance} - Updated record
 */
exports.softDelete = async (record, userId, reason = 'User initiated') => {
  if (!record) {
    throw new Error('Record not found');
  }

  if (record.deletedAt) {
    throw new Error('Record already deleted');
  }

  record.deletedAt = new Date();
  record.deletedBy = userId;
  record.deletionReason = reason;

  await record.save();
  return record;
};

/**
 * Soft restore a deleted record
 * @param {Model instance} record - The deleted record to restore
 * @returns {Model instance} - Updated record
 */
exports.softRestore = async (record) => {
  if (!record) {
    throw new Error('Record not found');
  }

  if (!record.deletedAt) {
    throw new Error('Record is not deleted');
  }

  record.deletedAt = null;
  record.deletedBy = null;
  record.deletionReason = null;

  await record.save();
  return record;
};

/**
 * Permanent delete (cascade, use with caution!)
 * @param {Model instance} record - The record to permanently delete
 * @returns {boolean} - Success
 */
exports.permanentDelete = async (record) => {
  await record.destroy({ force: true });
  return true;
};

/**
 * Query helper: Get all records matching criteria
 * Respects default soft delete scope
 */
exports.findActive = async (Model, where = {}) => {
  return Model.findAll({ where });
};

/**
 * Query helper: Get deleted records
 */
exports.findDeleted = async (Model, where = {}) => {
  return Model.scope('deleted').findAll({ where });
};

/**
 * Query helper: Bypass soft delete (admin only)
 */
exports.findWithDeleted = async (Model, where = {}) => {
  return Model.scope('withDeleted').findAll({ where });
};

/**
 * Query helper: Get deletion history
 */
exports.getDeletionHistory = async (Model, recordId) => {
  const deletedRecord = await Model.scope('withDeleted').findByPk(recordId);

  if (!deletedRecord || !deletedRecord.deletedAt) {
    return {
      id: recordId,
      isDeleted: false
    };
  }

  // Try to get deleter's name
  let deleterName = 'Unknown';
  try {
    if (deletedRecord.deletedBy) {
      const { User } = require('../models');
      const deleter = await User.findByPk(deletedRecord.deletedBy, {
        attributes: ['name', 'email']
      });
      deleterName = deleter ? `${deleter.name} (${deleter.email})` : 'Unknown';
    }
  } catch (err) {
    // Ignore error getting deleter info
  }

  return {
    id: recordId,
    isDeleted: true,
    deletedAt: deletedRecord.deletedAt,
    deletedBy: deleterName,
    deletionReason: deletedRecord.deletionReason || 'No reason provided'
  };
};

/**
 * Middleware to handle soft deletes in API responses
 * Shows deletion info in 404 responses if record was soft deleted
 */
exports.softDeleteMiddleware = (Model, idParamName = 'id') => {
  return async (req, res, next) => {
    const recordId = req.params[idParamName];

    if (!recordId) {
      return next();
    }

    try {
      const deleted = await Model.scope('deleted').findByPk(recordId);

      if (deleted) {
        const history = await this.getDeletionHistory(Model, recordId);
        return res.status(410).json({
          success: false,
          error: 'Record has been deleted',
          status: 'gone',
          deletionInfo: history,
          suggestion: 'Contact admin to restore if needed'
        });
      }
    } catch (err) {
      // Ignore errors, proceed
    }

    next();
  };
};
