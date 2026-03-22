/**
 * Expense Controller
 * Handles expenses and cost of goods tracking
 * 
 * AUDIT LOGGING:
 * - CREATE: Expense creation is logged with category 'finance', severity 'info'
 * - UPDATE: Expense updates are logged with before/after values
 * - DELETE: Expense deletion is logged with severity 'warning'
 * - APPROVE/REJECT: Approval decisions are logged with severity 'info'/'warning'
 * 
 * All CREATE/UPDATE/DELETE/APPROVE operations are tracked via logAudit() from utils/auditLog
 */

// ===== MODELS & DATABASE =====
const { Expense, CostOfGoods, NozzleReading, CreditTransaction, Station, User } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

// ===== ERROR & RESPONSE HANDLING =====
const { asyncHandler, NotFoundError, AuthorizationError, ValidationError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/apiResponse');

// ===== MIDDLEWARE & CONFIG =====
const { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, EXPENSE_APPROVAL_STATUS, EXPENSE_CATEGORY_FREQUENCY_MAP, FUEL_TYPES } = require('../config/constants');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');
const { getPaginationOptions, formatPaginatedResponse } = require('../utils/paginationHelper');
const { buildDateRangeWhere } = require('../utils/dateRangeHelper');
const expenseCategorization = require('../services/expenseCategorization');

/**
 * Utility: Fix data inconsistencies in expenses
 * If approvedBy is set but approvalStatus is PENDING, correct it to AUTO_APPROVED
 * This handles legacy data created before auto-approval logic was added
 */
const fixExpenseDataConsistency = async (expense) => {
  if (expense && expense.approvedBy && expense.approvalStatus === EXPENSE_APPROVAL_STATUS.PENDING) {
    expense.approvalStatus = EXPENSE_APPROVAL_STATUS.AUTO_APPROVED;
    await expense.save();
  }
  return expense;
};

/**
 * Get expense categories (for dropdown) with frequency hints
 */
const getCategories = asyncHandler(async (req, res, next) => {
  const categories = Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
    // Req #3: suggest default frequency per category so UI can pre-fill
    suggestedFrequency: EXPENSE_CATEGORY_FREQUENCY_MAP[value] || 'one_time'
  }));

  return sendSuccess(res, categories);
});

/**
 * Get expenses for a station
 * Supports filtering by category, frequency, approvalStatus, date range, month
 */
const getExpenses = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { startDate, endDate, category, month, frequency, approvalStatus, page = 1, limit = 50 } = req.query;
  
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new NotFoundError('Station', stationId);
  }
  
  const where = { stationId };
  
  if (category) where.category = category;
  if (month) where.expenseMonth = month;
  if (frequency) where.frequency = frequency;
  if (approvalStatus) where.approvalStatus = approvalStatus;
  
  // Use date range helper for date filtering
  if (startDate && endDate) {
    Object.assign(where, buildDateRangeWhere(startDate, endDate, 'expenseDate', 30));
  }
  
  // Use pagination helper
  const { offset, limit: parsedLimit } = getPaginationOptions(page, limit);
  
  const { count, rows: expenses } = await Expense.findAndCountAll({
    where,
    include: [
      { model: User, as: 'enteredByUser', attributes: ['id', 'name', 'role'] },
      { model: User, as: 'approvedByUser', attributes: ['id', 'name', 'role'], required: false }
    ],
    order: [['expenseDate', 'DESC'], ['createdAt', 'DESC']],
    limit: parsedLimit,
    offset
  });
  
  // Fix any data inconsistencies where approvedBy is set but status is still pending
  for (const expense of expenses) {
    await fixExpenseDataConsistency(expense);
  }
  
  // Get total for the query (only approved/auto_approved for reporting)
  const approvedTotal = await Expense.sum('amount', {
    where: { ...where, approvalStatus: { [Op.in]: ['approved', 'auto_approved'] } }
  });
  const pendingTotal = await Expense.sum('amount', {
    where: { ...where, approvalStatus: 'pending' }
  });
  
  // Breakdown by frequency for the query
  const byFrequency = await Expense.findAll({
    attributes: ['frequency', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count']],
    where: { ...where, approvalStatus: { [Op.in]: ['approved', 'auto_approved'] } },
    group: ['frequency'],
    raw: true
  });

  // Breakdown by category for the query
  const byCategory = await Expense.findAll({
    attributes: ['category', [fn('SUM', col('amount')), 'total']],
    where: { ...where, approvalStatus: { [Op.in]: ['approved', 'auto_approved'] } },
    group: ['category'],
    raw: true
  });
  
  // Format response using pagination helper
  const paginationData = formatPaginatedResponse(expenses, count, page, parsedLimit);
  
  return sendSuccess(res, paginationData.data, 200, {
    pagination: paginationData.pagination,
    summary: {
      approvedTotal: approvedTotal || 0,
      pendingTotal: pendingTotal || 0,
      total: approvedTotal || 0,
      byFrequency,
      byCategory
    }
  });
});

