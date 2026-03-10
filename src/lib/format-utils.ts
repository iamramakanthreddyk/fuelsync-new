/**
 * Number formatting utilities — Indian (en-IN) locale with Lakhs/Crores
 * 
 * Formatting examples:
 * - 23942 → "23,942" (with Indian comma grouping)
 * - 100000 → "1,00,000" (1 Lakh)
 * - 1000000 → "10,00,000" (10 Lakhs)
 * - 10000000 → "1,00,00,000" (1 Crore)
 */

/**
 * Format currency (INR) with Indian grouping
 * e.g., 1234567 → "₹12,34,567.00"
 */
export function formatCurrency(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount);
}

/**
 * Format number with Indian grouping (commas at 2-digit intervals after first 3 digits)
 * e.g., 1234567 → "12,34,567"
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

/**
 * Format volume (liters) with Indian grouping
 * e.g., 23942.15 → "23,942.15 L"
 */
export function formatVolume(liters: number): string {
  return `${formatNumber(liters, 2)} L`;
}

/**
 * Format number with Lakh/Crore labels (compact Indian format)
 * 10,000 → "10,000"
 * 100,000 → "1,00,000" (1 Lakh)
 * 1,000,000 → "10,00,000" (10 Lakhs)
 * 10,000,000 → "1,00,00,000" (1 Crore)
 * 100,000,000 → "10,00,00,000" (10 Crores)
 */
export function formatCompactNumber(num: number): string {
  if (num >= 10000000) {
    return `${(num / 10000000).toFixed(1)}Cr`;
  }
  if (num >= 100000) {
    return `${(num / 100000).toFixed(1)}L`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format large number as Lakhs/Crores with label
 * e.g., 100000 → "1.00 Lakhs", 10000000 → "1.00 Crores"
 */
export function formatInIndianUnits(num: number, decimals: number = 2): string {
  if (num >= 10000000) {
    // Crores
    const crores = num / 10000000;
    return `${crores.toFixed(decimals)} Crores`;
  }
  if (num >= 100000) {
    // Lakhs
    const lakhs = num / 100000;
    return `${lakhs.toFixed(decimals)} Lakhs`;
  }
  // Just format as regular number with Indian grouping
  return formatNumber(num, decimals);
}

/**
 * Parse number from string
 */
export function parseNumber(str: string): number | null {
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Safe toFixed that handles both numbers and strings
 */
export function safeToFixed(value: unknown, decimals: number = 2): string {
  if (value === null || value === undefined) return '0.00';
  
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num)) return '0.00';
  
  return num.toFixed(decimals);
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Round to decimal places
 */
export function roundTo(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Format percentage with sign and "No change" for 0%
 */
export function formatPercentage(value: number): string {
  if (value === 0) return 'No change';
  return `${value >= 0 ? '+' : ''}${safeToFixed(value, 1)}%`;
}
