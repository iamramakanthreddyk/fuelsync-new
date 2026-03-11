/**
 * Expenses API Service Layer
 * Centralized API calls for expense operations
 * 
 * Endpoints:
 * - GET /stations/{stationId}/expenses - Get expenses for specific station
 * - GET /stations/all/expenses - Get all expenses (cross-station)
 * - GET /stations/{stationId}/expense-summary - Get monthly expense summary
 */

import { apiClient } from './api-client';

export interface Expense {
  id: string;
  stationId: string;
  category: string;
  description: string;
  amount: string | number;
  frequency: string;
  expenseDate: string;
  expenseMonth: string;
  receiptNumber: string | null;
  paymentMethod: string;
  notes: string | null;
  tags: string | null;
  approvalStatus: 'pending' | 'approved' | 'auto_approved' | 'rejected';
  createdBy: string;
  enteredBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  enteredByUser?: {
    id: string;
    name: string;
    role: string;
  };
  approvedByUser?: {
    id: string;
    name: string;
    role: string;
  };
  station?: {
    id: string;
    name: string;
  };
}

export interface ExpenseSummary {
  mode: 'daily' | 'monthly';
  month?: string;
  date?: string;
  approvedTotal: number;
  pendingCount: number;
  pendingAmount: number;
  byCategory: Array<{
    category: string;
    total: number;
  }>;
  byFrequency: Array<{
    frequency: string;
    count: number;
    total: number;
  }>;
}

export interface ExpensesListResponse {
  success: boolean;
  data: Expense[];
  summary: {
    totalExpenses: number;
    approvedTotal: number;
    pendingTotal: number;
    total: number;
    byCategory: Array<{
      category: string;
      total: number;
      count: number;
    }>;
    byFrequency: Array<{
      frequency: string;
      count: number;
      total: number;
    }>;
    dateRange: {
      startDate: string;
      endDate: string;
    };
    stationsIncluded: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ExpenseSummaryResponse {
  success: boolean;
  data: ExpenseSummary;
}

/**
 * Get expenses for a specific station (single station view)
 * @param stationId - Station ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param limit - Result limit (default: 100)
 * @returns List of expenses with summary
 */
export async function getStationExpenses(
  stationId: string,
  startDate: string,
  endDate: string,
  limit: number = 100
): Promise<ExpensesListResponse> {
  try {
    const response = await apiClient.get<ExpensesListResponse>(
      `/stations/${stationId}/expenses?startDate=${startDate}&endDate=${endDate}&limit=${limit}`
    );
    return response || { success: false, data: [], summary: {} as any, pagination: {} as any };
  } catch (error) {
    console.error('Error fetching station expenses:', error);
    throw error;
  }
}

/**
 * Get all expenses across all stations (manager/owner view)
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param limit - Result limit (default: 50)
 * @param page - Page number (default: 1)
 * @returns List of expenses across all stations with summary
 */
export async function getAllExpenses(
  startDate: string,
  endDate: string,
  limit: number = 50,
  page: number = 1
): Promise<ExpensesListResponse> {
  try {
    const response = await apiClient.get<ExpensesListResponse>(
      `/stations/all/expenses?startDate=${startDate}&endDate=${endDate}&limit=${limit}&page=${page}`
    );
    return response || { success: false, data: [], summary: {} as any, pagination: {} as any };
  } catch (error) {
    console.error('Error fetching all expenses:', error);
    throw error;
  }
}

/**
 * Get monthly expense summary for a station
 * Note: This endpoint uses month-based aggregation, not daily date ranges
 * @param stationId - Station ID
 * @param startDate - Start date (YYYY-MM-DD) - used for date mode selection
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Monthly summary of expenses
 */
export async function getExpenseSummary(
  stationId: string,
  startDate: string,
  endDate: string
): Promise<ExpenseSummaryResponse> {
  try {
    const response = await apiClient.get<ExpenseSummaryResponse>(
      `/stations/${stationId}/expense-summary?startDate=${startDate}&endDate=${endDate}`
    );
    return response || { success: false, data: {} as ExpenseSummary };
  } catch (error) {
    console.error('Error fetching expense summary:', error);
    throw error;
  }
}

/**
 * Helper function to parse expense amount (handle string/number)
 */
export function parseExpenseAmount(amount: string | number | undefined): number {
  if (!amount) return 0;
  if (typeof amount === 'number') return amount;
  const parsed = parseFloat(amount as string);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Helper function to calculate total expenses
 */
export function calculateExpenseTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, exp) => sum + parseExpenseAmount(exp.amount), 0);
}

