/**
 * RouteGuard - Protects routes based on authentication and role requirements
 * 
 * Usage:
 * <Route path="/admin" element={
 *   <RouteGuard requireAuth minRole="manager">
 *     <AdminPage />
 *   </RouteGuard>
 * } />
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '@/hooks/useAuth';

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  superadmin: 100,
  owner: 80,
  manager: 60,
  employee: 40,
};

interface RouteGuardProps {
  children: React.ReactNode;
  /** Require user to be authenticated */
  requireAuth?: boolean;
  /** Require user to NOT be authenticated (for login page) */
  requireGuest?: boolean;
  /** Required roles (any of these) */
  roles?: UserRole[];
  /** Minimum role level */
  minRole?: UserRole;
  /** Where to redirect if unauthorized */
  redirectTo?: string;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
}

/**
 * Default loading spinner
 */
function DefaultLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
}

/**
 * Check if user role meets minimum requirement
 */
function meetsMinRole(userRole: UserRole | undefined, minRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/**
 * Check if user has one of the required roles
 */
function hasRequiredRole(userRole: UserRole | undefined, roles: UserRole[]): boolean {
  if (!userRole) return false;
  return roles.includes(userRole);
}

/**
 * Get default redirect path based on user role
 */
function getDefaultRedirect(userRole?: UserRole): string {
  if (!userRole) return '/login';
  
  switch (userRole) {
    case 'super_admin':
      return '/superadmin/users';
    case 'owner':
    case 'manager':
    case 'employee':
    default:
      return '/dashboard';
  }
}

export function RouteGuard({
  children,
  requireAuth = true,
  requireGuest = false,
  roles,
  minRole,
  redirectTo,
  loadingComponent,
}: RouteGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (isLoading) {
    return <>{loadingComponent || <DefaultLoader />}</>;
  }

  // Guest-only routes (like login)
  if (requireGuest) {
    if (isAuthenticated) {
      const redirect = redirectTo || getDefaultRedirect(user?.role);
      return <Navigate to={redirect} replace />;
    }
    return <>{children}</>;
  }

  // Auth required routes
  if (requireAuth && !isAuthenticated) {
    // Save intended destination for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based access
  if (roles && roles.length > 0) {
    if (!hasRequiredRole(user?.role, roles)) {
      const redirect = redirectTo || getDefaultRedirect(user?.role);
      return <Navigate to={redirect} replace />;
    }
  }

  // Minimum role check
  if (minRole) {
    if (!meetsMinRole(user?.role, minRole)) {
      const redirect = redirectTo || getDefaultRedirect(user?.role);
      return <Navigate to={redirect} replace />;
    }
  }

  // All checks passed
  return <>{children}</>;
}

/**
 * Convenience wrapper for auth-required routes
 */
export function AuthRoute({ children }: { children: React.ReactNode }) {
  return <RouteGuard requireAuth>{children}</RouteGuard>;
}

/**
 * Convenience wrapper for guest-only routes (login, register)
 */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  return <RouteGuard requireGuest>{children}</RouteGuard>;
}

/**
 * Convenience wrapper for owner+ routes
 */
export function OwnerRoute({ children }: { children: React.ReactNode }) {
  return <RouteGuard requireAuth minRole="owner">{children}</RouteGuard>;
}

/**
 * Convenience wrapper for manager+ routes
 */
export function ManagerRoute({ children }: { children: React.ReactNode }) {
  return <RouteGuard requireAuth minRole="manager">{children}</RouteGuard>;
}

/**
 * Convenience wrapper for super admin routes
 */
export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  return <RouteGuard requireAuth roles={['super_admin']}>{children}</RouteGuard>;
}

export default RouteGuard;
