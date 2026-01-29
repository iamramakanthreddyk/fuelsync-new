import { useAuth } from './useAuth';
import { apiClient } from '@/lib/api-client';

export interface PermissionCheck {
  hasPermission: boolean;
  hasRole: boolean;
  planAllows: boolean;
  isSuperAdmin: boolean;
  reason?: string;
  upgradeRequired?: boolean;
}

export interface UserPermissions {
  // Export permissions
  canExportCSV: boolean;
  canExportPDF: boolean;
  canExportReports: boolean;

  // Report permissions
  canViewSalesReports: boolean;
  canViewProfitLoss: boolean;
  canViewAdvancedReports: boolean;
  canViewSampleReports: boolean;

  // Management permissions
  canManageStations: boolean;
  canManageUsers: boolean;
  canManagePlans: boolean;
  canManageEquipment: boolean;

  // Data entry permissions
  canManualDataEntry: boolean;
  canBulkDataEntry: boolean;

  // Admin permissions
  isSuperAdmin: boolean;
  canAuditLogs: boolean;
  canBackupRestore: boolean;

  // Date range limits (days back from today)
  maxSalesReportsDays: number;
  maxProfitReportsDays: number;
  maxAnalyticsDataDays: number;
  maxAuditLogsDays: number;
  maxTransactionHistoryDays: number;

  // Plan info
  planName?: string;
  role: string;
}

/**
 * Hook to check if user has a specific permission
 */
export const usePermission = (permission: string): PermissionCheck => {
  const { user } = useAuth();

  if (!user) {
    return {
      hasPermission: false,
      hasRole: false,
      planAllows: false,
      isSuperAdmin: false,
      reason: 'Not authenticated'
    };
  }

  const userRole = String(user.role || '').toLowerCase();
  const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin';

  // Super admin has all permissions
  if (isSuperAdmin) {
    return {
      hasPermission: true,
      hasRole: true,
      planAllows: true,
      isSuperAdmin: true
    };
  }

  // Check role-based permissions
  const rolePermissions = getRolePermissions(user.role);
  const hasRolePermission = rolePermissions.includes(permission);

  // Check plan-based permissions
  const planCheck = checkPlanPermission(user, permission);

  return {
    hasPermission: hasRolePermission && planCheck.allowed,
    hasRole: hasRolePermission,
    planAllows: planCheck.allowed,
    isSuperAdmin: false,
    reason: planCheck.reason,
    upgradeRequired: !planCheck.allowed
  };
};

/**
 * Hook to check if user has a specific role
 */
export const useRole = (allowedRoles: string[]): boolean => {
  const { user } = useAuth();

  if (!user) return false;

  const userRole = String(user.role || '').toLowerCase();
  return allowedRoles.some(role => role.toLowerCase() === userRole);
};

/**
 * Hook to get comprehensive user permissions
 */
