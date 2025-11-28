/**
 * Plan Model
 * Subscription plans with feature limits
 * Super admin can configure all limits per plan
 */

const { DataTypes } = require('sequelize');
const { DEFAULT_PLAN_LIMITS, DOWNGRADE_GRACE_DAYS } = require('../config/constants');

module.exports = (sequelize) => {
  const Plan = sequelize.define('Plan', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING(255)
    },
    
    // Resource limits - all configurable by super admin
    maxStations: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'max_stations'
    },
    maxPumpsPerStation: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      field: 'max_pumps_per_station'
    },
    maxNozzlesPerPump: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4,
      field: 'max_nozzles_per_pump'
    },
    maxEmployees: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      field: 'max_employees'
    },
    maxCreditors: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      field: 'max_creditors'
    },
    
    // Time limits
    backdatedDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      field: 'backdated_days'
    },
    analyticsDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7,
      field: 'analytics_days'
    },
    
    // Feature flags
    canExport: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'can_export'
    },
    canTrackExpenses: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'can_track_expenses'
    },
    canTrackCredits: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'can_track_credits'
    },
    canViewProfitLoss: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'can_view_profit_loss'
    },
    
    // Pricing
    priceMonthly: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'price_monthly'
    },
    priceYearly: {
      type: DataTypes.DECIMAL(10, 2),
      field: 'price_yearly'
    },
    
    // Additional features as JSON (extensible)
    features: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    
    // Sort order for display
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order'
    },
    
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'plans',
    timestamps: true,
    underscored: true
  });

  Plan.associate = (models) => {
    Plan.hasMany(models.User, { foreignKey: 'planId', as: 'users' });
  };

  /**
   * Check if a user can add more of a resource type
   * Returns { allowed: boolean, current: number, limit: number, message: string }
   */
  Plan.prototype.checkLimit = async function(resourceType, currentCount) {
    const limits = {
      stations: this.maxStations,
      pumps: this.maxPumpsPerStation,
      nozzles: this.maxNozzlesPerPump,
      employees: this.maxEmployees,
      creditors: this.maxCreditors
    };
    
    const limit = limits[resourceType];
    if (limit === undefined) {
      return { allowed: true, current: currentCount, limit: null, message: 'No limit defined' };
    }
    
    const allowed = currentCount < limit;
    return {
      allowed,
      current: currentCount,
      limit,
      message: allowed 
        ? `${limit - currentCount} more ${resourceType} allowed`
        : `${resourceType} limit reached (${limit})`
    };
  };

  /**
   * Get grace period end date for downgrades
   */
  Plan.getDowngradeGraceEndDate = function() {
    const date = new Date();
    date.setDate(date.getDate() + DOWNGRADE_GRACE_DAYS);
    return date;
  };

  return Plan;
};

