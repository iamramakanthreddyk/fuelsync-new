/**
 * Expenses Service
 * Req #3: CRUD operations, approval workflow, and expense summaries
 * Handles expense tracking with approval status and frequency-based grouping
 */

const { Expense, User, Op, fn, col } = require('../../models');
const { logAudit } = require('../../utils/auditLog');
const expenseCategoriesService = require('./expense-categories.service');

class ExpensesService {
  /**
   * Create a new expense (initially pending if entered by employee, auto-approved if by manager/owner)
   */
  async createExpense(data, userId, userRole) {
    const {
      stationId,
      category,
      description,
      amount,
      expenseDate,
      paymentMethod,
      frequency = 'one_time',
      receiptNumber,
      tags,
      notes
    } = data;

    // Validate category
    if (!expenseCategoriesService.isValidCategory(category)) {
      throw new Error(`Invalid expense category: ${category}`);
    }

    // Calculate expenseMonth from date
    const [year, month] = expenseDate.split('-').slice(0, 2);
    const expenseMonth = `${year}-${month}`;

    // Determine approval status based on user role
    const approvalStatus = ['manager', 'owner', 'super_admin'].includes(userRole)
      ? 'auto_approved'
      : 'pending';

    const expense = await Expense.create({
      stationId,
      category,
      description,
      amount,
      expenseDate,
      expenseMonth,
      paymentMethod,
      frequency,
      receiptNumber,
      tags: tags || null,
      notes,
      createdBy: userId,
      enteredBy: userId,
      approvalStatus,
      approvedBy: approvalStatus === 'auto_approved' ? userId : null,
      approvedAt: approvalStatus === 'auto_approved' ? new Date() : null
    });

    // Log audit
    await logAudit({
      userId,
      userEmail: 'system', // populate from user lookup if needed
      userRole,
      stationId,
      action: 'CREATE',
      entityType: 'Expense',
      entityId: expense.id,
      category: 'expenses',
      severity: 'info',
      description: `Created expense: ${category} - ₹${amount} (Status: ${approvalStatus})`
    });

    return this.getExpenseWithDetails(expense.id);
  }

