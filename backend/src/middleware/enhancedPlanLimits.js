/**
 * Enhanced Plan Limits Middleware
 * Implements progressive feature degradation and usage quotas for non-paying customers
 */

const { User, Station, Pump, Nozzle, Plan, UserActivityLog } = require('../models');
const { Op } = require('sequelize');

/**
 * Feature degradation levels for non-paying customers
 */
const DEGRADATION_LEVELS = {
  WARNING: 'warning',     // Show upgrade prompts, full functionality
  LIMITED: 'limited',     // Reduce data/rows, add delays
  RESTRICTED: 'restricted', // Major limitations, watermarks
  BLOCKED: 'blocked'      // Feature completely disabled
};

/**
 * Usage quotas for different features (monthly limits)
 */
const USAGE_QUOTAS = {
  exports: 5,        // 5 CSV exports per month
  reports: 10,       // 10 advanced reports per month
  manual_entries: 20 // 20 manual entries per month
};

/**
 * Get current month's usage for a station/feature
 */
const getMonthlyUsage = async (stationId, feature) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const logs = await UserActivityLog.findAll({
    where: {
      stationId,
      activityType: feature,
      occurredAt: {
        [Op.gte]: startOfMonth
      }
    }
  });

  return logs.length;
};

/**
 * Check if user has exceeded usage quota for a feature
 */
const checkUsageQuota = async (stationId, feature) => {
  const quota = USAGE_QUOTAS[feature];
  if (!quota) return { exceeded: false, usage: 0, limit: 0 };

  const usage = await getMonthlyUsage(stationId, feature);
  return {
    exceeded: usage >= quota,
    usage,
    limit: quota,
    remaining: Math.max(0, quota - usage)
  };
};

/**
 * Enhanced plan compliance check with degradation levels
 */
const checkEnhancedPlanCompliance = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId, {
      include: [{ model: Plan, as: 'plan' }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Super admin bypasses all limits
    if ((user.role || '').toLowerCase() === 'super_admin' || (user.role || '').toLowerCase() === 'superadmin') {
      req.planStatus = { level: 'unlimited', features: {} };
      return next();
    }

    // Get owner's plan and station
    let ownerId = user.id;
    let stationId = req.params.stationId || req.body.stationId;

    if (user.role !== 'owner' && user.stationId) {
      const station = await Station.findByPk(user.stationId);
      ownerId = station?.ownerId || user.id;
      stationId = user.stationId;
    }

    const owner = await User.findByPk(ownerId, {
      include: [{ model: Plan, as: 'plan' }]
    });

    if (!owner || !owner.plan) {
      req.planStatus = { level: DEGRADATION_LEVELS.BLOCKED, features: {} };
      return next();
    }

    const plan = owner.plan;
    const degradationLevel = determineDegradationLevel(plan, stationId);
    const featureLimits = await getFeatureLimits(plan, stationId);

    req.planStatus = {
      level: degradationLevel,
      features: featureLimits,
      plan: plan.name,
      stationId
    };

    next();
  } catch (error) {
    console.error('Enhanced plan compliance check error:', error);
    next();
  }
};

/**
 * Determine degradation level based on plan and payment status
 */
const determineDegradationLevel = (plan, stationId) => {
  // For now, base on plan features. Later integrate payment status
  if (plan.canExport && plan.canTrackExpenses && plan.canViewProfitLoss) {
    return DEGRADATION_LEVELS.WARNING; // Premium plan
  } else if (plan.canExport || plan.canTrackCredits) {
    return DEGRADATION_LEVELS.LIMITED; // Basic plan
  } else {
    return DEGRADATION_LEVELS.RESTRICTED; // Free plan
  }
};

/**
 * Get feature-specific limits with usage tracking
 */
