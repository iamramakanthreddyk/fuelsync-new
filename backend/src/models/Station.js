/**
 * Station Model
 * Fuel stations (multi-tenant core)
 * 
 * HIERARCHY:
 * - Super Admin: Can see all stations
 * - Owner: Owns multiple stations (via ownerId)
 * - Manager: Assigned to ONE station (via User.stationId)
 * - Employee: Assigned to ONE station (via User.stationId)
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Station = sequelize.define('Station', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // OWNER - who owns this station
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'owner_id',
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Owner who owns this station'
    },
    
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(20),
      unique: true,
      comment: 'Short unique code for station (e.g., STN001)'
    },
    address: {
      type: DataTypes.TEXT
    },
    city: {
      type: DataTypes.STRING(100)
    },
    state: {
      type: DataTypes.STRING(100)
    },
    pincode: {
      type: DataTypes.STRING(10)
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    email: {
      type: DataTypes.STRING(255)
    },
    gstNumber: {
      type: DataTypes.STRING(20),
      field: 'gst_number'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    
    // Settings
    requireShiftForReadings: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'require_shift_for_readings',
      comment: 'If true, employees must have an active shift to enter readings'
    },
    
    alertOnMissedReadings: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'alert_on_missed_readings',
      comment: 'If true, show alerts when nozzles have no readings for a day'
    },
    
    missedReadingThresholdDays: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'missed_reading_threshold_days',
      comment: 'Days without reading before alerting'
    }
  }, {
    tableName: 'stations',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['owner_id'] },
      { fields: ['is_active'] }
    ]
  });

  Station.associate = (models) => {
    // Owner relationship
    Station.belongsTo(models.User, { foreignKey: 'ownerId', as: 'owner' });
    
    // Employees/Managers assigned to this station
    Station.hasMany(models.User, { foreignKey: 'stationId', as: 'staff' });
    
    // Station resources
    Station.hasMany(models.Pump, { foreignKey: 'stationId', as: 'pumps' });
    Station.hasMany(models.FuelPrice, { foreignKey: 'stationId', as: 'fuelPrices' });
    Station.hasMany(models.NozzleReading, { foreignKey: 'stationId', as: 'readings' });
    Station.hasMany(models.Creditor, { foreignKey: 'stationId', as: 'creditors' });
    Station.hasMany(models.Expense, { foreignKey: 'stationId', as: 'expenses' });
    Station.hasMany(models.CostOfGoods, { foreignKey: 'stationId', as: 'costOfGoods' });
  };

  return Station;
};
