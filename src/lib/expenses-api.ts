/**
 * @deprecated Import from '@/api' or '@/api/expenses' instead.
 * This file is a compatibility shim — all exports now live in src/api/expenses.ts.
 */
export {
  expenseApi,
  parseExpenseAmount,
  calculateExpenseTotal,
  groupExpensesByCategory,
  getExpenseStats,
} from '@/api/expenses';
export type {
  Expense,
  ExpenseSummary,
  ExpensesListResponse,
  ExpenseSummaryResponse,
} from '@/api/expenses';

// Legacy function wrappers for backward compatibility
import { expenseApi } from '@/api/expenses';

export async function getStationExpenses(
  stationId: string,
  startDate: string,
  endDate: string,
  limit = 100
) {
  return expenseApi.getForStation(stationId, { startDate, endDate, limit });
}

export async function getAllExpenses(
  startDate: string,
  endDate: string,
  limit = 50,
  page = 1
) {
  return expenseApi.getAll({ startDate, endDate, limit, page });
}

export async function getExpenseSummary(
  stationId: string,
  startDate: string,
  endDate: string
) {
  return expenseApi.getSummary(stationId, startDate, endDate);
}

export async function createExpense(stationId: string, expenseData: Record<string, unknown>) {
  return expenseApi.create(stationId, expenseData);
}

export async function updateExpenseApproval(expenseId: string, action: 'approve' | 'reject') {
  return expenseApi.updateApproval(expenseId, action);
}

export async function bulkApproveExpenses(stationId: string, expenseIds: string[]) {
  return expenseApi.bulkApprove(stationId, expenseIds);
}
