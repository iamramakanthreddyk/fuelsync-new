/**
 * CreditTransaction Model
 * Records both credit sales and settlements
 */

const { DataTypes, Op } = require('sequelize');
const { CREDIT_STATUS, FUEL_TYPES } = require('../config/constants');

module.exports = (sequelize) => {
  const CreditTransaction = sequelize.define('CreditTransaction', {
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
    creditorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'creditor_id',
      references: {
        model: 'creditors',
        key: 'id'
      }
    },
    
    // Transaction type
    transactionType: {
      type: DataTypes.ENUM('credit', 'settlement'),
      allowNull: false,
      field: 'transaction_type'
    },
    
    // For credit transactions
    fuelType: {
      type: DataTypes.STRING(30),
      field: 'fuel_type',
      validate: {
        isIn: [Object.values(FUEL_TYPES)]
      }
    },
    litres: {
      type: DataTypes.DECIMAL(10, 3),
      comment: 'Litres given on credit'
    },
    pricePerLitre: {
      type: DataTypes.DECIMAL(8, 2),
      field: 'price_per_litre',
      comment: 'Price at time of credit'
    },

    // Optional invoice/document reference for legal/tax traceability
    invoiceNumber: {
      type: DataTypes.STRING(50),
      field: 'invoice_number'
    },
    
    // Amount
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Total amount (credit) or settlement amount'
    },
    
    // For settlements - link to reading if applicable
    nozzleReadingId: {
      type: DataTypes.UUID,
      field: 'nozzle_reading_id',
      references: {
        model: 'nozzle_readings',
        key: 'id'
      }
    },
    
    // Transaction date
    transactionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'transaction_date'
    },
    
    // Settlement tracking
    vehicleNumber: {
      type: DataTypes.STRING(20),
      field: 'vehicle_number',
      comment: 'Vehicle number for the credit'
    },
    
    // Reference/receipt
    referenceNumber: {
      type: DataTypes.STRING(50),
      field: 'reference_number'
    },
    
    notes: {
      type: DataTypes.TEXT
    },

    // Invoice/document reference (optional)
    invoiceNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'invoice_number',
      comment: 'Invoice or document number for legal/tax tracking'
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
    tableName: 'credit_transactions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id'] },
      { fields: ['creditor_id'] },
      { fields: ['transaction_date'] },
      { fields: ['transaction_type'] }
    ]
    // Note: Balance updates are handled in the controller with proper transaction support
    // The afterCreate hook was removed to prevent SQLite locking issues
  });

  CreditTransaction.associate = (models) => {
    CreditTransaction.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    CreditTransaction.belongsTo(models.Creditor, { foreignKey: 'creditorId', as: 'creditor' });
    CreditTransaction.belongsTo(models.User, { foreignKey: 'enteredBy', as: 'enteredByUser' });
    CreditTransaction.belongsTo(models.NozzleReading, { foreignKey: 'nozzleReadingId', as: 'reading' });
    CreditTransaction.hasMany(models.CreditSettlementLink, { foreignKey: 'settlementId', as: 'settlementLinks' });
    CreditTransaction.hasMany(models.CreditSettlementLink, { foreignKey: 'creditTransactionId', as: 'appliedSettlements' });
  };

  /**
   * Get total credits for a creditor
   */
  CreditTransaction.getTotalCredits = async function(creditorId) {
    const result = await this.sum('amount', {
      where: { creditorId, transactionType: 'credit' }
    });
    return result || 0;
  };

  /**
   * Get total settlements for a creditor
   */
  CreditTransaction.getTotalSettlements = async function(creditorId) {
    const result = await this.sum('amount', {
      where: { creditorId, transactionType: 'settlement' }
    });
    return result || 0;
  };

  /**
   * Get outstanding balance for a creditor
   */
  CreditTransaction.getOutstanding = async function(creditorId) {
    const credits = await this.getTotalCredits(creditorId);
    const settlements = await this.getTotalSettlements(creditorId);
    return credits - settlements;
  };

  return CreditTransaction;
};
