
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NozzleReading = sequelize.define('NozzleReading', {
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
  pumpSno: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'pump_sno'
  },
  nozzleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'nozzle_id'
  },
  cumulativeVolume: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    field: 'cumulative_volume'
  },
  readingDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'reading_date'
  },
  readingTime: {
    type: DataTypes.TIME,
    allowNull: true,
    field: 'reading_time'
  },
  fuelType: {
    type: DataTypes.ENUM('Petrol', 'Diesel'),
    allowNull: false,
    field: 'fuel_type'
  },
  isManualEntry: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_manual_entry'
  },
  litresSold: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
    field: 'litres_sold'
  },
  pricePerLitre: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    field: 'price_per_litre'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'total_amount'
  }
}, {
  tableName: 'nozzle_readings',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['pump_sno', 'nozzle_id', 'reading_date'],
      name: 'idx_pump_nozzle_date'
    },
    {
      fields: ['user_id']
    }
  ]
});

module.exports = NozzleReading;
