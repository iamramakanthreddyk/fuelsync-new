/**
 * Cash Handover Controller
 * Manages the cash confirmation workflow
 * 
 * FLOW:
 * 1. Shift ends → creates shift_collection handover
 * 2. Manager confirms receipt → employee_to_manager
 * 3. Owner confirms receipt → manager_to_owner
 * 4. Deposit to bank → deposit_to_bank
 */

const { 
  CashHandover, 
  Shift, 
  User, 
  Station, 
  sequelize 
} = require('../models');
const { Op } = require('sequelize');
const { canAccessStation } = require('../middleware/accessControl');

/**
 * Get pending handovers for current user
 * GET /api/v1/handovers/pending
 */
exports.getPendingHandovers = async (req, res, next) => {
  try {
    const { stationId } = req.query;
    
    const handovers = await CashHandover.getPendingForUser(req.userId, stationId);
    
    res.json({
      success: true,
      data: handovers,
      count: handovers.length
    });
  } catch (error) {
    console.error('Get pending handovers error:', error);
    next(error);
  }
};

/**
 * Create a new handover (manager/owner initiates)
 * POST /api/v1/handovers
 */
exports.createHandover = async (req, res, next) => {
  try {
    const { 
      stationId, 
      handoverType, 
      handoverDate, 
      fromUserId, 
      expectedAmount,
      notes 
    } = req.body;
    
    const user = await User.findByPk(req.userId);
    
    // Authorization
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this station'
      });
    }
    
    // Only managers+ can create handovers
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only managers can create handovers'
      });
    }
    
    // Validate handover type based on role
    if (handoverType === 'manager_to_owner' && user.role === 'manager') {
      // Manager is giving to owner
    } else if (handoverType === 'deposit_to_bank' && !['owner', 'super_admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only owners can record bank deposits'
      });
    }
    
    // Get uncollected amount if not specified
    let amount = expectedAmount;
    if (!amount && handoverType === 'employee_to_manager') {
      // Sum unconfirmed shift collections
      const pending = await CashHandover.findAll({
        where: {
          stationId,
          handoverType: 'shift_collection',
          status: 'pending',
          fromUserId: fromUserId
        }
      });
      amount = pending.reduce((sum, h) => sum + parseFloat(h.expectedAmount || 0), 0);
    }
    
    const handover = await CashHandover.createHandover({
      stationId,
      handoverType,
      handoverDate,
      fromUserId,
      toUserId: req.userId,
      expectedAmount: amount || 0,
      notes
    });
    
    await handover.reload({
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'name'] },
        { model: User, as: 'toUser', attributes: ['id', 'name'] }
      ]
    });
    
    res.status(201).json({
      success: true,
      data: handover,
      message: 'Handover created, pending confirmation'
    });
  } catch (error) {
    console.error('Create handover error:', error);
    next(error);
  }
};

/**
 * Confirm a handover (recipient confirms)
 * POST /api/v1/handovers/:id/confirm
 */
exports.confirmHandover = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { actualAmount, notes } = req.body;
    
    const handover = await CashHandover.findByPk(id, {
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'name'] }
      ],
      transaction: t
    });
    
    if (!handover) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: 'Handover not found'
      });
    }
    
    if (handover.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: 'Handover is not pending'
      });
    }
    
    // Authorization
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, handover.stationId))) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    // Only the recipient or higher role can confirm
    if (handover.toUserId && handover.toUserId !== req.userId) {
      if (!['super_admin', 'owner'].includes(user.role)) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          error: 'Only the designated recipient can confirm'
        });
      }
    }
    
    await handover.confirm({
      actualAmount: actualAmount !== undefined ? actualAmount : handover.expectedAmount,
      confirmedBy: req.userId,
      notes
    }, t);
    
    await t.commit();
    
    await handover.reload({
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'name'] },
        { model: User, as: 'toUser', attributes: ['id', 'name'] },
        { model: User, as: 'confirmedByUser', attributes: ['id', 'name'] }
      ]
    });
    
    const message = handover.status === 'disputed'
      ? `Handover confirmed with discrepancy of ₹${handover.difference}`
      : 'Handover confirmed successfully';
    
    res.json({
      success: true,
      data: handover,
      message
    });
  } catch (error) {
    await t.rollback();
    console.error('Confirm handover error:', error);
    next(error);
  }
};

/**
 * Record bank deposit
 * POST /api/v1/handovers/bank-deposit
 */
