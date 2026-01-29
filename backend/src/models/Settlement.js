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
    // Employee-reported values (auto-aggregated from readings)
    employeeCash: {
      type: DataTypes.DECIMAL(12,2),
      defaultValue: 0,
      field: 'employee_cash'
    },
    employeeOnline: {
      type: DataTypes.DECIMAL(12,2),
      defaultValue: 0,
      field: 'employee_online'
    },
    employeeCredit: {
      type: DataTypes.DECIMAL(12,2),
      defaultValue: 0,
      field: 'employee_credit'
    },
    // Owner-confirmed values
    online: {
      type: DataTypes.DECIMAL(12,2),
      defaultValue: 0
    },
    credit: {
      type: DataTypes.DECIMAL(12,2),
      defaultValue: 0
    },
    // Variance for online and credit
    varianceOnline: {
      type: DataTypes.DECIMAL(12,2),
      defaultValue: 0,
      field: 'variance_online'
    },
    varianceCredit: {
      type: DataTypes.DECIMAL(12,2),
      defaultValue: 0,
      field: 'variance_credit'
    },
    notes: {
      type: DataTypes.TEXT
    },
    employeeShortfalls: {
      type: DataTypes.JSON,
      defaultValue: null,
      field: 'employee_shortfalls',
      comment: 'JSON object tracking employee-wise shortfalls: {empId: {employeeName, shortfall, count}}'
    },
    readingIds: {
      type: DataTypes.JSON,
      defaultValue: null,
      field: 'reading_ids',
      comment: 'Array of reading IDs included in this settlement'
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
        type: DataTypes.ENUM('draft', 'final', 'locked'),
        defaultValue: 'draft',
        field: 'status'
      }
  }, {
    tableName: 'settlements',
    underscored: true,
    timestamps: true
  });

  Settlement.associate = (models) => {
    Settlement.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    Settlement.belongsTo(models.User, { foreignKey: 'recordedBy', as: 'recordedByUser' });
    Settlement.hasMany(models.NozzleReading, { foreignKey: 'settlementId', as: 'readings' });
  };

  return Settlement;
};
