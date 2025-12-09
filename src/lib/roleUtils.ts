/**
 * Role Normalization Utilities
 * Provides consistent role comparison and normalization across the application
 */

/**
 * Normalize a role string to canonical form
 * Handles case sensitivity and common variations
 */
export function normalizeRole(role?: string): string {
  if (!role) return '';
  
  const lower = role.toLowerCase().trim();
  
  // Normalize variations to canonical forms
  if (lower === 'superadmin' || lower === 'super admin' || lower === 'super_admin') {
    return 'super_admin';
  }
  // legacy mapping: accept 'pump owner' variants but normalize to 'owner'
  if (lower === 'pump owner' || lower === 'pump_owner') {
    return 'owner';
  }
  
  return lower;
}

/**
 * Check if a role is an owner role
 */
export function isOwner(role?: string): boolean {
  return normalizeRole(role) === 'owner';
}

/**
 * Check if a role is a super admin role
 */
export function isSuperAdmin(role?: string): boolean {
  return normalizeRole(role) === 'super_admin';
}

/**
 * Check if a role is a manager role
 */
export function isManager(role?: string): boolean {
  return normalizeRole(role) === 'manager';
}

/**
 * Check if a role is an employee role
 */
export function isEmployee(role?: string): boolean {
  return normalizeRole(role) === 'employee';
}

/**
 * Get dashboard URL for a given role
 */
export function getDashboardUrl(role?: string): string {
  const normalized = normalizeRole(role);
  
  switch (normalized) {
    case 'super_admin':
      return '/superadmin/users';
    case 'owner':
      return '/owner/dashboard';
    case 'manager':
    case 'employee':
    default:
      return '/dashboard';
  }
}
