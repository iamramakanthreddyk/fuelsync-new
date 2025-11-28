
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FuelPrice = sequelize.define('FuelPrice', {
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
  fuelType: {
    type: DataTypes.ENUM('petrol', 'diesel'),
    allowNull: false,
    field: 'fuel_type'
  },
  price: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  validFrom: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'valid_from'
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'updated_by',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'fuel_prices',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false, // Price history is immutable
  indexes: [
    {
      unique: true,
      fields: ['station_id', 'fuel_type', 'valid_from'],
      name: 'unique_price_per_fuel_per_station_per_time'
    },
    {
      fields: ['station_id', 'fuel_type', 'valid_from'],
      name: 'idx_fuel_prices_lookup'
    }
  ]
});

module.exports = FuelPrice;
