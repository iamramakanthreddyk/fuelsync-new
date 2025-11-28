
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Pump = sequelize.define('Pump', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'maintenance'),
    allowNull: false,
    defaultValue: 'active'
  },
  stationId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  lastMaintenanceDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  totalSalesToday: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'pumps',
  timestamps: true
});

module.exports = Pump;