/**
 * Create expense
 * Req #3: Accepts frequency and tags. Auto-sets approvalStatus based on role.
 */
const createExpense = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { category, description, amount, expenseDate, receiptNumber, paymentMethod, notes, frequency, tags } = req.body;
  
  // Validate station exists
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new NotFoundError('Station', stationId);
  }
  
  // Validate category
  if (!Object.values(EXPENSE_CATEGORIES).includes(category)) {
    return sendError(res, 'INVALID_CATEGORY', 
      `Invalid category. Valid: ${Object.values(EXPENSE_CATEGORIES).join(', ')}`, 400);
  }

  // Req #3: Auto-set approvalStatus based on role
  // Manager/Owner entries are auto-approved (they're accountable)
  // Employee entries need approval (prevents inflating expenses)
  const role = req.user?.role || 'employee';
  const approvalStatus = ['manager', 'owner', 'super_admin'].includes(role)
    ? EXPENSE_APPROVAL_STATUS.AUTO_APPROVED
    : EXPENSE_APPROVAL_STATUS.PENDING;

  const expense = await Expense.create({
    stationId,
    category,
    description,
    amount,
    expenseDate: expenseDate || new Date().toISOString().split('T')[0],
    receiptNumber,
    paymentMethod,
    notes,
    frequency: frequency || EXPENSE_CATEGORY_FREQUENCY_MAP[category] || 'one_time',
    tags: tags || null,
    createdBy: req.user.id,
    enteredBy: req.user.id,
    approvalStatus,
    // Auto-approve if manager/owner
    approvedBy: approvalStatus === EXPENSE_APPROVAL_STATUS.AUTO_APPROVED ? req.user.id : null,
    approvedAt: approvalStatus === EXPENSE_APPROVAL_STATUS.AUTO_APPROVED ? new Date() : null
  });

  // Get category suggestion if not already provided
  let categorySuggestion = null;
  try {
    categorySuggestion = await expenseCategorization.suggestCategory({
      description,
      amount,
      timestamp: new Date()
    });
    
    // Record correction if user provided category is different
    if (categorySuggestion.category !== category) {
      await expenseCategorization.recordCorrection({
        description,
        suggestedCategory: categorySuggestion.category,
        selectedCategory: category,
        timestamp: new Date()
      });
    }
  } catch (suggestionError) {
    console.warn('[WARN] Category suggestion failed:', suggestionError.message);
    // Don't block expense creation if suggestion fails
  }

  // Log expense creation
  const currentUser = await User.findByPk(req.user.id);
  await logAudit({
    userId: req.user.id,
    userEmail: currentUser?.email,
    userRole: currentUser?.role,
    stationId,
    action: 'CREATE',
    entityType: 'Expense',
    entityId: expense.id,
    newValues: {
      id: expense.id,
      category,
      description,
      amount
    },
    category: 'finance',
    severity: 'info',
    description: `Created expense: ${description} (₹${amount})`
  });
  
  return sendCreated(res, expense, {
    suggestion: categorySuggestion ? {
      category: categorySuggestion.category,
      confidence: categorySuggestion.confidence,
      keywords: categorySuggestion.keywords
    } : null
  });
});

/**
 * Update expense
 */
const updateExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;
  
  const expense = await Expense.findByPk(id);
  if (!expense) {
    throw new NotFoundError('Expense', id);
  }
  
  const oldValues = expense.toJSON();
  const allowedUpdates = ['category', 'description', 'amount', 'expenseDate', 'receiptNumber', 'paymentMethod', 'notes', 'frequency', 'tags'];
  const newValues = {};
  
  allowedUpdates.forEach(field => {
    if (updates[field] !== undefined) {
      expense[field] = updates[field];
      newValues[field] = updates[field];
    }
  });

  // If a pending expense is updated by manager/owner, auto-approve it
  if (['manager', 'owner', 'super_admin'].includes(req.user?.role) && expense.approvalStatus === 'pending') {
    expense.approvalStatus = EXPENSE_APPROVAL_STATUS.AUTO_APPROVED;
    expense.approvedBy = req.user.id;
    expense.approvedAt = new Date();
    newValues.approvalStatus = EXPENSE_APPROVAL_STATUS.AUTO_APPROVED;
  }
  
  await expense.save();

  // Log expense update
  await logAudit({
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    stationId: expense.stationId,
    action: 'UPDATE',
    entityType: 'Expense',
    entityId: expense.id,
    oldValues: oldValues,
    newValues: newValues,
    category: 'finance',
    severity: 'info',
    description: `Updated expense: ${expense.description}`
  });

  return sendSuccess(res, expense);
});

/**
 * Delete expense
 */
const deleteExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  
  const expense = await Expense.findByPk(id);
  if (!expense) {
    throw new NotFoundError('Expense', id);
  }

  // Fix any data inconsistencies
  await fixExpenseDataConsistency(expense);

  const stationId = expense.stationId;
  const expenseData = expense.toJSON();
  
  await expense.destroy();

  // Log expense deletion
  await logAudit({
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    stationId,
    action: 'DELETE',
    entityType: 'Expense',
    entityId: id,
    oldValues: expenseData,
    category: 'finance',
    severity: 'warning',
    description: `Deleted expense: ${expenseData.description}`
  });

  return sendSuccess(res, null, 200, {
    message: 'Expense deleted'
  });
});

/**
 * Approve or reject a pending expense
 * PATCH /expenses/:id/approve  (manager/owner/super_admin only)
 * Body: { action: 'approve' | 'reject', notes: string }
 */
const approveExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { action, notes } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return sendError(res, 'INVALID_ACTION', "action must be 'approve' or 'reject'", 400);
  }

  const expense = await Expense.findByPk(id, {
    include: [{ model: User, as: 'enteredByUser', attributes: ['id', 'name', 'email'] }]
  });
  if (!expense) {
    throw new NotFoundError('Expense', id);
  }

  // Fix any data inconsistencies first
  await fixExpenseDataConsistency(expense);

  if (expense.approvalStatus !== EXPENSE_APPROVAL_STATUS.PENDING) {
    return sendError(res, 'INVALID_STATUS', 
      `Expense is already ${expense.approvalStatus}`, 400);
  }

  const oldStatus = expense.approvalStatus;
  expense.approvalStatus = action === 'approve'
    ? EXPENSE_APPROVAL_STATUS.APPROVED
    : EXPENSE_APPROVAL_STATUS.REJECTED;
  expense.approvedBy = req.user.id;
  expense.approvedAt = new Date();
  if (notes) expense.notes = notes;

  await expense.save();

  await logAudit({
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    stationId: expense.stationId,
    action: action === 'approve' ? 'APPROVE' : 'REJECT',
    entityType: 'Expense',
    entityId: expense.id,
    oldValues: { approvalStatus: oldStatus },
    newValues: { approvalStatus: expense.approvalStatus, approvedBy: req.user.id },
    category: 'finance',
    severity: action === 'approve' ? 'info' : 'warning',
    description: `${action === 'approve' ? 'Approved' : 'Rejected'} expense: ${expense.description} (₹${expense.amount}) entered by ${expense.enteredByUser?.name}`
  });

  return sendSuccess(res, expense, 200, {
    message: `Expense ${action === 'approve' ? 'approved' : 'rejected'} successfully`
  });
});

/**
 * Get expense summary - daily and monthly breakdown
 * GET /stations/:stationId/expense-summary?date=YYYY-MM-DD&month=YYYY-MM
 * Req #3: Daily expenses + monthly fixed expenses + pending approvals
 */
