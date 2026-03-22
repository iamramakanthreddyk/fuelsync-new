/**
 * Credit Controller
 * Handles creditors and credit transactions with proper transactions
 * 
 * AUDIT LOGGING:
 * - All creditor and credit transaction operations logged
 * - Tracks: creditor creation/updates, credit sales, settlements
 */

// ===== MODELS & DATABASE =====
const { Creditor, CreditTransaction, CreditSettlementLink, Station, User, NozzleReading, sequelize } = require('../services/modelAccess');
const { Op } = require('sequelize');

// ===== UTILITIES =====
const { canAccessStation } = require('../utils/stationAccessControl');

// ===== UTILITIES & LOGGING =====
const { logAudit } = require('../utils/auditLog');
const { getPaginationOptions, formatPaginatedResponse } = require('../utils/paginationHelper');
const { buildDateRangeWhere } = require('../utils/dateRangeHelper');
const { createContextLogger } = require('../services/loggerService');

// ===== LOGGER =====
const logger = createContextLogger('CreditController');

/**
 * Get all creditors for a station
 * GET /api/v1/stations/:stationId/creditors
 * 
 * Query Parameters:
 * - isActive (boolean): Filter by active status
 * - search (string): Search by name, business name, or phone
 * - page, limit: Pagination
 */
exports.getCreditors = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;
    
    // Verify station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
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
  
  // Use pagination helper
  const { offset, limit: parsedLimit } = getPaginationOptions(page, limit);
  
  const { count, rows: creditors } = await Creditor.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    limit: parsedLimit,
    offset
  });
  
    // Format response using pagination helper
    const paginationData = formatPaginatedResponse(creditors, count, page, parsedLimit);
    
    res.json({
      success: true,
      data: paginationData.data,
      pagination: paginationData.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get credit ledger with outstanding balances and last sale dates
 * GET /api/v1/creditors/ledger?search=...
 * 
 * Returns active creditors with outstanding balances and last transaction dates.
 */
exports.getCreditLedger = async (req, res, next) => {
  try {
    const { search, stationId, showAll } = req.query;
    const user = req.user;
    
    // Get station from user if not provided
    let finalStationId = stationId;
    if (!finalStationId && user?.stations?.length > 0) {
      finalStationId = user.stations[0].id;
    }
    
    // Verify station access
    if (!(await canAccessStation(user, finalStationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
  
    // Build where clause
    const where = { 
      stationId: finalStationId,
      isActive: true 
    };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { businessName: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    // Get all active creditors for the station
    const creditors = await Creditor.findAll({
      where,
      attributes: ['id', 'name', 'businessName', 'currentBalance', 'creditLimit', 'phone', 'lastTransactionDate'],
      order: [['currentBalance', 'DESC']]
    });
    
    // Enrich with last sale date from nozzle_readings
    const enrichedCreditors = await Promise.all(
      creditors.map(async (c) => {
        const lastReading = await NozzleReading.findOne({
          where: {
            creditorId: c.id,
            creditAmount: { [Op.gt]: 0 }
          },
          attributes: ['readingDate'],
          order: [['readingDate', 'DESC']],
          raw: true
        });
        
        return {
          id: c.id,
          name: c.name,
          businessName: c.businessName,
          mobile: c.phone,
          creditLimit: c.creditLimit,
          outstanding: parseFloat(c.currentBalance) || 0,
          lastSaleDate: lastReading?.readingDate || null
        };
      })
    );
    
    // Filter based on showAll parameter
    const filtered = showAll === 'true' ? enrichedCreditors : enrichedCreditors.filter(c => c.outstanding > 0);
    
    res.json({ success: true, data: filtered });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single creditor with transaction history
 * GET /api/v1/creditors/:id
 */
exports.getCreditor = async (req, res, next) => {
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
      return res.status(404).json({ success: false, error: `Creditor ${id} not found` });
    }
    
    res.json({ success: true, data: creditor });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new creditor
 * POST /api/v1/stations/:stationId/creditors
 */
exports.createCreditor = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;
    
    // Verify station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    // Only owner/manager/super_admin can create creditors
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Only owner or manager can create creditors' });
    }
    
    const { name, contactPerson, phone, email, address, businessName, gstNumber, creditLimit, notes } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(422).json({ success: false, error: 'Creditor name is required' });
    }
    // Check plan limits
    const station = await Station.findByPk(stationId, {
      include: [{ model: User, as: 'owner', include: ['plan'] }]
    });
    if (station?.owner?.plan) {
      const currentCount = await Creditor.count({ where: { stationId, isActive: true } });
      const limit = station.owner.plan.maxCreditors;
      if (currentCount >= limit) {
        return res.status(400).json({
          success: false,
          error: `Creditor limit reached (${limit}). Upgrade plan to add more.`
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
      createdBy: user.id
    });

    // Log creditor creation
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      stationId,
      action: 'CREATE',
      entityType: 'Creditor',
      entityId: creditor.id,
      newValues: {
        id: creditor.id,
        name,
        businessName,
        creditLimit
      },
      category: 'data',
      severity: 'info',
      description: `Created creditor: ${name}`
    });

    res.status(201).json({ success: true, data: creditor });
  } catch (error) {
    next(error);
  }
};

/**
 * Update creditor
 * PUT /api/v1/creditors/:id
 */
exports.updateCreditor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;
    
    const creditor = await Creditor.findByPk(id);
    if (!creditor) {
      return res.status(404).json({ success: false, error: `Creditor ${id} not found` });
    }
    
    // Only owner/manager/super_admin can update creditors
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Only owner or manager can update creditors' });
    }
    
    // Only allow updating specific fields
    const allowedUpdates = ['name', 'contactPerson', 'phone', 'email', 'address', 'businessName', 'gstNumber', 'creditLimit', 'notes', 'isActive'];
    const oldValues = creditor.toJSON();
    const newValues = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        creditor[field] = updates[field];
        newValues[field] = updates[field];
      }
    });
    
    await creditor.save();

    // Log creditor update
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      stationId: creditor.stationId,
      action: 'UPDATE',
      entityType: 'Creditor',
      entityId: creditor.id,
      oldValues: oldValues,
      newValues: newValues,
      category: 'data',
      severity: 'info',
      description: `Updated creditor: ${creditor.name}`
    });

    res.json({ success: true, data: creditor });
  } catch (error) {
    next(error);
  }
};


