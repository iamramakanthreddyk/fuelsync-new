// src/lib/apiPayloadHelpers.ts
// Global helper to map form values to API payloads with correct types and keys

import { PaymentMethod } from '@/core/enums';

/**
 * Ensures a value is a number, returns 0 if not parseable.
 */
export function toNumber(val: unknown): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (typeof val === 'string') {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Standardizes reading payload for API
 */
export function mapReadingFormToPayload(form: {
  nozzleId: string;
  readingValue: string | number;
  readingDate: string;
  paymentType: PaymentMethod;
}): {
  nozzleId: string;
  readingValue: number;
  readingDate: string;
  paymentType: PaymentMethod;
} {
  return {
    nozzleId: form.nozzleId,
    readingValue: toNumber(form.readingValue),
    readingDate: form.readingDate,
    paymentType: form.paymentType,
  };
}

// Add more helpers as needed for other forms
