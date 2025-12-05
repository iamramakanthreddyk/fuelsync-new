/**
 * API Constants
 * 
 * Centralized API endpoint definitions and configuration.
 * 
 * @module core/constants/api
 */

// ============================================
// API CONFIGURATION
// ============================================

/**
 * Base API URL
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

/**
 * API version
 */
export const API_VERSION = 'v1';

/**
 * Request timeout in milliseconds
 */
export const API_TIMEOUT = 30000;

/**
 * Default pagination limit
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Maximum pagination limit
 */
export const MAX_PAGE_SIZE = 100;

// ============================================
// AUTH ENDPOINTS
// ============================================

export const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  ME: '/auth/me',
  CHANGE_PASSWORD: '/auth/change-password',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
} as const;

// ============================================
// USER ENDPOINTS
// ============================================

export const USER_ENDPOINTS = {
  BASE: '/users',
  BY_ID: (id: string) => `/users/${id}`,
  PROFILE: '/users/profile',
  PREFERENCES: '/users/preferences',
} as const;

// ============================================
// STATION ENDPOINTS
// ============================================

export const STATION_ENDPOINTS = {
  BASE: '/stations',
  BY_ID: (id: string) => `/stations/${id}`,
  SETTINGS: (id: string) => `/stations/${id}/settings`,
  STATS: (id: string) => `/stations/${id}/stats`,
  PUMPS: (id: string) => `/stations/${id}/pumps`,
  TANKS: (id: string) => `/stations/${id}/tanks`,
  PRICES: (id: string) => `/stations/${id}/prices`,
  EMPLOYEES: (id: string) => `/stations/${id}/employees`,
} as const;

// ============================================
// PUMP ENDPOINTS
// ============================================

export const PUMP_ENDPOINTS = {
  BASE: '/pumps',
  BY_ID: (id: string) => `/pumps/${id}`,
  NOZZLES: (pumpId: string) => `/pumps/${pumpId}/nozzles`,
  NOZZLE_BY_ID: (pumpId: string, nozzleId: string) => `/pumps/${pumpId}/nozzles/${nozzleId}`,
  STATUS: (id: string) => `/pumps/${id}/status`,
} as const;

// ============================================
// TANK ENDPOINTS
// ============================================

export const TANK_ENDPOINTS = {
  BASE: '/tanks',
  BY_ID: (id: string) => `/tanks/${id}`,
  DIP_READINGS: (tankId: string) => `/tanks/${tankId}/dip-readings`,
  FUEL_RECEIPTS: (tankId: string) => `/tanks/${tankId}/receipts`,
} as const;

// ============================================
// READING ENDPOINTS
// ============================================

export const READING_ENDPOINTS = {
  BASE: '/readings',
  BY_ID: (id: string) => `/readings/${id}`,
  BY_NOZZLE: (nozzleId: string) => `/readings/nozzle/${nozzleId}`,
  BY_DATE: '/readings/by-date',
  LATEST: '/readings/latest',
  RECORD: '/readings/record',
} as const;

// ============================================
// SHIFT ENDPOINTS
// ============================================

export const SHIFT_ENDPOINTS = {
  BASE: '/shifts',
  BY_ID: (id: string) => `/shifts/${id}`,
  CURRENT: '/shifts/current',
  START: '/shifts/start',
  END: (id: string) => `/shifts/${id}/end`,
  HANDOVER: (id: string) => `/shifts/${id}/handover`,
  CONFIRM_HANDOVER: (id: string) => `/shifts/${id}/confirm-handover`,
} as const;

// ============================================
// DASHBOARD ENDPOINTS
// ============================================

export const DASHBOARD_ENDPOINTS = {
  SUMMARY: '/dashboard/summary',
  DAILY_TOTALS: '/dashboard/daily-totals',
  FUEL_BREAKDOWN: '/dashboard/fuel-breakdown',
  PUMP_PERFORMANCE: '/dashboard/pump-performance',
  FINANCIAL_OVERVIEW: '/dashboard/financial-overview',
  SALES_TREND: '/dashboard/sales-trend',
  ALERTS: '/dashboard/alerts',
} as const;

// ============================================
// FINANCIAL ENDPOINTS
// ============================================