/**
 * Record a credit sale - wrapped in transaction for atomicity
 * POST /api/v1/stations/:stationId/credit-sales
 */
exports.recordCreditSale = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { stationId } = req.params;
    const user = req.user;
    
    if (!(await canAccessStation(user, stationId))) {
      await t.rollback();
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    // Only owner/manager/super_admin/employee can record credit sales
    if (!['super_admin', 'owner', 'manager', 'employee'].includes(user.role)) {
      await t.rollback();
      return res.status(403).json({ success: false, error: 'Not authorized to record credit sale' });
    }
    const { creditAllocations, fuelType, litres, pricePerLitre, amount, transactionDate, vehicleNumber, referenceNumber, notes, nozzleReadingId, invoiceNumber } = req.body;
    
    // Process multiple allocations if provided
    if (Array.isArray(creditAllocations) && creditAllocations.length > 0) {
      const transactions = [];
      for (const alloc of creditAllocations) {
        const { creditorId, amount: allocAmount } = alloc;
        if (!creditorId || !allocAmount || allocAmount <= 0) continue;
        
        const findOptions = { transaction: t };
        if (sequelize.getDialect() !== 'sqlite') {
          findOptions.lock = t.LOCK.UPDATE;
        }
        const creditor = await Creditor.findByPk(creditorId, findOptions);
        if (!creditor || String(creditor.stationId) !== String(stationId)) {
          await t.rollback();
          return res.status(404).json({ success: false, error: `Creditor not found for ID ${creditorId}` });
        }
        
        if (!creditor.canTakeCredit(allocAmount)) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            error: `Credit limit exceeded for ${creditor.name}. Current: ₹${creditor.currentBalance}, Limit: ₹${creditor.creditLimit}`
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
          invoiceNumber,
          notes,
          nozzleReadingId,
          enteredBy: user.id
        }, { transaction: t });
        
        await creditor.update({
          currentBalance: parseFloat(creditor.currentBalance) + parseFloat(allocAmount),
          lastTransactionDate: new Date()
        }, { transaction: t });
        
        transactions.push(transaction);
      }

      // Log all transactions
      for (const txn of transactions) {
        await logAudit({
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          stationId,
          action: 'CREATE',
          entityType: 'CreditTransaction',
          entityId: txn.id,
          newValues: {
            id: txn.id,
            creditorId: txn.creditorId,
            fuelType,
            litres,
            amount: txn.amount,
            transactionType: 'credit'
          },
          category: 'finance',
          severity: 'info',
          description: `Recorded credit sale: ${litres}L of ${fuelType} for ₹${txn.amount}`
        });
      }

      await t.commit();
      res.status(201).json({ success: true, data: { transactions } });
      return;
    }
    
    // Single creditor fallback
    const { creditorId } = req.body;
    if (!creditorId) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Creditor ID is required' });
    }
    
    const findOptions = { transaction: t };
    if (sequelize.getDialect() !== 'sqlite') {
      findOptions.lock = t.LOCK.UPDATE;
    }
    const creditor = await Creditor.findByPk(creditorId, findOptions);
    if (!creditor || String(creditor.stationId) !== String(stationId)) {
      await t.rollback();
      return res.status(404).json({ success: false, error: 'Creditor not found' });
    }
    
    const calculatedAmount = amount || (parseFloat(litres) * parseFloat(pricePerLitre));
    if (!creditor.canTakeCredit(calculatedAmount)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: `Credit limit exceeded. Current: ₹${creditor.currentBalance}, Limit: ₹${creditor.creditLimit}`
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
      invoiceNumber,
      notes,
      nozzleReadingId,
      enteredBy: user.id
    }, { transaction: t });
    
    await creditor.update({
      currentBalance: parseFloat(creditor.currentBalance) + calculatedAmount,
      lastTransactionDate: new Date()
    }, { transaction: t });

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      stationId,
      action: 'CREATE',
      entityType: 'CreditTransaction',
      entityId: transaction.id,
      newValues: {
        id: transaction.id,
        creditorId,
        fuelType,
        litres,
        amount: calculatedAmount,
        transactionType: 'credit'
      },
      category: 'finance',
      severity: 'info',
      description: `Recorded credit sale: ${litres}L of ${fuelType} for ₹${calculatedAmount}`
    });

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
    next(error);
  }
};

