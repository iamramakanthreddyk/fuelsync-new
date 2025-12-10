/**
 * Credit Controller
 * Handles creditors and credit transactions with proper transactions
 */

const { Creditor, CreditTransaction, Station, User, NozzleReading, sequelize } = require('../models');
const { Op } = require('sequelize');
const { hasPermission, CREDIT_STATUS } = require('../config/constants');
const { canAccessStation } = require('../middleware/accessControl');

/**
 * Get all creditors for a station
 */
const getCreditors = async (req, res) => {
  try {
    const { stationId } = req.params;
    // Verify station access
    if (!(await canAccessStation(req.user, stationId))) {
      return res.status(403).json({ success: false, error: { message: 'Access denied' } });
    }
    const { isActive, search, page = 1, limit = 20 } = req.query;
    
    // Build where clause
    const where = { stationId };
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { businessName: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: creditors } = await Creditor.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset
    });
    
    res.json({
      success: true,
      data: creditors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get creditors error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch creditors' } });
  }
};

/**
 * Get single creditor with transaction history
 */
const getCreditor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const creditor = await Creditor.findByPk(id, {
      include: [
        {
          model: CreditTransaction,
          as: 'transactions',
          order: [['transactionDate', 'DESC']],
          limit: 50
        }
      ]
    });
    
    if (!creditor) {
      return res.status(404).json({ success: false, error: { message: 'Creditor not found' } });
    }
    
    res.json({ success: true, data: creditor });
  } catch (error) {
    console.error('Get creditor error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch creditor' } });
  }
};

/**
 * Create a new creditor
 */
const createCreditor = async (req, res) => {
  try {
    const { stationId } = req.params;
    // Verify station access
    if (!(await canAccessStation(req.user, stationId))) {
      return res.status(403).json({ success: false, error: { message: 'Access denied' } });
    }
    // Only owner/manager/super_admin can create creditors
    if (!['super_admin', 'owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { message: 'Only owner or manager can create creditors' } });
    }
    const { name, contactPerson, phone, email, address, businessName, gstNumber, creditLimit, notes } = req.body;
    // Validate required fields
    if (!name) {
      return res.status(400).json({ success: false, error: { message: 'Creditor name is required' } });
    }
    // Check plan limits
    const station = await Station.findByPk(stationId, {
      include: [{ model: User, as: 'owner', include: ['plan'] }]
    });
    if (station?.owner?.plan) {
      const currentCount = await Creditor.count({ where: { stationId, isActive: true } });
      const limit = station.owner.plan.maxCreditors;
      if (currentCount >= limit) {
        return res.status(403).json({
          success: false,
          error: { message: `Creditor limit reached (${limit}). Upgrade plan to add more.` }
        });
      }
    }
    const creditor = await Creditor.create({
      stationId,
      name,
      contactPerson,
      phone,
      email,
      address,
      businessName,
      gstNumber,
      creditLimit: creditLimit || 0,
      notes,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: creditor, creditor });
  } catch (error) {
    console.error('Create creditor error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to create creditor' } });
  }
};

/**
 * Update creditor
 */
const updateCreditor = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const creditor = await Creditor.findByPk(id);
    if (!creditor) {
      return res.status(404).json({ success: false, error: { message: 'Creditor not found' } });
    }
    // Only owner/manager/super_admin can update creditors
    if (!['super_admin', 'owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { message: 'Only owner or manager can update creditors' } });
    }
    // Only allow updating specific fields
    const allowedUpdates = ['name', 'contactPerson', 'phone', 'email', 'address', 'businessName', 'gstNumber', 'creditLimit', 'notes', 'isActive'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        creditor[field] = updates[field];
      }
    });
    await creditor.save();
    res.json({ success: true, data: creditor });
  } catch (error) {
    console.error('Update creditor error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update creditor' } });
  }
};


/**
 * Record a credit sale - wrapped in transaction for atomicity
 */
