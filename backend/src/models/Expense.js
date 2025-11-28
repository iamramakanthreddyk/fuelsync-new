/**
 * Expense Model
 * Tracks daily expenses and monthly cost of goods
 */

const { DataTypes, Op } = require('sequelize');
const { EXPENSE_CATEGORIES } = require('../config/constants');

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
    
    // Who entered
    enteredBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'entered_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'expenses',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id'] },
      { fields: ['expense_date'] },
      { fields: ['expense_month'] },
      { fields: ['category'] }
    ],
    hooks: {
      beforeValidate: (expense) => {
        // Auto-set expense month from date
        if (expense.expenseDate) {
          const date = new Date(expense.expenseDate);
          expense.expenseMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
      }
    }
  });

  Expense.associate = (models) => {
    Expense.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    Expense.belongsTo(models.User, { foreignKey: 'enteredBy', as: 'enteredByUser' });
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
        }
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
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      where: { stationId, expenseMonth: month },
      group: ['category']
    });
  };

  return Expense;
};
