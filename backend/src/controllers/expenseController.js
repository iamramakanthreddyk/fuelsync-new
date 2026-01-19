/**
 * Expense Controller
 * Handles expenses and cost of goods tracking
 * 
 * AUDIT LOGGING:
 * - CREATE: Expense creation is logged with category 'finance', severity 'info'
 * - UPDATE: Expense updates are logged with before/after values
 * - DELETE: Expense deletion is logged with severity 'warning'
 * 
 * All CREATE/UPDATE/DELETE operations are tracked via logAudit() from utils/auditLog
 */

const { Expense, CostOfGoods, NozzleReading, CreditTransaction, Station } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, FUEL_TYPES } = require('../config/constants');
const { logAudit } = require('../utils/auditLog');

/**
 * Get expense categories (for dropdown)
 */
const getCategories = async (req, res) => {
  try {
    res.json({
      success: true,
      data: Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({
        value,
        label
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch categories' } });
  }
};

/**
 * Get expenses for a station
 */
const getExpenses = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate, category, month, page = 1, limit = 50 } = req.query;
    
    const where = { stationId };
    
    if (category) where.category = category;
    if (month) where.expenseMonth = month;
    if (startDate && endDate) {
      where.expenseDate = { [Op.between]: [startDate, endDate] };
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: expenses } = await Expense.findAndCountAll({
      where,
      order: [['expenseDate', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    // Get total for the query
    const total = await Expense.sum('amount', { where });
    
    res.json({
      success: true,
      data: expenses,
      summary: { total: total || 0 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch expenses' } });
  }
};

/**
 * Create expense
 */
const createExpense = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { category, description, amount, expenseDate, receiptNumber, paymentMethod, notes } = req.body;
    
    // Validate category
    if (!Object.values(EXPENSE_CATEGORIES).includes(category)) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid category. Valid: ${Object.values(EXPENSE_CATEGORIES).join(', ')}` }
      });
    }
    
    const expense = await Expense.create({
      stationId,
      category,
      description,
      amount,
      expenseDate: expenseDate || new Date().toISOString().split('T')[0],
      receiptNumber,
      paymentMethod,
      notes,
      enteredBy: req.user.id
    });

    // Log expense creation
    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
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
    
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to create expense' } });
  }
};

/**
 * Update expense
 */
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const expense = await Expense.findByPk(id);
    if (!expense) {
      return res.status(404).json({ success: false, error: { message: 'Expense not found' } });
    }
    
    const oldValues = expense.toJSON();
    const allowedUpdates = ['category', 'description', 'amount', 'expenseDate', 'receiptNumber', 'paymentMethod', 'notes'];
    const newValues = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        expense[field] = updates[field];
        newValues[field] = updates[field];
      }
    });
    
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

    res.json({ success: true, data: expense });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update expense' } });
  }
};

/**
 * Delete expense
 */
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    
    const expense = await Expense.findByPk(id);
    if (!expense) {
      return res.status(404).json({ success: false, error: { message: 'Expense not found' } });
    }

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

    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to delete expense' } });
  }
};

/**
 * Get expense summary by category for a month
 */
const getExpenseSummary = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { month } = req.query;
    
    // Default to current month
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    
    const byCategory = await Expense.findAll({
      attributes: [
        'category',
        [fn('SUM', col('amount')), 'total'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: { stationId, expenseMonth: targetMonth },
      group: ['category'],
      order: [[literal('total'), 'DESC']]
    });
    
    const total = byCategory.reduce((sum, item) => sum + parseFloat(item.dataValues.total || 0), 0);
    
    res.json({
      success: true,
      data: {
        month: targetMonth,
        total,
        byCategory: byCategory.map(item => ({
          category: item.category,
          label: EXPENSE_CATEGORY_LABELS[item.category] || item.category,
          total: parseFloat(item.dataValues.total),
          count: parseInt(item.dataValues.count)
        }))
      }
    });
  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch expense summary' } });
  }
};

/**
 * Get/Set cost of goods for a month
 */
const getCostOfGoods = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { month } = req.query;
    
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    
    const costs = await CostOfGoods.findAll({
      where: { stationId, month: targetMonth },
      order: [['fuelType', 'ASC']]
    });
    
    const total = costs.reduce((sum, item) => sum + parseFloat(item.totalCost || 0), 0);
    
    res.json({
      success: true,
      data: {
        month: targetMonth,
        total,
        byFuelType: costs
      }
    });
  } catch (error) {
    console.error('Get cost of goods error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch cost of goods' } });
  }
};

/**
 * Set cost of goods for a month/fuel type
 */
const setCostOfGoods = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { month, fuelType, litresPurchased, totalCost, supplierName, invoiceNumbers, notes } = req.body;
    
    // Validate fuel type
    if (!Object.values(FUEL_TYPES).includes(fuelType)) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid fuel type. Valid: ${Object.values(FUEL_TYPES).join(', ')}` }
      });
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
    
    res.status(created ? 201 : 200).json({ success: true, data: costOfGoods });
  } catch (error) {
    console.error('Set cost of goods error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to set cost of goods' } });
  }
};

/**
 * Get profit/loss statement for a month
 */
const getProfitLoss = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { month } = req.query;
    
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
    
    // Get expenses
    const expensesResult = await Expense.sum('amount', {
      where: { stationId, expenseMonth: targetMonth }
    });
    const expenses = expensesResult || 0;
    
    // Get expenses by category
    const expensesByCategory = await Expense.findAll({
      attributes: ['category', [fn('SUM', col('amount')), 'total']],
      where: { stationId, expenseMonth: targetMonth },
      group: ['category']
    });
    
    // Calculate profit/loss
    const grossProfit = sales.totalSales - costOfGoods;
    const netProfit = grossProfit - expenses;
    const profitMargin = sales.totalSales > 0 ? ((netProfit / sales.totalSales) * 100).toFixed(2) : 0;
    
    res.json({
      success: true,
      data: {
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
      }
    });
  } catch (error) {
    console.error('Get profit/loss error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to calculate profit/loss' } });
  }
};

module.exports = {
  getCategories,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  getCostOfGoods,
  setCostOfGoods,
  getProfitLoss
};
