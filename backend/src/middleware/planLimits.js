/**
 * Plan Limits Middleware
 * Enforces subscription plan limits and handles downgrades gracefully
 */

const { User, Station, Pump, Nozzle, Plan } = require('../models');

/**
 * Check if user exceeds plan limits (for existing resources)
 * Returns soft warnings - doesn't block, just informs
 */
const checkPlanCompliance = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId, {
      include: [{ model: Plan, as: 'plan' }]
    });

    if (!user || !user.plan) {
      // No plan assigned - allow but log warning
      console.warn(`User ${userId} has no plan assigned`);
      req.planWarnings = ['No plan assigned - using unlimited access'];
      return next();
    }

    const plan = user.plan;
    const warnings = [];
    const ownerId = user.role === 'owner' ? user.id : null;

    if (!ownerId) {
      // Not an owner - skip limit checks
      return next();
    }

    // Check current usage vs limits
    const stationCount = await Station.count({ where: { ownerId } });
    const pumpCount = await Pump.count({
      include: [{
        model: Station,
        as: 'station',
        where: { ownerId },
        attributes: []
      }]
    });

    // Check station limit
    if (plan.maxStations && stationCount > plan.maxStations) {
      warnings.push({
        resource: 'stations',
        current: stationCount,
        limit: plan.maxStations,
        overage: stationCount - plan.maxStations,
        severity: 'warning',
        message: `You have ${stationCount} stations but your plan allows ${plan.maxStations}. New station creation is blocked.`
      });
    }

    // Check pump limit (per station average)
    if (plan.maxPumpsPerStation && stationCount > 0) {
      const avgPumpsPerStation = Math.ceil(pumpCount / stationCount);
      if (avgPumpsPerStation > plan.maxPumpsPerStation) {
        warnings.push({
          resource: 'pumps',
          current: avgPumpsPerStation,
          limit: plan.maxPumpsPerStation,
          severity: 'info',
          message: `Average pumps per station (${avgPumpsPerStation}) exceeds plan limit (${plan.maxPumpsPerStation})`
        });
      }
    }

    // Attach warnings to request for controllers to handle
    req.planWarnings = warnings;
    req.userPlan = plan;
    req.planCompliance = {
      isCompliant: warnings.length === 0,
      warnings,
      usage: {
        stations: { current: stationCount, limit: plan.maxStations },
        pumps: { current: pumpCount, limit: plan.maxPumpsPerStation }
      }
    };

    next();
  } catch (error) {
    console.error('Plan compliance check error:', error);
    // Don't block on error - just log and continue
    next();
  }
};

/**
 * Enforce plan limit before creation (hard block)
 * Use this before creating new stations/pumps/nozzles
 */
