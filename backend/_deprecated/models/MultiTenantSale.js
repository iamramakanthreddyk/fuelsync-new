
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Sale = sequelize.define('Sale', {
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
    field: 'nozzle_id'
  },
  readingId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'reading_id',
    references: {
      model: 'ocr_readings',
      key: 'id'
    }
  },
  previousReadingId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'previous_reading_id',
    references: {
      model: 'ocr_readings',
      key: 'id'
    }
  },
  fuelType: {
    type: DataTypes.ENUM('petrol', 'diesel'),
    allowNull: false,
    field: 'fuel_type'
  },
  litresSold: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    field: 'litres_sold',
    validate: {
      min: 0
    }
  },
  pricePerLitre: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
    field: 'price_per_litre',
    validate: {
      min: 0
    }
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'total_amount',
    validate: {
      min: 0
    }
  },
  saleDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'sale_date'
  },
  shift: {
    type: DataTypes.ENUM('morning', 'afternoon', 'night'),
    allowNull: false
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'sales',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false, // Sales are immutable once calculated
  indexes: [
    {
      fields: ['station_id', 'sale_date'],
      name: 'idx_sales_station_date'
    },
    {
      fields: ['pump_id', 'shift', 'sale_date'],
      name: 'idx_sales_pump_shift_date'
    }
  ],
  validate: {
    salesCalculationCheck() {
      const calculatedAmount = parseFloat((this.litresSold * this.pricePerLitre).toFixed(2));
      if (Math.abs(this.totalAmount - calculatedAmount) > 0.01) {
        throw new Error('Total amount must equal litres_sold * price_per_litre');
      }
    }
  }
});

module.exports = Sale;
