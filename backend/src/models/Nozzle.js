/**
 * Nozzle Model
 * Fuel dispensing nozzles on each pump
 * Supports expandable fuel types (petrol, diesel, CNG, LPG, etc.)
 */

const { DataTypes } = require('sequelize');
const { FUEL_TYPES, PUMP_STATUS } = require('../config/constants');

module.exports = (sequelize) => {
  const Nozzle = sequelize.define('Nozzle', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    pumpId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'pump_id',
      references: {
        model: 'pumps',
        key: 'id'
      }
    },
    // Denormalized for easier queries
    stationId: {
      type: DataTypes.UUID,
      field: 'station_id',
      references: {
        model: 'stations',
        key: 'id'
      }
    },
    nozzleNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'nozzle_number',
      validate: {
        min: 1,
        max: 10
      }
    },
    // Use string instead of ENUM for easy expansion
    fuelType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: 'fuel_type',
      validate: {
        isIn: [Object.values(FUEL_TYPES)]
      }
    },
    // Optional label (e.g., "Nozzle A", "Green Handle")
    label: {
      type: DataTypes.STRING(50)
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: PUMP_STATUS.ACTIVE,
      validate: {
        isIn: [Object.values(PUMP_STATUS)]
      }
    },
    initialReading: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'initial_reading'
    },
    lastReading: {
      type: DataTypes.DECIMAL(12, 2),
      field: 'last_reading',
      comment: 'Cached last reading for quick access'
    },
    lastReadingDate: {
      type: DataTypes.DATEONLY,
      field: 'last_reading_date'
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'nozzles',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['pump_id', 'nozzle_number'] },
      { fields: ['station_id'] },
      { fields: ['fuel_type'] },
      { fields: ['status'] }
    ]
  });

  Nozzle.associate = (models) => {
    Nozzle.belongsTo(models.Pump, { foreignKey: 'pumpId', as: 'pump' });
    Nozzle.belongsTo(models.Station, { foreignKey: 'stationId', as: 'station' });
    Nozzle.hasMany(models.NozzleReading, { foreignKey: 'nozzleId', as: 'readings' });
  };

  /**
   * Update last reading cache
   */
  Nozzle.prototype.updateLastReading = async function(reading, date, options = {}) {
    this.lastReading = reading;
    this.lastReadingDate = date;
    await this.save(options);
  };

  /**
   * Check if nozzle has a reading gap (no reading for X days)
   * @param {number} thresholdDays - Number of days without reading to flag as gap
   * @returns {Object} { hasGap, daysSinceLastReading, lastReadingDate }
   */
  Nozzle.prototype.hasReadingGap = function(thresholdDays = 1) {
    if (!this.lastReadingDate) {
      return {
        hasGap: true,
        daysSinceLastReading: null,
        lastReadingDate: null,
        message: 'No readings recorded for this nozzle'
      };
    }
    
    const today = new Date();
    const lastDate = new Date(this.lastReadingDate);
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      hasGap: diffDays > thresholdDays,
      daysSinceLastReading: diffDays,
      lastReadingDate: this.lastReadingDate,
      message: diffDays > thresholdDays 
        ? `No reading for ${diffDays} days (last: ${this.lastReadingDate})`
        : null
    };
  };

  // ============================================
  // CLASS METHODS FOR MISSED ENTRY DETECTION
  // ============================================

  /**
   * Get all nozzles with reading gaps for a station
   * @param {string} stationId - Station ID
   * @param {number} thresholdDays - Days threshold (default 1)
   * @returns {Array} Nozzles with gaps
   */
  Nozzle.getNozzlesWithGaps = async function(stationId, thresholdDays = 1) {
    const nozzles = await this.findAll({
      where: {
        stationId,
        status: 'active'
      },
      include: [
        { model: sequelize.models.Pump, as: 'pump', attributes: ['id', 'pumpNumber'] }
      ]
    });
    
    const today = new Date();
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() - thresholdDays);
    const thresholdStr = threshold.toISOString().split('T')[0];
    
    const nozzlesWithGaps = nozzles.filter(nozzle => {
      if (!nozzle.lastReadingDate) return true;
      return nozzle.lastReadingDate < thresholdStr;
    }).map(nozzle => ({
      id: nozzle.id,
      pumpNumber: nozzle.pump?.pumpNumber,
      nozzleNumber: nozzle.nozzleNumber,
      fuelType: nozzle.fuelType,
      lastReadingDate: nozzle.lastReadingDate,
      ...nozzle.hasReadingGap(thresholdDays)
    }));
    
    return nozzlesWithGaps;
  };

  /**
   * Get dates with missing readings for a nozzle in a date range
   * @param {string} nozzleId - Nozzle ID  
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Array} Dates without readings
   */
  Nozzle.getMissedDays = async function(nozzleId, startDate, endDate) {
    const NozzleReading = sequelize.models.NozzleReading;
    const { Op } = require('sequelize');
    
    // Get all readings in date range
    const readings = await NozzleReading.findAll({
      where: {
        nozzleId,
        readingDate: { [Op.between]: [startDate, endDate] },
        isInitialReading: false
      },
      attributes: ['readingDate'],
      raw: true
    });
    
    const readingDates = new Set(readings.map(r => r.readingDate || r.reading_date));
    
    // Generate all dates in range
    const missedDays = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      if (!readingDates.has(dateStr)) {
        missedDays.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }
    
    return missedDays;
  };

  return Nozzle;
};
