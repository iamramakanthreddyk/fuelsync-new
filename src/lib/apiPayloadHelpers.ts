// src/lib/apiPayloadHelpers.ts
// Global helper to map form values to API payloads with correct types and keys

/**
 * Ensures a value is a number, returns 0 if not parseable.
 */
export function toNumber(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Standardizes reading payload for API
 */
export function mapReadingFormToPayload(form: {
  nozzleId: string;
  readingValue: string | number;
  readingDate: string;
  paymentType: 'cash' | 'credit' | 'digital';
}): {
  nozzleId: string;
  readingValue: number;
  readingDate: string;
  paymentType: 'cash' | 'credit' | 'digital';
} {
  return {
    nozzleId: form.nozzleId,
    readingValue: toNumber(form.readingValue),
    readingDate: form.readingDate,
    paymentType: form.paymentType,
  };
}

// Add more helpers as needed for other forms
