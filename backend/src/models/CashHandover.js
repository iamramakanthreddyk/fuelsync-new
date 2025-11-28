/**
 * CashHandover Model
 * Track cash handover chain: Employee → Manager → Owner → Bank
 * 
 * WORKFLOW:
 * 1. Employee ends shift with cash collected
 * 2. Manager confirms receipt from employee (employee_to_manager)
 * 3. Owner confirms receipt from manager (manager_to_owner)
 * 4. Owner/Manager deposits to bank (deposit_to_bank)
 * 
 * Each step creates a new handover record with confirmation
 */

const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const CashHandover = sequelize.define('CashHandover', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    stationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'station_id',
      references: { model: 'stations', key: 'id' }
    },
    
    // Handover type
    handoverType: {
      type: DataTypes.ENUM(
        'shift_collection',      // When shift ends
        'employee_to_manager',   // Employee hands cash to manager
        'manager_to_owner',      // Manager hands cash to owner
        'deposit_to_bank'        // Deposit to bank account
      ),
      allowNull: false,
      field: 'handover_type'
    },
    
    // Date of handover
    handoverDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'handover_date'
    },
    
    // Who gave the cash
    fromUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'from_user_id',
      references: { model: 'users', key: 'id' },
      comment: 'NULL for bank deposits'
    },
    
    // Who received the cash
    toUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'to_user_id',
      references: { model: 'users', key: 'id' },
      comment: 'NULL for bank deposits'
    },
    
    // Amount details
    expectedAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'expected_amount',
      comment: 'Amount expected based on sales/previous handover'
    },
    
    actualAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'actual_amount',
      comment: 'Actual amount received (filled on confirmation)'
    },
    
    difference: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Difference between expected and actual'
    },
    
    // Linked shift (for shift_collection type)
    shiftId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'shift_id',
      references: { model: 'shifts', key: 'id' }
    },
    
    // Links to previous handover in chain
    previousHandoverId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'previous_handover_id',
      comment: 'Links handovers in chain'
    },
    
    // Status
    status: {
      type: DataTypes.ENUM(
        'pending',      // Waiting for confirmation
        'confirmed',    // Received and confirmed
        'disputed',     // Discrepancy reported
        'resolved'      // Discrepancy resolved
      ),
      defaultValue: 'pending'
    },
    
    // Confirmation details
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'confirmed_at'
    },
    
    confirmedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'confirmed_by',
      references: { model: 'users', key: 'id' }
    },
    
    // Bank deposit details
    bankName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'bank_name'
    },
    
    depositReference: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'deposit_reference',
      comment: 'Bank transaction ID or deposit slip number'
    },
    
    depositReceiptUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'deposit_receipt_url',
      comment: 'URL to uploaded receipt image'
    },
    
    // Notes
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    disputeNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'dispute_notes',
      comment: 'Reason for dispute if any'
    },
    
    resolutionNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'resolution_notes'
    }
  }, {
    tableName: 'cash_handovers',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['station_id'] },
      { fields: ['handover_date'] },
      { fields: ['station_id', 'handover_date'] },
      { fields: ['from_user_id'] },
      { fields: ['to_user_id'] },
      { fields: ['status'] },
      { fields: ['handover_type'] },
      { fields: ['shift_id'] }
    ]
  });

  // ============================================
  // INSTANCE METHODS
  // ============================================

  /**
   * Confirm cash receipt
   */
  CashHandover.prototype.confirm = async function(data = {}, transaction = null) {
    const { actualAmount, confirmedBy, notes } = data;
    
    const difference = actualAmount !== undefined 
      ? parseFloat(actualAmount) - parseFloat(this.expectedAmount)
      : null;
    
    const status = difference && Math.abs(difference) > 1 ? 'disputed' : 'confirmed';
    
    await this.update({
      actualAmount: actualAmount || this.expectedAmount,
      difference,
      status,
      confirmedAt: new Date(),
      confirmedBy,
      notes: notes || this.notes,
      disputeNotes: status === 'disputed' ? `Discrepancy of ₹${difference}` : null
    }, { transaction });
    
    return this;
  };

  /**
   * Resolve a dispute
   */
  CashHandover.prototype.resolveDispute = async function(data = {}, transaction = null) {
    const { resolutionNotes, resolvedBy } = data;
    
    if (this.status !== 'disputed') {
      throw new Error('Only disputed handovers can be resolved');
    }
    
    await this.update({
      status: 'resolved',
      resolutionNotes,
      confirmedBy: resolvedBy || this.confirmedBy
    }, { transaction });
    
    return this;
  };

  // ============================================
  // CLASS METHODS
  // ============================================

  /**
   * Create a handover from shift end
   */
  CashHandover.createFromShift = async function(shift, transaction = null) {
    return this.create({
      stationId: shift.stationId,
      handoverType: 'shift_collection',
      handoverDate: shift.shiftDate,
      fromUserId: shift.employeeId,
      expectedAmount: shift.cashCollected || 0,
      actualAmount: shift.cashCollected || 0,
      shiftId: shift.id,
      status: 'pending'
    }, { transaction });
  };

  /**
   * Create a handover to next level
   */
  CashHandover.createHandover = async function(data, transaction = null) {
    const {
      stationId,
      handoverType,
      handoverDate,
      fromUserId,
      toUserId,
      expectedAmount,
      previousHandoverId,
      notes
    } = data;

    return this.create({
      stationId,
      handoverType,
      handoverDate: handoverDate || new Date().toISOString().split('T')[0],
      fromUserId,
      toUserId,
      expectedAmount,
      previousHandoverId,
      notes,
      status: 'pending'
    }, { transaction });
  };

  /**
   * Get pending handovers for a user (what they need to confirm)
   */
  CashHandover.getPendingForUser = async function(userId, stationId = null) {
    const where = {
      toUserId: userId,
      status: 'pending'
    };
    
    if (stationId) where.stationId = stationId;
    
    return this.findAll({
      where,
      include: [
        { model: sequelize.models.User, as: 'fromUser', attributes: ['id', 'name'] },
        { model: sequelize.models.Station, as: 'station', attributes: ['id', 'name'] }
      ],
      order: [['handoverDate', 'DESC'], ['createdAt', 'DESC']]
    });
  };

  /**
   * Get unconfirmed collections for a date range
   */
  CashHandover.getUnconfirmed = async function(stationId, startDate, endDate) {
    return this.findAll({
      where: {
        stationId,
        handoverDate: { [Op.between]: [startDate, endDate] },
        status: 'pending'
      },
      include: [
        { model: sequelize.models.User, as: 'fromUser', attributes: ['id', 'name'] },
        { model: sequelize.models.User, as: 'toUser', attributes: ['id', 'name'] }
      ],
      order: [['handoverDate', 'ASC']]
    });
  };

  /**
   * Get cash flow summary for a station
   */
  CashHandover.getCashFlowSummary = async function(stationId, startDate, endDate) {
    const handovers = await this.findAll({
      where: {
        stationId,
        handoverDate: { [Op.between]: [startDate, endDate] },
        status: { [Op.in]: ['confirmed', 'resolved'] }
      },
      attributes: [
        'handoverType',
        [sequelize.fn('SUM', sequelize.col('actual_amount')), 'totalAmount'],
        [sequelize.fn('SUM', sequelize.col('difference')), 'totalDifference'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['handoverType'],
      raw: true
    });

    const pending = await this.count({
      where: {
        stationId,
        handoverDate: { [Op.between]: [startDate, endDate] },
        status: 'pending'
      }
    });

    const disputed = await this.count({
      where: {
        stationId,
        handoverDate: { [Op.between]: [startDate, endDate] },
        status: 'disputed'
      }
    });

    return {
      byType: handovers,
      pendingCount: pending,
      disputedCount: disputed
    };
  };

  /**
   * Get bank deposits for a date range
   */
  CashHandover.getBankDeposits = async function(stationId, startDate, endDate) {
    return this.findAll({
      where: {
        stationId,
        handoverType: 'deposit_to_bank',
        handoverDate: { [Op.between]: [startDate, endDate] }
      },
      include: [
        { model: sequelize.models.User, as: 'fromUser', attributes: ['id', 'name'] },
        { model: sequelize.models.User, as: 'confirmedByUser', attributes: ['id', 'name'] }
      ],
      order: [['handoverDate', 'DESC']]
    });
  };

  return CashHandover;
};
