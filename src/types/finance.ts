// src/types/finance.ts
// Shared types for finance-related UI and logic

export interface ReadingEntry {
  nozzleId: string;
  readingValue: string;
  date: string;
  paymentType: string;
  is_sample?: boolean;
}

// Use string for form state, number for backend/calc
export interface CreditAllocation {
  creditorId: string;
  amount: string | number;
}

export interface PaymentAllocation {
  cash: string | number;
  online: string | number;
  credits: CreditAllocation[];
}

export interface Creditor {
  id: string;
  name: string;
  businessName?: string;
  currentBalance: number;
  creditLimit: number;
}
