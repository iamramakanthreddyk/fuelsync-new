/**
 * NozzleReading Model
 * Core table: tracks meter readings and calculates sales
 * Supports multiple payment types including credit
 */

const { DataTypes, Op } = require('sequelize');
const { PAYMENT_METHODS, FUEL_TYPES } = require('../config/constants');

module.exports = (sequelize) => {
  const NozzleReading = sequelize.define('NozzleReading', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // References
    nozzleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'nozzle_id',
      references: {
        model: 'nozzles',
        key: 'id'
      }
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
    enteredBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'entered_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    
    // Reading data
    readingDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'reading_date'
    },
    readingValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'reading_value',
      validate: {
        min: 0
      }
    },
    previousReading: {
      type: DataTypes.DECIMAL(12, 2),
      field: 'previous_reading'
    },
    
    // Calculated values
    litresSold: {
      type: DataTypes.DECIMAL(10, 3),
      defaultValue: 0,
      field: 'litres_sold'
    },
    pricePerLitre: {
      type: DataTypes.DECIMAL(8, 2),
      field: 'price_per_litre'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'total_amount'
    },
    
    // Payment breakdown - expandable
    paymentBreakdown: {
      type: DataTypes.JSONB,
      defaultValue: {},
      field: 'payment_breakdown',
      comment: 'Flexible payment split: { cash: 1000, upi: 500, card: 200, credit: 300 }'
    },
    
    // Legacy fields for backward compatibility - DEPRECATED
    // As of Dec 2025, payment breakdown is tracked in DailyTransaction model, not per-reading
    // These fields should always be 0 and are kept only for schema compatibility
    cashAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'cash_amount',
      comment: 'DEPRECATED: Always 0. Use DailyTransaction.paymentBreakdown instead'
    },
    onlineAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'online_amount',
      comment: 'DEPRECATED: Always 0. Use DailyTransaction.paymentBreakdown instead'
    },
    creditAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'credit_amount',
      comment: 'DEPRECATED: Always 0. Use DailyTransaction.creditAllocations instead'
    },
    
    // Credit reference (if any amount is on credit)
    creditorId: {
      type: DataTypes.UUID,
      field: 'creditor_id',
      references: {
        model: 'creditors',
        key: 'id'
      },
      comment: 'DEPRECATED: Kept for schema only. Credit tracking is in DailyTransaction'
    },
    
    // Metadata
    isInitialReading: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_initial_reading'
    },
    notes: {
      type: DataTypes.TEXT
    },
    
    // For analytics
    fuelType: {
      type: DataTypes.STRING(30),
      field: 'fuel_type',
      comment: 'Denormalized from nozzle for faster queries'
    },
    pumpId: {
      type: DataTypes.UUID,
      field: 'pump_id',
      comment: 'Denormalized from nozzle for faster queries'
    },
    
    // Shift linkage (optional based on station settings)
    shiftId: {
      type: DataTypes.UUID,
      field: 'shift_id',
      allowNull: true,
      references: { model: 'shifts', key: 'id' },
      comment: 'Links reading to active shift if station requires it'
    },
    
    // Settlement linkage (set when owner reviews and finalizes)
    settlementId: {
      type: DataTypes.UUID,
      field: 'settlement_id',
      allowNull: true,
      references: { model: 'settlements', key: 'id' },
      comment: 'Links reading to a settlement when owner reviews and finalizes'
    },

    // Transaction linkage (group readings by transaction)
    transactionId: {
      type: DataTypes.UUID,
      field: 'transaction_id',
      allowNull: true,
      references: { model: 'daily_transactions', key: 'id' },
      comment: 'Links reading to a DailyTransaction (grouped entry)'
    },
    
    // Approval workflow
    approvalStatus: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
      field: 'approval_status',
      comment: 'Manager/Owner approval status'
    },
    approvedBy: {
      type: DataTypes.UUID,
      field: 'approved_by',
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    approvedAt: {
      type: DataTypes.DATE,
      field: 'approved_at',
      allowNull: true
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      field: 'rejection_reason',
      allowNull: true
    }
  }, {
    tableName: 'nozzle_readings',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id', 'reading_date'] },
      { fields: ['nozzle_id', 'reading_date'] },
      { fields: ['pump_id', 'reading_date'] },
      { fields: ['fuel_type', 'reading_date'] },
      { fields: ['creditor_id'] }
    ]
  });

  NozzleReading.associate = (models) => {
    NozzleReading.belongsTo(models.Nozzle, { foreignKey: 'nozzleId', as: 'nozzle' });
    NozzleReading.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    NozzleReading.belongsTo(models.User, { foreignKey: 'enteredBy', as: 'enteredByUser' });
    NozzleReading.belongsTo(models.User, { foreignKey: 'approvedBy', as: 'approvedByUser' });
    NozzleReading.belongsTo(models.Creditor, { foreignKey: 'creditorId', as: 'creditor' });
    NozzleReading.belongsTo(models.Pump, { foreignKey: 'pumpId', as: 'pump' });
    NozzleReading.belongsTo(models.Shift, { foreignKey: 'shiftId', as: 'shift' });
    NozzleReading.belongsTo(models.Settlement, { foreignKey: 'settlementId', as: 'settlement' });
    NozzleReading.belongsTo(models.DailyTransaction, { foreignKey: 'transactionId', as: 'transaction' });
  };

  /**
   * CRITICAL VALIDATION: Prevent isInitialReading from being set to true in NozzleReading
   * Initial readings are ONLY for nozzle setup (via Nozzle.initialReading)
   * Sales readings (NozzleReading) must NEVER be marked as initial
   */
  NozzleReading.beforeCreate((reading) => {
    // STRICT: Force isInitialReading to false for sales readings
    // This prevents accidental marking of sales as initial readings
    if (reading.isInitialReading === true) {
      console.warn(`⚠️  ALERT: Attempted to create NozzleReading with isInitialReading=true. Forcing to false. Reading ID: ${reading.id}, nozzleId: ${reading.nozzleId}`);
    }
    reading.isInitialReading = false;
  });

  NozzleReading.beforeUpdate((reading) => {
    // STRICT: Force isInitialReading to false for sales readings
    // Prevent updates from accidentally setting initial flag
    if (reading.changed('isInitialReading') && reading.isInitialReading === true) {
      console.warn(`⚠️  ALERT: Attempted to update NozzleReading with isInitialReading=true. Forcing to false. Reading ID: ${reading.id}`);
    }
    reading.isInitialReading = false;
  });

  /**
   * Get the latest reading for a nozzle (for showing previous reading)
   */
  NozzleReading.getLatestReading = async function(nozzleId) {
    const latest = await this.findOne({
      where: { nozzleId },
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
    });
    console.log(`[DEBUG] getLatestReading for nozzleId=${nozzleId}:`, latest ? latest.readingValue : null);
    return latest;
  };

  /**
   * Get the previous reading for a nozzle before a specific date
   */
  NozzleReading.getPreviousReading = async function(nozzleId, beforeDate) {
    return this.findOne({
      where: {
        nozzleId,
        readingDate: { [Op.lt]: beforeDate }
      },
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
    });
  };

  /**
   * Get aggregated metrics by grouping
   */
  NozzleReading.getMetrics = async function(stationId, startDate, endDate, groupBy = 'date') {
    const groupFields = {
      date: ['reading_date'],
      fuel: ['fuel_type'],
      pump: ['pump_id'],
      nozzle: ['nozzle_id']
    };
    
    return this.findAll({
      attributes: [
        ...groupFields[groupBy],
        [sequelize.fn('SUM', sequelize.col('litres_sold')), 'totalLitres'],
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
        [sequelize.fn('SUM', sequelize.col('cash_amount')), 'totalCash'],
        [sequelize.fn('SUM', sequelize.col('online_amount')), 'totalOnline'],
        [sequelize.fn('SUM', sequelize.col('credit_amount')), 'totalCredit'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        stationId,
        readingDate: { [Op.between]: [startDate, endDate] },
        isInitialReading: false
      },
      group: groupFields[groupBy],
      order: [[groupFields[groupBy][0], 'ASC']]
    });
  };

  return NozzleReading;
};
