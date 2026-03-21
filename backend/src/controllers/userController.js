/**
 * User Controller
 * User management with role-based access
 * 
 * AUDIT LOGGING:
 * - CREATE: User creation is logged with category 'data', severity 'info'
 * - UPDATE: User updates are logged with before/after values
 * - DELETE: User deletion is logged with category 'data', severity 'warning'
 * 
 * All CREATE/UPDATE/DELETE operations are tracked via logAudit() from utils/auditLog
 * 
 * WHO CAN CREATE WHOM:
 * - super_admin: Can create owners
 * - owner: Can create managers and employees for their stations
 * - manager: Can create employees for their station
 * - employee: Cannot create users
 * 
 * WHO CAN VIEW WHOM:
 * - super_admin: All users
 * - owner: All staff across all their stations
 * - manager: Employees in their station
 * - employee: Only themselves
 */

// ===== MODELS & DATABASE =====
const { User, Station, Plan } = require('../models');
const { Op } = require('sequelize');

// ===== ERROR & RESPONSE HANDLING =====
const { asyncHandler, NotFoundError, AuthorizationError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/apiResponse');

// ===== MIDDLEWARE & CONFIG =====
const { USER_ROLES } = require('../config/constants');
const { PERMISSIONS, ROLE_PERMISSIONS, PLAN_FEATURES } = require('../middleware/permissions');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');

/**
 * Get users based on role permissions
 * GET /api/v1/users
 */
exports.getUsers = asyncHandler(async (req, res, next) => {
  const { role, stationId, isActive, search, page = 1, limit = 20 } = req.query;
  const currentUser = req.user;
  const currentRole = (currentUser.role || '').toLowerCase();

  let where = {};
  let stationFilter = {};

  if (currentRole === 'super_admin') {
    if (role) where.role = role;
    if (stationId) where.stationId = stationId;
  } else if (currentRole === 'owner') {
    const ownerStations = await Station.findAll({
      where: { ownerId: currentUser.id },
      attributes: ['id']
    });
    const stationIds = ownerStations.map(s => s.id);
    
    if (stationIds.length === 0) {
      return sendSuccess(res, [], { pagination: { total: 0 } });
    }
    
    where.stationId = { [Op.in]: stationIds };
    where.role = { [Op.in]: ['manager', 'employee'] };
    
    if (stationId && stationIds.includes(stationId)) {
      where.stationId = stationId;
    }
  } else if (currentRole === 'manager') {
    where.stationId = currentUser.stationId;
    where.role = 'employee';
  } else {
    return sendSuccess(res, [currentUser.toSafeObject()], { 
      pagination: { total: 1, page: 1, limit: 1, pages: 1 } 
    });
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: users } = await User.findAndCountAll({
    where,
    include: [
      { model: Station, as: 'station', attributes: ['id', 'name', 'code'] },
      { model: Plan, as: 'plan', attributes: ['id', 'name'] }
    ],
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset
  });

  return sendPaginated(res, users, {
    page: parseInt(page),
    limit: parseInt(limit),
    total: count,
    pages: Math.ceil(count / limit)
  });
});

/**
 * Get single user
 * GET /api/v1/users/:id
 */
exports.getUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const currentUser = req.user;

  const user = await User.findByPk(id, {
    include: [
      { model: Station, as: 'station', attributes: ['id', 'name', 'code'] },
      { model: Plan, as: 'plan', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['id', 'name'] }
    ],
    attributes: { exclude: ['password'] }
  });

  if (!user) {
    throw new NotFoundError('User', id);
  }

  const canView = await canAccessUser(currentUser, user);
  if (!canView) {
    throw new AuthorizationError('Access denied');
  }

  return sendSuccess(res, user);
});

/**
 * Create new user
 * POST /api/v1/users
 */
