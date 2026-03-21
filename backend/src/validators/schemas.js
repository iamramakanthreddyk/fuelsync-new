/**
 * Comprehensive Joi Validation Schemas
 * 
 * Centralized validation schemas for all API endpoints
 * Ensures consistent validation across all controllers
 */

const Joi = require('joi');

// ============================================
// COMMON SCHEMAS (Reusable)
// ============================================

const id = Joi.string().uuid().required();
const email = Joi.string().email().lowercase().required();
const password = Joi.string().min(8).max(128).required();
const name = Joi.string().min(2).max(255).required();
const description = Joi.string().max(5000).allow(null, '');
const phoneNumber = Joi.string().regex(/^\+?[0-9]{10,15}$/).allow(null, '');

const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('asc', 'desc').default('asc'),
  sortBy: Joi.string().allow(null),
};

const dateRange = {
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
};

// ============================================
// AUTH SCHEMAS
// ============================================

const loginSchema = Joi.object({
  email: email.required(),
  password: password.required(),
}).unknown(false);

const registerSchema = Joi.object({
  name: name.required(),
  email: email.required(),
  password: password.required(),
  role: Joi.string().valid('owner', 'manager', 'employee').default('employee'),
  phone: phoneNumber,
}).unknown(false);

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(255),
  phone: phoneNumber,
  email: Joi.string().email().lowercase(),
}).unknown(false).min(1);

// ============================================
// STATION SCHEMAS
// ============================================

const createStationSchema = Joi.object({
  name: name.required(),
  location: Joi.string().min(5).max(500).required(),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  description: description,
}).unknown(false);

const updateStationSchema = Joi.object({
  name: Joi.string().min(2).max(255),
  location: Joi.string().min(5).max(500),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  description: description,
  isActive: Joi.boolean(),
}).unknown(false).min(1);

const getStationsQuerySchema = Joi.object({
  ...pagination,
  search: Joi.string().max(255),
  isActive: Joi.boolean(),
}).unknown(true); // Allow extra params for flexibility

// ============================================
// READING SCHEMAS
// ============================================

const createReadingSchema = Joi.object({
  nozzleId: id.required(),
  readingValue: Joi.number().positive().required(),
  previousReading: Joi.number().min(0),
  notes: Joi.string().max(1000).allow(null, ''),
  isSample: Joi.boolean().default(false),
  pricePerLitre: Joi.number().positive(),
}).unknown(false);

const updateReadingSchema = Joi.object({
  readingValue: Joi.number().positive(),
  notes: Joi.string().max(1000).allow(null, ''),
  status: Joi.string().valid('pending', 'approved', 'rejected'),
}).unknown(false).min(1);

const getReadingsQuerySchema = Joi.object({
  ...pagination,
  ...dateRange.endDate ? { ...dateRange } : {},
  stationId: id,
  nozzleId: id,
  status: Joi.string().valid('pending', 'approved', 'settled'),
  isSample: Joi.boolean(),
  search: Joi.string().max(255),
}).unknown(true);

// ============================================
// SETTLEMENT SCHEMAS
// ============================================

const createSettlementSchema = Joi.object({
  stationId: id.required(),
  date: Joi.date().iso().required(),
  expectedCash: Joi.number().min(0).required(),
  actualCash: Joi.number().min(0).required(),
  online: Joi.number().min(0).default(0),
  credit: Joi.number().min(0).default(0),
  readingIds: Joi.array().items(id),
  status: Joi.string().valid('draft', 'final').default('draft'),
}).unknown(false);

const updateSettlementSchema = Joi.object({
  expectedCash: Joi.number().min(0),
  actualCash: Joi.number().min(0),
  online: Joi.number().min(0),
  credit: Joi.number().min(0),
  readingIds: Joi.array().items(id),
  status: Joi.string().valid('draft', 'final'),
}).unknown(false).min(1);

// ============================================
// TRANSACTION SCHEMAS
// ============================================

const createTransactionSchema = Joi.object({
  stationId: id.required(),
  transactionDate: Joi.date().iso().required(),
  readingIds: Joi.array().items(id).min(1).required(),
  paymentBreakdown: Joi.object({
    cash: Joi.number().min(0).required(),
    online: Joi.number().min(0).required(),
    credit: Joi.number().min(0).required(),
  }).required(),
}).unknown(false);

// ============================================
// FINANCIAL SCHEMAS
// ============================================

const createCreditSchema = Joi.object({
  creditorName: name.required(),
  stationId: id.required(),
  totalAmount: Joi.number().positive().required(),
  startDate: Joi.date().iso().required(),
  dueDate: Joi.date().iso().min(Joi.ref('startDate')),
  description: description,
}).unknown(false);

const createExpenseSchema = Joi.object({
  stationId: id.required(),
  description: Joi.string().min(5).max(1000).required(),
  amount: Joi.number().positive().required(),
  category: Joi.string()
    .valid('maintenance', 'fuel', 'salary', 'utilities', 'supplies', 'other')
    .required(),
  expenseDate: Joi.date().iso().required(),
  paymentMethod: Joi.string()
    .valid('cash', 'check', 'transfer', 'online', 'other')
    .required(),
  receiptUrl: Joi.string().uri().allow(null),
  notes: Joi.string().max(1000).allow(null, ''),
}).unknown(false);

// ============================================
// EMPLOYEE SCHEMAS
// ============================================

const getEmployeeSalesQuerySchema = Joi.object({
  stationId: Joi.alternatives().try(id, Joi.string().valid('all')),
  ...dateRange,
  ...pagination,
}).unknown(true);

const getEmployeeShortfallsQuerySchema = Joi.object({
  stationId: Joi.alternatives().try(id, Joi.string().valid('all')),
  ...dateRange,
  ...pagination,
}).unknown(true);

// ============================================
// DASHBOARD SCHEMAS
// ============================================

const getDashboardSummaryQuerySchema = Joi.object({
  stationId: id,
  date: Joi.date().iso(),
}).unknown(true);

const getDashboardReportQuerySchema = Joi.object({
  stationId: id,
  ...dateRange,
  ...pagination,
  reportType: Joi.string().valid('sales', 'expenses', 'settlements', 'all'),
}).unknown(true);

// ============================================
// PUMP & NOZZLE SCHEMAS
// ============================================

const createPumpSchema = Joi.object({
  stationId: id.required(),
  name: name.required(),
  pumpNumber: Joi.number().positive().required(),
  description: description,
}).unknown(false);

const createNozzleSchema = Joi.object({
  pumpId: id.required(),
  nozzleNumber: Joi.number().positive().required(),
  fuelType: Joi.string()
    .valid('petrol', 'diesel', 'cng', 'lpg', 'electric')
    .required(),
  pricePerLitre: Joi.number().positive().required(),
}).unknown(false);

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Common
  pagination,
  dateRange,

  // Auth
  loginSchema,
  registerSchema,
  updateProfileSchema,

  // Station
  createStationSchema,
  updateStationSchema,
  getStationsQuerySchema,

  // Reading
  createReadingSchema,
  updateReadingSchema,
  getReadingsQuerySchema,

  // Settlement
  createSettlementSchema,
  updateSettlementSchema,

  // Transaction
  createTransactionSchema,

  // Financial
  createCreditSchema,
  createExpenseSchema,

  // Employee
  getEmployeeSalesQuerySchema,
  getEmployeeShortfallsQuerySchema,

  // Dashboard
  getDashboardSummaryQuerySchema,
  getDashboardReportQuerySchema,

  // Pump & Nozzle
  createPumpSchema,
  createNozzleSchema,
};
