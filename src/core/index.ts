/**
 * Core Module
 * 
 * Centralized exports for the entire core architecture.
 * This is the main entry point for importing core functionality.
 * 
 * @module core
 * 
 * @example
 * // Import specific items
 * import { User, UserRole, ROUTES, useApi } from '@/core';
 * 
 * // Or import from specific modules
 * import { User } from '@/core/models';
 * import { UserRole } from '@/core/enums';
 * import { ROUTES } from '@/core/constants';
 */

// Export all models
export * from './models';

// Export all enums
export * from './enums';

// Export all constants
export * from './constants';

// Export hooks
export * from './hooks';

// Export utility functions
export * from './utils';

// Export reusable components
export * from './components';

// Export i18n configuration
// Note: i18n requires npm packages to be installed
// export * from './i18n';
