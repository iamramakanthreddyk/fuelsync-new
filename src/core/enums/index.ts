/**
 * Application Enums
 * 
 * Centralized enum definitions for type-safe constants.
 * All enums are exported with their corresponding type aliases.
 * 
 * @module core/enums
 */

// Central export for all enums and type aliases
// (This file already exports all enums and types directly)
// No further action needed unless you split enums into multiple files

// ============================================
// USER & AUTH ENUMS
// ============================================

/**
 * User roles with hierarchy levels
 */
export enum UserRoleEnum {
  SUPER_ADMIN = 'super_admin',
  OWNER = 'owner',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}

export type UserRole = `${UserRoleEnum}`;

/**
 * Role hierarchy levels (higher = more permissions)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  owner: 75,
  manager: 50,
  employee: 25,
};

// ============================================
// FUEL & STATION ENUMS
// ============================================

/**
 * Fuel types available at stations
 */
export enum FuelTypeEnum {
  PETROL = 'petrol',
  DIESEL = 'diesel',
  PREMIUM_PETROL = 'premium_petrol',
  PREMIUM_DIESEL = 'premium_diesel',
  CNG = 'cng',
  LPG = 'lpg',
}

export type FuelType = `${FuelTypeEnum}`;

/**
 * Equipment status (pumps, nozzles, tanks)
 */
export enum EquipmentStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}

export type EquipmentStatus = `${EquipmentStatusEnum}`;

/**
 * Tank status
 */
export enum TankStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  EMPTY = 'empty',
  LOW = 'low',
  CRITICAL = 'critical',
}

export type TankStatus = `${TankStatusEnum}`;

/**
 * Pump status
 */
export enum PumpStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  OFFLINE = 'offline',
}

export type PumpStatus = `${PumpStatusEnum}`;

/**
 * Oil company brands
 */
export enum OilCompanyEnum {
  INDIAN_OIL = 'indian_oil',
  BHARAT_PETROLEUM = 'bharat_petroleum',
  HINDUSTAN_PETROLEUM = 'hindustan_petroleum',
  RELIANCE = 'reliance',
  SHELL = 'shell',
  NAYARA = 'nayara',
  OTHER = 'other',
}

export type OilCompany = `${OilCompanyEnum}`;

// ============================================
// SHIFT ENUMS
// ============================================

/**
 * Shift types
 */
export enum ShiftTypeEnum {
  MORNING = 'morning',
  EVENING = 'evening',
  NIGHT = 'night',
  FULL_DAY = 'full_day',
  CUSTOM = 'custom',
}

export type ShiftType = `${ShiftTypeEnum}`;

/**
 * Shift status
 */
export enum ShiftStatusEnum {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export type ShiftStatus = `${ShiftStatusEnum}`;

// ============================================
// PAYMENT & FINANCIAL ENUMS
// ============================================

/**
 * Payment methods
 */
export enum PaymentMethodEnum {
  CASH = 'cash',
  UPI = 'upi',
  CARD = 'card',
  CREDIT = 'credit',
  FLEET_CARD = 'fleet_card',
  WALLET = 'wallet',
}

export type PaymentMethod = `${PaymentMethodEnum}`;

/**
 * Credit transaction status
 */
export enum CreditStatusEnum {
  PENDING = 'pending',
  PARTIAL = 'partial',
  SETTLED = 'settled',
  OVERDUE = 'overdue',
}

export type CreditStatus = `${CreditStatusEnum}`;

/**
 * Cash handover status
 */
export enum HandoverStatusEnum {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DISPUTED = 'disputed',
  RESOLVED = 'resolved',
}

export type HandoverStatus = `${HandoverStatusEnum}`;

/**
 * Transaction types
 */
export enum TransactionTypeEnum {
  SALE = 'sale',
  PAYMENT = 'payment',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
}

export type TransactionType = `${TransactionTypeEnum}`;

// ============================================
// EXPENSE ENUMS
// ============================================

/**
 * Expense categories
 */
export enum ExpenseCategoryEnum {
  SALARY = 'salary',
  ELECTRICITY = 'electricity',
  RENT = 'rent',
  MAINTENANCE = 'maintenance',
  SUPPLIES = 'supplies',
  TAXES = 'taxes',
  INSURANCE = 'insurance',
  TRANSPORTATION = 'transportation',
  FUEL_PURCHASE = 'fuel_purchase',
  MISCELLANEOUS = 'miscellaneous',
}

export type ExpenseCategory = `${ExpenseCategoryEnum}`;

/**
 * Recurring frequency
 */
export enum RecurringFrequencyEnum {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export type RecurringFrequency = `${RecurringFrequencyEnum}`;

// ============================================
// ALERT & NOTIFICATION ENUMS
// ============================================

/**
 * Alert severity levels
 */
export enum AlertSeverityEnum {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export type AlertSeverity = `${AlertSeverityEnum}`;

/**
 * Alert categories
 */
export enum AlertCategoryEnum {
  INVENTORY = 'inventory',
  FINANCE = 'finance',
  SHIFT = 'shift',
  EQUIPMENT = 'equipment',
  COMPLIANCE = 'compliance',
  SECURITY = 'security',
}

export type AlertCategory = `${AlertCategoryEnum}`;

/**
 * Notification types
 */
export enum NotificationTypeEnum {
  SYSTEM = 'system',
  ALERT = 'alert',
  REMINDER = 'reminder',
  MESSAGE = 'message',
}

export type NotificationType = `${NotificationTypeEnum}`;

// ============================================
// UI ENUMS
// ============================================

/**
 * Theme modes
 */
export enum ThemeModeEnum {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export type ThemeMode = `${ThemeModeEnum}`;

/**
 * Sort order
 */
export enum SortOrderEnum {
  ASC = 'asc',
  DESC = 'desc',
}

export type SortOrder = `${SortOrderEnum}`;

/**
 * Date range presets
 */
export enum DateRangePresetEnum {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom',
}

export type DateRangePreset = `${DateRangePresetEnum}`;
