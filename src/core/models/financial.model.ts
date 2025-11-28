/**
 * Financial Model
 * 
 * Types and interfaces for credits, expenses, and financial tracking.
 * 
 * @module core/models/financial
 */

import { BaseEntity, Activatable, Contactable, Notable, DateRangeFilter } from './base.model';
import { CreditStatus, ExpenseCategory, PaymentMethod, TransactionType, FuelType } from '../enums';

// ============================================
// CREDITOR ENTITY
// ============================================

/**
 * Creditor entity - represents a credit customer
 */
export interface Creditor extends BaseEntity, Activatable, Contactable, Notable {
  stationId: string;
  name: string;
  businessName?: string;
  contactPerson?: string;
  address?: string;
  gstNumber?: string;
  panNumber?: string;
  creditLimit: number;
  currentBalance: number;
  creditPeriodDays: number;
  lastTransactionDate?: string;
}

/**
 * Creditor with summary
 */
export interface CreditorWithSummary extends Creditor {
  totalCredit: number;
  totalPayments: number;
  overdueAmount: number;
  isOverdue: boolean;
  daysPastDue?: number;
}

// ============================================
// CREDIT TRANSACTION ENTITY
// ============================================

/**
 * Credit transaction entity
 */
export interface CreditTransaction extends BaseEntity, Notable {
  creditorId: string;
  stationId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  fuelType?: FuelType;
  litres?: number;
  pricePerLitre?: number;
  vehicleNumber?: string;
  driverName?: string;
  transactionDate: string;
  referenceNumber?: string;
  recordedBy: string;
}

/**
 * Transaction with related data
 */
export interface TransactionWithRelations extends CreditTransaction {
  creditor?: {
    id: string;
    name: string;
    businessName?: string;
  };
  recorder?: {
    id: string;
    name: string;
  };
}

// ============================================
// EXPENSE ENTITY
// ============================================

/**
 * Expense entity
 */
export interface Expense extends BaseEntity, Notable {
  stationId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  receiptUrl?: string;
  vendorName?: string;
  isRecurring: boolean;
  recurringFrequency?: string;
  nextDueDate?: string;
  recordedBy: string;
  approvedBy?: string;
  approvedAt?: string;
}

/**
 * Expense with related data
 */
export interface ExpenseWithRelations extends Expense {
  recorder?: {
    id: string;
    name: string;
  };
  approver?: {
    id: string;
    name: string;
  };
}

// ============================================
// CREDITOR DTOs
// ============================================

/**
 * DTO for creating a creditor
 */
export interface CreateCreditorDTO {
  stationId?: string;
  name: string;
  businessName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  creditLimit: number;
  creditPeriodDays?: number;
  notes?: string;
}

/**
 * DTO for updating a creditor
 */
export interface UpdateCreditorDTO {
  name?: string;
  businessName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
  creditPeriodDays?: number;
  isActive?: boolean;
  notes?: string;
}

// ============================================
// CREDIT TRANSACTION DTOs
// ============================================

/**
 * DTO for recording a credit sale
 */
export interface RecordCreditSaleDTO {
  creditorId: string;
  stationId?: string;
  amount: number;
  fuelType?: FuelType;
  litres?: number;
  pricePerLitre?: number;
  vehicleNumber?: string;
  driverName?: string;
  transactionDate?: string;
  referenceNumber?: string;
  notes?: string;
}

/**
 * DTO for recording a credit payment
 */
export interface RecordCreditPaymentDTO {
  creditorId: string;
  stationId?: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  transactionDate?: string;
  referenceNumber?: string;
  notes?: string;
}

// ============================================
// EXPENSE DTOs
// ============================================

/**
 * DTO for creating an expense
 */
export interface CreateExpenseDTO {
  stationId?: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate?: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
  vendorName?: string;
  isRecurring?: boolean;
  recurringFrequency?: string;
  notes?: string;
}

/**
 * DTO for updating an expense
 */
export interface UpdateExpenseDTO {
  category?: ExpenseCategory;
  amount?: number;
  description?: string;
  expenseDate?: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
  vendorName?: string;
  notes?: string;
}

// ============================================
// FINANCIAL FILTERS
// ============================================

/**
 * Filter for creditor list
 */
export interface CreditorFilter {
  stationId?: string;
  search?: string;
  isActive?: boolean;
  hasOverdue?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Filter for credit transactions
 */
export interface CreditTransactionFilter extends DateRangeFilter {
  stationId?: string;
  creditorId?: string;
  type?: TransactionType;
  page?: number;
  limit?: number;
}

/**
 * Filter for expenses
 */
export interface ExpenseFilter extends DateRangeFilter {
  stationId?: string;
  category?: ExpenseCategory;
  paymentMethod?: PaymentMethod;
  minAmount?: number;
  maxAmount?: number;
  isRecurring?: boolean;
  page?: number;
  limit?: number;
}

// ============================================
// FINANCIAL SUMMARIES
// ============================================

/**
 * Financial overview
 */
export interface FinancialOverview {
  grossSales: number;
  netSales: number;
  costOfGoods: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  cashOnHand: number;
  creditOutstanding: number;
  bankDeposits: number;
  profitMargin: number;
}

/**
 * Credit summary
 */
export interface CreditSummary {
  totalCreditors: number;
  activeCreditors: number;
  totalOutstanding: number;
  overdueAmount: number;
  creditUtilization: number;
  avgCreditPeriod: number;
  topCreditors: Array<{
    creditorId: string;
    creditorName: string;
    outstandingAmount: number;
  }>;
}

/**
 * Expense summary by category
 */
export interface ExpenseSummary {
  totalExpenses: number;
  byCategory: Record<ExpenseCategory, number>;
  byPaymentMethod: Record<PaymentMethod, number>;
  recurringExpenses: number;
  oneTimeExpenses: number;
  topCategories: Array<{
    category: ExpenseCategory;
    amount: number;
    percentage: number;
  }>;
}

/**
 * Cash flow summary
 */
export interface CashFlowSummary {
  period: string;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
  bySource: {
    sales: number;
    creditPayments: number;
    other: number;
  };
  byUsage: {
    expenses: number;
    purchases: number;
    bankDeposits: number;
    other: number;
  };
}