const getFeatureLimits = async (plan, stationId) => {
  const limits = {};

  // Export limits
  if (!plan.canExport) {
    const exportQuota = await checkUsageQuota(stationId, 'exports');
    limits.exports = {
      allowed: exportQuota.remaining > 0,
      quota: exportQuota,
      maxRows: exportQuota.remaining > 0 ? 50 : 10, // Limited rows for quota exceeded
      watermark: true
    };
  } else {
    limits.exports = { allowed: true, unlimited: true };
  }

  // Report limits
  if (!plan.canViewProfitLoss) {
    const reportQuota = await checkUsageQuota(stationId, 'reports');
    limits.reports = {
      allowed: reportQuota.remaining > 0,
      quota: reportQuota,
      dataDays: reportQuota.remaining > 0 ? 30 : 7, // Limited history
      advancedFilters: reportQuota.remaining > 0
    };
  } else {
    limits.reports = { allowed: true, unlimited: true };
  }

  // Manual entry limits
  const manualQuota = await checkUsageQuota(stationId, 'manual_entries');
  limits.manualEntries = {
    allowed: manualQuota.remaining > 0,
    quota: manualQuota,
    delay: manualQuota.usage > manualQuota.limit * 0.8 ? 2000 : 0 // Add delay when nearing limit
  };

  return limits;
};

/**
 * Middleware to enforce export limitations
 */
const enforceExportLimits = async (req, res, next) => {
  if (!req.planStatus) {
    return next();
  }

  const exportLimits = req.planStatus.features.exports;
  if (!exportLimits) return next();

  // Log the export attempt
  await logFeatureUsage(req.planStatus.stationId, 'exports', req.userId);

  if (!exportLimits.allowed) {
    return res.status(403).json({
      success: false,
      error: 'Export quota exceeded for this month',
      quota: exportLimits.quota,
      upgradeMessage: 'Upgrade your plan to increase export limits'
    });
  }

  // Add limitations to response
  req.exportLimits = {
    maxRows: exportLimits.maxRows,
    watermark: exportLimits.watermark,
    quota: exportLimits.quota
  };

  next();
};

/**
 * Middleware to enforce report limitations
 */
const enforceReportLimits = async (req, res, next) => {
  if (!req.planStatus) {
    return next();
  }

  const reportLimits = req.planStatus.features.reports;
  if (!reportLimits) return next();

  // Log the report access
  await logFeatureUsage(req.planStatus.stationId, 'reports', req.userId);

  if (!reportLimits.allowed) {
    return res.status(403).json({
      success: false,
      error: 'Advanced reports not available in your plan',
      upgradeMessage: 'Upgrade to access detailed profit/loss reports'
    });
  }

  // Add limitations to request
  req.reportLimits = {
    dataDays: reportLimits.dataDays,
    advancedFilters: reportLimits.advancedFilters,
    quota: reportLimits.quota
  };

  next();
};

/**
 * Log feature usage for quota tracking
 */
const logFeatureUsage = async (stationId, feature, userId) => {
  try {
    await UserActivityLog.create({
      userId,
      stationId,
      activityType: feature,
      details: { timestamp: new Date() },
      occurredAt: new Date()
    });
  } catch (error) {
    console.error('Failed to log feature usage:', error);
  }
};

/**
 * Add upgrade prompts to responses
 */
const addUpgradePrompts = (req, res, next) => {
  if (!req.planStatus || req.planStatus.level === 'unlimited') {
    return next();
  }

  // Add upgrade prompt to response
  const originalJson = res.json;
  res.json = function(data) {
    if (data.success !== false && req.planStatus) {
      data.planStatus = {
        level: req.planStatus.level,
        upgradePrompt: getUpgradePrompt(req.planStatus.level),
        limits: req.planStatus.features
      };
    }
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Get upgrade prompt based on degradation level
 */
const getUpgradePrompt = (level) => {
  switch (level) {
    case DEGRADATION_LEVELS.WARNING:
      return 'Upgrade to unlock unlimited exports and advanced features';
    case DEGRADATION_LEVELS.LIMITED:
      return 'Limited to 50 rows per export. Upgrade for unlimited access';
    case DEGRADATION_LEVELS.RESTRICTED:
      return 'Many features are limited. Upgrade to remove restrictions';
    case DEGRADATION_LEVELS.BLOCKED:
      return 'This feature requires a paid plan. Upgrade now';
    default:
      return null;
  }
};

module.exports = {
  checkEnhancedPlanCompliance,
  enforceExportLimits,
  enforceReportLimits,
  addUpgradePrompts,
  logFeatureUsage,
  DEGRADATION_LEVELS,
  USAGE_QUOTAS
};