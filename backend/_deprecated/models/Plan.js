const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Plan = sequelize.define('Plan', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  // uploadLimit removed
  features: { type: DataTypes.JSONB },
  price: { type: DataTypes.FLOAT },
}, {
  tableName: 'plans',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Plan;