exports.recordBankDeposit = async (req, res, next) => {
  try {
    const { 
      stationId, 
      handoverDate, 
      amount, 
      bankName, 
      depositReference, 
      depositReceiptUrl,
      notes 
    } = req.body;
    
    const user = await User.findByPk(req.userId);
    
    // Only owner+ can record bank deposits
    if (!['super_admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only owners can record bank deposits'
      });
    }
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this station'
      });
    }
    
    const handover = await CashHandover.create({
      stationId,
      handoverType: 'deposit_to_bank',
      handoverDate: handoverDate || new Date().toISOString().split('T')[0],
      fromUserId: req.userId,
      expectedAmount: amount,
      actualAmount: amount,
      bankName,
      depositReference,
      depositReceiptUrl,
      notes,
      status: 'confirmed',
      confirmedAt: new Date(),
      confirmedBy: req.userId
    });
    
    res.status(201).json({
      success: true,
      data: handover,
      message: `Bank deposit of ₹${amount} recorded`
    });
  } catch (error) {
    console.error('Record bank deposit error:', error);
    next(error);
  }
};

/**
 * Resolve a disputed handover
 * POST /api/v1/handovers/:id/resolve
 */
exports.resolveDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    
    const handover = await CashHandover.findByPk(id);
    
    if (!handover) {
      return res.status(404).json({
        success: false,
        error: 'Handover not found'
      });
    }
    
    if (handover.status !== 'disputed') {
      return res.status(400).json({
        success: false,
        error: 'Only disputed handovers can be resolved'
      });
    }
    
    // Only owner+ can resolve disputes
    const user = await User.findByPk(req.userId);
    if (!['super_admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only owners can resolve disputes'
      });
    }
    
    await handover.resolveDispute({
      resolutionNotes,
      resolvedBy: req.userId
    });
    
    res.json({
      success: true,
      data: handover,
      message: 'Dispute resolved'
    });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    next(error);
  }
};

/**
 * Get handovers for a station
 * GET /api/v1/stations/:stationId/handovers
 */
exports.getStationHandovers = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate, handoverType, status, page = 1, limit = 50 } = req.query;
    
    const user = await User.findByPk(req.userId);
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const where = { stationId };
    
    if (startDate && endDate) {
      where.handoverDate = { [Op.between]: [startDate, endDate] };
    }
    
    if (handoverType) where.handoverType = handoverType;
    if (status) where.status = status;
    
    const offset = (page - 1) * limit;
    
    const { count, rows } = await CashHandover.findAndCountAll({
      where,
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'name'] },
        { model: User, as: 'toUser', attributes: ['id', 'name'] },
        { model: User, as: 'confirmedByUser', attributes: ['id', 'name'] }
      ],
      order: [['handoverDate', 'DESC'], ['createdAt', 'DESC']],
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
    console.error('Get station handovers error:', error);
    next(error);
  }
};

/**
 * Get cash flow summary
 * GET /api/v1/stations/:stationId/handovers/summary
 */
exports.getCashFlowSummary = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    const user = await User.findByPk(req.userId);
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const summary = await CashHandover.getCashFlowSummary(stationId, startDate, endDate);
    
    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        ...summary
      }
    });
  } catch (error) {
    console.error('Get cash flow summary error:', error);
    next(error);
  }
};

/**
 * Get unconfirmed handovers (manager alert)
 * GET /api/v1/stations/:stationId/handovers/unconfirmed
 */
exports.getUnconfirmed = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate } = req.query;
    
    const user = await User.findByPk(req.userId);
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const start = startDate || today;
    const end = endDate || today;
    
    const unconfirmed = await CashHandover.getUnconfirmed(stationId, start, end);
    
    res.json({
      success: true,
      data: unconfirmed,
      count: unconfirmed.length,
      alert: unconfirmed.length > 0 
        ? `${unconfirmed.length} handover(s) pending confirmation` 
        : null
    });
  } catch (error) {
    console.error('Get unconfirmed error:', error);
    next(error);
  }
};

/**
 * Get bank deposits
 * GET /api/v1/stations/:stationId/handovers/bank-deposits
 */
exports.getBankDeposits = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    const user = await User.findByPk(req.userId);
    
    // Only owner+ can see bank deposits
    if (!['super_admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only owners can view bank deposit records'
      });
    }
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const deposits = await CashHandover.getBankDeposits(stationId, startDate, endDate);
    
    const totalDeposited = deposits.reduce(
      (sum, d) => sum + parseFloat(d.actualAmount || 0), 
      0
    );
    
    res.json({
      success: true,
      data: deposits,
      summary: {
        count: deposits.length,
        totalDeposited
      }
    });
  } catch (error) {
    console.error('Get bank deposits error:', error);
    next(error);
  }
};
