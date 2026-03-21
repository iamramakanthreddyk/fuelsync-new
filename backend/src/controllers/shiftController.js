/**
 * Shift Controller
 * Employee shift management with cash reconciliation
 * 
 * AUDIT LOGGING:
 * - START: Shift start is logged with category 'data', severity 'info'
 * - END: Shift end is logged with category 'data', severity 'info'
 * 
 * All shift operations are tracked via logAudit() from utils/auditLog
 */

// ===== MODELS & DATABASE =====
const { Shift, User, Station, NozzleReading, sequelize } = require('../models');
const { Op } = require('sequelize');

// ===== ERROR & RESPONSE HANDLING =====
const { asyncHandler, NotFoundError, AuthorizationError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/apiResponse');

// ===== MIDDLEWARE & CONFIG =====
const { canAccessStation, getAccessibleStationIds } = require('../middleware/accessControl');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');

/**
 * Start a new shift
 * POST /api/v1/shifts/start
 */
exports.startShift = asyncHandler(async (req, res, next) => {
  const { employeeId, stationId, shiftDate, startTime, shiftType, notes } = req.body;
  const user = await User.findByPk(req.userId);
  
  const targetEmployeeId = employeeId || req.userId;
  const targetEmployee = await User.findByPk(targetEmployeeId);
  
  if (!targetEmployee) {
    throw new NotFoundError('Employee', targetEmployeeId);
  }
  
  const targetStationId = stationId || targetEmployee.stationId;
  
  if (!targetStationId) {
    return sendError(res, 'VALIDATION_ERROR', 'Station ID is required', 422);
  }
  
  if (targetEmployeeId !== req.userId) {
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      throw new AuthorizationError('Only managers can start shifts for other employees');
    }
  }
  
  if (!(await canAccessStation(user, targetStationId))) {
    throw new AuthorizationError('Not authorized to access this station');
  }
  
  const existingShift = await Shift.getActiveShift(targetEmployeeId);
  if (existingShift) {
    return sendError(res, 'CONFLICT', 'Employee already has an active shift', 409, { data: existingShift });
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

  await logAudit({
    userId: req.userId,
    userEmail: user.email,
    userRole: user.role,
    stationId: targetStationId,
    action: 'CREATE',
    entityType: 'Shift',
    entityId: shift.id,
    newValues: {
      id: shift.id,
      employeeId: targetEmployeeId,
      employeeName: targetEmployee.name,
      stationType: shiftType,
      startTime: shift.startTime
    },
    category: 'data',
    severity: 'info',
    description: `${targetEmployee.name} started shift at ${shift.startTime}`
  });
  
  return sendCreated(res, shift, {
    message: `Shift started for ${targetEmployee.name} at ${shift.startTime}`
  });
});

/**
 * End a shift
 * POST /api/v1/shifts/:id/end
 */
exports.endShift = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { cashCollected, onlineCollected, endTime, endNotes } = req.body;
  const user = await User.findByPk(req.userId);
  
  const shift = await Shift.findByPk(id, {
    include: [
      { model: User, as: 'employee', attributes: ['id', 'name'] }
    ]
  });
  
  if (!shift) {
    throw new NotFoundError('Shift', id);
  }
  
  if (shift.status !== 'active') {
    throw new Error('Shift is not active');
  }
  
  if (shift.employeeId !== req.userId) {
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      throw new AuthorizationError('Only managers can end shifts for other employees');
    }
  }
  
  const endedShift = await sequelize.transaction(async (transaction) => {
    await shift.endShift({
      cashCollected,
      onlineCollected,
      endTime,
      endNotes,
      endedBy: req.userId
    }, transaction);
    
    return shift;
  });
  
  await endedShift.reload({
    include: [
      { model: User, as: 'employee', attributes: ['id', 'name'] },
      { model: User, as: 'endedByUser', attributes: ['id', 'name'] }
    ]
  });
  
  await logAudit({
    userId: req.userId,
    userEmail: user.email,
    userRole: user.role,
    stationId: shift.stationId,
    action: 'UPDATE',
    entityType: 'Shift',
    entityId: shift.id,
    newValues: {
      status: 'ended',
      endTime,
      cashCollected,
      onlineCollected
    },
    category: 'data',
    severity: 'info',
    description: `${shift.employee.name} ended shift at ${endTime || 'auto'}`
  });
  
  return sendSuccess(res, endedShift, 200, {
    message: `Shift ended. Duration: ${endedShift.getDuration()?.toFixed(1)} hours. Cash difference: ₹${endedShift.cashDifference || 0}`
  });
});

