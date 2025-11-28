/**
 * Creditor Model
 * Represents customers/businesses who buy fuel on credit
 * Enhanced with credit periods, aging, and invoice support
 */

const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const Creditor = sequelize.define('Creditor', {
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
    
    // Creditor details
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    contactPerson: {
      type: DataTypes.STRING(100),
      field: 'contact_person'
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    email: {
      type: DataTypes.STRING(100)
    },
    address: {
      type: DataTypes.TEXT
    },
    
    // Business details
    businessName: {
      type: DataTypes.STRING(150),
      field: 'business_name'
    },
    gstNumber: {
      type: DataTypes.STRING(20),
      field: 'gst_number'
    },
    
    // Credit limits and terms
    creditLimit: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'credit_limit',
      comment: 'Maximum credit allowed'
    },
    creditPeriodDays: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      field: 'credit_period_days',
      comment: 'Payment due within X days'
    },
    currentBalance: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'current_balance',
      comment: 'Current outstanding amount'
    },
    
    // Tracking
    lastTransactionDate: {
      type: DataTypes.DATEONLY,
      field: 'last_transaction_date'
    },
    lastPaymentDate: {
      type: DataTypes.DATEONLY,
      field: 'last_payment_date'
    },
    
    // Aging buckets (computed, but cached for performance)
    aging0to30: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'aging_0_to_30',
      comment: 'Amount due within 30 days'
    },
    aging31to60: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'aging_31_to_60',
      comment: 'Amount 31-60 days overdue'
    },
    aging61to90: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'aging_61_to_90',
      comment: 'Amount 61-90 days overdue'
    },
    agingOver90: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'aging_over_90',
      comment: 'Amount over 90 days overdue'
    },
    
    // Status
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    isFlagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_flagged',
      comment: 'Flagged for credit issues'
    },
    flagReason: {
      type: DataTypes.STRING(255),
      field: 'flag_reason'
    },
    notes: {
      type: DataTypes.TEXT
    },
    
    // Metadata
    createdBy: {
      type: DataTypes.UUID,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'creditors',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id'] },
      { fields: ['name'] },
      { fields: ['is_active'] },
      { fields: ['is_flagged'] },
      { fields: ['current_balance'] }
    ]
  });

  Creditor.associate = (models) => {
    Creditor.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    Creditor.belongsTo(models.User, { foreignKey: 'createdBy', as: 'createdByUser' });
    Creditor.hasMany(models.CreditTransaction, { foreignKey: 'creditorId', as: 'transactions' });
  };

  /**
   * Update balance after a credit transaction
   */
  Creditor.prototype.updateBalance = async function(amount, isSettlement = false) {
    if (isSettlement) {
      this.currentBalance = parseFloat(this.currentBalance) - parseFloat(amount);
      this.lastPaymentDate = new Date().toISOString().split('T')[0];
    } else {
      this.currentBalance = parseFloat(this.currentBalance) + parseFloat(amount);
      this.lastTransactionDate = new Date().toISOString().split('T')[0];
    }
    await this.save();
    return this;
  };

  /**
   * Check if creditor can take more credit
   */
  Creditor.prototype.canTakeCredit = function(amount) {
    if (this.creditLimit <= 0) return true; // No limit set
    if (this.isFlagged) return false; // Flagged creditors cannot take credit
    return (parseFloat(this.currentBalance) + parseFloat(amount)) <= parseFloat(this.creditLimit);
  };

  /**
   * Calculate aging buckets from transactions
   */
  Creditor.prototype.calculateAging = async function() {
    const CreditTransaction = sequelize.models.CreditTransaction;
    const today = new Date();
    
    // Get all unpaid credit transactions (simplified - for full aging, track individual invoices)
    const result = await CreditTransaction.findAll({
      where: {
        creditorId: this.id,
        transactionType: 'credit'
      },
      attributes: ['transactionDate', 'amount'],
      raw: true
    });

    let aging0to30 = 0, aging31to60 = 0, aging61to90 = 0, agingOver90 = 0;
    let totalCredit = 0;

    for (const txn of result) {
      const txnDate = new Date(txn.transactionDate);
      const daysDiff = Math.floor((today - txnDate) / (1000 * 60 * 60 * 24));
      const amount = parseFloat(txn.amount);
      totalCredit += amount;

      if (daysDiff <= 30) {
        aging0to30 += amount;
      } else if (daysDiff <= 60) {
        aging31to60 += amount;
      } else if (daysDiff <= 90) {
        aging61to90 += amount;
      } else {
        agingOver90 += amount;
      }
    }

    // Scale to match current balance (settlements are applied)
    const scale = totalCredit > 0 ? parseFloat(this.currentBalance) / totalCredit : 0;
    
    await this.update({
      aging0to30: aging0to30 * scale,
      aging31to60: aging31to60 * scale,
      aging61to90: aging61to90 * scale,
      agingOver90: agingOver90 * scale
    });

    return {
      aging0to30: aging0to30 * scale,
      aging31to60: aging31to60 * scale,
      aging61to90: aging61to90 * scale,
      agingOver90: agingOver90 * scale
    };
  };

  /**
   * Flag creditor for credit issues
   */
  Creditor.prototype.flag = async function(reason) {
    await this.update({
      isFlagged: true,
      flagReason: reason
    });
    return this;
  };

  /**
   * Unflag creditor
   */
  Creditor.prototype.unflag = async function() {
    await this.update({
      isFlagged: false,
      flagReason: null
    });
    return this;
  };

  /**
   * Get overdue amount based on credit period
   */
  Creditor.prototype.getOverdueAmount = function() {
    const overdue = parseFloat(this.aging31to60 || 0) + 
                   parseFloat(this.aging61to90 || 0) + 
                   parseFloat(this.agingOver90 || 0);
    return overdue;
  };

  /**
   * Check if creditor is overdue
   */
  Creditor.prototype.isOverdue = function() {
    if (!this.lastTransactionDate || parseFloat(this.currentBalance) <= 0) return false;
    
    const today = new Date();
    const lastTxn = new Date(this.lastTransactionDate);
    const daysSinceLastTxn = Math.floor((today - lastTxn) / (1000 * 60 * 60 * 24));
    
    return daysSinceLastTxn > (this.creditPeriodDays || 30);
  };

  // ============================================
  // CLASS METHODS
  // ============================================

  /**
   * Get overdue creditors for a station
   */
  Creditor.getOverdueCreditors = async function(stationId) {
    const creditors = await this.findAll({
      where: {
        stationId,
        isActive: true,
        currentBalance: { [Op.gt]: 0 }
      }
    });

    return creditors.filter(c => c.isOverdue());
  };

  /**
   * Get aging report for a station
   */
  Creditor.getAgingReport = async function(stationId) {
    const creditors = await this.findAll({
      where: {
        stationId,
        isActive: true,
        currentBalance: { [Op.gt]: 0 }
      },
      order: [['currentBalance', 'DESC']]
    });

    // Recalculate aging for each
    for (const creditor of creditors) {
      await creditor.calculateAging();
    }

    // Summary
    const totals = {
      totalOutstanding: 0,
      aging0to30: 0,
      aging31to60: 0,
      aging61to90: 0,
      agingOver90: 0
    };

    for (const c of creditors) {
      totals.totalOutstanding += parseFloat(c.currentBalance);
      totals.aging0to30 += parseFloat(c.aging0to30 || 0);
      totals.aging31to60 += parseFloat(c.aging31to60 || 0);
      totals.aging61to90 += parseFloat(c.aging61to90 || 0);
      totals.agingOver90 += parseFloat(c.agingOver90 || 0);
    }

    return {
      totals,
      creditors: creditors.map(c => ({
        id: c.id,
        name: c.name,
        businessName: c.businessName,
        currentBalance: c.currentBalance,
        creditLimit: c.creditLimit,
        creditPeriodDays: c.creditPeriodDays,
        lastTransactionDate: c.lastTransactionDate,
        lastPaymentDate: c.lastPaymentDate,
        isOverdue: c.isOverdue(),
        isFlagged: c.isFlagged,
        aging: {
          current: c.aging0to30,
          '31-60': c.aging31to60,
          '61-90': c.aging61to90,
          'over90': c.agingOver90
        }
      }))
    };
  };

  return Creditor;
};
