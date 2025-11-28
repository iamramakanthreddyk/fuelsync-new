/**
 * Core Utilities
 * 
 * Common utility functions used throughout the application.
 * 
 * @module core/utils
 */

import { CURRENCY, DATE_FORMATS, NUMBER_FORMATS } from '../constants/app.constants';

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format a number as currency (INR)
 */
export function formatCurrency(
  value: number,
  options: {
    showSymbol?: boolean;
    decimals?: number;
    compact?: boolean;
  } = {}
): string {
  const {
    showSymbol = true,
    decimals = CURRENCY.DECIMALS,
    compact = false,
  } = options;

  if (compact && Math.abs(value) >= 100000) {
    // Use Indian number system for large numbers
    if (Math.abs(value) >= 10000000) {
      const crores = value / 10000000;
      return `${showSymbol ? CURRENCY.SYMBOL : ''}${crores.toFixed(2)} Cr`;
    }
    const lakhs = value / 100000;
    return `${showSymbol ? CURRENCY.SYMBOL : ''}${lakhs.toFixed(2)} L`;
  }

  const formatted = new Intl.NumberFormat(CURRENCY.LOCALE, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: CURRENCY.CODE,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return formatted;
}

/**
 * Format a number with locale-specific separators
 */
export function formatNumber(
  value: number,
  decimals: number = 0
): string {
  return new Intl.NumberFormat(CURRENCY.LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number as volume (litres)
 */
export function formatVolume(
  value: number,
  options: { showUnit?: boolean; decimals?: number } = {}
): string {
  const {
    showUnit = true,
    decimals = NUMBER_FORMATS.VOLUME_DECIMALS,
  } = options;

  const formatted = formatNumber(value, decimals);
  return showUnit ? `${formatted} L` : formatted;
}

/**
 * Format a percentage
 */
export function formatPercentage(
  value: number,
  decimals: number = NUMBER_FORMATS.PERCENTAGE_DECIMALS
): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Format a date
 */
export function formatDate(
  date: Date | string,
  format: keyof typeof DATE_FORMATS = 'DISPLAY_DATE'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  const formatString = DATE_FORMATS[format];
  
  // Simple format implementation
  const options: Intl.DateTimeFormatOptions = {};
  
  if (formatString.includes('yyyy')) {
    options.year = 'numeric';
  }
  if (formatString.includes('MMM')) {
    options.month = 'short';
  } else if (formatString.includes('MM')) {
    options.month = '2-digit';
  }
  if (formatString.includes('dd')) {
    options.day = '2-digit';
  }
  if (formatString.includes('HH') || formatString.includes('hh')) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  if (formatString.includes('a')) {
    options.hour12 = true;
  }

  return dateObj.toLocaleDateString('en-IN', options);
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  return formatDate(dateObj, 'DISPLAY_DATE');
}

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Indian phone number
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}

/**
 * Validate GST number
 */
export function isValidGST(gst: string): boolean {
  const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
  return gstRegex.test(gst.toUpperCase());
}

/**
 * Validate vehicle number (Indian format)
 */
export function isValidVehicleNumber(vehicle: string): boolean {
  const vehicleRegex = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;
  return vehicleRegex.test(vehicle.toUpperCase().replace(/\s/g, ''));
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert to title case
 */
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Generate initials from name
 */
export function getInitials(name: string, maxLength: number = 2): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, maxLength)
    .join('');
}

/**
 * Slugify a string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// ============================================
// OBJECT UTILITIES
// ============================================

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: object): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Pick specific keys from object
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * Omit specific keys from object
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
}

/**
 * Remove undefined/null values from object
 */
export function compact<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      (result as Record<string, unknown>)[key] = value;
    }
  });
  return result;
}

// ============================================
// ARRAY UTILITIES
// ============================================

/**
 * Group array items by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Sum array of numbers
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((total, num) => total + num, 0);
}

/**
 * Sum array by property
 */
export function sumBy<T>(array: T[], key: keyof T): number {
  return array.reduce((total, item) => {
    const value = item[key];
    return total + (typeof value === 'number' ? value : 0);
  }, 0);
}

/**
 * Get unique values from array
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Sort array by key
 */
export function sortBy<T>(
  array: T[],
  key: keyof T,
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

// ============================================
// COLOR UTILITIES
// ============================================

/**
 * Get color for fuel type
 */
export function getFuelColor(fuelType: string): string {
  const colors: Record<string, string> = {
    petrol: '#ef4444',
    diesel: '#10b981',
    premium_petrol: '#f59e0b',
    premium_diesel: '#14b8a6',
    cng: '#3b82f6',
    lpg: '#8b5cf6',
  };
  return colors[fuelType.toLowerCase()] || '#6b7280';
}

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: '#10b981',
    inactive: '#6b7280',
    maintenance: '#f59e0b',
    pending: '#3b82f6',
    completed: '#10b981',
    cancelled: '#ef4444',
  };
  return colors[status.toLowerCase()] || '#6b7280';
}

// ============================================
// MISC UTILITIES
// ============================================

/**
 * Generate unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
