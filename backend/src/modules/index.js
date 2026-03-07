/**
 * Modules Index
 * Central export for all application modules
 */

const { readingsService } = require('./readings');
const { paymentMethodsService } = require('./payments');
const { expensesService, expenseCategoriesService } = require('./expenses');
const { profitabilityService } = require('./reports');

module.exports = {
  // Req #1: Readings with employee attribution
  readingsService,

  // Req #2: Payment methods with online subtypes
  paymentMethodsService,

  // Req #3: Expenses with approval workflow
  expensesService,
  expenseCategoriesService,

  // Req #3: Profitability with expense deduction
  profitabilityService
};
