/**
 * Expenses Module
 * Handles Req #3: Expense tracking, approval workflow, and summaries
 * Exports: ExpensesService, ExpenseCategoriesService
 */

const expensesService = require('./expenses.service');
const expenseCategoriesService = require('./expense-categories.service');

module.exports = {
  expensesService,
  expenseCategoriesService
};