/**
 * Get active shift for current user
 * GET /api/v1/shifts/active
 */
exports.getActiveShift = asyncHandler(async (req, res, next) => {
  const { employeeId } = req.query;
  const targetId = employeeId || req.userId;
  
  const shift = await Shift.getActiveShift(targetId);
  
  return sendSuccess(res, shift);
});

/**
 * Get shift by ID
 * GET /api/v1/shifts/:id
 */
exports.getShift = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  
  const shift = await Shift.findByPk(id, {
    include: [
      { model: User, as: 'employee', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'endedByUser', attributes: ['id', 'name'] },
      { model: Station, as: 'station', attributes: ['id', 'name'] }
    ]
  });
  
  if (!shift) {
    throw new NotFoundError('Shift', id);
  }
  
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, shift.stationId))) {
    throw new AuthorizationError('Not authorized to view this shift');
  }
  
  return sendSuccess(res, {
    ...shift.toJSON(),
    duration: shift.getDuration()
  });
});

/**
 * Get shifts for a station on a date
 * GET /api/v1/stations/:stationId/shifts
 */
exports.getStationShifts = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { date, startDate, endDate, employeeId, page = 1, limit = 50 } = req.query;
  
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, stationId))) {
    throw new AuthorizationError('Not authorized to access this station');
  }
  
  if (date) {
    const shifts = await Shift.getDailyShifts(stationId, date);
    return sendSuccess(res, shifts);
  }
  
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
  
  return sendPaginated(res, rows, {
    page: parseInt(page),
    limit: parseInt(limit),
    total: count,
    pages: Math.ceil(count / limit)
  });
});

/**
 * Get shift summary for reporting
 * GET /api/v1/stations/:stationId/shifts/summary
 */
exports.getShiftSummary = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { startDate, endDate, employeeId } = req.query;
  
  if (!startDate || !endDate) {
    return sendError(res, 'VALIDATION_ERROR', 'startDate and endDate are required', 400);
  }
  
  const user = await User.findByPk(req.userId);
  if (!(await canAccessStation(user, stationId))) {
    throw new AuthorizationError('Not authorized to access this station');
  }
  
  const summary = await Shift.getSummary(stationId, startDate, endDate, employeeId);
  
  return sendSuccess(res, {
    period: { startDate, endDate },
    employees: summary
  });
});

/**
 * Get shifts with cash discrepancies
 * GET /api/v1/stations/:stationId/shifts/discrepancies
 */
exports.getDiscrepancies = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { threshold = 100 } = req.query;
  
  const user = await User.findByPk(req.userId);
  if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
    throw new AuthorizationError('Only managers can view discrepancy reports');
  }
  
  if (!(await canAccessStation(user, stationId))) {
    throw new AuthorizationError('Not authorized to access this station');
  }
  
  const discrepancies = await Shift.getDiscrepancies(stationId, parseFloat(threshold));
  
  return sendSuccess(res, discrepancies);
});

/**
 * Cancel a shift (manager+ only)
 * POST /api/v1/shifts/:id/cancel
 */
exports.cancelShift = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  const shift = await Shift.findByPk(id);
  
  if (!shift) {
    throw new NotFoundError('Shift', id);
  }
  
  if (shift.status !== 'active') {
    throw new Error('Only active shifts can be cancelled');
  }
  
  const user = await User.findByPk(req.userId);
  if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
    throw new AuthorizationError('Only managers can cancel shifts');
  }
  
  await shift.update({
    status: 'cancelled',
    endNotes: reason || 'Shift cancelled',
    endedBy: req.userId
  });
  
  return sendSuccess(res, shift, 200, {
    message: 'Shift cancelled'
  });
});
