/**
 * Expenses API
 * Single source of truth for all expense-related API calls and types.
 * Only this file (and other src/api/ modules) should import from api-client.
 */

import { apiClient } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────────────────

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
  enteredByUser?: { id: string; name: string; role: string };
  approvedByUser?: { id: string; name: string; role: string };
  station?: { id: string; name: string };
}

export interface ExpenseSummary {
  mode: 'daily' | 'monthly';
  month?: string;
  date?: string;
  approvedTotal: number;
  pendingCount: number;
  pendingAmount: number;
  byCategory: Array<{ category: string; total: number }>;
  byFrequency: Array<{ frequency: string; count: number; total: number }>;
}

export interface ExpensesListResponse {
  success: boolean;
  data: Expense[];
  summary: {
    totalExpenses: number;
    approvedTotal: number;
    pendingTotal: number;
    total: number;
    byCategory: Array<{ category: string; total: number; count: number }>;
    byFrequency: Array<{ frequency: string; count: number; total: number }>;
    dateRange: { startDate: string; endDate: string };
    stationsIncluded: number;
  };
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface ExpenseSummaryResponse {
  success: boolean;
  data: ExpenseSummary;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const expenseApi = {
  /** GET /stations/:stationId/expenses */
  getForStation: (
    stationId: string,
    params?: { startDate?: string; endDate?: string; limit?: number; page?: number; category?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.page) qs.set('page', String(params.page));
    if (params?.category) qs.set('category', params.category);
    const q = qs.toString();
    return apiClient.get<ExpensesListResponse>(`/stations/${stationId}/expenses${q ? `?${q}` : ''}`);
  },

  /** GET /stations/all/expenses */
  getAll: (params?: { startDate?: string; endDate?: string; limit?: number; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString();
    return apiClient.get<ExpensesListResponse>(`/stations/all/expenses${q ? `?${q}` : ''}`);
  },

  /** GET /stations/:stationId/expense-summary */
  getSummary: (stationId: string, startDate: string, endDate: string) =>
    apiClient.get<ExpenseSummaryResponse>(
      `/stations/${stationId}/expense-summary?startDate=${startDate}&endDate=${endDate}`
    ),

  /** POST /stations/:stationId/expenses */
  create: (stationId: string, data: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Expense }>(`/stations/${stationId}/expenses`, data),

  /** PATCH /expenses/:expenseId/approve */
  updateApproval: (expenseId: string, action: 'approve' | 'reject') =>
    apiClient.patch<{ success: boolean; data: Expense }>(`/expenses/${expenseId}/approve`, { action }),

  /** PATCH /stations/:stationId/expenses/bulk-approve */
  bulkApprove: (stationId: string, expenseIds: string[]) =>
    apiClient.patch<{ success: boolean; approved: number; failed: number }>(
      `/stations/${stationId}/expenses/bulk-approve`,
      { expenseIds }
    ),

  /**
   * POST /expenses
   * Direct expense creation where stationId is included in the request body.
   * Used by hooks that follow the legacy POST /expenses pattern.
   */
  createDirect: (data: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Expense }>('/expenses', data),
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function parseExpenseAmount(amount: string | number | undefined): number {
  if (!amount) return 0;
  if (typeof amount === 'number') return amount;
  const parsed = parseFloat(amount as string);
  return isNaN(parsed) ? 0 : parsed;
}

export function calculateExpenseTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, exp) => sum + parseExpenseAmount(exp.amount), 0);
}

export function groupExpensesByCategory(
  expenses: Expense[]
): Record<string, { total: number; items: Expense[] }> {
  return expenses.reduce<Record<string, { total: number; items: Expense[] }>>((acc, exp) => {
    const category = exp.category || 'uncategorized';
    if (!acc[category]) acc[category] = { total: 0, items: [] };
    acc[category].total += parseExpenseAmount(exp.amount);
    acc[category].items.push(exp);
    return acc;
  }, {});
}

export function getExpenseStats(expenses: Expense[]) {
  const approved = expenses.filter(
    e => e.approvalStatus === 'auto_approved' || e.approvalStatus === 'approved'
  ).length;
  const pending = expenses.filter(e => e.approvalStatus === 'pending').length;
  const rejected = expenses.filter(e => e.approvalStatus === 'rejected').length;

  const approvedTotal = expenses
    .filter(e => e.approvalStatus === 'auto_approved' || e.approvalStatus === 'approved')
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