  /**
   * Get expense with full details including user info
   */
  async getExpenseWithDetails(expenseId) {
    const expense = await Expense.findByPk(expenseId, {
      include: [
        { model: User, as: 'EnteredByUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'ApprovedByUser', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!expense) {
      throw new Error('Expense not found');
    }

    return {
      ...expense.toJSON(),
      categoryLabel: expenseCategoriesService.getLabel(expense.category)
    };
  }

  /**
   * List expenses with filtering
   */
  async listExpenses(filter) {
    const {
      stationId,
      startDate,
      endDate,
      month,
      approvalStatus,
      category,
      frequency,
      limit = 50,
      offset = 0
    } = filter;

    const where = { stationId };

    // Date range filtering
    if (month) {
      where.expenseMonth = month;
    } else if (startDate && endDate) {
      where.expenseDate = { [Op.between]: [startDate, endDate] };
    }

    // Status filtering
    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
    }

    // Category filtering
    if (category) {
      where.category = category;
    }

    // Frequency filtering
    if (frequency) {
      where.frequency = frequency;
    }

    const expenses = await Expense.findAll({
      where,
      include: [
        { model: User, as: 'EnteredByUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'ApprovedByUser', attributes: ['id', 'name', 'email'] }
      ],
      order: [['expenseDate', 'DESC']],
      limit,
      offset
    });

    return expenses.map(e => ({
      ...e.toJSON(),
      categoryLabel: expenseCategoriesService.getLabel(e.category)
    }));
  }

  /**
   * Approve or reject an expense (manager/owner only)
   */
  async approveExpense(expenseId, action, userId, userRole, reason = null) {
    if (!['manager', 'owner', 'super_admin'].includes(userRole)) {
      throw new Error('Only managers and owners can approve expenses');
    }

    const expense = await Expense.findByPk(expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }

    if (expense.approvalStatus !== 'pending') {
      throw new Error(`Cannot ${action} - expense is already ${expense.approvalStatus}`);
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await expense.update({
      approvalStatus: newStatus,
      approvedBy: userId,
      approvedAt: new Date(),
      notes: reason ? `${expense.notes || ''}\nReason: ${reason}` : expense.notes
    });

    // Log audit
    await logAudit({
      userId,
      userEmail: 'system',
      userRole,
      stationId: expense.stationId,
      action: action === 'approve' ? 'APPROVE' : 'REJECT',
      entityType: 'Expense',
      entityId: expense.id,
      category: 'expenses',
      severity: 'info',
      description: `${action === 'approve' ? 'Approved' : 'Rejected'} expense: ${expense.category} - ₹${expense.amount}`
    });

    return this.getExpenseWithDetails(expenseId);
  }

  /**
   * Get expense summary (Req #3: daily or monthly breakdown)
   */
  async getExpenseSummary(stationId, period, dateOrMonth) {
    const where = { stationId, approvalStatus: { [Op.in]: ['approved', 'auto_approved'] } };

    if (period === 'daily') {
      where.expenseDate = dateOrMonth;
    } else if (period === 'monthly') {
      where.expenseMonth = dateOrMonth;
    }

    // Get approved total
    const approvedTotal = await Expense.sum('amount', { where }) || 0;

    // Get pending total (for insight, not included in calculations)
    const pendingWhere = { ...where, approvalStatus: 'pending' };
    delete pendingWhere.approvalStatus;
    pendingWhere.approvalStatus = 'pending';
    const pendingQuery = {
      stationId,
      expenseDate: period === 'daily' ? dateOrMonth : undefined,
      expenseMonth: period === 'monthly' ? dateOrMonth : undefined,
      approvalStatus: 'pending'
    };
    const pendingTotal = await Expense.sum('amount', {
      where: pendingQuery
    }) || 0;

    const pendingCount = await Expense.count({ where: pendingQuery });

    // Group by category
    const byCategory = await Expense.findAll({
      attributes: [
        'category',
        [fn('SUM', col('amount')), 'total'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: { ...where },
      group: ['category'],
      raw: true
    });

    // Group by frequency
    const byFrequency = await Expense.findAll({
      attributes: [
        'frequency',
        [fn('SUM', col('amount')), 'total'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: { ...where },
      group: ['frequency'],
      raw: true
    });

    return {
      stationId,
      period,
      date: period === 'daily' ? dateOrMonth : undefined,
      month: period === 'monthly' ? dateOrMonth : undefined,
      approvedTotal: parseFloat((approvedTotal || 0).toFixed(2)),
      pendingTotal: parseFloat((pendingTotal || 0).toFixed(2)),
      pendingCount,
      byCategory: byCategory.map(c => ({
        category: c.category,
        label: expenseCategoriesService.getLabel(c.category),
        total: parseFloat(c.total || 0),
        count: c.count
      })),
      byFrequency: byFrequency.map(f => ({
        frequency: f.frequency,
        total: parseFloat(f.total || 0),
        count: f.count
      }))
    };
  }

  /**
   * Get total approved expenses for profit calculation
   */
  async getTotalApprovedExpenses(stationId, startDate, endDate) {
    return Expense.sum('amount', {
      where: {
        stationId,
        expenseDate: { [Op.between]: [startDate, endDate] },
        approvalStatus: { [Op.in]: ['approved', 'auto_approved'] }
      }
    }) || 0;
  }

  /**
   * Get pending expenses count for transparency on profit reports
   */
  async getPendingExpenses(stationId, startDate, endDate) {
    return Expense.sum('amount', {
      where: {
        stationId,
        expenseDate: { [Op.between]: [startDate, endDate] },
        approvalStatus: 'pending'
      }
    }) || 0;
  }
}

module.exports = new ExpensesService();
