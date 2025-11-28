
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Sale = sequelize.define('Sale', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  pumpId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'pumps',
      key: 'id'
    }
  },
  fuelType: {
    type: DataTypes.ENUM('Petrol', 'Diesel'),
    allowNull: false
  },
  litres: {
    type: DataTypes.DECIMAL(8, 3),
    allowNull: false
  },
  pricePerLitre: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  shift: {
    type: DataTypes.ENUM('morning', 'afternoon', 'night'),
    allowNull: false
  },
  uploadId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'uploads',
      key: 'id'
    }
  },
  nozzleId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'sales',
  timestamps: true
});

module.exports = Sale;
