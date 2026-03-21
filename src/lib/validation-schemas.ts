/**
 * Centralized Validation Schemas for Frontend
 * Single source of truth for all form validations
 * Synced with backend validation in Joi
 */

import { z } from 'zod';

/**
 * Common schemas reused across forms
 */
export const commonSchemas = {
  id: z.string().uuid('Invalid ID format'),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^[+]?[\d\s\-()]{10,}$/, 'Invalid phone number format'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  positiveNumber: z.number().positive('Must be a positive number'),
  nonNegativeNumber: z.number().nonnegative('Must be non-negative'),
  fuelType: z.enum(['Petrol', 'Diesel', 'CNG', 'LPG'], { errorMap: () => ({ message: 'Invalid fuel type' }) }),
  userRole: z.enum(['owner', 'employee', 'manager', 'super_admin'], { errorMap: () => ({ message: 'Invalid user role' }) }),
  status: z.enum(['active', 'inactive', 'maintenance'], { errorMap: () => ({ message: 'Invalid status' }) }),
  paymentMethod: z.enum(['cash', 'digital', 'online', 'credit'], { errorMap: () => ({ message: 'Invalid payment method' }) }),
};

/**
 * Authentication Schemas
 */
export const authSchemas = {
  login: z.object({
    email: commonSchemas.email,
    password: z.string().min(1, 'Password is required'),
  }),

  register: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    email: commonSchemas.email,
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Must contain lowercase letter')
      .regex(/[A-Z]/, 'Must contain uppercase letter')
      .regex(/\d/, 'Must contain number'),
    phone: commonSchemas.phone.optional().or(z.literal('')),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Must contain lowercase letter')
      .regex(/[A-Z]/, 'Must contain uppercase letter')
      .regex(/\d/, 'Must contain number'),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),
};

/**
 * Station Schemas
 */
export const stationSchemas = {
  create: z.object({
    name: z.string().min(1, 'Station name is required').max(100, 'Name too long'),
    address: z.string().min(1, 'Address is required').max(500, 'Address too long'),
    phone: commonSchemas.phone.optional().or(z.literal('')),
    email: commonSchemas.email.optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
    licenseNumber: z.string().optional().or(z.literal('')),
  }),

  update: z.object({
    name: z.string().min(1).max(100).optional().or(z.literal('')),
    address: z.string().min(1).max(500).optional().or(z.literal('')),
    phone: commonSchemas.phone.optional().or(z.literal('')),
    email: commonSchemas.email.optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
    licenseNumber: z.string().optional().or(z.literal('')),
    status: commonSchemas.status.optional(),
  }),
};

/**
 * User Schemas
 */
export const userSchemas = {
  create: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    email: commonSchemas.email,
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Must contain lowercase letter')
      .regex(/[A-Z]/, 'Must contain uppercase letter')
      .regex(/\d/, 'Must contain number'),
    role: commonSchemas.userRole,
    phone: commonSchemas.phone.optional().or(z.literal('')),
  }),

  update: z.object({
    name: z.string().min(1).max(100).optional().or(z.literal('')),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional().or(z.literal('')),
    role: commonSchemas.userRole.optional(),
    isActive: z.boolean().optional(),
  }),
};

/**
 * Reading Schemas
 */
export const readingSchemas = {
  create: z.object({
    nozzleId: commonSchemas.id,
    stationId: commonSchemas.id.optional(),
    readingValue: commonSchemas.positiveNumber,
    readingDate: commonSchemas.date.optional(),
    previousReading: commonSchemas.nonNegativeNumber.optional(),
    litresSold: commonSchemas.nonNegativeNumber.optional(),
    pricePerLitre: commonSchemas.nonNegativeNumber.optional(),
    totalAmount: commonSchemas.nonNegativeNumber.optional(),
    paymentBreakdown: z.object({
      cash: commonSchemas.nonNegativeNumber.optional(),
      online: commonSchemas.nonNegativeNumber.optional(),
      credit: commonSchemas.nonNegativeNumber.optional(),
    }).optional(),
    creditorId: commonSchemas.id.optional(),
    paymentType: commonSchemas.paymentMethod.optional(),
    notes: z.string().max(500, 'Notes must be less than 500 characters').optional().or(z.literal('')),
  }),

  update: z.object({
    currentReading: commonSchemas.positiveNumber.optional(),
    notes: z.string().max(500).optional().or(z.literal('')),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
  }),

  query: z.object({
    stationId: commonSchemas.id.optional(),
    nozzleId: commonSchemas.id.optional(),
    dateFrom: commonSchemas.date.optional(),
    dateTo: commonSchemas.date.optional(),
    limit: z.number().min(1).max(1000).default(50),
    offset: z.number().nonnegative().default(0),
  }),
};

