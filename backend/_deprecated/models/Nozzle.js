
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Nozzle = sequelize.define('Nozzle', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  pumpId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'pump_id', // Map to snake_case DB column
    references: {
      model: 'pumps',
      key: 'id'
    }
  },
  number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 10
    }
  },
  fuelType: {
    type: DataTypes.ENUM('Petrol', 'Diesel'),
    allowNull: false,
    field: 'fuel_type' // Map to snake_case DB column
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  tableName: 'nozzles',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['pump_id', 'nozzle_id']
    }
  ]
});

module.exports = Nozzle;