export const useUserPermissions = (): UserPermissions => {
  const { user } = useAuth();

  if (!user) {
    return getDefaultPermissions();
  }

  const userRole = String(user.role || '').toLowerCase();
  const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin';
  const rolePermissions = getRolePermissions(userRole);

  console.log('[DEBUG] useUserPermissions - user:', user);
  console.log('[DEBUG] useUserPermissions - user.plan:', user.plan);
  console.log('[DEBUG] useUserPermissions - salesReportsDays:', user.plan?.salesReportsDays);

  return {
    // Export permissions
    canExportCSV: isSuperAdmin || (rolePermissions.includes('export_csv') && checkPlanPermission(user, 'export_csv').allowed),
    canExportPDF: isSuperAdmin || (rolePermissions.includes('export_pdf') && checkPlanPermission(user, 'export_pdf').allowed),
    canExportReports: isSuperAdmin || (rolePermissions.includes('export_reports') && checkPlanPermission(user, 'export_reports').allowed),

    // Report permissions
    canViewSalesReports: isSuperAdmin || rolePermissions.includes('view_sales_reports'),
    canViewProfitLoss: isSuperAdmin || (rolePermissions.includes('view_profit_loss') && checkPlanPermission(user, 'view_profit_loss').allowed),
    canViewAdvancedReports: isSuperAdmin || (rolePermissions.includes('view_advanced_reports') && checkPlanPermission(user, 'view_advanced_reports').allowed),
    canViewSampleReports: isSuperAdmin || rolePermissions.includes('view_sample_reports'),

    // Management permissions
    canManageStations: isSuperAdmin || rolePermissions.includes('manage_stations'),
    canManageUsers: isSuperAdmin || rolePermissions.includes('manage_users'),
    canManagePlans: isSuperAdmin || rolePermissions.includes('manage_plans'),
    canManageEquipment: isSuperAdmin || rolePermissions.includes('manage_equipment'),

    // Data entry permissions
    canManualDataEntry: isSuperAdmin || (rolePermissions.includes('manual_data_entry') && checkPlanPermission(user, 'manual_data_entry').allowed),
    canBulkDataEntry: isSuperAdmin || (rolePermissions.includes('bulk_data_entry') && checkPlanPermission(user, 'bulk_data_entry').allowed),

    // Admin permissions
    isSuperAdmin,
    canAuditLogs: isSuperAdmin || rolePermissions.includes('audit_logs'),
    canBackupRestore: isSuperAdmin || rolePermissions.includes('backup_restore'),

    // Date range limits
    maxSalesReportsDays: isSuperAdmin ? -1 : (user.plan?.salesReportsDays || 30),
    maxProfitReportsDays: isSuperAdmin ? -1 : (user.plan?.profitReportsDays || 30),
    maxAnalyticsDataDays: isSuperAdmin ? -1 : (user.plan?.analyticsDataDays || 90),
    maxAuditLogsDays: isSuperAdmin ? -1 : (user.plan?.auditLogsDays || 30),
    maxTransactionHistoryDays: isSuperAdmin ? -1 : (user.plan?.transactionHistoryDays || 90),

    // Plan info
    planName: user.plan?.name,
    role: user.role
  };
};

/**
 * Get role-based permissions
 */
const getRolePermissions = (role: string): string[] => {
  const rolePermissions: Record<string, string[]> = {
    super_admin: [
      'system_admin', 'manage_plans', 'manage_users', 'manage_stations', 'manage_equipment',
      'export_csv', 'export_pdf', 'export_reports', 'view_sales_reports', 'view_profit_loss',
      'view_advanced_reports', 'view_sample_reports', 'manual_data_entry', 'bulk_data_entry',
      'audit_logs', 'backup_restore'
    ],
    owner: [
      'manage_stations', 'manage_users', 'manage_equipment', 'export_csv', 'export_pdf',
      'export_reports', 'view_sales_reports', 'view_profit_loss', 'view_advanced_reports',
      'view_sample_reports', 'manual_data_entry', 'bulk_data_entry'
    ],
    manager: [
      'view_sales_reports', 'view_sample_reports', 'manual_data_entry', 'export_csv', 'export_pdf'
    ],
    employee: [
      'manual_data_entry', 'view_sales_reports'
    ]
  };

  return rolePermissions[role?.toLowerCase()] || [];
};

/**
 * Check plan-based permission
 */
const checkPlanPermission = (user: any, permission: string): { allowed: boolean; reason?: string } => {
  if (!user.plan) {
    return { allowed: false, reason: 'No plan assigned' };
  }

  const planName = user.plan.name?.toLowerCase();

  // Plan feature mappings
  const planFeatures: Record<string, Record<string, any>> = {
    basic: {
      export_csv: { allowed: true, quota: 5 },
      export_pdf: { allowed: true, quota: 3 },
      export_reports: { allowed: false },
      view_profit_loss: { allowed: false },
      view_advanced_reports: { allowed: false },
      manual_data_entry: { allowed: true, quota: 20 },
      bulk_data_entry: { allowed: false }
    },
    standard: {
      export_csv: { allowed: true, quota: 50 },
      export_pdf: { allowed: true, quota: 25 },
      export_reports: { allowed: true, quota: 10 },
      view_profit_loss: { allowed: false },
      view_advanced_reports: { allowed: true, quota: 20 },
      manual_data_entry: { allowed: true, quota: 100 },
      bulk_data_entry: { allowed: false }
    },
    premium: {
      export_csv: { allowed: true, unlimited: true },
      export_pdf: { allowed: true, unlimited: true },
      export_reports: { allowed: true, unlimited: true },
      view_profit_loss: { allowed: true, unlimited: true },
      view_advanced_reports: { allowed: true, unlimited: true },
      manual_data_entry: { allowed: true, unlimited: true },
      bulk_data_entry: { allowed: true, unlimited: true }
    }
  };

  const planConfig = planFeatures[planName];
  if (!planConfig) {
    return { allowed: false, reason: 'Unknown plan' };
  }

  const featureConfig = planConfig[permission];
  if (!featureConfig) {
    return { allowed: false, reason: 'Feature not available in plan' };
  }

  return { allowed: featureConfig.allowed || featureConfig.unlimited };
};

