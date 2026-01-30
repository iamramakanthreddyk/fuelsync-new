/**
 * Comprehensive Role and Plan-Based Access Control Middleware
 * Guards APIs and features based on user roles and subscription plans
 */

const { User, Station } = require('../models');

/**
 * Permission definitions for different features
 */
const PERMISSIONS = {
  // Export features
  EXPORT_CSV: 'export_csv',
  EXPORT_PDF: 'export_pdf',
  EXPORT_REPORTS: 'export_reports',

  // Report features
  VIEW_SALES_REPORTS: 'view_sales_reports',
  VIEW_PROFIT_LOSS: 'view_profit_loss',
  VIEW_ADVANCED_REPORTS: 'view_advanced_reports',
  VIEW_SAMPLE_REPORTS: 'view_sample_reports',

  // Management features
  MANAGE_STATIONS: 'manage_stations',
  MANAGE_USERS: 'manage_users',
  MANAGE_PLANS: 'manage_plans',
  MANAGE_EQUIPMENT: 'manage_equipment',

  // Data entry features
  MANUAL_DATA_ENTRY: 'manual_data_entry',
  BULK_DATA_ENTRY: 'bulk_data_entry',

  // Administrative features
  SYSTEM_ADMIN: 'system_admin',
  AUDIT_LOGS: 'audit_logs',
  BACKUP_RESTORE: 'backup_restore'
};

/**
 * Role hierarchy and permissions mapping
 */
const ROLE_PERMISSIONS = {
  super_admin: [
    PERMISSIONS.SYSTEM_ADMIN,
    PERMISSIONS.MANAGE_PLANS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_STATIONS,
    PERMISSIONS.MANAGE_EQUIPMENT,
    PERMISSIONS.EXPORT_CSV,
    PERMISSIONS.EXPORT_PDF,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_SALES_REPORTS,
    PERMISSIONS.VIEW_PROFIT_LOSS,
    PERMISSIONS.VIEW_ADVANCED_REPORTS,
    PERMISSIONS.VIEW_SAMPLE_REPORTS,
    PERMISSIONS.MANUAL_DATA_ENTRY,
    PERMISSIONS.BULK_DATA_ENTRY,
    PERMISSIONS.AUDIT_LOGS,
    PERMISSIONS.BACKUP_RESTORE
  ],
  owner: [
    PERMISSIONS.MANAGE_STATIONS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_EQUIPMENT,
    PERMISSIONS.EXPORT_CSV,
    PERMISSIONS.EXPORT_PDF,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_SALES_REPORTS,
    PERMISSIONS.VIEW_PROFIT_LOSS,
    PERMISSIONS.VIEW_ADVANCED_REPORTS,
    PERMISSIONS.VIEW_SAMPLE_REPORTS,
    PERMISSIONS.MANUAL_DATA_ENTRY,
    PERMISSIONS.BULK_DATA_ENTRY
  ],
  manager: [
    PERMISSIONS.VIEW_SALES_REPORTS,
    PERMISSIONS.VIEW_SAMPLE_REPORTS,
    PERMISSIONS.MANUAL_DATA_ENTRY,
    PERMISSIONS.EXPORT_CSV,
    PERMISSIONS.EXPORT_PDF
  ],
  employee: [
    PERMISSIONS.MANUAL_DATA_ENTRY,
    PERMISSIONS.VIEW_SALES_REPORTS
  ]
};

/**
 * Plan-based feature restrictions
 */
const PLAN_FEATURES = {
  // Basic/Free plans
  basic: {
    [PERMISSIONS.EXPORT_CSV]: { allowed: true, quota: 5 },
    [PERMISSIONS.EXPORT_PDF]: { allowed: true, quota: 3 },
    [PERMISSIONS.EXPORT_REPORTS]: { allowed: false },
    [PERMISSIONS.VIEW_PROFIT_LOSS]: { allowed: false },
    [PERMISSIONS.VIEW_ADVANCED_REPORTS]: { allowed: false },
    [PERMISSIONS.MANUAL_DATA_ENTRY]: { allowed: true, quota: 20 },
    [PERMISSIONS.BULK_DATA_ENTRY]: { allowed: false }
  },
  // Standard plans
  standard: {
    [PERMISSIONS.EXPORT_CSV]: { allowed: true, quota: 50 },
    [PERMISSIONS.EXPORT_PDF]: { allowed: true, quota: 25 },
    [PERMISSIONS.EXPORT_REPORTS]: { allowed: true, quota: 10 },
    [PERMISSIONS.VIEW_PROFIT_LOSS]: { allowed: false },
    [PERMISSIONS.VIEW_ADVANCED_REPORTS]: { allowed: true, quota: 20 },
    [PERMISSIONS.MANUAL_DATA_ENTRY]: { allowed: true, quota: 100 },
    [PERMISSIONS.BULK_DATA_ENTRY]: { allowed: false }
  },
  // Premium plans
  premium: {
    [PERMISSIONS.EXPORT_CSV]: { allowed: true, unlimited: true },
    [PERMISSIONS.EXPORT_PDF]: { allowed: true, unlimited: true },
    [PERMISSIONS.EXPORT_REPORTS]: { allowed: true, unlimited: true },
    [PERMISSIONS.VIEW_PROFIT_LOSS]: { allowed: true, unlimited: true },
    [PERMISSIONS.VIEW_ADVANCED_REPORTS]: { allowed: true, unlimited: true },
    [PERMISSIONS.MANUAL_DATA_ENTRY]: { allowed: true, unlimited: true },
    [PERMISSIONS.BULK_DATA_ENTRY]: { allowed: true, unlimited: true }
  }
};

