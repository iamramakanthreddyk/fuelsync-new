/**
 * Payment Methods DTO
 * Req #2: Online payment sub-types (UPI, Card, Oil Company)
 */

export class PaymentMethodDto {
  id!: string;
  type!: 'cash' | 'online' | 'credit'; // main category
  method!: string; // sub-type identifier
  label!: string; // human-readable
}

export class PaymentSubTypeDto {
  category!: 'upi' | 'card' | 'oil_company';
  items!: {
    id: string;
    label: string;
    icon?: string;
  }[];
}

/**
 * UPI Payment Sub-Types
 */
export const UPI_SUBTYPES: Record<string, string> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  amazon_pay: 'Amazon Pay',
  cred: 'CRED',
  bhim: 'BHIM',
  other_upi: 'Other UPI',
};

/**
 * Card Payment Sub-Types
 */
export const CARD_SUBTYPES: Record<string, string> = {
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
};

/**
 * Oil Company Card Sub-Types
 */
export const OIL_COMPANY_SUBTYPES: Record<string, string> = {
  hp_pay: 'HP Pay',
  iocl_card: 'IOCL Card',
  bpcl_smartfleet: 'BPCL SmartFleet',
  essar_fleet: 'Essar Fleet',
  reliance_fleet: 'Reliance Fleet',
  other_oil_company: 'Other Oil Company Card',
};

export class PaymentBreakdownDto {
  cash?: number;
  upi?: Record<string, number>; // maps gpay, phonepe, etc to amounts
  card?: Record<string, number>; // maps debit_card, credit_card to amounts
  oil_company?: Record<string, number>; // maps hp_pay, iocl_card, etc to amounts
  credit?: number;
}

export class ListPaymentMethodsResponseDto {
  paymentMethods: PaymentMethodDto[];
  subtypes: {
    upi: PaymentSubTypeDto;
    card: PaymentSubTypeDto;
    oil_company: PaymentSubTypeDto;
  };
}