exports.createUser = asyncHandler(async (req, res, next) => {
  const { email, password, name, phone, role, stationId, planId } = req.body;
  const currentUser = req.user;
  const currentRole = (currentUser.role || '').toLowerCase();
  const roleNormalized = (role || '').toLowerCase();

  if (!email || !password || !name || !role) {
    return sendError(res, 'VALIDATION_ERROR', 'Email, password, name, and role are required', 400);
  }

  const creationRules = {
    'super_admin': ['owner'],
    'owner': ['manager', 'employee'],
    'manager': ['employee'],
    'employee': []
  };

  const allowedRoles = creationRules[currentRole] || [];
  if (!allowedRoles.includes(roleNormalized)) {
    throw new AuthorizationError(`${currentUser.role} cannot create ${role} users`);
  }

  if (['manager', 'employee'].includes(roleNormalized)) {
    if (!stationId) {
      return sendError(res, 'VALIDATION_ERROR', 'Station ID is required for manager/employee', 400);
    }

    const station = await Station.findByPk(stationId);
    if (!station) {
      throw new NotFoundError('Station', stationId);
    }

    if (currentRole === 'owner' && station.ownerId !== currentUser.id) {
      throw new AuthorizationError('You can only add staff to your own stations');
    }

    if (currentRole === 'manager' && currentUser.stationId !== stationId) {
      throw new AuthorizationError('You can only add employees to your station');
    }

    if (currentRole === 'owner') {
      const ownerPlan = await Plan.findByPk(currentUser.planId);
      if (ownerPlan) {
        const employeeCount = await User.count({
          where: { stationId, role: { [Op.in]: ['manager', 'employee'] }, isActive: true }
        });
        
        if (employeeCount >= ownerPlan.maxEmployees) {
          return sendError(res, 'PLAN_LIMIT_EXCEEDED', 
            `Employee limit reached (${ownerPlan.maxEmployees}). Upgrade your plan to add more staff.`, 
            402, {
              planLimitExceeded: true,
              details: {
                planName: ownerPlan.name,
                resource: 'employees',
                limit: ownerPlan.maxEmployees,
                current: employeeCount,
                upgradeRequired: true
              }
            }
          );
        }
      }
    }
  }

  const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existingUser) {
    return sendError(res, 'CONFLICT', 'Email already registered', 409);
  }

  let ownerPlanId = null;
  if (roleNormalized === 'owner') {
    if (planId && currentRole === 'super_admin') {
      const plan = await Plan.findByPk(planId);
      if (plan) {
        ownerPlanId = plan.id;
      } else {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid planId provided', 400);
      }
    } else {
      let plan = await Plan.findOne({ where: { name: 'Free' } });
      if (!plan) {
        plan = await Plan.findOne({ where: { name: 'Basic' } });
      }
      if (!plan) {
        console.warn('No default plan found — creating a Free plan automatically for owner creation');
        plan = await Plan.create({
          name: 'Free',
          description: 'Auto-created Free plan',
          maxStations: 1,
          maxPumpsPerStation: 5,
          maxNozzlesPerPump: 4,
          maxEmployees: 5,
          maxCreditors: 10,
          backdatedDays: 3,
          analyticsDays: 7,
          priceMonthly: 0,
          features: {},
          sortOrder: 999,
          isActive: true
        });
      }
      ownerPlanId = plan.id;
    }
  }

  const user = await User.create({
    email: email.toLowerCase(),
    password,
    name,
    phone,
    role: roleNormalized,
    stationId: ['manager', 'employee'].includes(roleNormalized) ? stationId : null,
    planId: roleNormalized === 'owner' ? ownerPlanId : null,
    createdBy: currentUser.id
  });

  await logAudit({
    userId: currentUser.id,
    userEmail: currentUser.email,
    userRole: currentUser.role,
    stationId: stationId || null,
    action: 'CREATE',
    entityType: 'User',
    entityId: user.id,
    newValues: {
      id: user.id,
      email: user.email,
      name,
      role: roleNormalized,
      stationId
    },
    category: 'data',
    severity: 'info',
    description: `Created ${roleNormalized} user: ${name} (${email})`
  });

  return sendCreated(res, user.toSafeObject(), {
    message: `${role} created successfully`
  });
});

/**
 * Update user
 * PUT /api/v1/users/:id
 */
