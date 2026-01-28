/**
 * Application Constants
 * 
 * Centralized application-wide constants and configuration values.
 * 
 * @module core/constants/app
 */

// ============================================
// APPLICATION INFO
// ============================================

export const APP_NAME = 'FuelSync Hub';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Fuel Station Management System';

// ============================================
// STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
  // Auth
  AUTH_TOKEN: 'fuelsync_auth_token',
  REFRESH_TOKEN: 'fuelsync_refresh_token',
  USER: 'fuelsync_user',
  
  // Station
  SELECTED_STATION: 'fuelsync_selected_station',
  
  // Preferences
  THEME: 'fuelsync_theme',
  LANGUAGE: 'fuelsync_language',
  SIDEBAR_COLLAPSED: 'fuelsync_sidebar_collapsed',
  
  // Cache
  LAST_SYNC: 'fuelsync_last_sync',
  OFFLINE_QUEUE: 'fuelsync_offline_queue',
} as const;

// ============================================
// ROUTE PATHS
// ============================================

export const ROUTES = {
  // Public
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  
  // Dashboard
  DASHBOARD: '/dashboard',
  EMPLOYEE_DASHBOARD: '/employee-dashboard',
  
  // Operations
  READINGS: '/readings',
  RECORD_READING: '/readings/record',
  SHIFTS: '/shifts',
  SETTLEMENTS: '/settlements',
  
  // Station Management
  STATION: '/station',
  PUMPS: '/pumps',
  TANKS: '/tanks',
  PRICES: '/prices',
  
  // Financial
  CREDITORS: '/creditors',
  EXPENSES: '/expenses',
  FINANCIAL: '/financial',
  
  // Reports (now under analytics)
  REPORTS: '/analytics',
  SALES_REPORT: '/analytics/sales',
  INVENTORY_REPORT: '/analytics/inventory',
  
  // Settings
  SETTINGS: '/settings',
  PROFILE: '/profile',
  EMPLOYEES: '/employees',
  
  // Setup
  SETUP: '/setup',
  SETUP_STATION: '/setup/station',
  SETUP_PUMPS: '/setup/pumps',
  SETUP_TANKS: '/setup/tanks',
  SETUP_EMPLOYEES: '/setup/employees',
} as const;

// ============================================
// DATE & TIME FORMATS
// ============================================

export const DATE_FORMATS = {
  // Display formats
  DISPLAY_DATE: 'dd MMM yyyy',
  DISPLAY_DATE_SHORT: 'dd/MM/yyyy',
  DISPLAY_TIME: 'hh:mm a',
  DISPLAY_TIME_24: 'HH:mm',
  DISPLAY_DATETIME: 'dd MMM yyyy, hh:mm a',
  DISPLAY_DATETIME_SHORT: 'dd/MM/yyyy HH:mm',
  
  // API formats
  API_DATE: 'yyyy-MM-dd',
  API_DATETIME: "yyyy-MM-dd'T'HH:mm:ss",
  API_DATETIME_TZ: "yyyy-MM-dd'T'HH:mm:ssXXX",
  
  // Relative
  RELATIVE: 'relative',
} as const;

export const TIME_ZONES = {
  IST: 'Asia/Kolkata',
  UTC: 'UTC',
} as const;

// ============================================
// NUMBER & CURRENCY FORMATS
// ============================================

export const CURRENCY = {
  CODE: 'INR',
  SYMBOL: '₹',
  LOCALE: 'en-IN',
  DECIMALS: 2,
} as const;

export const NUMBER_FORMATS = {
  VOLUME_DECIMALS: 2,
  PRICE_DECIMALS: 2,
  PERCENTAGE_DECIMALS: 1,
  QUANTITY_DECIMALS: 0,
} as const;

// ============================================
// VALIDATION RULES
// ============================================

