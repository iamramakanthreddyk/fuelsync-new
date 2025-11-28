
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
    field: 'pump_id',
    references: {
      model: 'pumps',
      key: 'id'
    }
  },
  nozzleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'nozzle_id',
    validate: {
      min: 1,
      max: 8
    }
  },
  fuelType: {
    type: DataTypes.ENUM('petrol', 'diesel'),
    allowNull: false,
    field: 'fuel_type'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  },
  maxFlowRate: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    field: 'max_flow_rate',
    comment: 'Litres per minute'
  }
}, {
  tableName: 'nozzles',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['pump_id', 'nozzle_id'],
      name: 'unique_nozzle_per_pump'
    }
  ]
});

module.exports = Nozzle;
