/**
 * Storage utilities for localStorage management
 */

const STORAGE_PREFIX = 'fuelsync_';
import { getErrorMessage } from './errorUtils';

/**
 * Get item from localStorage with type safety
 */
export function getStorageItem<T>(key: string, defaultValue?: T): T | null {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    if (!item) return defaultValue ?? null;
    return JSON.parse(item) as T;
  } catch (error: unknown) {
    console.error('Error reading from localStorage:', getErrorMessage(error));
    return defaultValue ?? null;
  }
}

/**
 * Set item in localStorage
 */
export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (error: unknown) {
    console.error('Error writing to localStorage:', getErrorMessage(error));
  }
}

/**
 * Remove item from localStorage
 */
export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (error: unknown) {
    console.error('Error removing from localStorage:', getErrorMessage(error));
  }
}

/**
 * Clear all app storage
 */
export function clearStorage(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error: unknown) {
    console.error('Error clearing localStorage:', getErrorMessage(error));
  }
}

/**
 * Check if storage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error: unknown) {
    return false;
  }
}

/**
 * Get storage size (approximate)
 */
export function getStorageSize(): number {
  let total = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return total;
}
