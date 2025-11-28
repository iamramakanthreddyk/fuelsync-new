
const { User, Plan } = require('../models');

// Plan limits configuration - Updated with new values
const PLAN_LIMITS = {
  Basic: {
    maxEmployees: 2,
    maxPumps: 3,
    maxStations: 1,
    maxUploadsPerDay: 5  // Updated from 10 to 5
  },
  Premium: {
    maxEmployees: 5,
    maxPumps: 5,
    maxStations: 1,
    maxUploadsPerDay: 10  // Updated from 50 to 10
  },
  Enterprise: {
    maxEmployees: -1, // Unlimited
    maxPumps: -1, // Unlimited
    maxStations: -1, // Unlimited
    maxUploadsPerDay: -1 // Unlimited
  }
};

// Get effective limits for a user (considering custom overrides)
const getEffectiveLimits = (user) => {
  const planLimits = PLAN_LIMITS[user.plan?.name] || {};
  
  // If user has custom limits set by Super Admin, merge them
  if (user.customLimits) {
    return { ...planLimits, ...user.customLimits };
  }
  
  return planLimits;
};

const checkPlanLimits = (limitType) => {
  return async (req, res, next) => {
    try {
      const user = await User.findByPk(req.userId, {
        include: [{ model: Plan, as: 'plan' }]
      });

      if (!user || !user.plan) {
        return res.status(400).json({
          success: false,
          error: 'User plan not found'
        });
      }

      const effectiveLimits = getEffectiveLimits(user);
      const limit = effectiveLimits[limitType];

      // Enterprise or unlimited access
      if (user.plan.name === 'Enterprise' || limit === -1) {
        return next();
      }

      // Store limit info in request for controller use
      req.planLimit = {
        type: limitType,
        limit: limit,
        planName: user.plan.name,
        isCustom: !!user.customLimits && user.customLimits.hasOwnProperty(limitType)
      };

      next();
    } catch (error) {
      console.error('Plan limit check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check plan limits'
      });
    }
  };
};

module.exports = {
  checkPlanLimits,
  getEffectiveLimits,
  PLAN_LIMITS
};