export const VALIDATION = {
  // Password
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  
  // Name
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  
  // Phone
  PHONE_LENGTH: 10,
  PHONE_REGEX: /^[6-9]\d{9}$/,
  
  // Email
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // GST
  GST_REGEX: /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/,
  
  // PAN
  PAN_REGEX: /^[A-Z]{5}\d{4}[A-Z]{1}$/,
  
  // Vehicle Number
  VEHICLE_REGEX: /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/,
  
  // Amounts
  MIN_AMOUNT: 0,
  MAX_AMOUNT: 999999999,
  
  // Volumes
  MIN_VOLUME: 0,
  MAX_VOLUME: 999999,
} as const;

// ============================================
// UI CONSTANTS
// ============================================

export const UI = {
  // Sidebar
  SIDEBAR_WIDTH: 260,
  SIDEBAR_COLLAPSED_WIDTH: 64,
  
  // Header
  HEADER_HEIGHT: 64,
  
  // Toast
  TOAST_DURATION: 5000,
  TOAST_DURATION_ERROR: 8000,
  
  // Debounce
  SEARCH_DEBOUNCE_MS: 300,
  INPUT_DEBOUNCE_MS: 500,
  
  // Animation
  TRANSITION_DURATION: 200,
  
  // Tables
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  
  // Charts
  CHART_HEIGHT: 300,
  CHART_COLORS: [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
  ],
} as const;

// ============================================
// SHIFT CONFIGURATION
// ============================================

export const SHIFT_CONFIG = {
  MORNING: {
    startHour: 6,
    endHour: 14,
    label: 'Morning Shift',
  },
  EVENING: {
    startHour: 14,
    endHour: 22,
    label: 'Evening Shift',
  },
  NIGHT: {
    startHour: 22,
    endHour: 6,
    label: 'Night Shift',
  },
} as const;

// ============================================
// ALERT THRESHOLDS
// ============================================

export const THRESHOLDS = {
  // Tank levels (percentage)
  TANK_LOW: 25,
  TANK_CRITICAL: 10,
  
  // Credit
  CREDIT_WARNING_DAYS: 7,
  CREDIT_OVERDUE_DAYS: 30,
  
  // Variance
  VARIANCE_WARNING: 1,
  VARIANCE_CRITICAL: 2,
  
  // Cash
  CASH_VARIANCE_WARNING: 500,
  CASH_VARIANCE_CRITICAL: 2000,
} as const;

// ============================================
// FUEL CONFIGURATION - DEPRECATED
// ============================================

/**
 * @deprecated Use FUEL_TYPE_CONFIG from @/core/fuel/fuelConfig instead
 * This export is maintained for backward compatibility only.
 */
export { FUEL_CONFIG } from '@/core/fuel/fuelConfig';

// ============================================
// ERROR MESSAGES
// ============================================

export const ERROR_MESSAGES = {
  // Generic
  GENERIC: 'Something went wrong. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  TIMEOUT: 'Request timed out. Please try again.',
  
  // Auth
  INVALID_CREDENTIALS: 'Invalid email or password.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  
  // Validation
  REQUIRED_FIELD: 'This field is required.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_PHONE: 'Please enter a valid phone number.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  PASSWORDS_NOT_MATCH: 'Passwords do not match.',
  
  // Operations
  READING_ALREADY_EXISTS: 'A reading for this nozzle already exists today.',
  SHIFT_ALREADY_ACTIVE: 'You already have an active shift.',
  INSUFFICIENT_STOCK: 'Insufficient stock in tank.',
} as const;

// ============================================
// SUCCESS MESSAGES
// ============================================

export const SUCCESS_MESSAGES = {
  // Auth
  LOGIN_SUCCESS: 'Login successful.',
  LOGOUT_SUCCESS: 'You have been logged out.',
  PASSWORD_CHANGED: 'Password changed successfully.',
  
  // CRUD
  CREATED: 'Created successfully.',
  UPDATED: 'Updated successfully.',
  DELETED: 'Deleted successfully.',
  SAVED: 'Saved successfully.',
  
  // Operations
  READING_RECORDED: 'Reading recorded successfully.',
  SHIFT_STARTED: 'Shift started successfully.',
  SHIFT_ENDED: 'Shift ended successfully.',
  HANDOVER_CONFIRMED: 'Handover confirmed successfully.',
} as const;