/**
 * Pump & Nozzle Schemas
 */
export const pumpSchemas = {
  create: z.object({
    stationId: commonSchemas.id,
    pumpNumber: commonSchemas.positiveNumber,
    name: z.string().max(100).optional().or(z.literal('')),
    isActive: z.boolean().default(true),
  }),

  update: z.object({
    name: z.string().max(100).optional().or(z.literal('')),
    isActive: z.boolean().optional(),
  }),
};

export const nozzleSchemas = {
  create: z.object({
    pumpId: commonSchemas.id,
    nozzleNumber: commonSchemas.positiveNumber,
    fuelType: commonSchemas.fuelType,
    isActive: z.boolean().default(true),
  }),

  update: z.object({
    fuelType: commonSchemas.fuelType.optional(),
    isActive: z.boolean().optional(),
  }),
};

/**
 * Fuel Price Schemas
 */
export const fuelPriceSchemas = {
  update: z.object({
    fuelType: commonSchemas.fuelType,
    price: commonSchemas.nonNegativeNumber,
    effectiveDate: commonSchemas.date.optional(),
  }),
};

/**
 * Expense Schemas
 */
export const expenseSchemas = {
  create: z.object({
    stationId: commonSchemas.id,
    category: z.string().min(1, 'Category is required'),
    amount: commonSchemas.positiveNumber,
    description: z.string().optional().or(z.literal('')),
    date: commonSchemas.date.optional(),
    paymentMethod: commonSchemas.paymentMethod.optional(),
    reference: z.string().optional().or(z.literal('')),
  }),

  update: z.object({
    category: z.string().min(1).optional(),
    amount: commonSchemas.positiveNumber.optional(),
    description: z.string().optional().or(z.literal('')),
    date: commonSchemas.date.optional(),
    paymentMethod: commonSchemas.paymentMethod.optional(),
    status: commonSchemas.status.optional(),
  }),
};

/**
 * Credit Schemas
 */
export const creditSchemas = {
  create: z.object({
    stationId: commonSchemas.id,
    creditorName: z.string().min(1, 'Name is required').max(100),
    phone: commonSchemas.phone.optional().or(z.literal('')),
    email: commonSchemas.email.optional(),
    creditLimit: commonSchemas.positiveNumber.optional(),
    notes: z.string().optional().or(z.literal('')),
  }),

  update: z.object({
    creditorName: z.string().min(1).max(100).optional(),
    phone: commonSchemas.phone.optional().or(z.literal('')),
    email: commonSchemas.email.optional(),
    creditLimit: commonSchemas.positiveNumber.optional(),
    notes: z.string().optional().or(z.literal('')),
  }),

  settle: z.object({
    amount: commonSchemas.positiveNumber,
    paymentMethod: commonSchemas.paymentMethod,
    notes: z.string().optional().or(z.literal('')),
  }),
};

/**
 * Tank Schemas
 */
export const tankSchemas = {
  create: z.object({
    stationId: commonSchemas.id,
    tankNumber: commonSchemas.positiveNumber,
    fuelType: commonSchemas.fuelType,
    capacity: commonSchemas.positiveNumber,
  }),

  refill: z.object({
    tankId: commonSchemas.id,
    quantity: commonSchemas.positiveNumber,
    costPerUnit: commonSchemas.nonNegativeNumber,
    totalCost: commonSchemas.nonNegativeNumber,
    supplier: z.string().optional().or(z.literal('')),
    invoice: z.string().optional().or(z.literal('')),
  }),
};

/**
 * Shift Schemas
 */
export const shiftSchemas = {
  create: z.object({
    stationId: commonSchemas.id,
    shiftDate: commonSchemas.date,
    employeeId: commonSchemas.id.optional(),
    startReading: commonSchemas.nonNegativeNumber.optional(),
    endReading: commonSchemas.nonNegativeNumber.optional(),
  }),

  close: z.object({
    shiftId: commonSchemas.id,
    endReading: commonSchemas.nonNegativeNumber,
    closedBy: commonSchemas.id,
    notes: z.string().optional().or(z.literal('')),
  }),
};

export type AuthLogin = z.infer<typeof authSchemas.login>;
export type AuthRegister = z.infer<typeof authSchemas.register>;
export type StationCreate = z.infer<typeof stationSchemas.create>;
export type UserCreate = z.infer<typeof userSchemas.create>;
export type ReadingCreate = z.infer<typeof readingSchemas.create>;
export type ExpenseCreate = z.infer<typeof expenseSchemas.create>;
export type CreditCreate = z.infer<typeof creditSchemas.create>;