const enforcePlanLimit = (resourceType) => {
  return async (req, res, next) => {
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
      if (user.role === 'super_admin') {
        return next();
      }

      // Get the owner ID (either self or from request body)
      let ownerId;
      if (user.role === 'owner') {
        ownerId = user.id;
      } else if (user.role === 'super_admin' && req.body.ownerId) {
        ownerId = req.body.ownerId;
      } else {
        // Staff members - get owner from their assigned station
        if (user.stationId) {
          const station = await Station.findByPk(user.stationId);
          ownerId = station?.ownerId;
        }
      }

      if (!ownerId) {
        return res.status(403).json({
          success: false,
          error: 'Unable to determine owner for plan limit check'
        });
      }

      // Get owner's plan
      const owner = await User.findByPk(ownerId, {
        include: [{ model: Plan, as: 'plan' }]
      });

      if (!owner || !owner.plan) {
        console.warn(`Owner ${ownerId} has no plan - allowing creation`);
        return next();
      }

      const plan = owner.plan;

      // Check limits based on resource type
      switch (resourceType) {
        case 'station': {
          const stationCount = await Station.count({ where: { ownerId } });
          
          if (plan.maxStations && stationCount >= plan.maxStations) {
            return res.status(403).json({
              success: false,
              error: `Plan limit reached. Your ${plan.name} plan allows ${plan.maxStations} station(s). You currently have ${stationCount}.`,
              planLimitExceeded: true,
              details: {
                planName: plan.name,
                resource: 'stations',
                limit: plan.maxStations,
                current: stationCount,
                upgradeRequired: true
              }
            });
          }
          break;
        }

        case 'pump': {
          // Get station ID from params or body
          const stationId = req.params.stationId || req.body.stationId;
          if (!stationId) {
            return res.status(400).json({
              success: false,
              error: 'Station ID required for pump creation'
            });
          }

          const pumpCount = await Pump.count({ where: { stationId } });
          
          if (plan.maxPumpsPerStation && pumpCount >= plan.maxPumpsPerStation) {
            return res.status(403).json({
              success: false,
              error: `Plan limit reached. Your ${plan.name} plan allows ${plan.maxPumpsPerStation} pump(s) per station. This station has ${pumpCount}.`,
              planLimitExceeded: true,
              details: {
                planName: plan.name,
                resource: 'pumps',
                limit: plan.maxPumpsPerStation,
                current: pumpCount,
                upgradeRequired: true
              }
            });
          }
          break;
        }

        case 'nozzle': {
          // Get pump ID from params or body
          const pumpId = req.params.pumpId || req.body.pumpId;
          if (!pumpId) {
            return res.status(400).json({
              success: false,
              error: 'Pump ID required for nozzle creation'
            });
          }

          const nozzleCount = await Nozzle.count({ where: { pumpId } });
          
          if (plan.maxNozzlesPerPump && nozzleCount >= plan.maxNozzlesPerPump) {
            return res.status(403).json({
              success: false,
              error: `Plan limit reached. Your ${plan.name} plan allows ${plan.maxNozzlesPerPump} nozzle(s) per pump. This pump has ${nozzleCount}.`,
              planLimitExceeded: true,
              details: {
                planName: plan.name,
                resource: 'nozzles',
                limit: plan.maxNozzlesPerPump,
                current: nozzleCount,
                upgradeRequired: true
              }
            });
          }
          break;
        }

        case 'employee': {
          const employeeCount = await User.count({
            where: {
              createdBy: ownerId,
              role: { [Op.in]: ['manager', 'employee'] }
            }
          });

          if (plan.maxEmployees && employeeCount >= plan.maxEmployees) {
            return res.status(403).json({
              success: false,
              error: `Plan limit reached. Your ${plan.name} plan allows ${plan.maxEmployees} employee(s). You currently have ${employeeCount}.`,
              planLimitExceeded: true,
              details: {
                planName: plan.name,
                resource: 'employees',
                limit: plan.maxEmployees,
                current: employeeCount,
                upgradeRequired: true
              }
            });
          }
          break;
        }

        default:
          console.warn(`Unknown resource type for plan limit: ${resourceType}`);
      }

      // Attach plan info to request for controllers to use
      req.ownerPlan = plan;
      req.planInfo = {
        name: plan.name,
        limits: {
          maxStations: plan.maxStations,
          maxPumpsPerStation: plan.maxPumpsPerStation,
          maxNozzlesPerPump: plan.maxNozzlesPerPump,
          maxEmployees: plan.maxEmployees
        }
      };

      next();
    } catch (error) {
      console.error('Plan limit enforcement error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify plan limits'
      });
    }
  };
};

/**
 * Get plan usage summary for an owner
 */
const getPlanUsage = async (ownerId) => {
  try {
    const owner = await User.findByPk(ownerId, {
      include: [{ model: Plan, as: 'plan' }]
    });

    if (!owner || !owner.plan) {
      return null;
    }

    const plan = owner.plan;

    // Get current usage
    const [stationCount, totalPumps, totalNozzles, employeeCount] = await Promise.all([
      Station.count({ where: { ownerId } }),
      Pump.count({
        include: [{
          model: Station,
          as: 'station',
          where: { ownerId },
          attributes: []
        }]
      }),
      Nozzle.count({
        include: [{
          model: Pump,
          as: 'pump',
          include: [{
            model: Station,
            as: 'station',
            where: { ownerId },
            attributes: []
          }],
          attributes: []
        }]
      }),
      User.count({
        where: {
          createdBy: ownerId,
          role: { [Op.in]: ['manager', 'employee'] }
        }
      })
    ]);

    return {
      plan: {
        id: plan.id,
        name: plan.name,
        priceMonthly: plan.priceMonthly
      },
      usage: {
        stations: {
          current: stationCount,
          limit: plan.maxStations,
          percentage: plan.maxStations ? Math.round((stationCount / plan.maxStations) * 100) : 0,
          remaining: plan.maxStations ? Math.max(0, plan.maxStations - stationCount) : null
        },
        pumps: {
          current: totalPumps,
          limit: plan.maxPumpsPerStation,
          perStation: stationCount > 0 ? Math.ceil(totalPumps / stationCount) : 0
        },
        nozzles: {
          current: totalNozzles,
          limit: plan.maxNozzlesPerPump
        },
        employees: {
          current: employeeCount,
          limit: plan.maxEmployees,
          percentage: plan.maxEmployees ? Math.round((employeeCount / plan.maxEmployees) * 100) : 0,
          remaining: plan.maxEmployees ? Math.max(0, plan.maxEmployees - employeeCount) : null
        }
      },
      compliance: {
        isCompliant: (
          (!plan.maxStations || stationCount <= plan.maxStations) &&
          (!plan.maxEmployees || employeeCount <= plan.maxEmployees)
        ),
        exceedsLimits: {
          stations: plan.maxStations && stationCount > plan.maxStations,
          employees: plan.maxEmployees && employeeCount > plan.maxEmployees
        }
      }
    };
  } catch (error) {
    console.error('Error getting plan usage:', error);
    return null;
  }
};

module.exports = {
  checkPlanCompliance,
  enforcePlanLimit,
  getPlanUsage
};
