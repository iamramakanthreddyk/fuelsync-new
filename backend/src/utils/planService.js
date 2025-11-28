/**
 * Plan-based access control service
 * Manages subscription plans and enforces limits
 */

const planLimits = {
  basic: {
    name: 'Basic',
    maxEmployees: 2,
    maxPumps: 3,
    maxStations: 1,
    maxOcrUploads: 10, // per day
    priceMonthly: 999,
    features: [
      'Core features',
      'Limited operations',
      'Email support',
      'Basic analytics'
    ]
  },
  premium: {
    name: 'Premium',
    maxEmployees: 5,
    maxPumps: 5,
    maxStations: 1,
    maxOcrUploads: 50, // per day
    priceMonthly: 2499,
    features: [
      'Advanced analytics',
      'More capacity',
      'Priority support',
      'Custom reports',
      'API access'
    ]
  },
  enterprise: {
    name: 'Enterprise',
    maxEmployees: null, // unlimited
    maxPumps: null, // unlimited
    maxStations: null, // unlimited
    maxOcrUploads: null, // unlimited
    priceMonthly: null, // custom pricing
    features: [
      'Multi-station support',
      'Unlimited access',
      'Priority support',
      'Custom features',
      'Dedicated account manager',
      'SLA guarantee'
    ]
  }
};

/**
 * Get plan limits for a user
 * @param {string} planType - Plan type ('basic', 'premium', 'enterprise')
 * @returns {Object} Plan limits
 */
function getPlanLimits(planType) {
  const plan = planLimits[planType?.toLowerCase()] || planLimits.basic;
  return plan;
}

/**
 * Check if user can add more employees
 * @param {number} currentCount - Current employee count
 * @param {string} planType - Plan type
 * @returns {boolean} Whether more employees can be added
 */
function canAddEmployee(currentCount, planType) {
  const plan = getPlanLimits(planType);
  if (plan.maxEmployees === null) return true; // unlimited
  return currentCount < plan.maxEmployees;
}

/**
 * Check if user can add more pumps
 * @param {number} currentCount - Current pump count
 * @param {string} planType - Plan type
 * @returns {boolean} Whether more pumps can be added
 */
function canAddPump(currentCount, planType) {
  const plan = getPlanLimits(planType);
  if (plan.maxPumps === null) return true; // unlimited
  return currentCount < plan.maxPumps;
}

/**
 * Check if user can add more stations
 * @param {number} currentCount - Current station count
 * @param {string} planType - Plan type
 * @returns {boolean} Whether more stations can be added
 */
function canAddStation(currentCount, planType) {
  const plan = getPlanLimits(planType);
  if (plan.maxStations === null) return true; // unlimited
  return currentCount < plan.maxStations;
}

/**
 * Check if user can upload OCR receipt
 * @param {number} todayCount - OCR uploads today
 * @param {string} planType - Plan type
 * @returns {boolean} Whether more OCR uploads allowed
 */
function canUploadOcr(todayCount, planType) {
  const plan = getPlanLimits(planType);
  if (plan.maxOcrUploads === null) return true; // unlimited
  return todayCount < plan.maxOcrUploads;
}

/**
 * Get remaining allowance for a resource
 * @param {number} currentCount - Current usage
 * @param {string} resource - Resource type
 * @param {string} planType - Plan type
 * @returns {number|string} Remaining count or 'unlimited'
 */
function getRemainingAllowance(currentCount, resource, planType) {
  const plan = getPlanLimits(planType);
  const maxMap = {
    employees: plan.maxEmployees,
    pumps: plan.maxPumps,
    stations: plan.maxStations,
    ocrUploads: plan.maxOcrUploads
  };
  
  const max = maxMap[resource];
  if (max === null) return 'unlimited';
  return Math.max(0, max - currentCount);
}

/**
 * Middleware to check plan limits
 * @param {string} resource - Resource type to check
 * @returns {Function} Express middleware
 */
function checkPlanLimit(resource) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Super admin bypasses all limits
      if (user.role === 'superadmin') {
        return next();
      }

      const planType = user.planType || 'basic';
      
      // Get current usage count (this would need to be implemented based on resource)
      let currentCount = 0;
      let canAdd = false;

      switch (resource) {
        case 'employee':
          // Would need to query employee count
          canAdd = canAddEmployee(currentCount, planType);
          break;
        case 'pump':
          canAdd = canAddPump(currentCount, planType);
          break;
        case 'station':
          canAdd = canAddStation(currentCount, planType);
          break;
        case 'ocrUpload':
          canAdd = canUploadOcr(currentCount, planType);
          break;
        default:
          return next();
      }

      if (!canAdd) {
        const plan = getPlanLimits(planType);
        return res.status(403).json({
          success: false,
          error: `Plan limit reached. Your ${planType} plan allows up to ${plan[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}s`] || plan.maxOcrUploads} ${resource}s.`,
          planType,
          upgradeRequired: true
        });
      }

      next();
    } catch (error) {
      console.error('Plan limit check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify plan limits'
      });
    }
  };
}

/**
 * Get plan comparison data
 * @returns {Array} All plans with their features
 */
function getAllPlans() {
  return Object.keys(planLimits).map(key => ({
    id: key,
    ...planLimits[key]
  }));
}

module.exports = {
  getPlanLimits,
  canAddEmployee,
  canAddPump,
  canAddStation,
  canUploadOcr,
  getRemainingAllowance,
  checkPlanLimit,
  getAllPlans,
  planLimits
};
