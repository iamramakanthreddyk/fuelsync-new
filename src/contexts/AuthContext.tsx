/**
 * @deprecated This file is DEPRECATED.
 * 
 * Use the consolidated auth hook instead:
 * import { useAuth, useRoleAccess, AuthProvider } from '@/hooks/useAuth';
 * 
 * All functionality has been merged into hooks/useAuth.tsx:
 * - useAuth() - main auth hook with user, login, logout, etc.
 * - useRoleAccess() - role-based access control helpers
 * - AuthProvider - context provider
 * 
 * This file is kept for backward compatibility and will be removed in a future version.
 */

// Re-export everything from the new consolidated auth hook
export { 
  AuthProvider, 
  useAuth, 
  useAuthSafe,
  useRoleAccess,
  type User,
  type UserRole
} from '@/hooks/useAuth';
