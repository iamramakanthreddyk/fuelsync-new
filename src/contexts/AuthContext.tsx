/**
 * @deprecated This file is DEPRECATED.
 * 
 * Use the separate hook imports instead:
 * import { useAuth, AuthProvider } from '@/hooks/useAuth';
 * import { useRoleAccess } from '@/hooks/useRoleAccess';
 * 
 * Functionality is spread across two hooks to avoid circular imports:
 * - useAuth() - main auth hook with user, login, logout, etc. (from useAuth.tsx)
 * - useRoleAccess() - role-based access control (from useRoleAccess.tsx)
 * - AuthProvider - context provider (from useAuth.tsx)
 * 
 * This file is kept for backward compatibility and will be removed in a future version.
 */

// Re-export everything from the separate auth modules
export { 
  AuthProvider, 
  useAuth, 
  useAuthSafe,
  type User,
  type UserRole
} from '@/hooks/useAuth';
export { useRoleAccess } from '@/hooks/useRoleAccess';