exports.updateUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, phone, stationId, isActive, planId } = req.body;
  const currentUser = req.user;

  const user = await User.findByPk(id);
  if (!user) {
    throw new NotFoundError('User', id);
  }

  const canEdit = await canAccessUser(currentUser, user);
  if (!canEdit) {
    throw new AuthorizationError('Access denied');
  }

  if (id === currentUser.id && isActive === false) {
    return sendError(res, 'VALIDATION_ERROR', 'Cannot deactivate yourself', 400);
  }

  if (stationId && stationId !== user.stationId) {
    if (currentUser.role === 'owner') {
      const station = await Station.findByPk(stationId);
      if (!station || station.ownerId !== currentUser.id) {
        throw new AuthorizationError('You can only move staff to your own stations');
      }
    } else if (currentUser.role !== 'super_admin') {
      throw new AuthorizationError('Only owner can change staff station');
    }
  }

  const updateFields = {
    name: name || user.name,
    phone: phone !== undefined ? phone : user.phone,
    stationId: stationId || user.stationId,
    isActive: isActive !== undefined ? isActive : user.isActive
  };

  if (user.role === 'owner' && currentUser.role === 'super_admin' && planId) {
    const plan = await Plan.findByPk(planId);
    if (!plan) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid planId provided', 400);
    }
    updateFields.planId = planId;
  }

  const oldValues = user.toJSON();
  await user.update(updateFields);
  const newValues = updateFields;

  await logAudit({
    userId: currentUser.id,
    userEmail: currentUser.email,
    userRole: currentUser.role,
    stationId: user.stationId,
    action: 'UPDATE',
    entityType: 'User',
    entityId: user.id,
    oldValues: oldValues,
    newValues: newValues,
    category: 'data',
    severity: 'info',
    description: `Updated user: ${user.name} (${user.email})`
  });

  return sendSuccess(res, user.toSafeObject(), {
    message: 'User updated'
  });
});

/**
 * Deactivate user (soft delete)
 * DELETE /api/v1/users/:id
 */
exports.deactivateUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const currentUser = req.user;

  const user = await User.findByPk(id);
  if (!user) {
    throw new NotFoundError('User', id);
  }

  if (user.role === 'super_admin') {
    throw new AuthorizationError('Superadmin cannot be deactivated');
  }

  if (id === currentUser.id) {
    return sendError(res, 'VALIDATION_ERROR', 'Cannot deactivate yourself', 400);
  }

  if (user.role === 'owner') {
    const ownedStations = await Station.findAll({
      where: { ownerId: id },
      attributes: ['id', 'name']
    });
    if (ownedStations.length > 0) {
      return sendError(res, 'VALIDATION_ERROR', 
        `Cannot deactivate owner: responsible for ${ownedStations.length} station(s). Transfer ownership first or request superadmin assistance.`,
        403, {
          stations: ownedStations.map(s => ({ id: s.id, name: s.name }))
        }
      );
    }
  }

  const canEdit = await canAccessUser(currentUser, user);
  if (!canEdit) {
    throw new AuthorizationError('Access denied');
  }

  const userData = user.toJSON();
  await user.update({ isActive: false });

  await logAudit({
    userId: currentUser.id,
    userEmail: currentUser.email,
    userRole: currentUser.role,
    stationId: user.stationId,
    action: 'UPDATE',
    entityType: 'User',
    entityId: user.id,
    oldValues: userData,
    newValues: { isActive: false },
    category: 'data',
    severity: 'warning',
    description: `Deactivated user: ${user.name} (${user.email})`
  });

  return sendSuccess(res, null, {
    message: `User ${user.name} deactivated`
  });
});

/**
 * Reset password
 * POST /api/v1/users/:id/reset-password
 */
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const currentUser = req.user;

  if (!newPassword || newPassword.length < 6) {
    return sendError(res, 'VALIDATION_ERROR', 'Password must be at least 6 characters', 400);
  }

  const user = await User.findByPk(id);
  if (!user) {
    throw new NotFoundError('User', id);
  }

  // Can reset own password or managed users
  if (id !== currentUser.id) {
    const canEdit = await canAccessUser(currentUser, user);
    if (!canEdit) {
      throw new AuthorizationError('Access denied');
    }
  }

  await user.update({ password: newPassword }); // Hook will hash it

  await logAudit({
    userId: currentUser.id,
    userEmail: currentUser.email,
    userRole: currentUser.role,
    stationId: user.stationId,
    action: 'UPDATE',
    entityType: 'User',
    entityId: user.id,
    oldValues: { password: '***' },
    newValues: { password: '***' },
    category: 'security',
    severity: 'info',
    description: `Password reset for user: ${user.name} (${user.email})`
  });

  return sendSuccess(res, null, {
    message: 'Password reset successfully'
  });
});

