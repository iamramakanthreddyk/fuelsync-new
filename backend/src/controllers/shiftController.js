/**
 * Shift Controller
 * Employee shift management with cash reconciliation
 */

const { Shift, User, Station, NozzleReading, CashHandover, sequelize } = require('../models');
const { Op } = require('sequelize');
const { canAccessStation, getAccessibleStationIds } = require('../middleware/accessControl');

/**
 * Start a new shift
 * POST /api/v1/shifts/start
 */
exports.startShift = async (req, res, next) => {
  try {
    const { employeeId, stationId, shiftDate, startTime, shiftType, notes } = req.body;
    const user = await User.findByPk(req.userId);
    
    // Determine employee - self or specified
    const targetEmployeeId = employeeId || req.userId;
    const targetEmployee = await User.findByPk(targetEmployeeId);
    
    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }
    
    // Determine station
    const targetStationId = stationId || targetEmployee.stationId;
    
    if (!targetStationId) {
      return res.status(400).json({
        success: false,
        error: 'Station ID is required'
      });
    }
    
    // Authorization: can start shift for self, or if manager+
    if (targetEmployeeId !== req.userId) {
      if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Only managers can start shifts for other employees'
        });
      }
    }
    
    if (!(await canAccessStation(user, targetStationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this station'
      });
    }
    
    // Check for existing active shift
    const existingShift = await Shift.getActiveShift(targetEmployeeId);
    if (existingShift) {
      return res.status(400).json({
        success: false,
        error: 'Employee already has an active shift',
        data: existingShift
      });
    }
    
    const shift = await Shift.startShift({
      employeeId: targetEmployeeId,
      stationId: targetStationId,
      shiftDate,
      startTime,
      shiftType,
      notes
    });
    
    await shift.reload({
      include: [
        { model: User, as: 'employee', attributes: ['id', 'name'] },
        { model: Station, as: 'station', attributes: ['id', 'name'] }
      ]
    });
    
    res.status(201).json({
      success: true,
      data: shift,
      message: `Shift started for ${targetEmployee.name} at ${shift.startTime}`
    });
  } catch (error) {
    console.error('Start shift error:', error);
    next(error);
  }
};

/**
 * End a shift
 * POST /api/v1/shifts/:id/end
 */
exports.endShift = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { cashCollected, onlineCollected, endTime, endNotes } = req.body;
    
    const shift = await Shift.findByPk(id, {
      include: [
        { model: User, as: 'employee', attributes: ['id', 'name'] }
      ],
      transaction: t
    });
    
    if (!shift) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: 'Shift not found'
      });
    }
    
    if (shift.status !== 'active') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: 'Shift is not active'
      });
    }
    
    // Authorization: can end own shift, or if manager+
    const user = await User.findByPk(req.userId);
    
    if (shift.employeeId !== req.userId) {
      if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          error: 'Only managers can end shifts for other employees'
        });
      }
    }
    
    await shift.endShift({
      cashCollected,
      onlineCollected,
      endTime,
      endNotes,
      endedBy: req.userId
    }, t);
    
    // Auto-create cash handover for manager confirmation
    if (shift.cashCollected && parseFloat(shift.cashCollected) > 0) {
      await CashHandover.createFromShift(shift, t);
    }
    
    await t.commit();
    
    await shift.reload({
      include: [
        { model: User, as: 'employee', attributes: ['id', 'name'] },
        { model: User, as: 'endedByUser', attributes: ['id', 'name'] }
      ]
    });
    
    res.json({
      success: true,
      data: shift,
      message: `Shift ended. Duration: ${shift.getDuration()?.toFixed(1)} hours. Cash difference: ₹${shift.cashDifference || 0}`
    });
  } catch (error) {
    await t.rollback();
    console.error('End shift error:', error);
    next(error);
  }
};

/**
 * Get active shift for current user
 * GET /api/v1/shifts/active
 */
exports.getActiveShift = async (req, res, next) => {
  try {
    const { employeeId } = req.query;
    const targetId = employeeId || req.userId;
    
    const shift = await Shift.getActiveShift(targetId);
    
    res.json({
      success: true,
      data: shift
    });
  } catch (error) {
    console.error('Get active shift error:', error);
    next(error);
  }
};

/**
 * Get shift by ID
 * GET /api/v1/shifts/:id
 */
exports.getShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const shift = await Shift.findByPk(id, {
      include: [
        { model: User, as: 'employee', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'endedByUser', attributes: ['id', 'name'] },
        { model: Station, as: 'station', attributes: ['id', 'name'] }
      ]
    });
    
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found'
      });
    }
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, shift.stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this shift'
      });
    }
    
    res.json({
      success: true,
      data: {
        ...shift.toJSON(),
        duration: shift.getDuration()
      }
    });
  } catch (error) {
    console.error('Get shift error:', error);
    next(error);
  }
};

/**
 * Get shifts for a station on a date
 * GET /api/v1/stations/:stationId/shifts
 */
exports.getStationShifts = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { date, startDate, endDate, employeeId, page = 1, limit = 50 } = req.query;
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this station'
      });
    }
    
    // If specific date, use getDailyShifts
    if (date) {
      const shifts = await Shift.getDailyShifts(stationId, date);
      return res.json({
        success: true,
        data: shifts
      });
    }
    
    // Otherwise query with filters
    const where = { stationId };
    
    if (startDate && endDate) {
      where.shiftDate = { [Op.between]: [startDate, endDate] };
    }
    
    if (employeeId) {
      where.employeeId = employeeId;
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows } = await Shift.findAndCountAll({
      where,
      include: [
        { model: User, as: 'employee', attributes: ['id', 'name'] }
      ],
      order: [['shiftDate', 'DESC'], ['startTime', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get station shifts error:', error);
    next(error);
  }
};

/**
 * Get shift summary for reporting
 * GET /api/v1/stations/:stationId/shifts/summary
 */
exports.getShiftSummary = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate, employeeId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this station'
      });
    }
    
    const summary = await Shift.getSummary(stationId, startDate, endDate, employeeId);
    
    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        employees: summary
      }
    });
  } catch (error) {
    console.error('Get shift summary error:', error);
    next(error);
  }
};

/**
 * Get shifts with cash discrepancies
 * GET /api/v1/stations/:stationId/shifts/discrepancies
 */
exports.getDiscrepancies = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { threshold = 100 } = req.query;
    
    // Authorization - manager+ only
    const user = await User.findByPk(req.userId);
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only managers can view discrepancy reports'
      });
    }
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this station'
      });
    }
    
    const discrepancies = await Shift.getDiscrepancies(stationId, parseFloat(threshold));
    
    res.json({
      success: true,
      data: discrepancies
    });
  } catch (error) {
    console.error('Get discrepancies error:', error);
    next(error);
  }
};

/**
 * Cancel a shift (manager+ only)
 * POST /api/v1/shifts/:id/cancel
 */
exports.cancelShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const shift = await Shift.findByPk(id);
    
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found'
      });
    }
    
    // Only active shifts can be cancelled
    if (shift.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Only active shifts can be cancelled'
      });
    }
    
    // Authorization - manager+ only
    const user = await User.findByPk(req.userId);
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only managers can cancel shifts'
      });
    }
    
    await shift.update({
      status: 'cancelled',
      endNotes: reason || 'Shift cancelled',
      endedBy: req.userId
    });
    
    res.json({
      success: true,
      data: shift,
      message: 'Shift cancelled'
    });
  } catch (error) {
    console.error('Cancel shift error:', error);
    next(error);
  }
};