/**
 * Default permissions for unauthenticated users
 */
const getDefaultPermissions = (): UserPermissions => ({
  canExportCSV: false,
  canExportPDF: false,
  canExportReports: false,
  canViewSalesReports: false,
  canViewProfitLoss: false,
  canViewAdvancedReports: false,
  canViewSampleReports: false,
  canManageStations: false,
  canManageUsers: false,
  canManagePlans: false,
  canManageEquipment: false,
  canManualDataEntry: false,
  canBulkDataEntry: false,
  isSuperAdmin: false,
  canAuditLogs: false,
  canBackupRestore: false,
  maxSalesReportsDays: 7,
  maxProfitReportsDays: 7,
  maxAnalyticsDataDays: 7,
  maxAuditLogsDays: 7,
  maxTransactionHistoryDays: 7,
  role: 'guest'
});

/**
 * Component wrapper for permission-based rendering
 */
export const PermissionGuard: React.FC<{
  permission?: string;
  roles?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ permission, roles, fallback = null, children }) => {
  const permissionCheck = usePermission(permission || '');
  const hasRole = useRole(roles || []);

  if (permission && !permissionCheck.hasPermission) {
    return <>{fallback}</>;
  }

  if (roles && !hasRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Hook to check PDF export permission specifically
 */
export const usePDFExportPermission = () => {
  return usePermission('export_pdf');
};

/**
 * Hook to check CSV export permission specifically
 */
export const useCSVExportPermission = () => {
  return usePermission('export_csv');
};

/**
 * Hook to get date range limits for different data types
 */
export const useDateRangeLimits = () => {
  const permissions = useUserPermissions();

  const getMaxDateForType = (type: 'sales' | 'profit' | 'analytics' | 'audit' | 'transactions'): Date => {
    let maxDays: number;

    switch (type) {
      case 'sales':
        maxDays = permissions.maxSalesReportsDays;
        break;
      case 'profit':
        maxDays = permissions.maxProfitReportsDays;
        break;
      case 'analytics':
        maxDays = permissions.maxAnalyticsDataDays;
        break;
      case 'audit':
        maxDays = permissions.maxAuditLogsDays;
        break;
      case 'transactions':
        maxDays = permissions.maxTransactionHistoryDays;
        break;
      default:
        maxDays = 30;
    }

    // -1 means unlimited
    if (maxDays === -1) {
      return new Date('2099-12-31'); // Far future date
    }

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() - maxDays);
    return maxDate;
  };

  const isDateRangeAllowed = (startDate: Date, endDate: Date, type: 'sales' | 'profit' | 'analytics' | 'audit' | 'transactions'): boolean => {
    const maxDate = getMaxDateForType(type);
    return startDate >= maxDate;
  };

  return {
    permissions,
    getMaxDateForType,
    isDateRangeAllowed
  };
};

/**
 * Legacy hook for backward compatibility - returns canAccessFeature function
 */
export const usePermissions = () => {
  const permissions = useUserPermissions();

  const canAccessFeature = (feature: string): boolean => {
    switch (feature) {
      case 'pdf_export':
        return permissions.canExportPDF;
      case 'csv_export':
        return permissions.canExportCSV;
      case 'reports_export':
        return permissions.canExportReports;
      case 'sales_reports':
        return permissions.canViewSalesReports;
      case 'profit_loss':
        return permissions.canViewProfitLoss;
      case 'advanced_reports':
        return permissions.canViewAdvancedReports;
      case 'sample_reports':
        return permissions.canViewSampleReports;
      case 'manage_stations':
        return permissions.canManageStations;
      case 'manage_users':
        return permissions.canManageUsers;
      case 'manage_plans':
        return permissions.canManagePlans;
      case 'manage_equipment':
        return permissions.canManageEquipment;
      case 'manual_data_entry':
        return permissions.canManualDataEntry;
      case 'bulk_data_entry':
        return permissions.canBulkDataEntry;
      case 'audit_logs':
        return permissions.canAuditLogs;
      case 'backup_restore':
        return permissions.canBackupRestore;
      default:
        return false;
    }
  };

  return {
    canAccessFeature,
    permissions
  };
};