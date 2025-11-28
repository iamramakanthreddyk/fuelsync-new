
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OCRReading = sequelize.define('OCRReading', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  uploadId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'upload_id',
    references: {
      model: 'uploads',
      key: 'id'
    }
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
  pumpSno: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'pump_sno',
    comment: 'For reference and validation'
  },
  fuelType: {
    type: DataTypes.ENUM('petrol', 'diesel'),
    allowNull: false,
    field: 'fuel_type'
  },
  cumulativeVolume: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
    field: 'cumulative_volume',
    validate: {
      min: 0
    }
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
  isManualEntry: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_manual_entry'
  },
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
  tableName: 'ocr_readings',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false, // OCR readings are immutable
  indexes: [
    {
      unique: true,
      fields: ['station_id', 'pump_sno', 'nozzle_id', 'reading_date', 'reading_time'],
      name: 'unique_reading_per_nozzle_datetime'
    },
    {
      fields: ['station_id', 'reading_date'],
      name: 'idx_readings_station_date'
    },
    {
      fields: ['pump_sno', 'nozzle_id', 'reading_date'],
      name: 'idx_readings_pump_nozzle_date'
    }
  ]
});

module.exports = OCRReading;
