
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Station = sequelize.define('Station', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON object with street, city, state, pincode'
  },
  contactInfo: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'contact_info',
    comment: 'JSON object with phone, email, manager_name'
  },
  licenseNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'license_number'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'stations',
  timestamps: true,
  underscored: true
});

module.exports = Station;
