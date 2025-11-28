/**
 * PermissionGate Component
 * 
 * Provides role-based access control for UI elements.
 * Wraps children and only renders them if user has required permissions.
 * 
 * @example
 * <PermissionGate roles={['owner', 'manager']}>
 *   <SettingsPanel />
 * </PermissionGate>
 * 
 * @example
 * <PermissionGate 
 *   roles={['owner']} 
 *   fallback={<AccessDenied />}
 * >
 *   <AdminSection />
 * </PermissionGate>
 */

import React, { ReactNode, ComponentType } from 'react';
import { useAuth, type UserRole } from '@/hooks/useAuth';

// Role hierarchy - higher number = more permissions
const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  superadmin: 100,
  owner: 80,
  manager: 60,
  employee: 40,
};

// Permission definitions for different actions
export const PERMISSIONS = {
  // Station management
  'station:create': ['super_admin', 'owner'] as UserRole[],
  'station:edit': ['super_admin', 'owner', 'manager'] as UserRole[],
  'station:delete': ['super_admin', 'owner'] as UserRole[],
  'station:settings': ['super_admin', 'owner', 'manager'] as UserRole[],
  
  // Pump management
  'pump:create': ['super_admin', 'owner', 'manager'] as UserRole[],
  'pump:edit': ['super_admin', 'owner', 'manager'] as UserRole[],
  'pump:delete': ['super_admin', 'owner'] as UserRole[],
  
  // Nozzle management
  'nozzle:create': ['super_admin', 'owner', 'manager'] as UserRole[],
  'nozzle:edit': ['super_admin', 'owner', 'manager'] as UserRole[],
  
  // Readings
  'reading:submit': ['super_admin', 'owner', 'manager', 'employee'] as UserRole[],
  'reading:view': ['super_admin', 'owner', 'manager', 'employee'] as UserRole[],
  'reading:edit': ['super_admin', 'owner', 'manager'] as UserRole[],
  'reading:delete': ['super_admin', 'owner'] as UserRole[],
  
  // Shifts
  'shift:start': ['super_admin', 'owner', 'manager', 'employee'] as UserRole[],
  'shift:end': ['super_admin', 'owner', 'manager', 'employee'] as UserRole[],
  'shift:manage': ['super_admin', 'owner', 'manager'] as UserRole[],
  
  // Prices
  'price:set': ['super_admin', 'owner', 'manager'] as UserRole[],
  'price:view': ['super_admin', 'owner', 'manager', 'employee'] as UserRole[],
  
  // Credits
  'credit:create': ['super_admin', 'owner', 'manager', 'employee'] as UserRole[],
  'credit:settle': ['super_admin', 'owner', 'manager'] as UserRole[],
  'credit:manage': ['super_admin', 'owner'] as UserRole[],
  
  // Expenses
  'expense:create': ['super_admin', 'owner', 'manager'] as UserRole[],
  'expense:view': ['super_admin', 'owner', 'manager'] as UserRole[],
  'expense:delete': ['super_admin', 'owner'] as UserRole[],
  
  // Cash handover
  'handover:confirm': ['super_admin', 'owner', 'manager'] as UserRole[],
  
  // Staff management
  'staff:manage': ['super_admin', 'owner'] as UserRole[],
  'staff:invite': ['super_admin', 'owner', 'manager'] as UserRole[],
  
  // Analytics
  'analytics:view': ['super_admin', 'owner', 'manager'] as UserRole[],
  'analytics:export': ['super_admin', 'owner'] as UserRole[],
  
  // System settings
  'system:settings': ['super_admin'] as UserRole[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

interface PermissionGateProps {
  /** Required roles (user must have at least one) */
  roles?: UserRole[];
  /** Required permission (from PERMISSIONS map) */
  permission?: Permission;
  /** Minimum role level (uses hierarchy) */
  minRole?: UserRole;
  /** Content to render if authorized */
  children: ReactNode;
  /** Optional content to render if not authorized */
  fallback?: ReactNode;
  /** If true, requires ALL roles instead of any */
  requireAll?: boolean;
}

/**
 * Check if a user role has permission based on role list
 */
export function hasRole(userRole: UserRole | undefined, allowedRoles: UserRole[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Check if user role meets minimum role level
 */
export function meetsMinRole(userRole: UserRole | undefined, minRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(userRole: UserRole | undefined, permission: Permission): boolean {
  if (!userRole) return false;
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles.includes(userRole);
}

/**
 * PermissionGate component for conditional rendering based on permissions
 */
export function PermissionGate({
  roles,
  permission,
  minRole,
  children,
  fallback = null,
  requireAll = false,
}: PermissionGateProps) {
  const { user } = useAuth();
  
  const userRole = user?.role;
  
  // If no restrictions specified, allow access
  if (!roles && !permission && !minRole) {
    return <>{children}</>;
  }
  
  let isAuthorized = true;
  const checks: boolean[] = [];
  
  // Check roles
  if (roles && roles.length > 0) {
    const roleCheck = requireAll
      ? roles.every(role => role === userRole)
      : hasRole(userRole, roles);
    checks.push(roleCheck);
  }
  
  // Check permission
  if (permission) {
    checks.push(hasPermission(userRole, permission));
  }
  
  // Check minimum role
  if (minRole) {
    checks.push(meetsMinRole(userRole, minRole));
  }
  
  // Combine checks
  if (checks.length > 0) {
    isAuthorized = requireAll
      ? checks.every(Boolean)
      : checks.some(Boolean);
  }
  
  return isAuthorized ? <>{children}</> : <>{fallback}</>;
}

/**
 * Hook to check permissions imperatively
 */
export function usePermissions() {
  const { user } = useAuth();
  const userRole = user?.role;
  
  return {
    userRole,
    hasRole: (roles: UserRole[]) => hasRole(userRole, roles),
    hasPermission: (permission: Permission) => hasPermission(userRole, permission),
    meetsMinRole: (minRole: UserRole) => meetsMinRole(userRole, minRole),
    isOwnerOrAbove: meetsMinRole(userRole, 'owner'),
    isManagerOrAbove: meetsMinRole(userRole, 'manager'),
    isEmployee: userRole === 'employee',
    isSuperAdmin: userRole === 'super_admin',
  };
}

/**
 * Higher-order component for route protection
 */
export function withPermission<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: Pick<PermissionGateProps, 'roles' | 'permission' | 'minRole'>
) {
  return function PermissionProtectedComponent(props: P) {
    return (
      <PermissionGate {...options} fallback={<AccessDeniedMessage />}>
        <WrappedComponent {...props} />
      </PermissionGate>
    );
  };
}

/**
 * Default access denied message
 */
function AccessDeniedMessage() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-destructive/10 p-3 mb-4">
        <svg 
          className="h-6 w-6 text-destructive" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
      <p className="text-muted-foreground text-sm">
        You don't have permission to access this feature.
      </p>
    </div>
  );
}

export default PermissionGate;
