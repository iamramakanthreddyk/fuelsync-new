/**
 * Fuel Delivery Model
 * Tracks fuel deliveries/receipts to the station
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FuelDelivery = sequelize.define('FuelDelivery', {
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
  tankId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'tank_id',
    references: {
      model: 'fuel_tanks',
      key: 'id'
    }
  },
  fuelType: {
    type: DataTypes.ENUM('petrol', 'diesel'),
    allowNull: false,
    field: 'fuel_type'
  },
  deliveryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'delivery_date'
  },
  deliveryTime: {
    type: DataTypes.TIME,
    allowNull: true,
    field: 'delivery_time'
  },
  supplierName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'supplier_name'
  },
  vehicleNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'vehicle_number'
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'invoice_number'
  },
  orderedQuantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    field: 'ordered_quantity',
    comment: 'Quantity ordered in litres'
  },
  receivedQuantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    field: 'received_quantity',
    comment: 'Quantity actually received in litres'
  },
  pricePerLitre: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
    field: 'price_per_litre'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'total_amount'
  },
  stockBefore: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
    field: 'stock_before',
    comment: 'Tank stock before delivery'
  },
  stockAfter: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
    field: 'stock_after',
    comment: 'Tank stock after delivery'
  },
  variance: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
    comment: 'Difference between expected and actual'
  },
  status: {
    type: DataTypes.ENUM('pending', 'verified', 'disputed'),
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  receivedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'received_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  verifiedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'verified_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'verified_at'
  }
}, {
  tableName: 'fuel_deliveries',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['station_id', 'delivery_date'] },
    { fields: ['tank_id'] },
    { fields: ['invoice_number'] }
  ]
});

module.exports = FuelDelivery;
