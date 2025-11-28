/**
 * Shift Model
 * Track employee work shifts with start/end times and collections
 */

const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const Shift = sequelize.define('Shift', {
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
    
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    
    // Shift timing
    shiftDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    
    startTime: {
      type: DataTypes.TIME,
      allowNull: false
    },
    
    endTime: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Null until shift ends'
    },
    
    // Shift type/period
    shiftType: {
      type: DataTypes.ENUM('morning', 'evening', 'night', 'full_day', 'custom'),
      defaultValue: 'custom'
    },
    
    // Collections at shift end
    cashCollected: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Actual cash collected from employee'
    },
    
    onlineCollected: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Online/card payment collected (for verification)'
    },
    
    // Expected vs actual (reconciliation)
    expectedCash: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Expected cash based on readings'
    },
    
    cashDifference: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Difference between expected and actual cash'
    },
    
    // Readings summary
    readingsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    
    totalLitresSold: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    
    totalSalesAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    
    // Status
    status: {
      type: DataTypes.ENUM('active', 'ended', 'cancelled'),
      defaultValue: 'active'
    },
    
    // Who ended the shift (could be manager)
    endedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    endNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notes added at shift end'
    }
  }, {
    tableName: 'shifts',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id'] },
      { fields: ['employee_id'] },
      { fields: ['shift_date'] },
      { fields: ['station_id', 'shift_date'] },
      { fields: ['employee_id', 'shift_date'] },
      { fields: ['status'] }
    ]
  });

  // ============================================
  // INSTANCE METHODS
  // ============================================

  /**
   * End the shift and calculate collections
   */
  Shift.prototype.endShift = async function(data = {}, transaction = null) {
    const { 
      cashCollected, 
      onlineCollected, 
      endNotes, 
      endedBy,
      endTime = new Date().toTimeString().slice(0, 5)
    } = data;

    // Get readings during this shift
    const NozzleReading = sequelize.models.NozzleReading;
    const shiftStart = new Date(`${this.shiftDate}T${this.startTime}`);
    const shiftEnd = new Date(`${this.shiftDate}T${endTime}`);

    const readings = await NozzleReading.findAll({
      where: {
        stationId: this.stationId,
        enteredBy: this.employeeId,
        createdAt: {
          [Op.between]: [shiftStart, shiftEnd]
        },
        isInitialReading: false
      },
      transaction
    });

    // Calculate totals
    const readingsCount = readings.length;
    const totalLitresSold = readings.reduce((sum, r) => sum + parseFloat(r.litresSold || 0), 0);
    const totalSalesAmount = readings.reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);
    const expectedCash = readings.reduce((sum, r) => sum + parseFloat(r.cashAmount || 0), 0);
    
    const cashDifference = cashCollected !== undefined 
      ? parseFloat(cashCollected) - expectedCash 
      : null;

    await this.update({
      endTime,
      status: 'ended',
      cashCollected: cashCollected || null,
      onlineCollected: onlineCollected || null,
      expectedCash,
      cashDifference,
      readingsCount,
      totalLitresSold,
      totalSalesAmount,
      endNotes,
      endedBy: endedBy || this.employeeId
    }, { transaction });

    return this;
  };

  /**
   * Get shift duration in hours
   */
  Shift.prototype.getDuration = function() {
    if (!this.endTime) return null;
    
    const start = new Date(`2000-01-01T${this.startTime}`);
    const end = new Date(`2000-01-01T${this.endTime}`);
    
    // Handle overnight shifts
    let diff = end - start;
    if (diff < 0) diff += 24 * 60 * 60 * 1000;
    
    return diff / (1000 * 60 * 60); // hours
  };

  // ============================================
  // CLASS METHODS
  // ============================================

  /**
   * Get active shift for an employee
   */
  Shift.getActiveShift = async function(employeeId) {
    return this.findOne({
      where: {
        employeeId,
        status: 'active'
      },
      include: [
        { model: sequelize.models.User, as: 'employee', attributes: ['id', 'name'] },
        { model: sequelize.models.Station, as: 'station', attributes: ['id', 'name'] }
      ]
    });
  };

  /**
   * Start a new shift
   */
  Shift.startShift = async function(data) {
    const { employeeId, stationId, shiftDate, startTime, shiftType, notes } = data;

    // Check for existing active shift
    const activeShift = await this.getActiveShift(employeeId);
    if (activeShift) {
      throw new Error('Employee already has an active shift. End current shift first.');
    }

    return this.create({
      employeeId,
      stationId,
      shiftDate: shiftDate || new Date().toISOString().split('T')[0],
      startTime: startTime || new Date().toTimeString().slice(0, 5),
      shiftType: shiftType || 'custom',
      notes,
      status: 'active'
    });
  };

  /**
   * Get shifts for a station on a date
   */
  Shift.getDailyShifts = async function(stationId, date) {
    return this.findAll({
      where: {
        stationId,
        shiftDate: date
      },
      include: [
        { model: sequelize.models.User, as: 'employee', attributes: ['id', 'name'] }
      ],
      order: [['startTime', 'ASC']]
    });
  };

  /**
   * Get shift summary for date range
   */
  Shift.getSummary = async function(stationId, startDate, endDate, employeeId = null) {
    const where = {
      stationId,
      shiftDate: { [Op.between]: [startDate, endDate] },
      status: 'ended'
    };
    
    if (employeeId) where.employeeId = employeeId;

    const result = await this.findAll({
      where,
      attributes: [
        'employeeId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'shiftCount'],
        [sequelize.fn('SUM', sequelize.col('totalLitresSold')), 'totalLitres'],
        [sequelize.fn('SUM', sequelize.col('totalSalesAmount')), 'totalSales'],
        [sequelize.fn('SUM', sequelize.col('cashCollected')), 'totalCash'],
        [sequelize.fn('SUM', sequelize.col('cashDifference')), 'totalDifference']
      ],
      include: [
        { model: sequelize.models.User, as: 'employee', attributes: ['id', 'name'] }
      ],
      group: ['employeeId', 'employee.id', 'employee.name'],
      raw: false
    });

    return result;
  };

  /**
   * Get shifts with discrepancies
   */
  Shift.getDiscrepancies = async function(stationId, threshold = 100) {
    return this.findAll({
      where: {
        stationId,
        status: 'ended',
        cashDifference: {
          [Op.or]: [
            { [Op.gt]: threshold },
            { [Op.lt]: -threshold }
          ]
        }
      },
      include: [
        { model: sequelize.models.User, as: 'employee', attributes: ['id', 'name'] }
      ],
      order: [['shiftDate', 'DESC']],
      limit: 50
    });
  };

  return Shift;
};
