/**
 * Centralized formatting utilities
 * Single source of truth for all currency, number, and date formatting
 */

/**
 * Format currency in INR with proper locale
 * @param amount - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, decimals = 0): string => {
  return `₹${amount.toLocaleString('en-IN', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  })}`;
};

/**
 * Format large numbers in thousands/millions (K/M notation)
 * @param value - Number to format
 * @param decimals - Decimal places
 * @returns Formatted string (e.g., "1.5K", "2.3M")
 */
export const formatCompact = (value: number, decimals = 1): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`;
  }
  return value.toFixed(decimals);
};

/**
 * Format currency for Y-axis labels (in K for thousands)
 * @param value - Number to format
 * @returns Formatted currency string (e.g., "₹500K")
 */
export const formatCurrencyAxis = (value: number): string => {
  const formatted = formatCompact(value / 1000, 0);
  return `₹${formatted}`;
};

/**
 * Format number with fixed decimal places
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @returns Formatted number string
 */
export const formatNumber = (value: number, decimals = 2): string => {
  return value.toFixed(decimals);
};

/**
 * Format litres with unit
 * @param litres - Volume in litres
 * @param decimals - Decimal places (default: 0)
 * @returns Formatted string (e.g., "1500 L")
 */
export const formatLitres = (litres: number, decimals = 0): string => {
  return `${formatNumber(litres, decimals)} L`;
};

/**
 * Format percentage
 * @param value - Decimal value (0-1) or percentage value (0-100)
 * @param decimals - Decimal places
 * @param asDecimal - If true, treats input as 0-1, otherwise as 0-100
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals = 1, asDecimal = false): string => {
  const percentage = asDecimal ? value * 100 : value;
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * Format price per litre
 * @param pricePerLitre - Price value
 * @returns Formatted string (e.g., "₹95.50/L")
 */
export const formatPricePerLitre = (pricePerLitre: number): string => {
  return `${formatCurrency(pricePerLitre, 2)}/L`;
};

/**
 * Format transaction count
 * @param count - Number of transactions
 * @returns Formatted count string
 */
export const formatTransaction = (count: number): string => {
  return count.toString();
};

/**
 * Format date in readable format
 * @param date - Date string or Date object
 * @param locale - Locale (default: 'en-IN')
 * @returns Formatted date string
 */
export const formatDate = (date: string | Date, locale = 'en-IN'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(dateObj);
};

/**
 * Format date for charts (abbreviated)
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export const formatDateShort = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Round number to safe decimal places
 * @param value - Number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
export const roundTo = (value: number, decimals = 2): number => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * Safely parse and format a number with fallback
 * @param value - Value to parse
 * @param decimals - Decimal places
 * @param fallback - Fallback value
 * @returns Formatted number string
 */
export const safeFormatNumber = (value: any, decimals = 2, fallback = '0.00'): string => {
  try {
    const num = parseFloat(value);
    return isNaN(num) ? fallback : num.toFixed(decimals);
  } catch {
    return fallback;
  }
};
