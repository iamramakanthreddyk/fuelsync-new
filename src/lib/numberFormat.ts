// src/lib/numberFormat.ts
// Global helpers for number formatting (currency, fixed decimals, etc.)

/**
 * Formats a value as a number with fixed decimals. Returns fallback if not a valid number.
 */
export function toFixedNumber(val: unknown, decimals: number = 2, fallback: string = '0.00'): string {
  const n = Number(val);
  if (isNaN(n)) return fallback;
  return n.toFixed(decimals);
}

/**
 * Formats a value as currency (INR by default).
 */
export function formatCurrency(val: unknown, currency: string = 'INR', decimals: number = 2): string {
  const n = Number(val);
  if (isNaN(n)) return '₹0.00';
  return n.toLocaleString('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
