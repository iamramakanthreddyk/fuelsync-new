/**
 * DailyTransaction Model
 * Tracks daily payment breakdown at station level
 * Separates "what was sold" (readings) from "how was it paid" (transaction)
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DailyTransaction = sequelize.define('DailyTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // Station reference
    stationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'station_id',
      references: {
        model: 'stations',
        key: 'id'
      }
    },

    // Transaction date (typically today, but can be backdate)
    transactionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'transaction_date'
    },

    // Total amounts aggregated from all readings for this day
    totalLiters: {
      type: DataTypes.DECIMAL(10, 3),
      defaultValue: 0,
      field: 'total_liters'
    },
    totalSaleValue: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'total_sale_value'
    },

    // Payment breakdown - single breakdown for the entire day
    // Structure: { cash: 3000, online: 2000, credit: 0 }
    paymentBreakdown: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { cash: 0, online: 0, credit: 0 },
      field: 'payment_breakdown',
      validate: {
        isValidBreakdown(value) {
          if (!value || typeof value !== 'object') {
            throw new Error('paymentBreakdown must be an object');
          }
          if (!('cash' in value) || !('online' in value)) {
            throw new Error('paymentBreakdown must have cash and online fields');
          }
        }
      }
    },

    // Credit allocations (array for multiple creditors possible)
    // Structure: [{ creditorId: UUID, amount: 1000 }, ...]
    creditAllocations: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'credit_allocations',
      comment: 'Array of { creditorId, amount } for credit sales'
    },

    // References to reading IDs included in this transaction
    readingIds: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'reading_ids',
      comment: 'Array of NozzleReading IDs that make up this transaction'
    },

    // Who created this transaction
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },

    // Notes or remarks
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    // Status
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'settled', 'cancelled'),
      defaultValue: 'submitted',
      comment: 'draft=not yet submitted, submitted=pending settlement, settled=closed'
    },

    // Link to settlement (when this transaction is settled)
    settlementId: {
      type: DataTypes.UUID,
      field: 'settlement_id',
      allowNull: true,
      references: {
        model: 'settlements',
        key: 'id'
      },
      comment: 'Links to settlement record when day is closed'
    }
  }, {
    tableName: 'daily_transactions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id', 'transaction_date'] }, // Removed unique constraint - allow multiple per day
      { fields: ['transaction_date'] },
      { fields: ['created_by'] },
      { fields: ['status'] }
    ]
  });

  DailyTransaction.associate = (models) => {
    DailyTransaction.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    DailyTransaction.belongsTo(models.User, { foreignKey: 'createdBy', as: 'createdByUser' });
    DailyTransaction.belongsTo(models.Settlement, { foreignKey: 'settlementId', as: 'settlement' });
  };

  /**
   * Validate payment breakdown sums correctly
   */
  DailyTransaction.prototype.validatePaymentTotal = function() {
    const { cash = 0, online = 0, credit = 0 } = this.paymentBreakdown;
    const total = parseFloat(cash) + parseFloat(online) + parseFloat(credit);
    const expected = parseFloat(this.totalSaleValue);
    const diff = Math.abs(total - expected);
    
    if (diff > 0.01) {
      throw new Error(
        `Payment breakdown (₹${total.toFixed(2)}) must match total sale value (₹${expected.toFixed(2)}). Difference: ₹${diff.toFixed(2)}`
      );
    }
    return true;
  };

  /**
   * Get ALL transactions for a station on a specific date
   * Returns array of transactions (multiple employees/shifts per day)
   */
  DailyTransaction.getForDate = async function(stationId, date) {
    return this.findAll({
      where: {
        stationId,
        transactionDate: date
      },
      include: [
        { model: sequelize.models.User, as: 'createdByUser', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'ASC']]
    });
  };

  /**
   * Get transactions in date range
   */
  DailyTransaction.getForDateRange = async function(stationId, startDate, endDate) {
    const { Op } = require('sequelize');
    return this.findAll({
      where: {
        stationId,
        transactionDate: { [Op.between]: [startDate, endDate] }
      },
      order: [['transactionDate', 'DESC']],
      include: [
        { model: sequelize.models.User, as: 'createdByUser', attributes: ['id', 'name', 'email'] }
      ]
    });
  };

  /**
   * Calculate summary from transaction records
   */
  DailyTransaction.getSummary = async function(stationId, startDate, endDate) {
    const { Op, fn, col } = require('sequelize');
    
    const result = await this.findAll({
      where: {
        stationId,
        transactionDate: { [Op.between]: [startDate, endDate] }
      },
      attributes: [
        [fn('SUM', col('total_liters')), 'totalLiters'],
        [fn('SUM', col('total_sale_value')), 'totalSaleValue'],
        [fn('COUNT', col('id')), 'transactionCount']
      ],
      raw: true
    });

    const summary = result[0] || {};
    
    // Aggregate payment breakdown across all transactions
    const transactions = await this.findAll({
      where: {
        stationId,
        transactionDate: { [Op.between]: [startDate, endDate] }
      },
      raw: true
    });

    let totalCash = 0, totalOnline = 0, totalCredit = 0;
    transactions.forEach(t => {
      const breakdown = t.payment_breakdown || {};
      totalCash += parseFloat(breakdown.cash || 0);
      totalOnline += parseFloat(breakdown.online || 0);
      totalCredit += parseFloat(breakdown.credit || 0);
    });

    return {
      totalLiters: parseFloat(summary.totalLiters || 0),
      totalSaleValue: parseFloat(summary.totalSaleValue || 0),
      transactionCount: parseInt(summary.transactionCount || 0),
      paymentSummary: {
        cash: totalCash,
        online: totalOnline,
        credit: totalCredit
      }
    };
  };

  return DailyTransaction;
};
