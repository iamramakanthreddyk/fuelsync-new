/**
 * User Model
 * All user accounts with role-based access
 * 
 * ROLE HIERARCHY:
 * - super_admin: Platform admin, can create owners, see all data
 * - owner: Owns stations (stations via Station.ownerId), has planId
 * - manager: Works at ONE station, can manage prices/creditors/expenses
 * - employee: Works at ONE station, can only enter readings
 * 
 * IMPORTANT:
 * - Owners do NOT have stationId (they own stations via Station.ownerId)
 * - Managers and Employees have stationId (assigned to one station)
 */

const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'owner', 'manager', 'employee'),
      allowNull: false,
      defaultValue: 'employee'
    },
    
    // For manager/employee - which station they work at
    // For owner/super_admin - this is NULL (owners access via Station.ownerId)
    stationId: {
      type: DataTypes.UUID,
      field: 'station_id',
      references: {
        model: 'stations',
        key: 'id'
      },
      comment: 'For manager/employee only - their assigned station'
    },
    
    // For owners - their subscription plan
    planId: {
      type: DataTypes.UUID,
      field: 'plan_id',
      references: {
        model: 'plans',
        key: 'id'
      },
      comment: 'For owner only - their subscription plan'
    },
    
    // Who created this user (for audit)
    createdBy: {
      type: DataTypes.UUID,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'User who created this account'
    },
    
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      field: 'last_login_at'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
      afterCreate: (user) => {
        try {
          const secret = process.env.JWT_SECRET || 'test-secret';
          user.token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });
        } catch (err) {
          // ignore token generation failures in non-critical environments
          user.token = null;
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      }
    },
    indexes: [
      { fields: ['station_id'] },
      { fields: ['role'] },
      { fields: ['created_by'] }
    ]
  });

  // Instance method to compare password
  User.prototype.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  };

  // Instance method to get safe user data (no password)
  User.prototype.toSafeObject = function() {
    const { password, ...safeUser } = this.toJSON();
    return safeUser;
  };

  User.associate = (models) => {
    // Station they work at (for manager/employee)
    User.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    
    // Stations they own (for owner)
    User.hasMany(models.Station, { foreignKey: 'ownerId', as: 'ownedStations' });
    
    // Plan subscription (for owner)
    User.belongsTo(models.Plan, { foreignKey: 'planId', as: 'plan' });
    
    // Created by relationship
    User.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    User.hasMany(models.User, { foreignKey: 'createdBy', as: 'createdUsers' });
    
    // Activity tracking
    User.hasMany(models.NozzleReading, { foreignKey: 'enteredBy', as: 'readings' });
    User.hasMany(models.FuelPrice, { foreignKey: 'updatedBy', as: 'priceUpdates' });
  };

  return User;
};
