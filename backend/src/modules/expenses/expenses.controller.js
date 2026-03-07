/**
 * Expenses Controller
 * HTTP handlers for Req #3: Expense CRUD, approval, and profitability integration
 */

const { expensesService, expenseCategoriesService } = require('./index');

exports.createExpense = async (req, res) => {
  try {
    const { stationId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const expense = await expensesService.createExpense(
      { ...req.body, stationId },
      userId,
      userRole
    );

    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

exports.listExpenses = async (req, res) => {
  try {
    const { stationId } = req.params;

    const expenses = await expensesService.listExpenses({
      stationId,
      ...req.query,
      limit: Math.min(req.query.limit || 50, 500),
      offset: req.query.offset || 0
    });

    res.json({
      success: true,
      data: { expenses }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

exports.getExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await expensesService.getExpenseWithDetails(id);

    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Req #3: Approve or reject an expense
 */
exports.approveExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Action must be "approve" or "reject"' }
      });
    }

    const expense = await expensesService.approveExpense(
      id,
      action,
      userId,
      userRole,
      reason
    );

    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Req #3: Get expense summary (daily or monthly breakdown)
 */
exports.getExpenseSummary = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { period = 'monthly', date, month } = req.query;

    if (!period || !['daily', 'monthly'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Period must be "daily" or "monthly"' }
      });
    }

    const dateOrMonth = period === 'daily' ? date : month;
    if (!dateOrMonth) {
      return res.status(400).json({
        success: false,
        error: { message: `${period === 'daily' ? 'date' : 'month'} is required` }
      });
    }

    const summary = await expensesService.getExpenseSummary(
      stationId,
      period,
      dateOrMonth
    );

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * List all expense categories with suggested frequencies
 */
exports.listCategories = async (req, res) => {
  try {
    const categories = expenseCategoriesService.getCategories();
    const frequencies = expenseCategoriesService.getFrequencies();

    res.json({
      success: true,
      data: {
        categories,
        frequencies
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

module.exports = exports;