/**
 * Check if user has a specific permission
 */
const hasPermission = (user, permission) => {
  if (!user || !user.role) return false;

  const rolePermissions = ROLE_PERMISSIONS[user.role.toLowerCase()] || [];
  return rolePermissions.includes(permission);
};

/**
 * Check if user's plan allows a specific feature
 */
const checkPlanFeature = (user, permission) => {
  if (!user || !user.plan) return { allowed: false, reason: 'No plan assigned' };

  // Super admin bypasses plan restrictions
  if (user.role === 'super_admin' || user.role === 'superadmin') {
    return { allowed: true, unlimited: true };
  }

  const planName = user.plan.name?.toLowerCase();
  const planFeatures = PLAN_FEATURES[planName];

  if (!planFeatures) {
    return { allowed: false, reason: 'Unknown plan' };
  }

  const featureConfig = planFeatures[permission];
  if (!featureConfig) {
    return { allowed: false, reason: 'Feature not available in plan' };
  }

  return featureConfig;
};

/**
 * Middleware to require specific permissions
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const user = await User.findByPk(userId, {
        include: [{ model: require('../models').Plan, as: 'plan' }]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      // Check role-based permission
      if (!hasPermission(user, permission)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          requiredPermission: permission,
          userRole: user.role
        });
      }

      // Check plan-based feature access
      const planCheck = checkPlanFeature(user, permission);
      if (!planCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: 'Feature not available in your plan',
          reason: planCheck.reason,
          planName: user.plan?.name,
          upgradeRequired: true
        });
      }

      // Attach permission info to request
      req.userPermissions = {
        hasPermission: true,
        planLimits: planCheck,
        userRole: user.role,
        planName: user.plan?.name
      };

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      next(error);
    }
  };
};

/**
 * Middleware to require minimum role
 */
const requireRole = (...roles) => {
  // Accept either requireRole('owner') or requireRole(['owner','super_admin'])
  const normalize = (r) => {
    if (Array.isArray(r)) return r;
    if (typeof r === 'string') return [r];
    return [];
  };

  return async (req, res, next) => {
    try {
      const allowed = roles.length === 1 && Array.isArray(roles[0]) ? roles[0] : roles;
      const allowedRoles = normalize(allowed).map(role => String(role).toLowerCase());

      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      const userRole = (user.role || '').toLowerCase();

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient role permissions',
          requiredRoles: allowedRoles,
          userRole: user.role
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      next(error);
    }
  };
};

/**
 * Middleware for station-based access control
 */
const requireStationAccess = (permission = null) => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      const stationId = req.params.stationId || req.body.stationId || req.query.stationId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const user = await User.findByPk(userId, {
        include: [{ model: require('../models').Plan, as: 'plan' }]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      // Super admin has access to all stations
      if (user.role === 'super_admin' || user.role === 'superadmin') {
        req.stationAccess = { allowed: true, allStations: true };
        return next();
      }

      // Check station ownership for owners
      if (user.role === 'owner') {
        if (stationId) {
          const station = await Station.findByPk(stationId);
          if (!station || station.ownerId !== user.id) {
            return res.status(403).json({
              success: false,
              error: 'Access denied to this station'
            });
          }
        }
        req.stationAccess = { allowed: true, stationId };
        return next();
      }

      // Managers and employees can only access their assigned station
      if (user.stationId) {
        if (stationId && stationId !== user.stationId.toString()) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to this station'
          });
        }
        req.stationAccess = { allowed: true, stationId: user.stationId };
      } else {
        return res.status(403).json({
          success: false,
          error: 'No station assigned'
        });
      }

      // If permission is specified, check it
      if (permission) {
        if (!hasPermission(user, permission)) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions for this action'
          });
        }

        const planCheck = checkPlanFeature(user, permission);
        if (!planCheck.allowed) {
          return res.status(403).json({
            success: false,
            error: 'Feature not available in your plan',
            upgradeRequired: true
          });
        }
      }

      next();
    } catch (error) {
      console.error('Station access check error:', error);
      next(error);
    }
  };
};