/**
 * Record a settlement (payment from creditor) - wrapped in transaction
 * POST /api/v1/creditors/:creditorId/settlement
 */
exports.recordSettlement = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { stationId, creditorId } = req.params;
    const user = req.user;
    
    if (!(await canAccessStation(user, stationId))) {
      await t.rollback();
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    // Only owner/manager/super_admin can record settlements
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      await t.rollback();
      return res.status(403).json({ success: false, error: 'Only owner or manager can record settlements' });
    }
    const { amount, transactionDate, referenceNumber, notes, invoiceNumber } = req.body;
    const allocations = Array.isArray(req.body.allocations) ? req.body.allocations : [];
    
    const findOptions = { transaction: t };
    if (sequelize.getDialect() !== 'sqlite') {
      findOptions.lock = t.LOCK.UPDATE;
    }
    const creditor = await Creditor.findByPk(creditorId, findOptions);
    if (!creditor || String(creditor.stationId) !== String(stationId)) {
      await t.rollback();
      return res.status(404).json({ success: false, error: 'Creditor not found' });
    }
    
    // Calculate settlement amount from allocations or direct amount
    let settlementAmount = amount !== undefined && amount !== null ? parseFloat(amount) : 0;
    if (allocations.length > 0) {
      const totalAllocAmount = allocations.reduce((sum, alloc) => {
        const val = parseFloat(alloc?.amount || 0);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
      if (totalAllocAmount <= 0) {
        await t.rollback();
        return res.status(400).json({ success: false, error: 'Allocation amounts must be positive' });
      }
      if (settlementAmount > 0 && Math.abs(totalAllocAmount - settlementAmount) > 0.01) {
        await t.rollback();
        return res.status(400).json({ success: false, error: 'Settlement amount must match allocation totals' });
      }
      settlementAmount = totalAllocAmount;
    }
    
    if (!settlementAmount || settlementAmount <= 0 || Number.isNaN(settlementAmount)) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Settlement amount must be positive' });
    }
    
    const transaction = await CreditTransaction.create({
      stationId,
      creditorId,
      transactionType: 'settlement',
      amount: settlementAmount,
      transactionDate: transactionDate || new Date().toISOString().split('T')[0],
      referenceNumber,
      invoiceNumber,
      notes,
      enteredBy: user.id
    }, { transaction: t });

    // Persist allocation links for partial settlements
    if (allocations.length > 0) {
      for (const alloc of allocations) {
        const creditTransactionId = alloc?.creditTransactionId;
        const allocAmount = parseFloat(alloc?.amount || 0);
        if (!creditTransactionId || !allocAmount || allocAmount <= 0) {
          await t.rollback();
          return res.status(400).json({ success: false, error: 'Each allocation needs creditTransactionId and positive amount' });
        }

        const lockOptions = { transaction: t };
        if (sequelize.getDialect() !== 'sqlite') {
          lockOptions.lock = t.LOCK.UPDATE;
        }

        const creditTxn = await CreditTransaction.findByPk(creditTransactionId, lockOptions);
        if (!creditTxn || creditTxn.transactionType !== 'credit' || String(creditTxn.creditorId) !== String(creditorId) || String(creditTxn.stationId) !== String(stationId)) {
          await t.rollback();
          return res.status(404).json({ success: false, error: 'Referenced credit transaction is invalid' });
        }

        const alreadySettled = await CreditSettlementLink.sum('amount', { where: { creditTransactionId }, transaction: t }) || 0;
        const creditTxnAmount = parseFloat(creditTxn.amount || 0);
        if (parseFloat(alreadySettled) + allocAmount - creditTxnAmount > 0.01) {
          await t.rollback();
          return res.status(400).json({ success: false, error: 'Allocation exceeds remaining amount for the credit transaction' });
        }

        await CreditSettlementLink.create({
          settlementId: transaction.id,
          creditTransactionId,
          amount: allocAmount
        }, { transaction: t });
      }
    }
    
    const newBalance = parseFloat(creditor.currentBalance) - settlementAmount;
    await creditor.update({
      currentBalance: newBalance,
      lastTransactionDate: new Date()
    }, { transaction: t });

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      stationId,
      action: 'CREATE',
      entityType: 'Settlement',
      entityId: transaction.id,
      newValues: {
        id: transaction.id,
        creditorId,
        amount: settlementAmount,
        transactionType: 'settlement',
        allocations: allocations.length
      },
      category: 'finance',
      severity: 'info',
      description: `Recorded settlement of ₹${settlementAmount} for creditor ${creditor.name}`
    });

    await t.commit();
    
    const allocationLinks = allocations.length > 0
      ? await CreditSettlementLink.findAll({ where: { settlementId: transaction.id }, raw: true })
      : [];

    const txnObj = typeof transaction.toJSON === 'function' ? transaction.toJSON() : transaction;
    txnObj.pid = txnObj.id;

    res.status(201).json({
      success: true,
      data: {
        transaction: txnObj,
        allocations: allocationLinks,
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
    next(error);
  }
};

/**
 * Get credit transactions for a station
 * GET /api/v1/stations/:stationId/credit-transactions
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const { creditorId, type, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const where = { stationId };
    
    if (creditorId) where.creditorId = creditorId;
    if (type) where.transactionType = type;
    if (startDate && endDate) {
      Object.assign(where, buildDateRangeWhere(startDate, endDate, 'transactionDate', 60));
    }
    
    const { offset, limit: parsedLimit } = getPaginationOptions(page, limit);
    
    const { count, rows: transactions } = await CreditTransaction.findAndCountAll({
      where,
      include: [
        { model: Creditor, as: 'creditor', attributes: ['id', 'name', 'businessName'] },
        { model: User, as: 'enteredByUser', attributes: ['id', 'name'] }
      ],
      order: [['transactionDate', 'DESC'], ['createdAt', 'DESC']],
      limit: parsedLimit,
      offset
    });
    
    const normalized = transactions.map(t => {
      const obj = typeof t.toJSON === 'function' ? t.toJSON() : t;
      return { ...obj, pid: obj.id };
    });

    const paginationData = formatPaginatedResponse(normalized, count, page, parsedLimit);
    
    res.json({
      success: true,
      data: paginationData.data,
      pagination: paginationData.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get credit summary for dashboard
 * GET /api/v1/stations/:stationId/credit-summary
 */
exports.getCreditSummary = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const creditors = await Creditor.findAll({
      where: { stationId, isActive: true },
      attributes: ['id', 'name', 'businessName', 'currentBalance', 'creditLimit', 'isFlagged'],
      order: [['currentBalance', 'DESC']]
    });
    
    const totalOutstanding = creditors.reduce((sum, c) => sum + parseFloat(c.currentBalance || 0), 0);
    const creditorsWithBalance = creditors.filter(c => parseFloat(c.currentBalance) > 0);
    const flaggedCreditors = creditors.filter(c => c.isFlagged);
    
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
    next(error);
  }
};