const recordCreditSale = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { stationId } = req.params;
    if (!(await canAccessStation(req.user, stationId))) {
      await t.rollback();
      return res.status(403).json({ success: false, error: { message: 'Access denied' } });
    }
    // Only owner/manager/super_admin/employee can record credit sales
    if (!['super_admin', 'owner', 'manager', 'employee'].includes(req.user.role)) {
      await t.rollback();
      return res.status(403).json({ success: false, error: { message: 'Not authorized to record credit sale' } });
    }
    const { creditAllocations, fuelType, litres, pricePerLitre, amount, transactionDate, vehicleNumber, referenceNumber, notes, nozzleReadingId } = req.body;
    // If creditAllocations is present and is an array, process each allocation
    if (Array.isArray(creditAllocations) && creditAllocations.length > 0) {
      const transactions = [];
      for (const alloc of creditAllocations) {
        const { creditorId, amount: allocAmount } = alloc;
        if (!creditorId || !allocAmount || allocAmount <= 0) continue;
        // Validate creditor
        const findOptions = { transaction: t };
        if (sequelize.getDialect() !== 'sqlite') {
          findOptions.lock = t.LOCK.UPDATE;
        }
        const creditor = await Creditor.findByPk(creditorId, findOptions);
        if (!creditor || String(creditor.stationId) !== String(stationId)) {
          await t.rollback();
          return res.status(404).json({ success: false, error: { message: `Creditor not found for ID ${creditorId}` } });
        }
        // Check credit limit
        if (!creditor.canTakeCredit(allocAmount)) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            error: {
              message: `Credit limit exceeded for ${creditor.name}. Current balance: ₹${creditor.currentBalance}, Limit: ₹${creditor.creditLimit}`,
              code: 'CREDIT_LIMIT_EXCEEDED'
            }
          });
        }
        const transaction = await CreditTransaction.create({
          stationId,
          creditorId,
          transactionType: 'credit',
          fuelType,
          litres,
          pricePerLitre,
          amount: allocAmount,
          transactionDate: transactionDate || new Date().toISOString().split('T')[0],
          vehicleNumber,
          referenceNumber,
          notes,
          nozzleReadingId,
          enteredBy: req.user.id
        }, { transaction: t });
        // Update creditor balance atomically
        await creditor.update({
          currentBalance: parseFloat(creditor.currentBalance) + parseFloat(allocAmount),
          lastTransactionDate: new Date()
        }, { transaction: t });
        transactions.push(transaction);
      }
      await t.commit();
      res.status(201).json({
        success: true,
        data: {
          transactions
        }
      });
      return;
    }
    // Fallback: legacy single-creditor logic
    const { creditorId } = req.body;
    if (!creditorId) {
      await t.rollback();
      return res.status(400).json({ success: false, error: { message: 'Creditor ID is required' } });
    }
    const findOptions = { transaction: t };
    if (sequelize.getDialect() !== 'sqlite') {
      findOptions.lock = t.LOCK.UPDATE;
    }
    const creditor = await Creditor.findByPk(creditorId, findOptions);
    if (!creditor || String(creditor.stationId) !== String(stationId)) {
      await t.rollback();
      return res.status(404).json({ success: false, error: { message: 'Creditor not found' } });
    }
    const calculatedAmount = amount || (parseFloat(litres) * parseFloat(pricePerLitre));
    if (!creditor.canTakeCredit(calculatedAmount)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: {
          message: `Credit limit exceeded. Current balance: ₹${creditor.currentBalance}, Limit: ₹${creditor.creditLimit}`,
          code: 'CREDIT_LIMIT_EXCEEDED'
        }
      });
    }
    const transaction = await CreditTransaction.create({
      stationId,
      creditorId,
      transactionType: 'credit',
      fuelType,
      litres,
      pricePerLitre,
      amount: calculatedAmount,
      transactionDate: transactionDate || new Date().toISOString().split('T')[0],
      vehicleNumber,
      referenceNumber,
      notes,
      nozzleReadingId,
      enteredBy: req.user.id
    }, { transaction: t });
    await creditor.update({
      currentBalance: parseFloat(creditor.currentBalance) + calculatedAmount,
      lastTransactionDate: new Date()
    }, { transaction: t });
    await t.commit();
    res.status(201).json({
      success: true,
      data: {
        transaction,
        creditor: {
          id: creditor.id,
          name: creditor.name,
          currentBalance: creditor.currentBalance
        }
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Record credit sale error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to record credit sale' } });
  }
};

/**
 * Record a settlement (payment from creditor) - wrapped in transaction
 */
const recordSettlement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { stationId, creditorId } = req.params;
    if (!(await canAccessStation(req.user, stationId))) {
      await t.rollback();
      return res.status(403).json({ success: false, error: { message: 'Access denied' } });
    }
    // Only owner/manager/super_admin can record settlements
    if (!['super_admin', 'owner', 'manager'].includes(req.user.role)) {
      await t.rollback();
      return res.status(403).json({ success: false, error: { message: 'Only owner or manager can record settlements' } });
    }
    const { amount, transactionDate, referenceNumber, notes } = req.body;
    // Validate creditor (lock only for non-SQLite databases)
    const findOptions = { transaction: t };
    if (sequelize.getDialect() !== 'sqlite') {
      findOptions.lock = t.LOCK.UPDATE;
    }
    const creditor = await Creditor.findByPk(creditorId, findOptions);
    if (!creditor || String(creditor.stationId) !== String(stationId)) {
      await t.rollback();
      return res.status(404).json({ success: false, error: { message: 'Creditor not found' } });
    }
    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      await t.rollback();
      return res.status(400).json({ success: false, error: { message: 'Settlement amount must be positive' } });
    }
    const settlementAmount = parseFloat(amount);
    const transaction = await CreditTransaction.create({
      stationId,
      creditorId,
      transactionType: 'settlement',
      amount: settlementAmount,
      transactionDate: transactionDate || new Date().toISOString().split('T')[0],
      referenceNumber,
      notes,
      enteredBy: req.user.id
    }, { transaction: t });
    // Update creditor balance atomically
    const newBalance = parseFloat(creditor.currentBalance) - settlementAmount;
    await creditor.update({
      currentBalance: newBalance,
      lastTransactionDate: new Date()
    }, { transaction: t });
    await t.commit();
    res.status(201).json({
      success: true,
      data: {
        transaction,
        creditor: {
          id: creditor.id,
          name: creditor.name,
          currentBalance: newBalance,
          message: newBalance <= 0 ? 'Fully settled!' : `Remaining: ₹${newBalance.toFixed(2)}`
        }
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Record settlement error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to record settlement' } });
  }
};

/**
 * Get credit transactions for a station
 */
const getTransactions = async (req, res) => {
  try {
    const { stationId } = req.params;
    if (!(await canAccessStation(req.user, stationId))) {
      return res.status(403).json({ success: false, error: { message: 'Access denied' } });
    }
    const { creditorId, type, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const where = { stationId };
    
    if (creditorId) where.creditorId = creditorId;
    if (type) where.transactionType = type;
    if (startDate && endDate) {
      where.transactionDate = { [Op.between]: [startDate, endDate] };
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: transactions } = await CreditTransaction.findAndCountAll({
      where,
      include: [
        { model: Creditor, as: 'creditor', attributes: ['id', 'name', 'businessName'] },
        { model: User, as: 'enteredByUser', attributes: ['id', 'name'] }
      ],
      order: [['transactionDate', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch transactions' } });
  }
};

/**
 * Get credit summary for dashboard
 */
const getCreditSummary = async (req, res) => {
  try {
    const { stationId } = req.params;
    if (!(await canAccessStation(req.user, stationId))) {
      return res.status(403).json({ success: false, error: { message: 'Access denied' } });
    }
    
    // Get all active creditors with balances
    const creditors = await Creditor.findAll({
      where: { stationId, isActive: true },
      attributes: ['id', 'name', 'businessName', 'currentBalance', 'creditLimit', 'isFlagged'],
      order: [['currentBalance', 'DESC']]
    });
    
    // Calculate totals
    const totalOutstanding = creditors.reduce((sum, c) => sum + parseFloat(c.currentBalance || 0), 0);
    const creditorsWithBalance = creditors.filter(c => parseFloat(c.currentBalance) > 0);
    const flaggedCreditors = creditors.filter(c => c.isFlagged);
    
    // Get recent transactions
    const recentTransactions = await CreditTransaction.findAll({
      where: { stationId },
      include: [{ model: Creditor, as: 'creditor', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalOutstanding,
          totalCreditors: creditors.length,
          creditorsWithBalance: creditorsWithBalance.length,
          flaggedCreditors: flaggedCreditors.length
        },
        topCreditors: creditorsWithBalance.slice(0, 5),
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Get credit summary error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch credit summary' } });
  }
};

/**
 * Get aging report for a station
 * GET /api/v1/stations/:stationId/creditors/aging
 */
const getAgingReport = async (req, res) => {
  try {
    const { stationId } = req.params;
    if (!(await canAccessStation(req.user, stationId))) {
      return res.status(403).json({ success: false, error: { message: 'Access denied' } });
    }
    
    const report = await Creditor.getAgingReport(stationId);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get aging report error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch aging report' } });
  }
};

/**
 * Get overdue creditors
 * GET /api/v1/stations/:stationId/creditors/overdue
 */
const getOverdueCreditors = async (req, res) => {
  try {
    const { stationId } = req.params;
    if (!(await canAccessStation(req.user, stationId))) {
      return res.status(403).json({ success: false, error: { message: 'Access denied' } });
    }
    
    const creditors = await Creditor.getOverdueCreditors(stationId);
    
    res.json({
      success: true,
      data: creditors.map(c => ({
        id: c.id,
        name: c.name,
        businessName: c.businessName,
        currentBalance: c.currentBalance,
        creditPeriodDays: c.creditPeriodDays,
        lastTransactionDate: c.lastTransactionDate,
        lastPaymentDate: c.lastPaymentDate,
        phone: c.phone,
        email: c.email
      }))
    });
  } catch (error) {
    console.error('Get overdue creditors error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch overdue creditors' } });
  }
};

/**
 * Flag a creditor
 * POST /api/v1/creditors/:id/flag
 */
const flagCreditor = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    // Only owner/manager/super_admin can flag creditors
    if (!['super_admin', 'owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { message: 'Only owner or manager can flag creditors' } });
    }
    const creditor = await Creditor.findByPk(id);
    if (!creditor) {
      return res.status(404).json({ success: false, error: { message: 'Creditor not found' } });
    }
    await creditor.flag(reason || 'Credit issue');
    res.json({
      success: true,
      data: creditor,
      message: 'Creditor flagged successfully'
    });
  } catch (error) {
    console.error('Flag creditor error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to flag creditor' } });
  }
};

/**
 * Unflag a creditor
 * POST /api/v1/creditors/:id/unflag
 */
const unflagCreditor = async (req, res) => {
  try {
    const { id } = req.params;
    // Only owner/manager/super_admin can unflag creditors
    if (!['super_admin', 'owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { message: 'Only owner or manager can unflag creditors' } });
    }
    const creditor = await Creditor.findByPk(id);
    if (!creditor) {
      return res.status(404).json({ success: false, error: { message: 'Creditor not found' } });
    }
    await creditor.unflag();
    res.json({
      success: true,
      data: creditor,
      message: 'Creditor unflagged successfully'
    });
  } catch (error) {
    console.error('Unflag creditor error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to unflag creditor' } });
  }
};

module.exports = {
  getCreditors,
  getCreditor,
  createCreditor,
  updateCreditor,
  recordCreditSale,
  recordSettlement,
  getTransactions,
  getCreditSummary,
  getAgingReport,
  getOverdueCreditors,
  flagCreditor,
  unflagCreditor
};
