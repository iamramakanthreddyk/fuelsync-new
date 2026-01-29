// src/lib/dateFormat.ts
// Global helpers for date formatting and standardization

/**
 * Formats a date string or Date object to 'YYYY-MM-DD' (ISO, date only)
 */
export function formatDateISO(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Formats a date string or Date object to a localized date string (e.g., '2/12/2025')
 */
export function formatDateLocal(date: string | Date, locale: string = 'en-IN') {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(locale, { timeZone: 'Asia/Kolkata' });
}

/**
 * Formats a date string or Date object to a localized date+time string
 */
export function formatDateTimeLocal(date: string | Date, locale: string = 'en-IN') {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString(locale, { timeZone: 'Asia/Kolkata' });
}
