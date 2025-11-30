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
    
    // Legacy fields for backward compatibility
    cashAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'cash_amount'
    },
    onlineAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'online_amount'
    },
    creditAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'credit_amount'
    },
    
    // Credit reference (if any amount is on credit)
    creditorId: {
      type: DataTypes.UUID,
      field: 'creditor_id',
      references: {
        model: 'creditors',
        key: 'id'
      }
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
    NozzleReading.belongsTo(models.Creditor, { foreignKey: 'creditorId', as: 'creditor' });
    NozzleReading.belongsTo(models.Pump, { foreignKey: 'pumpId', as: 'pump' });
    NozzleReading.belongsTo(models.Shift, { foreignKey: 'shiftId', as: 'shift' });
  };

  /**
   * Get the latest reading for a nozzle (for showing previous reading)
   */
  NozzleReading.getLatestReading = async function(nozzleId) {
    return this.findOne({
      where: { nozzleId },
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
    });
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
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalSales'],
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