/**
 * Get aging report for a station
 * GET /api/v1/stations/:stationId/creditors/aging
 */
exports.getAgingReport = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const report = await Creditor.getAgingReport(stationId);
    
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

/**
 * Get overdue creditors
 * GET /api/v1/stations/:stationId/creditors/overdue
 */
exports.getOverdueCreditors = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
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
    next(error);
  }
};

/**
 * Flag a creditor
 * POST /api/v1/creditors/:id/flag
 */
exports.flagCreditor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;
    
    // Only owner/manager/super_admin can flag creditors
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Only owner or manager can flag creditors' });
    }
    
    const creditor = await Creditor.findByPk(id);
    if (!creditor) {
      return res.status(404).json({ success: false, error: `Creditor ${id} not found` });
    }
    
    await creditor.flag(reason || 'Credit issue');
    res.json({ success: true, data: creditor, message: 'Creditor flagged successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Unflag a creditor
 * POST /api/v1/creditors/:id/unflag
 */
exports.unflagCreditor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    // Only owner/manager/super_admin can unflag creditors
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Only owner or manager can unflag creditors' });
    }
    
    const creditor = await Creditor.findByPk(id);
    if (!creditor) {
      return res.status(404).json({ success: false, error: `Creditor ${id} not found` });
    }
    
    await creditor.unflag();
    res.json({ success: true, data: creditor, message: 'Creditor unflagged successfully' });
  } catch (error) {
    next(error);
  }
};
