/**
 * Core Hooks
 * 
 * Centralized export of all application hooks.
 * 
 * @module core/hooks
 */

// Re-export existing hooks
export { useAuth, useRoleAccess, AuthProvider } from '../../hooks/useAuth';
export { useErrorHandler } from '../../hooks/useErrorHandler';

// Export new core hooks
export * from './useApi';
export * from './useLocalStorage';
export * from './useDebounce';
export * from './usePagination';
