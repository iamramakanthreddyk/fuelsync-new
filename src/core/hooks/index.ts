/**
 * Core Hooks
 * 
 * Centralized export of all application hooks.
 * 
 * @module core/hooks
 */

// Re-export existing hooks
export { useAuth, AuthProvider } from '../../hooks/useAuth';
export { useRoleAccess } from '../../hooks/useRoleAccess';
export { useErrorHandler } from '../../hooks/useErrorHandler';

// Export new core hooks
export * from './useApi';
export * from './useLocalStorage';
export * from './useDebounce';
export * from './usePagination';