/**
 * Get staff for a specific station
 * GET /api/v1/stations/:stationId/staff
 */
exports.getStationStaff = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { role } = req.query;
  const currentUser = req.user;

  // Verify station access
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new NotFoundError('Station', stationId);
  }

  // Check permissions
  const currentRole = (currentUser.role || '').toLowerCase();
  if (currentRole === 'owner' && station.ownerId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }
  if (['manager', 'employee'].includes(currentRole) && currentUser.stationId !== stationId) {
    throw new AuthorizationError('Access denied');
  }

  const where = { stationId };
  if (role) where.role = role;

  const staff = await User.findAll({
    where,
    attributes: { exclude: ['password'] },
    order: [['role', 'ASC'], ['name', 'ASC']]
  });

  return sendSuccess(res, {
    staff,
    summary: {
      managers: staff.filter(u => u.role === 'manager').length,
      employees: staff.filter(u => u.role === 'employee').length,
      total: staff.length
    }
  });
});

/**
 * Helper: Check if user can access another user
 */
async function canAccessUser(currentUser, targetUser) {
  // Super admin can access anyone
  if ((currentUser.role || '').toLowerCase() === 'super_admin') return true;

  // Self access always allowed
  if (currentUser.id === targetUser.id) return true;

  // Owner can access staff in their stations
  if ((currentUser.role || '').toLowerCase() === 'owner') {
    if (!targetUser.stationId) return false;
    const station = await Station.findByPk(targetUser.stationId);
    return station && station.ownerId === currentUser.id;
  }

  // Manager can access employees in their station
  if ((currentUser.role || '').toLowerCase() === 'manager') {
    return targetUser.stationId === currentUser.stationId && targetUser.role === 'employee';
  }

  return false;
}

module.exports = exports;

/**
 * Get effective features / permissions for a user (role + plan applied)
 * GET /api/v1/users/:id/effective-features
 */
exports.getEffectiveFeatures = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const currentUser = req.user;

  // Only super_admin can fetch arbitrary user's effective features
  if ((currentUser.role || '').toLowerCase() !== 'super_admin') {
    throw new AuthorizationError('Insufficient permissions');
  }

  const targetUser = await User.findByPk(id, {
    include: [{ model: Station, as: 'station' }, { model: Plan, as: 'plan' }]
  });

  if (!targetUser) {
    throw new NotFoundError('User', id);
  }

  // Determine effective plan: user's own plan or station owner's plan
  let effectivePlan = targetUser.plan || null;
  let ownerPlanUsed = false;

  if (!effectivePlan && targetUser.stationId) {
    const station = await Station.findByPk(targetUser.stationId);
    if (station && station.ownerId) {
      const owner = await User.findByPk(station.ownerId, { include: [{ model: Plan, as: 'plan' }] });
      if (owner && owner.plan) {
        effectivePlan = owner.plan;
        ownerPlanUsed = true;
      }
    }
  }

  const role = (targetUser.role || '').toLowerCase();
  const rolePerms = ROLE_PERMISSIONS[role] || [];

  const planName = effectivePlan ? (effectivePlan.name || '').toLowerCase() : null;
  const planFeatures = planName ? (PLAN_FEATURES[planName] || {}) : {};

  // Build effective permissions map
  const effective = {};
  Object.keys(PERMISSIONS).forEach((key) => {
    const perm = PERMISSIONS[key];
    const roleAllows = rolePerms.includes(perm);
    const planCfg = planFeatures[perm] || { allowed: false };
    const planAllows = !!planCfg.allowed;
    effective[perm] = {
      roleAllows,
      planAllows,
      allowed: roleAllows && planAllows,
      details: planCfg
    };
  });

  return sendSuccess(res, {
    userId: targetUser.id,
    email: targetUser.email,
    role: targetUser.role,
    stationId: targetUser.stationId,
    plan: effectivePlan ? { id: effectivePlan.id, name: effectivePlan.name } : null,
    ownerPlanUsed,
    rolePermissions: rolePerms,
    planFeatures: planFeatures,
    effectivePermissions: effective
  });
});
