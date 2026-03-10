/**
 * Expense Model
 * Tracks daily, weekly, and monthly station operational expenses
 * Supports approval workflow and net profit calculation
 */

const { DataTypes, Op } = require('sequelize');
const { EXPENSE_CATEGORIES, EXPENSE_FREQUENCY, EXPENSE_APPROVAL_STATUS, EXPENSE_CATEGORY_FREQUENCY_MAP } = require('../config/constants');

module.exports = (sequelize) => {
  const Expense = sequelize.define('Expense', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    stationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'station_id',
      references: {
        model: 'stations',
        key: 'id'
      }
    },
    
    // Expense details
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [Object.values(EXPENSE_CATEGORIES)]
      }
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    
    // Req #3: Frequency for grouping expenses by daily/monthly period
    frequency: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'one_time',
      comment: 'Recurrence: daily (cleaning, generator), monthly (salary, electricity), one_time (equipment)'
    },
    
    // Date
    expenseDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'expense_date'
    },
    
    // For monthly aggregations
    expenseMonth: {
      type: DataTypes.STRING(7),  // YYYY-MM format
      field: 'expense_month'
    },
    
    // Receipt/reference
    receiptNumber: {
      type: DataTypes.STRING(50),
      field: 'receipt_number'
    },
    
    // Payment details
    paymentMethod: {
      type: DataTypes.STRING(30),
      field: 'payment_method'
    },
    
    notes: {
      type: DataTypes.TEXT
    },
    
    // Custom tags for flexible categorization
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Optional JSON array of tags, e.g. ["overhead", "essential", "one-off"]'
    },

    // Who entered (maps to created_by in DB for legacy compatibility)
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },

    // Who entered (canonical field)
    enteredBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'entered_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },

    // Req #3: Approval workflow
    // Manager/Owner entry = auto_approved
    // Employee entry = pending (requires manager/owner sign-off)
    approvalStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'auto_approved',
      field: 'approval_status',
      comment: 'Approval state. Employees submit for approval; managers/owners are auto_approved.'
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'approved_by',
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Manager or owner who approved/rejected this expense'
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'approved_at',
      comment: 'Timestamp when expense was approved or rejected'
    }

    // Soft delete tracking for audit trail
    // TEMPORARILY DISABLED: columns don't exist in production DB yet
    // Will re-enable once 20260305 migrations are applied
    // deletedAt: {
    //   type: DataTypes.DATE,
    //   field: 'deleted_at',
    //   allowNull: true,
    //   comment: 'Timestamp when record was soft-deleted'
    // },
    // deletedBy: {
    //   type: DataTypes.UUID,
    //   field: 'deleted_by',
    //   allowNull: true,
    //   references: { model: 'users', key: 'id' },
    //   comment: 'User who deleted this expense'
    // },
    // deletionReason: {
    //   type: DataTypes.TEXT,
    //   field: 'deletion_reason',
    //   allowNull: true,
    //   comment: 'Reason for deletion (e.g., duplicate, incorrect entry)'
    // }
  }, {
    tableName: 'expenses',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id'] },
      { fields: ['expense_date'] },
      { fields: ['expense_month'] },
      { fields: ['category'] },
      { fields: ['frequency'] },
      { fields: ['approval_status'] }
    ],
    hooks: {
      beforeValidate: (expense) => {
        // Auto-set expense month from date
        if (expense.expenseDate) {
          const date = new Date(expense.expenseDate);
          expense.expenseMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        // Auto-set frequency from category if not provided
        if (!expense.frequency || expense.frequency === 'one_time') {
          const suggestedFrequency = EXPENSE_CATEGORY_FREQUENCY_MAP[expense.category];
          if (suggestedFrequency) {
            expense.frequency = suggestedFrequency;
          }
        }
      }
    }
  });

  /**
   * Scopes for soft delete functionality
   * TEMPORARILY DISABLED: soft delete columns don't exist in production DB yet
   * Will re-enable once 20260305 migrations are applied
   */
  // Expense.addScope('active', {
  //   where: { deletedAt: null }
  // });

  // Expense.addScope('deleted', {
  //   where: { deletedAt: { [Op.not]: null } }
  // });

  Expense.addScope('withDeleted', {
    // Returns all records (both active and deleted)
  });

  Expense.associate = (models) => {
    Expense.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    Expense.belongsTo(models.User, { foreignKey: 'enteredBy', as: 'enteredByUser' });
    Expense.belongsTo(models.User, { foreignKey: 'approvedBy', as: 'approvedByUser' });
  };

  /**
   * Get total expenses for a station in a date range
   */
  Expense.getTotalByDateRange = async function(stationId, startDate, endDate) {
    const result = await this.sum('amount', {
      where: {
        stationId,
        expenseDate: {
          [Op.between]: [startDate, endDate]
        },
        // Only count approved/auto_approved for net-profit calculations
        approvalStatus: { [Op.in]: ['approved', 'auto_approved'] }
      }
    });
    return result || 0;
  };

  /**
   * Get expenses by category for a month
   */
  Expense.getByCategory = async function(stationId, month) {
    return this.findAll({
      attributes: [
        'category',
        'frequency',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      where: {
        stationId,
        expenseMonth: month,
        approvalStatus: { [Op.in]: ['approved', 'auto_approved'] }
      },
      group: ['category', 'frequency']
    });
  };

  /**
   * Get daily expense total for net profit calculation
   */
  Expense.getDailyTotal = async function(stationId, date) {
    const result = await this.sum('amount', {
      where: {
        stationId,
        expenseDate: date,
        approvalStatus: { [Op.in]: ['approved', 'auto_approved'] }
      }
    });
    return result || 0;
  };

  return Expense;
};