export const FINANCIAL_ENDPOINTS = {
  // Creditors
  CREDITORS: '/creditors',
  CREDITOR_BY_ID: (id: string) => `/creditors/${id}`,
  CREDITOR_TRANSACTIONS: (id: string) => `/creditors/${id}/transactions`,
  CREDIT_SALE: '/creditors/credit-sale',
  CREDIT_PAYMENT: '/creditors/payment',

  // Expenses
  EXPENSES: '/expenses',
  EXPENSE_BY_ID: (id: string) => `/expenses/${id}`,
  EXPENSE_CATEGORIES: '/expenses/categories',
  EXPENSE_SUMMARY: '/expenses/summary',
} as const;

// ============================================
// REPORT ENDPOINTS
// ============================================

export const REPORT_ENDPOINTS = {
  DAILY_CLOSURE: '/reports/daily-closure',
  SALES: '/reports/sales',
  INVENTORY: '/reports/inventory',
  FINANCIAL: '/reports/financial',
  EMPLOYEE_PERFORMANCE: '/reports/employee-performance',
  EXPORT: '/reports/export',
} as const;

// ============================================
// COMBINED ENDPOINTS OBJECT
// ============================================

export const API_ENDPOINTS = {
  AUTH: AUTH_ENDPOINTS,
  USERS: USER_ENDPOINTS,
  STATIONS: STATION_ENDPOINTS,
  PUMPS: PUMP_ENDPOINTS,
  TANKS: TANK_ENDPOINTS,
  READINGS: READING_ENDPOINTS,
  SHIFTS: SHIFT_ENDPOINTS,
  DASHBOARD: DASHBOARD_ENDPOINTS,
  FINANCIAL: FINANCIAL_ENDPOINTS,
  REPORTS: REPORT_ENDPOINTS,
} as const;

// ============================================
// HTTP HEADERS
// ============================================

export const HTTP_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  ACCEPT: 'Accept',
  X_STATION_ID: 'X-Station-ID',
  X_REQUEST_ID: 'X-Request-ID',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  URL_ENCODED: 'application/x-www-form-urlencoded',
} as const;

// ============================================
// HTTP STATUS CODES
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================
// QUERY KEYS
// ============================================

/**
 * Query keys for React Query cache management
 */
export const QUERY_KEYS = {
  // Auth
  AUTH_USER: ['auth', 'user'],
  AUTH_SESSION: ['auth', 'session'],

  // Users
  USERS: ['users'],
  USER: (id: string) => ['users', id],

  // Stations
  STATIONS: ['stations'],
  STATION: (id: string) => ['stations', id],
  STATION_SETTINGS: (id: string) => ['stations', id, 'settings'],
  STATION_STATS: (id: string) => ['stations', id, 'stats'],

  // Pumps
  PUMPS: (stationId?: string) => ['pumps', stationId].filter(Boolean),
  PUMP: (id: string) => ['pumps', id],
  PUMP_NOZZLES: (pumpId: string) => ['pumps', pumpId, 'nozzles'],

  // Tanks
  TANKS: (stationId?: string) => ['tanks', stationId].filter(Boolean),
  TANK: (id: string) => ['tanks', id],
  DIP_READINGS: (tankId: string) => ['tanks', tankId, 'dip-readings'],

  // Readings
  READINGS: (filters?: Record<string, unknown>) => ['readings', filters],
  READING: (id: string) => ['readings', id],

  // Shifts
  SHIFTS: (filters?: Record<string, unknown>) => ['shifts', filters],
  SHIFT: (id: string) => ['shifts', id],
  CURRENT_SHIFT: ['shifts', 'current'],

  // Dashboard
  DASHBOARD_SUMMARY: ['dashboard', 'summary'],
  DASHBOARD_DAILY_TOTALS: ['dashboard', 'daily-totals'],
  DASHBOARD_FUEL_BREAKDOWN: ['dashboard', 'fuel-breakdown'],
  DASHBOARD_PUMP_PERFORMANCE: ['dashboard', 'pump-performance'],
  DASHBOARD_FINANCIAL: ['dashboard', 'financial'],

  // Financial
  CREDITORS: (filters?: Record<string, unknown>) => ['creditors', filters],
  CREDITOR: (id: string) => ['creditors', id],
  EXPENSES: (filters?: Record<string, unknown>) => ['expenses', filters],
  EXPENSE: (id: string) => ['expenses', id],

  // Reports
  REPORTS: ['reports'],
  DAILY_CLOSURE_REPORT: (date: string) => ['reports', 'daily-closure', date],
} as const;
