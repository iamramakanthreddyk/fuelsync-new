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
  /** Optional: detailed breakdown of online payment types (UPI, Card, Oil Company) */
  onlineBreakdown?: PaymentSubBreakdown | null;
}

export interface Creditor {
  id: string;
  name: string;
  businessName?: string;
  currentBalance: number;
  creditLimit: number;
}

// ============================================
// Req #2: Payment sub-type breakdown
// ============================================

export type UpiSubType = 'gpay' | 'phonepe' | 'paytm' | 'amazon_pay' | 'cred' | 'bhim' | 'other_upi';
export type CardSubType = 'debit_card' | 'credit_card';
export type OilCompanySubType = 'hp_pay' | 'iocl_card' | 'bpcl_smartfleet' | 'essar_fleet' | 'reliance_fleet' | 'other_oil_company';

export interface PaymentSubBreakdown {
  cash: number;
  upi: Partial<Record<UpiSubType, number>>;
  card: Partial<Record<CardSubType, number>>;
  oil_company: Partial<Record<OilCompanySubType, number>>;
  credit: number;
}

/** Collapsed legacy shape used by backend — derived from PaymentSubBreakdown */
export interface LegacyPaymentBreakdown {
  cash: number;
  online: number;
  credit: number;
}

// Labels for UI display
export const UPI_LABELS: Record<UpiSubType, string> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  amazon_pay: 'Amazon Pay',
  cred: 'CRED',
  bhim: 'BHIM',
  other_upi: 'Other UPI',
};

export const CARD_LABELS: Record<CardSubType, string> = {
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
};

export const OIL_COMPANY_LABELS: Record<OilCompanySubType, string> = {
  hp_pay: 'HP Pay',
  iocl_card: 'IOCL Card',
  bpcl_smartfleet: 'BPCL SmartFleet',
  essar_fleet: 'Essar Fleet',
  reliance_fleet: 'Reliance Fleet',
  other_oil_company: 'Other Oil Co.',
};

// ============================================
// Req #3: Expense frequency / approval types
// ============================================

export type ExpenseFrequency = 'daily' | 'weekly' | 'monthly' | 'one_time';
export type ExpenseApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved';

export const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  one_time: 'One-Time',
};

export const APPROVAL_STATUS_LABELS: Record<ExpenseApprovalStatus, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  auto_approved: 'Auto-Approved',
};
