/**
 * Centralized badge color system for consistent styling across the application
 * Provides standardized colors for user roles, status indicators, and other enums
 */

export type UserRole = 'super_admin' | 'owner' | 'manager' | 'employee';
export type StatusType = 'active' | 'inactive' | 'balanced' | 'over' | 'short';

/**
 * Get standardized badge classes for user roles
 */
export const getRoleBadgeClasses = (role: string): string => {
  // Normalize the role to lowercase and handle common variations
  const normalizedRole = role?.toLowerCase()?.replace('_', '') || '';

  switch (normalizedRole) {
    case 'superadmin':
    case 'super_admin':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'owner':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'manager':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'employee':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      console.warn('Unknown role:', role, 'normalized to:', normalizedRole);
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Get standardized badge classes for status indicators
 */
export const getStatusBadgeClasses = (status: StatusType): string => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'inactive':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'balanced':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'over':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'short':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Get standardized badge classes for financial differences
 */
export const getDifferenceBadgeClasses = (difference: number): string => {
  const absDiff = Math.abs(difference);

  if (absDiff < 0.01) {
    return 'bg-green-100 text-green-800 border-green-200'; // Balanced
  } else if (absDiff < 100) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Minor difference
  } else {
    return 'bg-red-100 text-red-800 border-red-200'; // Significant difference
  }
};

/**
 * Get standardized badge classes for plan status
 */
export const getPlanBadgeClasses = (isActive: boolean): string => {
  return isActive
    ? 'bg-green-100 text-green-800 border-green-200'
    : 'bg-red-100 text-red-800 border-red-200';
};

/**
 * Get standardized badge classes for station status
 */
export const getStationBadgeClasses = (isActive: boolean): string => {
  return isActive
    ? 'bg-green-100 text-green-800 border-green-200'
    : 'bg-red-100 text-red-800 border-red-200';
};