const getExpenseSummary = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { date, month } = req.query;

  // Validate station
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new NotFoundError('Station', stationId);
  }

  // ---------- DAILY summary ----------
  if (date) {
    const approvedFilter = {
      stationId,
      expenseDate: date,
      approvalStatus: { [Op.in]: [EXPENSE_APPROVAL_STATUS.APPROVED, EXPENSE_APPROVAL_STATUS.AUTO_APPROVED] }
    };
    const pendingFilter = { stationId, expenseDate: date, approvalStatus: EXPENSE_APPROVAL_STATUS.PENDING };

    const [byCategory, pendingCount, pendingAmount] = await Promise.all([
      Expense.findAll({
        attributes: ['category', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count']],
        where: approvedFilter,
        group: ['category'],
        order: [[literal('"total"'), 'DESC']]
      }),
      Expense.count({ where: pendingFilter }),
      Expense.sum('amount', { where: pendingFilter })
    ]);

    const approvedTotal = byCategory.reduce((s, r) => s + parseFloat(r.dataValues.total || 0), 0);

    return sendSuccess(res, {
      mode: 'daily',
      date,
      approvedTotal,
      pendingCount,
      pendingAmount: pendingAmount || 0,
      byCategory: byCategory.map(r => ({
        category: r.category,
        label: EXPENSE_CATEGORY_LABELS[r.category] || r.category,
        total: parseFloat(r.dataValues.total),
        count: parseInt(r.dataValues.count, 10)
      }))
    });
  }

  // ---------- MONTHLY summary (default) ----------
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const approvedFilter = {
    stationId,
    expenseMonth: targetMonth,
    approvalStatus: { [Op.in]: [EXPENSE_APPROVAL_STATUS.APPROVED, EXPENSE_APPROVAL_STATUS.AUTO_APPROVED] }
  };

  const [byCategory, byFrequency, pendingCount, pendingAmount] = await Promise.all([
    Expense.findAll({
      attributes: ['category', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count']],
      where: approvedFilter,
      group: ['category'],
      order: [[literal('"total"'), 'DESC']]
    }),
    Expense.findAll({
      attributes: ['frequency', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count']],
      where: approvedFilter,
      group: ['frequency']
    }),
    Expense.count({ where: { stationId, expenseMonth: targetMonth, approvalStatus: EXPENSE_APPROVAL_STATUS.PENDING } }),
    Expense.sum('amount', { where: { stationId, expenseMonth: targetMonth, approvalStatus: EXPENSE_APPROVAL_STATUS.PENDING } })
  ]);

  const approvedTotal = byCategory.reduce((s, r) => s + parseFloat(r.dataValues.total || 0), 0);

  return sendSuccess(res, {
    mode: 'monthly',
    month: targetMonth,
    approvedTotal,
    pendingCount,
    pendingAmount: pendingAmount || 0,
    byCategory: byCategory.map(r => ({
      category: r.category,
      label: EXPENSE_CATEGORY_LABELS[r.category] || r.category,
      total: parseFloat(r.dataValues.total),
      count: parseInt(r.dataValues.count)
    })),
    byFrequency: byFrequency.map(r => ({
      frequency: r.frequency,
      total: parseFloat(r.dataValues.total),
      count: parseInt(r.dataValues.count)
    }))
  });
});

/**
 * Get cost of goods for a month
 */
const getCostOfGoods = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { month } = req.query;
  
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new NotFoundError('Station', stationId);
  }
  
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  
  const costs = await CostOfGoods.findAll({
    where: { stationId, month: targetMonth },
    order: [['fuelType', 'ASC']]
  });
  
  const total = costs.reduce((sum, item) => sum + parseFloat(item.totalCost || 0), 0);
  
  return sendSuccess(res, {
    month: targetMonth,
    total,
    byFuelType: costs
  });
});

/**
 * Set cost of goods for a month/fuel type
 */
