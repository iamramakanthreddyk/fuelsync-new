
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('super_admin', 'owner', 'manager', 'employee'),
    allowNull: false,
    defaultValue: 'employee'
  },
  stationId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'station_id',
    references: {
      model: 'stations',
      key: 'id'
    }
  },
  planId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'plan_id',
    references: {
      model: 'plans',
      key: 'id'
    }
  },
  customLimits: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'custom_limits',
    comment: 'Super admin overrides for plan limits'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
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
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    }
  },
  validate: {
    ownerHasStation() {
      if (this.role === 'owner' && !this.stationId) {
        throw new Error('Owner must be assigned to a station');
      }
    },
    employeeHasStation() {
      if (['employee', 'manager'].includes(this.role) && !this.stationId) {
        throw new Error('Employee/Manager must be assigned to a station');
      }
    }
  }
});

// Password check method
User.prototype.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get effective limits (custom or plan-based)
User.prototype.getEffectiveLimits = function() {
  const planLimits = this.Plan ? {
    maxUploadsPerDay: this.Plan.uploadLimit,
    maxEmployees: this.Plan.maxEmployees,
    maxPumps: this.Plan.maxPumps,
    maxStations: this.Plan.maxStations
  } : {
    maxUploadsPerDay: 4,
    maxEmployees: 2,
    maxPumps: 2,
    maxStations: 1
  };

  // Custom limits override plan limits
  return {
    ...planLimits,
    ...(this.customLimits || {})
  };
};

module.exports = User;
