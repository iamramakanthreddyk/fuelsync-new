/**
 * Create Expense DTO
 * Req #3: Expense tracking with approval workflow
 */

export class CreateExpenseDto {
  stationId!: string;
  category!: string; // salary, electricity, rent, etc
  description!: string;
  amount!: number;
  expenseDate!: string; // YYYY-MM-DD
  paymentMethod?: string; // cash, online, card
  frequency?: 'daily' | 'weekly' | 'monthly' | 'one_time'; // default: one_time
  receiptNumber?: string;
  tags?: string[]; // flexible tags
  notes?: string;
}

export class ExpenseResponseDto {
  id!: string;
  stationId!: string;
  category!: string;
  description!: string;
  amount!: number;
  expenseDate!: string;
  expenseMonth!: string; // YYYY-MM
  paymentMethod?: string;
  frequency!: string;
  receiptNumber?: string;
  tags?: string[];
  notes?: string;

  // Approval workflow
  approvalStatus!: 'pending' | 'approved' | 'auto_approved' | 'rejected';
  enteredBy!: string;
  enteredByUser?: {
    id: string;
    name: string;
    email: string;
  };
  approvedBy?: string;
  approvedByUser?: {
    id: string;
    name: string;
    email: string;
  };
  approvedAt?: string;

  createdAt!: string;
  updatedAt!: string;
}

export class ExpenseFilterDto {
  stationId!: string;
  startDate?: string;
  endDate?: string;
  month?: string; // YYYY-MM
  approvalStatus?: 'pending' | 'approved' | 'auto_approved' | 'rejected';
  category?: string;
  frequency?: string;
  limit?: number;
  offset?: number;
}

export class ApproveExpenseDto {
  action!: 'approve' | 'reject';
  reason?: string; // optional reason for rejection
}

export class ExpenseSummaryDto {
  stationId!: string;
  period!: 'daily' | 'monthly';
  date?: string; // YYYY-MM-DD for daily
  month?: string; // YYYY-MM for monthly

  approvedTotal!: number;
  pendingTotal!: number;
  pendingCount!: number;

  byCategory?: Array<{
    category: string;
    label: string;
    total: number;
    count: number;
  }>;

  byFrequency?: Array<{
    frequency: string;
    total: number;
    count: number;
  }>;
}
