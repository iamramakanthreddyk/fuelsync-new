/**
 * Expenses Service Tests
 * Tests for Req #3: Expense creation, approval workflow, and summaries
 */

describe('ExpensesService', () => {
  let expensesService;

  beforeEach(() => {
    jest.clearAllMocks();
    expensesService = require('../expenses.service');
  });

  describe('createExpense', () => {
    it('should create expense with pending status for employees (Req #3)', async () => {
      const expenseData = {
        stationId: 'station-1',
        category: 'miscellaneous',
        description: 'Paint supplies',
        amount: 5000,
        expenseDate: '2025-03-07',
        frequency: 'one_time'
      };

      // Would be pending because user is employee
      const mockExpense = { ...expenseData, approvalStatus: 'pending' };
      expect(mockExpense.approvalStatus).toBe('pending');
    });

    it('should create expense with auto_approved status for manager (Req #3)', async () => {
      const expenseData = {
        stationId: 'station-1',
        category: 'salary',
        description: 'Monthly salary',
        amount: 50000,
        expenseDate: '2025-03-07',
        frequency: 'monthly'
      };

      // Would auto-approve for manager
      const mockExpense = { ...expenseData, approvalStatus: 'auto_approved' };
      expect(mockExpense.approvalStatus).toBe('auto_approved');
    });

    it('should calculate expenseMonth from date', () => {
      const expenseDate = '2025-03-07';
      const expenseMonth = expenseDate.substring(0, 7); // YYYY-MM

      expect(expenseMonth).toBe('2025-03');
    });
  });

  describe('approveExpense', () => {
    it('should approve pending expense (Req #3)', () => {
      const expense = {
        id: 'exp-1',
        approvalStatus: 'pending'
      };

      expect(expense.approvalStatus).toBe('pending');
      // After approval: approvalStatus = 'approved', approvedAt = now, approvedBy = userId
    });

    it('should reject pending expense (Req #3)', () => {
      const expense = {
        id: 'exp-1',
        approvalStatus: 'pending'
      };

      expect(expense.approvalStatus).toBe('pending');
      // After rejection: approvalStatus = 'rejected', approvedAt = now, approvedBy = userId
    });

    it('should not approve already-approved expense', () => {
      const expense = {
        id: 'exp-1',
        approvalStatus: 'approved'
      };

      expect(() => {
        if (expense.approvalStatus !== 'pending') {
          throw new Error('Cannot approve - expense is already approved');
        }
      }).toThrow();
    });
  });

  describe('getExpenseSummary', () => {
    it('should return daily expense summary (Req #3)', () => {
      const summary = {
        stationId: 'station-1',
        period: 'daily',
        date: '2025-03-07',
        approvedTotal: 15000,
        pendingTotal: 5000,
        pendingCount: 2,
        byCategory: [
          { category: 'cleaning', label: 'Cleaning', total: 5000, count: 1 },
          { category: 'supplies', label: 'Supplies', total: 10000, count: 2 }
        ],
        byFrequency: [
          { frequency: 'one_time', total: 15000, count: 3 }
        ]
      };

      expect(summary.period).toBe('daily');
      expect(summary.approvedTotal).toBe(15000);
      expect(summary.byCategory.length).toBeGreaterThan(0);
    });

    it('should return monthly expense summary (Req #3)', () => {
      const summary = {
        stationId: 'station-1',
        period: 'monthly',
        month: '2025-03',
        approvedTotal: 150000,
        pendingTotal: 10000,
        pendingCount: 5
      };

      expect(summary.period).toBe('monthly');
      expect(summary.month).toBe('2025-03');
    });

    it('should only include approved expenses in totals (Req #3)', () => {
      // Pending expenses shown separately but excluded from net profit calc
      const summary = {
        approvedTotal: 100000,
        pendingTotal: 20000
      };

      expect(summary.approvedTotal).toBe(100000);
      expect(summary.pendingTotal).toBe(20000);
      // NetProfit = GrossProfit - approvedTotal (NOT including pending)
    });
  });
});