const setCostOfGoods = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { month, fuelType, litresPurchased, totalCost, supplierName, invoiceNumbers, notes } = req.body;
  
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new NotFoundError('Station', stationId);
  }
  
  // Validate fuel type
  if (!Object.values(FUEL_TYPES).includes(fuelType)) {
    return sendError(res, 'INVALID_FUEL_TYPE', 
      `Invalid fuel type. Valid: ${Object.values(FUEL_TYPES).join(', ')}`, 400);
  }
  
  // Upsert - update if exists, create if not
  const [costOfGoods, created] = await CostOfGoods.upsert({
    stationId,
    month,
    fuelType,
    litresPurchased,
    totalCost,
    supplierName,
    invoiceNumbers: invoiceNumbers || [],
    notes,
    enteredBy: req.user.id
  }, {
    returning: true
  });
  
  // Log audit for creation
  if (created) {
    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      stationId,
      action: 'CREATE',
      entityType: 'CostOfGoods',
      entityId: costOfGoods.id,
      newValues: { fuelType, totalCost, litresPurchased },
      category: 'finance',
      severity: 'info',
      description: `Set cost of goods: ${fuelType} (₹${totalCost})`
    });
  }
  
  return sendCreated(res, costOfGoods);
});

/**
 * Get profit/loss statement for a month
 */
const getProfitLoss = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { month } = req.query;
  
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new NotFoundError('Station', stationId);
  }
  
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  
  // Parse month to get date range
  const [year, mon] = targetMonth.split('-');
  const startDate = `${year}-${mon}-01`;
  const endDate = new Date(year, mon, 0).toISOString().split('T')[0]; // Last day of month
  
  // Get total sales (from readings)
  const salesResult = await NozzleReading.findOne({
    attributes: [
      [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'totalSales'],
      [fn('SUM', col('litres_sold')), 'totalLitres'],
      [fn('SUM', col('cash_amount')), 'totalCash'],
      [fn('SUM', col('online_amount')), 'totalOnline'],
      [fn('SUM', col('credit_amount')), 'totalCredit']
    ],
    where: {
      stationId,
      readingDate: { [Op.between]: [startDate, endDate] },
      [Op.or]: [
        { isInitialReading: false },
        { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
      ]
    }
  });
  
  const sales = {
    totalSales: parseFloat(salesResult?.dataValues?.totalSales || 0),
    totalLitres: parseFloat(salesResult?.dataValues?.totalLitres || 0),
    totalCash: parseFloat(salesResult?.dataValues?.totalCash || 0),
    totalOnline: parseFloat(salesResult?.dataValues?.totalOnline || 0),
    totalCredit: parseFloat(salesResult?.dataValues?.totalCredit || 0)
  };
  
  // Get credit settlements
  const settlementsResult = await CreditTransaction.sum('amount', {
    where: {
      stationId,
      transactionType: 'settlement',
      transactionDate: { [Op.between]: [startDate, endDate] }
    }
  });
  const settlements = settlementsResult || 0;
  
  // Get cost of goods
  const costOfGoodsResult = await CostOfGoods.sum('totalCost', {
    where: { stationId, month: targetMonth }
  });
  const costOfGoods = costOfGoodsResult || 0;
  
  // Get expenses (only approved/auto_approved count toward financial statements)
  const expensesResult = await Expense.sum('amount', {
    where: {
      stationId,
      expenseMonth: targetMonth,
      approvalStatus: { [Op.in]: [EXPENSE_APPROVAL_STATUS.APPROVED, EXPENSE_APPROVAL_STATUS.AUTO_APPROVED] }
    }
  });
  const expenses = expensesResult || 0;
  
  // Get expenses by category (approved only)
  const expensesByCategory = await Expense.findAll({
    attributes: ['category', [fn('SUM', col('amount')), 'total']],
    where: {
      stationId,
      expenseMonth: targetMonth,
      approvalStatus: { [Op.in]: [EXPENSE_APPROVAL_STATUS.APPROVED, EXPENSE_APPROVAL_STATUS.AUTO_APPROVED] }
    },
    group: ['category']
  });
  
  // Calculate profit/loss
  const grossProfit = sales.totalSales - costOfGoods;
  const netProfit = grossProfit - expenses;
  const profitMargin = sales.totalSales > 0 ? ((netProfit / sales.totalSales) * 100).toFixed(2) : 0;
  
  return sendSuccess(res, {
    month: targetMonth,
    revenue: {
      sales: sales.totalSales,
      settlements,  // Money received from credit customers
      totalRevenue: sales.totalCash + sales.totalOnline + settlements
    },
    salesBreakdown: {
      cash: sales.totalCash,
      online: sales.totalOnline,
      credit: sales.totalCredit,
      litresSold: sales.totalLitres
    },
    costs: {
      costOfGoods,
      expenses,
      totalCosts: costOfGoods + expenses
    },
    expensesByCategory: expensesByCategory.map(e => ({
      category: e.category,
      label: EXPENSE_CATEGORY_LABELS[e.category],
      amount: parseFloat(e.dataValues.total)
    })),
    profit: {
      grossProfit,
      netProfit,
      profitMargin: parseFloat(profitMargin)
    },
    notes: {
      costOfGoodsEntered: costOfGoods > 0,
      message: costOfGoods === 0 
        ? 'Cost of goods not entered. Enter purchase costs for accurate profit calculation.'
        : null
    }
  });
});

