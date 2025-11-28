/**
 * Tank Model
 * Flexible inventory tracking for fuel storage tanks
 * 
 * Design Philosophy:
 * - Track capacity and current level WITHOUT strictly blocking sales
 * - Provide warnings at low/critical levels
 * - Allow initial setup for running businesses (estimated current level)
 * - Support multiple tanks per station per fuel type
 */

const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const Tank = sequelize.define('Tank', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    
    stationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'stations', key: 'id' }
    },
    
    fuelType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['petrol', 'diesel', 'premium_petrol', 'premium_diesel', 'cng']]
      }
    },
    
    name: {
      type: DataTypes.STRING(50),
      allowNull: true, // Optional name like "Tank A", "Underground Tank 1"
      comment: 'Optional display name for the tank'
    },
    
    // Tank capacity in litres
    capacity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Maximum tank capacity in litres'
    },
    
    // Current fuel level (estimated/tracked)
    currentLevel: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Current estimated fuel level in litres'
    },
    
    // Warning thresholds
    lowLevelWarning: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Litres at which to show low fuel warning'
    },
    
    criticalLevelWarning: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Litres at which to show critical fuel warning'
    },
    
    // Percentage-based warning option
    lowLevelPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 20, // 20% default
      validate: {
        min: 0,
        max: 100
      },
      comment: 'Percentage of capacity for low warning (alternative to fixed litres)'
    },
    
    criticalLevelPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 10, // 10% default
      validate: {
        min: 0,
        max: 100
      },
      comment: 'Percentage of capacity for critical warning'
    },
    
    // Last physical dip reading for calibration
    lastDipReading: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Last physical dip stick measurement'
    },
    
    lastDipDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    
    // Tracking settings
    trackingMode: {
      type: DataTypes.ENUM('strict', 'warning', 'disabled'),
      defaultValue: 'warning',
      comment: 'strict=block if insufficient, warning=warn only, disabled=no tracking'
    },
    
    // Allow negative (for data entry corrections)
    allowNegative: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Allow level to go negative (for corrections)'
    },
    
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'tanks',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id'] },
      { fields: ['station_id', 'fuel_type'] },
      { fields: ['is_active'] }
    ]
  });

  // ============================================
  // INSTANCE METHODS
  // ============================================

  /**
   * Calculate the effective low level threshold (litres)
   */
  Tank.prototype.getLowThreshold = function() {
    if (this.lowLevelWarning !== null) {
      return parseFloat(this.lowLevelWarning);
    }
    if (this.lowLevelPercent !== null) {
      return parseFloat(this.capacity) * (parseFloat(this.lowLevelPercent) / 100);
    }
    return parseFloat(this.capacity) * 0.20; // Default 20%
  };

  /**
   * Calculate the effective critical level threshold (litres)
   */
  Tank.prototype.getCriticalThreshold = function() {
    if (this.criticalLevelWarning !== null) {
      return parseFloat(this.criticalLevelWarning);
    }
    if (this.criticalLevelPercent !== null) {
      return parseFloat(this.capacity) * (parseFloat(this.criticalLevelPercent) / 100);
    }
    return parseFloat(this.capacity) * 0.10; // Default 10%
  };

  /**
   * Get current status with warning level
   */
  Tank.prototype.getStatus = function() {
    const level = parseFloat(this.currentLevel);
    const capacity = parseFloat(this.capacity);
    const lowThreshold = this.getLowThreshold();
    const criticalThreshold = this.getCriticalThreshold();
    const percentage = (level / capacity) * 100;

    let status = 'normal';
    let message = null;

    if (level <= 0) {
      status = 'empty';
      message = 'Tank is empty';
    } else if (level <= criticalThreshold) {
      status = 'critical';
      message = `Critical fuel level! Only ${level.toFixed(0)}L remaining (${percentage.toFixed(1)}%)`;
    } else if (level <= lowThreshold) {
      status = 'low';
      message = `Low fuel level. ${level.toFixed(0)}L remaining (${percentage.toFixed(1)}%)`;
    } else if (level > capacity) {
      status = 'overflow';
      message = `Level exceeds capacity by ${(level - capacity).toFixed(0)}L`;
    }

    return {
      status,
      message,
      level,
      capacity,
      percentage: Math.min(percentage, 100),
      lowThreshold,
      criticalThreshold
    };
  };

  /**
   * Check if we can dispense a given amount (warning-based, not blocking)
   */
  Tank.prototype.canDispense = function(litres) {
    const level = parseFloat(this.currentLevel);
    const requestedLitres = parseFloat(litres);
    const remaining = level - requestedLitres;

    const result = {
      allowed: true,
      warning: null,
      remaining,
      level
    };

    if (this.trackingMode === 'disabled') {
      return result;
    }

    if (remaining < 0 && !this.allowNegative) {
      if (this.trackingMode === 'strict') {
        result.allowed = false;
        result.warning = `Insufficient fuel. Available: ${level.toFixed(0)}L, Requested: ${requestedLitres.toFixed(0)}L`;
      } else {
        result.warning = `Warning: This will result in negative tank level (${remaining.toFixed(0)}L)`;
      }
    } else if (remaining <= this.getCriticalThreshold()) {
      result.warning = `Critical: Tank will be at ${remaining.toFixed(0)}L after this sale`;
    } else if (remaining <= this.getLowThreshold()) {
      result.warning = `Low: Tank will be at ${remaining.toFixed(0)}L after this sale`;
    }

    return result;
  };

  /**
   * Record a sale (decrease level) - does not block, just tracks
   */
  Tank.prototype.recordSale = async function(litres, options = {}) {
    const amount = parseFloat(litres);
    const newLevel = parseFloat(this.currentLevel) - amount;
    
    await this.update({
      currentLevel: this.allowNegative ? newLevel : Math.max(0, newLevel)
    }, options);

    return this.getStatus();
  };

  /**
   * Record a refill (increase level)
   */
  Tank.prototype.recordRefill = async function(litres, options = {}) {
    const amount = parseFloat(litres);
    const newLevel = parseFloat(this.currentLevel) + amount;
    
    await this.update({
      currentLevel: newLevel
    }, options);

    return this.getStatus();
  };

  /**
   * Calibrate tank with physical dip reading
   */
  Tank.prototype.calibrate = async function(dipReading, date = null) {
    await this.update({
      currentLevel: parseFloat(dipReading),
      lastDipReading: parseFloat(dipReading),
      lastDipDate: date || new Date().toISOString().split('T')[0]
    });

    return this.getStatus();
  };

  // ============================================
  // CLASS METHODS
  // ============================================

  /**
   * Get all tanks for a station with status
   */
  Tank.getStationTanks = async function(stationId) {
    const tanks = await this.findAll({
      where: { stationId, isActive: true },
      order: [['fuelType', 'ASC'], ['name', 'ASC']]
    });

    return tanks.map(tank => ({
      ...tank.toJSON(),
      status: tank.getStatus()
    }));
  };

  /**
   * Get tanks with warnings (for dashboard alerts)
   */
  Tank.getTanksWithWarnings = async function(stationId = null) {
    const where = { isActive: true };
    if (stationId) where.stationId = stationId;

    const tanks = await this.findAll({ where });

    return tanks
      .map(tank => ({ tank, status: tank.getStatus() }))
      .filter(({ status }) => ['low', 'critical', 'empty'].includes(status.status))
      .map(({ tank, status }) => ({
        id: tank.id,
        stationId: tank.stationId,
        fuelType: tank.fuelType,
        name: tank.name,
        ...status
      }));
  };

  /**
   * Find tank for a fuel type at a station
   */
  Tank.findForFuel = async function(stationId, fuelType) {
    return this.findOne({
      where: { stationId, fuelType, isActive: true }
    });
  };

  return Tank;
};
