/**
 * Dashboard Constants & Configuration
 * Centralized magic values and thresholds
 */

module.exports = {
  // Variance analysis thresholds (in percentages)
  VARIANCE_THRESHOLDS: {
    CRITICAL: 3,    // > 3% requires investigation
    WARNING: 1,     // 1-3% is warning level
    OK: 0           // < 1% is OK
  },

  // Variance status labels
  VARIANCE_STATUS: {
    OK: 'OK',
    WARNING: 'WARNING',
    INVESTIGATE: 'INVESTIGATE'
  },

  // Default time ranges
  DEFAULTS: {
    DAYS_FOR_PREVIOUS_PERIOD: 'periodDays', // Will be calculated dynamically
    TOP_STATIONS_LIMIT: 5,
    TOP_EMPLOYEES_LIMIT: 10,
    DATA_RETENTION_DAYS: 365
  },

  // Aging buckets for credit receivables
  AGING_BUCKETS: {
    CURRENT: 'Current',
    OVERDUE_0_30: '0-30 days overdue',
    OVERDUE_30_60: '30-60 days overdue',
    OVERDUE_60_PLUS: '60+ days overdue'
  },

  // Role hierarchy (mirror backend)
  ROLE_HIERARCHY: {
    SUPER_ADMIN: 'super_admin',
    OWNER: 'owner',
    MANAGER: 'manager',
    EMPLOYEE: 'employee'
  },

  // Accessible roles for employees
  EMPLOYEE_ACCESSIBLE_ROLES: ['manager', 'employee'],

  // Credit transaction types
  TRANSACTION_TYPES: {
    CREDIT: 'credit',
    SETTLEMENT: 'settlement'
  },

  // Shift statuses
  SHIFT_STATUSES: {
    ACTIVE: 'active',
    ENDED: 'ended'
  },

  // Response templates
  EMPTY_RESPONSES: {
    DASHBOARD_SUMMARY: {
      today: { litres: 0, amount: 0, cash: 0, online: 0, credit: 0, readings: 0 },
      pumps: []
    },
    NOZZLE_BREAKDOWN: { nozzles: [] },
    DAILY_SUMMARY: [],
    FUEL_BREAKDOWN: { breakdown: [] },
    PUMP_PERFORMANCE: { pumps: [] },
    FINANCIAL_OVERVIEW: { noData: true }
  }
};