/**
 * Helper function to group expenses by category
 */
export function groupExpensesByCategory(
  expenses: Expense[]
): Record<string, { total: number; items: Expense[] }> {
  const grouped: Record<string, { total: number; items: Expense[] }> = {};
  
  expenses.forEach(exp => {
    const category = exp.category || 'uncategorized';
    const amount = parseExpenseAmount(exp.amount);
    
    if (!grouped[category]) {
      grouped[category] = { total: 0, items: [] };
    }
    grouped[category].total += amount;
    grouped[category].items.push(exp);
  });
  
  return grouped;
}

/**
 * Helper function to get expense statistics
 */
export function getExpenseStats(expenses: Expense[]) {
  const approved = expenses.filter(
    e => e.approvalStatus === 'auto_approved' || e.approvalStatus === 'approved'
  ).length;
  const pending = expenses.filter(e => e.approvalStatus === 'pending').length;
  const rejected = expenses.filter(e => e.approvalStatus === 'rejected').length;
  
  const approvedTotal = expenses
    .filter(
      e => e.approvalStatus === 'auto_approved' || e.approvalStatus === 'approved'
    )
    .reduce((sum, exp) => sum + parseExpenseAmount(exp.amount), 0);
  
  const pendingTotal = expenses
    .filter(e => e.approvalStatus === 'pending')
    .reduce((sum, exp) => sum + parseExpenseAmount(exp.amount), 0);
  
  return {
    total: expenses.length,
    approved,
    pending,
    rejected,
    totalAmount: calculateExpenseTotal(expenses),
    approvedTotal,
    pendingTotal,
  };
}

/**
 * Create a new expense
 * @param stationId - Station ID
 * @param expenseData - Expense data to create
 * @returns Created expense
 */
export async function createExpense(
  stationId: string,
  expenseData: Record<string, any>
): Promise<{ success: boolean; data: Expense }> {
  try {
    const response = await apiClient.post<{ success: boolean; data: Expense }>(
      `/stations/${stationId}/expenses`,
      expenseData
    );
    return response || { success: false, data: {} as Expense };
  } catch (error) {
    console.error('Error creating expense:', error);
    throw error;
  }
}

/**
 * Approve or reject a single expense
 * @param expenseId - Expense ID
 * @param action - 'approve' or 'reject'
 * @returns Updated expense
 */
export async function updateExpenseApproval(
  expenseId: string,
  action: 'approve' | 'reject'
): Promise<{ success: boolean; data: Expense }> {
  try {
    const response = await apiClient.patch<{ success: boolean; data: Expense }>(
      `/expenses/${expenseId}/approve`,
      { action }
    );
    return response || { success: false, data: {} as Expense };
  } catch (error) {
    console.error(`Error ${action}ing expense:`, error);
    throw error;
  }
}

/**
 * Bulk approve expenses
 * @param stationId - Station ID
 * @param expenseIds - Array of expense IDs to approve
 * @returns Approval result
 */
export async function bulkApproveExpenses(
  stationId: string,
  expenseIds: string[]
): Promise<{ success: boolean; approved: number; failed: number }> {
  try {
    const response = await apiClient.patch<{
      success: boolean;
      approved: number;
      failed: number;
    }>(`/stations/${stationId}/expenses/bulk-approve`, {
      expenseIds,
    });
    return response || { success: false, approved: 0, failed: expenseIds.length };
  } catch (error) {
    console.error('Error bulk approving expenses:', error);
    throw error;
  }
}
