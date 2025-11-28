/**
 * Daily Closure Model
 * Represents end-of-shift/day reconciliation
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DailyClosure = sequelize.define('DailyClosure', {
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
  closureDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'closure_date'
  },
  shift: {
    type: DataTypes.ENUM('morning', 'afternoon', 'night', 'full_day'),
    allowNull: false
  },
  
  // Sales summary
  totalSalesAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_sales_amount'
  },
  totalLitresSold: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'total_litres_sold'
  },
  petrolLitres: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'petrol_litres'
  },
  dieselLitres: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'diesel_litres'
  },
  petrolAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'petrol_amount'
  },
  dieselAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'diesel_amount'
  },
  transactionCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'transaction_count'
  },

  // Cash reconciliation
  expectedCash: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'expected_cash'
  },
  actualCash: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'actual_cash'
  },
  cashVariance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'cash_variance'
  },
  
  // Card/UPI payments
  cardPayments: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'card_payments'
  },
  upiPayments: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'upi_payments'
  },
  creditSales: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'credit_sales'
  },

  // Tank dip readings
  dipReadings: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'dip_readings',
    comment: 'Array of {tankId, fuelType, openingDip, closingDip, variance}'
  },

  // Nozzle readings
  nozzleReadings: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'nozzle_readings',
    comment: 'Array of {nozzleId, pumpId, openingReading, closingReading, litresSold}'
  },

  // Status and approval
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'approved', 'rejected'),
    defaultValue: 'draft'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Audit fields
  preparedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'prepared_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'approved_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approved_at'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason'
  }
}, {
  tableName: 'daily_closures',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['station_id', 'closure_date', 'shift'], unique: true },
    { fields: ['status'] },
    { fields: ['prepared_by'] }
  ]
});

module.exports = DailyClosure;
