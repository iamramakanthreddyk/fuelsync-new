
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Pump = sequelize.define('Pump', {
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
  pumpSno: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'pump_sno',
    comment: 'Physical pump serial number'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Position within station'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'maintenance'),
    allowNull: false,
    defaultValue: 'active'
  },
  lastMaintenanceDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'last_maintenance_date'
  },
  installationDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'installation_date'
  }
}, {
  tableName: 'pumps',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['station_id', 'pump_sno'],
      name: 'unique_pump_per_station'
    }
  ]
});

module.exports = Pump;