/** * Check if date range is within plan limits
 */
const checkDateRangeLimit = (user, startDate, endDate, dataType = 'analytics', ownerPlan = null) => {
  // Use user's plan if present, otherwise fall back to owner's plan when provided
  const plan = user.plan || ownerPlan;
  if (!plan) {
    return { allowed: false, reason: 'No plan assigned' };
  }
  let maxDays = 30; // Default fallback

  // Determine max days based on data type
  switch (dataType) {
    case 'sales_reports':
      maxDays = plan.salesReportsDays || 30;
      break;
    case 'profit_reports':
      maxDays = plan.profitReportsDays || 30;
      break;
    case 'analytics':
      maxDays = plan.analyticsDataDays || 90;
      break;
    case 'audit_logs':
      maxDays = plan.auditLogsDays || 30;
      break;
    case 'transactions':
      maxDays = plan.transactionHistoryDays || 90;
      break;
    default:
      maxDays = plan.analyticsDataDays || 90;
  }

  // Super admin and unlimited plans have no restrictions
  const userRole = (user.role || '').toLowerCase();
  if (userRole === 'super_admin' || maxDays === -1 || maxDays === 0) {
    return { allowed: true };
  }

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculate days difference from today
  const daysFromToday = Math.ceil((now - start) / (1000 * 60 * 60 * 24));

  if (daysFromToday > maxDays) {
    return {
      allowed: false,
      reason: `Your plan allows access to ${maxDays} days of historical data. Requested range exceeds this limit.`,
      maxDays,
      requestedDays: daysFromToday
    };
  }

  return { allowed: true, maxDays };
};

/**
 * Middleware to enforce date range limits based on plan
 */
const enforceDateRangeLimit = (dataType = 'analytics') => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const user = await User.findByPk(userId, {
        include: [{ model: require('../models').Plan, as: 'plan' }]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      // Extract date range from query parameters
      const { startDate, endDate, date, start_date, end_date } = req.query;

      let start = startDate || start_date || date;
      let end = endDate || end_date || date;

      // If no dates provided, allow (will use default ranges)
      if (!start && !end) {
        return next();
      }

      // Set default end date to today if not provided
      if (!end) {
        end = new Date().toISOString().split('T')[0];
      }

      // Set default start date if not provided
      if (!start) {
        // Use a reasonable default (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        start = sevenDaysAgo.toISOString().split('T')[0];
      }

      // If user has no plan (e.g. manager/employee), attempt to fall back to the station owner's plan.
      // Prefer an explicit stationId passed in query/body when resolving owner plan.
      let ownerPlan = null;
      if (!user.plan) {
        const requestedStationId = req.query.stationId || req.body.stationId || user.stationId;
        if (requestedStationId) {
          try {
            const station = await Station.findByPk(requestedStationId);
            if (station && station.ownerId) {
              const owner = await User.findByPk(station.ownerId, {
                include: [{ model: require('../models').Plan, as: 'plan' }]
              });
              ownerPlan = owner?.plan || null;
            }
          } catch (err) {
            console.warn('Failed to fetch station owner plan for date range fallback', err);
          }
        }
      }

      const rangeCheck = checkDateRangeLimit(user, start, end, dataType, ownerPlan);

      if (!rangeCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: 'Date range exceeds plan limits',
          reason: rangeCheck.reason,
          maxDays: rangeCheck.maxDays,
          requestedDays: rangeCheck.requestedDays,
          planName: (user.plan && user.plan.name) || (ownerPlan && ownerPlan.name) || null,
          upgradeRequired: true
        });
      }

      // Attach range info to request
      req.dateRangeLimits = {
        allowed: true,
        maxDays: rangeCheck.maxDays,
        requestedStart: start,
        requestedEnd: end
      };

      next();
    } catch (error) {
      console.error('Date range limit check error:', error);
      next(error);
    }
  };
};

/** * Get user's permissions and plan features
 */
const getUserPermissions = async (userId) => {
  try {
    const user = await User.findByPk(userId, {
      include: [{ model: require('../models').Plan, as: 'plan' }]
    });

    if (!user) return null;

    const rolePermissions = ROLE_PERMISSIONS[user.role?.toLowerCase()] || [];
    const planFeatures = PLAN_FEATURES[user.plan?.name?.toLowerCase()] || {};

    return {
      userId,
      role: user.role,
      planName: user.plan?.name,
      rolePermissions,
      planFeatures,
      isSuperAdmin: user.role === 'super_admin' || user.role === 'superadmin'
    };
  } catch (error) {
    console.error('Get user permissions error:', error);
    return null;
  }
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  PLAN_FEATURES,
  hasPermission,
  checkPlanFeature,
  checkDateRangeLimit,
  requirePermission,
  requireRole,
  requireStationAccess,
  enforceDateRangeLimit,
  getUserPermissions
};