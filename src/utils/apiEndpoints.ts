/**
 * API Endpoints - Centralized configuration
 * Single source of truth for all API URLs
 */

// Station endpoints
export const STATION_ENDPOINTS = {
  list: '/api/stations',
  create: '/api/stations',
  get: (id: string) => `/api/stations/${id}`,
  update: (id: string) => `/api/stations/${id}`,
  delete: (id: string) => `/api/stations/${id}`,
  summary: '/api/stations/summary',
} as const;

// Nozzle endpoints
export const NOZZLE_ENDPOINTS = {
  list: '/api/nozzles',
  create: '/api/nozzles',
  get: (id: string) => `/api/nozzles/${id}`,
  update: (id: string) => `/api/nozzles/${id}`,
  delete: (id: string) => `/api/nozzles/${id}`,
  byStation: (stationId: string) => `/api/stations/${stationId}/nozzles`,
} as const;

// Pump endpoints
export const PUMP_ENDPOINTS = {
  list: '/api/pumps',
  create: '/api/pumps',
  get: (id: string) => `/api/pumps/${id}`,
  update: (id: string) => `/api/pumps/${id}`,
  delete: (id: string) => `/api/pumps/${id}`,
  byStation: (stationId: string) => `/api/stations/${stationId}/pumps`,
} as const;

// Product endpoints
export const PRODUCT_ENDPOINTS = {
  list: '/api/products',
  create: '/api/products',
  get: (id: string) => `/api/products/${id}`,
  update: (id: string) => `/api/products/${id}`,
  delete: (id: string) => `/api/products/${id}`,
  bulkUpdate: '/api/products/bulk/update',
} as const;

// Transaction endpoints
export const TRANSACTION_ENDPOINTS = {
  list: '/api/transactions',
  create: '/api/transactions',
  get: (id: string) => `/api/transactions/${id}`,
  update: (id: string) => `/api/transactions/${id}`,
  delete: (id: string) => `/api/transactions/${id}`,
  reconcile: (id: string) => `/api/transactions/${id}/reconcile`,
  byStation: (stationId: string) => `/api/stations/${stationId}/transactions`,
} as const;

// Report endpoints
export const REPORT_ENDPOINTS = {
  profitReport: '/api/reports/profit',
  expenseReport: '/api/reports/expense',
  cashReconciliation: '/api/reports/cash-reconciliation',
  inventorySummary: '/api/reports/inventory-summary',
  salesSummary: '/api/reports/sales-summary',
  fuelAudit: '/api/reports/fuel-audit',
} as const;

// Dashboard endpoints
export const DASHBOARD_ENDPOINTS = {
  summary: '/api/dashboard/summary',
  metrics: '/api/dashboard/metrics',
  alerts: '/api/dashboard/alerts',
  overview: '/api/dashboard/overview',
} as const;

// Expense endpoints
export const EXPENSE_ENDPOINTS = {
  list: '/api/expenses',
  create: '/api/expenses',
  get: (id: string) => `/api/expenses/${id}`,
  update: (id: string) => `/api/expenses/${id}`,
  delete: (id: string) => `/api/expenses/${id}`,
  approve: (id: string) => `/api/expenses/${id}/approve`,
  reject: (id: string) => `/api/expenses/${id}/reject`,
  byStation: (stationId: string) => `/api/stations/${stationId}/expenses`,
} as const;

// User endpoints
export const USER_ENDPOINTS = {
  list: '/api/users',
  create: '/api/users',
  get: (id: string) => `/api/users/${id}`,
  update: (id: string) => `/api/users/${id}`,
  delete: (id: string) => `/api/users/${id}`,
  profile: '/api/users/profile',
  changePassword: '/api/users/change-password',
} as const;

// Role endpoints
export const ROLE_ENDPOINTS = {
  list: '/api/roles',
  create: '/api/roles',
  get: (id: string) => `/api/roles/${id}`,
  update: (id: string) => `/api/roles/${id}`,
  delete: (id: string) => `/api/roles/${id}`,
} as const;

// Auth endpoints
export const AUTH_ENDPOINTS = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  register: '/api/auth/register',
  refresh: '/api/auth/refresh',
  verifyOtp: '/api/auth/verify-otp',
  resendOtp: '/api/auth/resend-otp',
} as const;

// Organization endpoints
export const ORGANIZATION_ENDPOINTS = {
  list: '/api/organizations',
  get: (id: string) => `/api/organizations/${id}`,
  update: (id: string) => `/api/organizations/${id}`,
  settings: '/api/organizations/settings',
} as const;

/**
 * Get all endpoints - useful for generating cache keys
 */
export const getAllEndpoints = () => ({
  ...STATION_ENDPOINTS,
  ...NOZZLE_ENDPOINTS,
  ...PUMP_ENDPOINTS,
  ...PRODUCT_ENDPOINTS,
  ...TRANSACTION_ENDPOINTS,
  ...REPORT_ENDPOINTS,
  ...DASHBOARD_ENDPOINTS,
  ...EXPENSE_ENDPOINTS,
  ...USER_ENDPOINTS,
  ...ROLE_ENDPOINTS,
  ...AUTH_ENDPOINTS,
  ...ORGANIZATION_ENDPOINTS,
});
