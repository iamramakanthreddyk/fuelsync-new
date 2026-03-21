/**
 * Service Layer Consolidation Index
 * Central exports for all business logic services
 * Organized by domain
 */

// ===== READING DOMAIN =====
const readingCreationService = require('./readingCreationService');
const readingCalculationService = require('./readingCalculationService');
const readingValidationService = require('./readingValidationService');
const readingValidationEnhancedService = require('./readingValidationEnhancedService');
const readingCacheService = require('./readingCacheService');

// ===== TRANSACTION DOMAIN =====
const paymentBreakdownService = require('./paymentBreakdownService');
const transactionValidationService = require('./transactionValidationService');
const transactionValidationEnhancedService = require('./transactionValidationEnhancedService');

// ===== FINANCIAL DOMAIN =====
const creditAllocationService = require('./creditAllocationService');
const costOfGoodsService = require('./costOfGoodsService');
const expenseCategorization = require('./expenseCategorization');

// ===== REPORTING DOMAIN =====
const dashboardService = require('./dashboardService');
const employeeSalesService = require('./employeeSalesService');
const employeeShortfallsService = require('./employeeShortfallsService');
const settlementVerificationService = require('./settlementVerificationService');

// ===== AGGREGATION DOMAIN =====
const aggregationService = require('./aggregationService');
const bulkOperationsService = require('./bulkOperations');

// Export organized by domain for cleaner imports
module.exports = {
  // Reading Services
  reading: {
    create: readingCreationService,
    calculate: readingCalculationService,
    validate: readingValidationService,
    validateEnhanced: readingValidationEnhancedService,
    cache: readingCacheService
  },

  // Transaction Services
  transaction: {
    paymentBreakdown: paymentBreakdownService,
    validate: transactionValidationService,
    validateEnhanced: transactionValidationEnhancedService
  },

  // Financial Services
  financial: {
    creditAllocation: creditAllocationService,
    costOfGoods: costOfGoodsService,
    expenseCategorization: expenseCategorization
  },

  // Reporting Services
  reporting: {
    dashboard: dashboardService,
    employeeSales: employeeSalesService,
    employeeShortfalls: employeeShortfallsService,
    settlementVerification: settlementVerificationService
  },

  // Aggregation Services
  aggregation: aggregationService,
  bulkOperations: bulkOperationsService,

  // Legacy direct access (for backwards compatibility)
  readingCreationService,
  readingCalculationService,
  paymentBreakdownService,
  creditAllocationService,
  dashboardService,
  employeeSalesService,
  employeeShortfallsService,
  settlementVerificationService,
  aggregationService,
  bulkOperationsService
};