/**
 * Bulk approve pending expenses
 * PUT /stations/:stationId/expenses/bulk-approve
 * Body: { approvalMode: 'all' | 'safe'; skipExpenseIds?: string[] }
 * 
 * Req #3: Managers can bulk-approve pending expenses with two modes:
 * - 'all': Approve all pending expenses for the station (⚠️ Use with caution)
 * - 'safe': Approve only reasonable expenses (small amounts, common categories)
 */
const bulkApproveExpenses = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { approvalMode = 'safe', skipExpenseIds = [] } = req.body;

  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new NotFoundError('Station', stationId);
  }

  if (!['all', 'safe'].includes(approvalMode)) {
    return sendError(res, 'INVALID_MODE', "approvalMode must be 'all' or 'safe'", 400);
  }

  // Get all pending expenses for this station
  const pendingExpenses = await Expense.findAll({
    where: {
      stationId,
      approvalStatus: EXPENSE_APPROVAL_STATUS.PENDING,
      id: { [Op.notIn]: skipExpenseIds }
    },
    include: [{ model: User, as: 'enteredByUser', attributes: ['id', 'name', 'email'] }]
  });

  if (!pendingExpenses.length) {
    return sendSuccess(res, {
      approved: 0,
      skipped: 0,
      total: 0
    }, {
      message: 'No pending expenses to approve'
    });
  }

  let approved = [];
  let skipped = [];

  // Safe mode: Only approve low-risk expenses (amount < ₹10,000 + common categories)
  if (approvalMode === 'safe') {
    const SAFE_CATEGORIES = ['cleaning', 'supplies', 'maintenance'];
    const SAFE_LIMIT = 10000;

    for (const expense of pendingExpenses) {
      const isSafeAmount = expense.amount <= SAFE_LIMIT;
      const isSafeCategory = SAFE_CATEGORIES.includes(expense.category);

      if (isSafeAmount || isSafeCategory) {
        approved.push(expense);
      } else {
        skipped.push({
          id: expense.id,
          reason: `High-risk: ₹${expense.amount} (${expense.category})`,
          amount: expense.amount,
          category: expense.category
        });
      }
    }
  } else {
    // Approve all
    approved = pendingExpenses;
  }

  // UPDATE all approved expenses
  await Promise.all(approved.map(async (expense) => {
    expense.approvalStatus = EXPENSE_APPROVAL_STATUS.APPROVED;
    expense.approvedBy = req.user.id;
    expense.approvedAt = new Date();
    await expense.save();

    // Log approval
    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      stationId: expense.stationId,
      action: 'BULK_APPROVE',
      entityType: 'Expense',
      entityId: expense.id,
      newValues: { approvalStatus: EXPENSE_APPROVAL_STATUS.APPROVED, approvedBy: req.user.id },
      category: 'finance',
      severity: 'info',
      description: `Bulk approved: ${expense.description} (₹${expense.amount}) entered by ${expense.enteredByUser?.name}`
    });
  }));

  return sendSuccess(res, {
    approved: approved.length,
    skipped: skipped.length,
    total: pendingExpenses.length,
    approvalMode,
    skippedDetails: skipped
  }, {
    message: `Bulk approved ${approved.length} expense(s)${skipped.length > 0 ? `. ${skipped.length} skipped for manual review.` : ''}`
  });
});

module.exports = {
  getCategories,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  bulkApproveExpenses,
  getExpenseSummary,
  getCostOfGoods,
  setCostOfGoods,
  getProfitLoss
};
