/**
 * Model Access Layer (Database Abstraction)
 * 
 * Centralizes all Sequelize model imports and database access
 * Enables easy testing, mocking, and future database swaps
 * Prevents scattered model imports throughout the codebase
 */

// Import all models
const {
  User,
  Station,
  Pump,
  Nozzle,
  NozzleReading,
  Shift,
  DailyTransaction,
  Settlement,
  Creditor,
  CreditTransaction,
  CostOfGoods,
  Expense,
  ExpenseCategory,
  FuelPrice,
  Plan,
  AuditLog,
  ActivityLog,
  TankRefill,
  Tank,
  sequelize,
  Op,
  fn,
  col,
  literal,
  DataTypes,
} = require('../models');

/**
 * Model registry - provides organized access to all models
 * Usage: const { User, Station } = require('./modelAccess').models;
 */
const models = {
  User,
  Station,
  Pump,
  Nozzle,
  NozzleReading,
  Shift,
  DailyTransaction,
  Settlement,
  Creditor,
  CreditTransaction,
  CostOfGoods,
  Expense,
  ExpenseCategory,
  FuelPrice,
  Plan,
  AuditLog,
  ActivityLog,
  TankRefill,
  Tank,
};

/**
 * Sequelize utilities - provides common Sequelize operations
 * Usage: const { sequelize, Op, fn, col } = require('./modelAccess');
 */
const sequelizeUtils = {
  sequelize,
  Op,
  fn,
  col,
  literal,
  DataTypes,
};

module.exports = {
  // Models organized by domain
  models: {
    // User management
    user: User,
    plan: Plan,

    // Station structure
    station: Station,
    pump: Pump,
    nozzle: Nozzle,
    tank: Tank,

    // Readings & Transactions
    nozzleReading: NozzleReading,
    dailyTransaction: DailyTransaction,
    fuelPrice: FuelPrice,

    // Financial
    settlement: Settlement,
    creditor: Creditor,
    creditTransaction: CreditTransaction,
    costOfGoods: CostOfGoods,

    // Operations
    shift: Shift,
    expense: Expense,
    expenseCategory: ExpenseCategory,
    tankRefill: TankRefill,

    // Audit & Logging
    auditLog: AuditLog,
    activityLog: ActivityLog,
  },

  // Flat access (backwards compatibility)
  ...models,

  // Sequelize utilities
  sequelize,
  Op,
  fn,
  col,
  literal,
  Sequelize: sequelizeUtils,
};
