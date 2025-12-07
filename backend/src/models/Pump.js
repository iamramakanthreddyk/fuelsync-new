/**
 * Pump Model
 * Physical pump machines at stations
 */

const { DataTypes } = require('sequelize');
const { PUMP_STATUS } = require('../config/constants');

module.exports = (sequelize) => {
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    pumpNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'pump_number'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PUMP_STATUS)),
      allowNull: false,
      defaultValue: PUMP_STATUS.ACTIVE
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'pumps',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['station_id', 'pump_number'],
        name: 'pumps_station_id_pump_number'
      }
    ]
  });

  Pump.associate = (models) => {
    Pump.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    Pump.hasMany(models.Nozzle, { foreignKey: 'pumpId', as: 'nozzles' });
  };

  return Pump;
};
