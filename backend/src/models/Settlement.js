/**
 * Settlement Model
 * Stores daily station settlements (cash reconciliation)
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Settlement = sequelize.define('Settlement', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    stationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'station_id',
      references: { model: 'stations', key: 'id' }
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    expectedCash: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: false,
      field: 'expected_cash'
    },
    actualCash: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: false,
      field: 'actual_cash'
    },
    variance: {
      type: DataTypes.DECIMAL(12,2)
    },
    online: {
      type: DataTypes.DECIMAL(12,2),
      defaultValue: 0
    },
    credit: {
      type: DataTypes.DECIMAL(12,2),
      defaultValue: 0
    },
    notes: {
      type: DataTypes.TEXT
    },
    recordedBy: {
      type: DataTypes.UUID,
      field: 'recorded_by',
      references: { model: 'users', key: 'id' }
    },
    recordedAt: {
      type: DataTypes.DATE,
      field: 'recorded_at'
    },
      isFinal: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_final'
      },
      finalizedAt: {
        type: DataTypes.DATE,
        field: 'finalized_at',
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('recorded','approved','disputed'),
        defaultValue: 'recorded'
      }
  }, {
    tableName: 'settlements',
    underscored: true,
    timestamps: true
  });

  Settlement.associate = (models) => {
    Settlement.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    Settlement.belongsTo(models.User, { foreignKey: 'recordedBy', as: 'recordedByUser' });
  };

  return Settlement;
};
