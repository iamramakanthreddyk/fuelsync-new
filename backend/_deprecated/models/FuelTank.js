/**
 * Fuel Tank Model
 * Represents physical storage tanks at a station
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FuelTank = sequelize.define('FuelTank', {
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
  tankNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'tank_number',
    validate: {
      min: 1,
      max: 20
    }
  },
  fuelType: {
    type: DataTypes.ENUM('petrol', 'diesel'),
    allowNull: false,
    field: 'fuel_type'
  },
  capacity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Total capacity in litres',
    validate: {
      min: 0
    }
  },
  currentStock: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'current_stock',
    comment: 'Current stock level in litres',
    validate: {
      min: 0
    }
  },
  reorderLevel: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'reorder_level',
    comment: 'Stock level at which to reorder'
  },
  lastDipReading: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
    field: 'last_dip_reading',
    comment: 'Last physical measurement'
  },
  lastDipDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_dip_date'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'maintenance'),
    defaultValue: 'active'
  }
}, {
  tableName: 'fuel_tanks',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['station_id', 'tank_number'], unique: true },
    { fields: ['station_id', 'fuel_type'] }
  ]
});

module.exports = FuelTank;
