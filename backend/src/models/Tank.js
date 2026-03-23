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
const { FUEL_TYPES } = require('../config/constants');

module.exports = (sequelize) => {
  const Tank = sequelize.define('Tank', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    
    stationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'stations', key: 'id' }
    },
    
    fuelType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [Object.values(FUEL_TYPES)]
      }
    },
    
    name: {
      type: DataTypes.STRING(50),
      allowNull: false, // Database requires a value; defaults to "[FuelType] Tank" if not provided
      defaultValue: '', // Sequelize default (overridden in controller)
      comment: 'Tank display name. Defaults to "[FuelType] Tank" if not provided'
    },
    
    // Custom fuel display name (owner-friendly: MSD, HSM, XP 95)
    displayFuelName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Custom fuel display name (e.g., MSD, HSM, XP 95). Falls back to fuelType if null.'
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
    // NOTE: Can be negative if owner forgets to enter a refill
    // Negative level = alert to owner that they missed recording a refill
    currentLevel: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Current fuel level in litres. Can be negative (indicates missed refill entry).'
    },
    
    // ============================================
    // "SINCE LAST REFILL" TRACKING FIELDS
    // These enable showing: "Last refill: +5000L on Jan 5, Sold since: 3000L"
    // ============================================
    
    // Level right after the most recent refill
    levelAfterLastRefill: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Tank level immediately after last refill. salesSinceLastRefill = this - currentLevel'
    },
    
    // Date of most recent refill
    lastRefillDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Date of the most recent refill'
    },
    
    // Amount added in most recent refill
    lastRefillAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Litres added in the most recent refill'
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
   * Handles negative levels (indicates missed refill entry)
   */
  Tank.prototype.getStatus = function() {
    const level = parseFloat(this.currentLevel);
    const capacity = parseFloat(this.capacity);
    const lowThreshold = this.getLowThreshold();
    const criticalThreshold = this.getCriticalThreshold();
    const percentage = (level / capacity) * 100;

    let status = 'normal';
    let message = null;

    // Handle negative levels (owner forgot to enter a refill)
    if (level < 0) {
      status = 'negative';
      message = `Tank level is negative (${level.toFixed(0)}L). Did you forget to record a refill?`;
    } else if (level === 0) {
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
   * Get comprehensive tank status for API response
   * Includes "since last refill" tracking and negative level alerts
   * 
   * @returns {Object} Full tank status with all tracking data
   */
  Tank.prototype.getFullStatus = function() {
    const currentLevel = parseFloat(this.currentLevel);
    const capacity = parseFloat(this.capacity);
    const levelAfterLastRefill = parseFloat(this.levelAfterLastRefill) || currentLevel;
    
    // Calculate sales since last refill (simple subtraction)
    // If no refill recorded yet, shows 0
    const salesSinceLastRefill = this.levelAfterLastRefill 
      ? Math.max(0, levelAfterLastRefill - currentLevel) 
      : 0;
    
    // Get basic status
    const basicStatus = this.getStatus();
    
    // Build the response
    const result = {
      // Core data
      id: this.id,
      stationId: this.stationId,
      fuelType: this.fuelType,
      displayFuelName: this.displayFuelName || this.fuelType, // Fallback to fuelType
      name: this.name,
      currentLevel,
      capacity,
      percentFull: Math.round((Math.max(0, currentLevel) / capacity) * 100),
      
      // Status info
      status: basicStatus.status,
      statusMessage: basicStatus.message,
      isNegative: currentLevel < 0,
      
      // Thresholds
      lowThreshold: basicStatus.lowThreshold,
      criticalThreshold: basicStatus.criticalThreshold,
      
      // "Since last refill" tracking
      lastRefill: {
        date: this.lastRefillDate || null,
        amount: parseFloat(this.lastRefillAmount) || 0,
        levelAfter: this.levelAfterLastRefill ? levelAfterLastRefill : null,
        salesSince: salesSinceLastRefill
      },
      
      // Calibration info
      lastDip: {
        reading: this.lastDipReading ? parseFloat(this.lastDipReading) : null,
        date: this.lastDipDate || null
      },
      
      // Settings
      trackingMode: this.trackingMode,
      allowNegative: this.allowNegative,
      isActive: this.isActive
    };
    
    // Add alert if negative (forgot to enter refill)
    if (currentLevel < 0) {
      result.alert = {
        type: 'negative_level',
        severity: 'warning',
        message: 'Tank level is negative. Did you forget to record a refill?',
        suggestedAction: 'Enter the missed refill to correct the level'
      };
    }
    
    return result;
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
   * 
   * IMPORTANT: When calibrating, we update levelAfterLastRefill to match the physical measurement
   * This ensures that the "sales since last refill" calculation remains accurate
   * 
   * Example:
   * - Last refill: levelAfterLastRefill = 10,000L, lastRefillAmount = 5,000L
   * - System calculated sales: 1,000L (so currentLevel = 9,000L)
   * - Physical measurement (dip): 8,000L (discovered 1,000L loss: unrecorded sales or leakage)
   * 
   * Action:
   * - Update levelAfterLastRefill from 10,000 to 8,000 (absorb the loss into the baseline)
   * - Update currentLevel to 8,000
   * - Now salesSince = 8,000 - 8,000 = 0 (no "negative sale" shown)
   * - The 1,000L loss is noted via discrepancy analysis for audit purposes
   */
  Tank.prototype.calibrate = async function(dipReading, date = null) {
    const dipReadingValue = parseFloat(dipReading);
    
    await this.update({
      currentLevel: dipReadingValue,
      levelAfterLastRefill: dipReadingValue,  // Update baseline to match physical reality
      lastDipReading: dipReadingValue,
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
