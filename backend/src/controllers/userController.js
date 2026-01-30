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

const { User, Station, Plan } = require('../models');
const { Op } = require('sequelize');
const { USER_ROLES } = require('../config/constants');
const { logAudit } = require('../utils/auditLog');
const { PERMISSIONS, ROLE_PERMISSIONS, PLAN_FEATURES } = require('../middleware/permissions');

/**
 * Get users based on role permissions
 * GET /api/v1/users
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { role, stationId, isActive, search, page = 1, limit = 20 } = req.query;
    const currentUser = req.user;
    const currentRole = (currentUser.role || '').toLowerCase();

    let where = {};
    let stationFilter = {};

    // Role-based filtering
    if (currentRole === 'super_admin') {
      // Super admin can see all users
      if (role) where.role = role;
      if (stationId) where.stationId = stationId;
    } else if (currentRole === 'owner') {
      // Owner sees staff in their stations only
      const ownerStations = await Station.findAll({
        where: { ownerId: currentUser.id },
        attributes: ['id']
      });
      const stationIds = ownerStations.map(s => s.id);
      
      if (stationIds.length === 0) {
        return res.json({ success: true, data: [], pagination: { total: 0 } });
      }
      
      where.stationId = { [Op.in]: stationIds };
      where.role = { [Op.in]: ['manager', 'employee'] }; // Only staff, not other owners
      
      if (stationId && stationIds.includes(stationId)) {
        where.stationId = stationId;
      }
    } else if (currentRole === 'manager') {
      // Manager sees only employees in their station
      where.stationId = currentUser.stationId;
      where.role = 'employee';
    } else {
      // Employee can only see themselves
      return res.json({
        success: true,
        data: [currentUser.toSafeObject()],
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

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    next(error);
  }
};

/**
 * Get single user
 * GET /api/v1/users/:id
 */
exports.getUser = async (req, res, next) => {
  try {
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
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check permissions
    const canView = await canAccessUser(currentUser, user);
    if (!canView) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get user error:', error);
    next(error);
  }
};

/**
 * Create new user
 * POST /api/v1/users
 */
exports.createUser = async (req, res, next) => {
  try {
    const { email, password, name, phone, role, stationId, planId } = req.body;
    const currentUser = req.user;
    const currentRole = (currentUser.role || '').toLowerCase();
    const roleNormalized = (role || '').toLowerCase();

    // Validation
    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, name, and role are required'
      });
    }

    // Check creation permissions
    const creationRules = {
      'super_admin': ['owner'],
      'owner': ['manager', 'employee'],
      'manager': ['employee'],
      'employee': []
    };

    const allowedRoles = creationRules[currentRole] || [];
    if (!allowedRoles.includes(roleNormalized)) {
      return res.status(403).json({
        success: false,
        error: `${currentUser.role} cannot create ${role} users`
      });
    }

    // Station validation for manager/employee
    if (['manager', 'employee'].includes(roleNormalized)) {
      if (!stationId) {
        return res.status(400).json({
          success: false,
          error: 'Station ID is required for manager/employee'
        });
      }

      // Verify owner owns this station OR manager is creating for their station
      const station = await Station.findByPk(stationId);
      if (!station) {
        return res.status(404).json({ success: false, error: 'Station not found' });
      }

      if (currentRole === 'owner' && station.ownerId !== currentUser.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only add staff to your own stations'
        });
      }

      if (currentRole === 'manager' && currentUser.stationId !== stationId) {
        return res.status(403).json({
          success: false,
          error: 'You can only add employees to your station'
        });
      }

      // Check employee limit
      if (currentRole === 'owner') {
        const ownerPlan = await Plan.findByPk(currentUser.planId);
        if (ownerPlan) {
          const employeeCount = await User.count({
            where: { stationId, role: { [Op.in]: ['manager', 'employee'] }, isActive: true }
          });
          
          if (employeeCount >= ownerPlan.maxEmployees) {
            return res.status(403).json({
              success: false,
              error: `Employee limit reached (${ownerPlan.maxEmployees}). Upgrade plan to add more.`
            });
          }
        }
      }
    }

    // Check email uniqueness
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    // Get plan for new owner
    let ownerPlanId = null;
    if (roleNormalized === 'owner') {
      if (planId && currentRole === 'super_admin') {
        const plan = await Plan.findByPk(planId);
        if (plan) {
          ownerPlanId = plan.id;
        } else {
          return res.status(400).json({ success: false, error: 'Invalid planId provided' });
        }
      } else {
        // Try to find Free plan first, then Basic plan as fallback
        let plan = await Plan.findOne({ where: { name: 'Free' } });
        if (!plan) {
          plan = await Plan.findOne({ where: { name: 'Basic' } });
        }
        // If no default plan exists (fresh DB in tests), create a Free plan automatically
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

    // Create user
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

    // Log user creation
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

    res.status(201).json({
      success: true,
      data: user.toSafeObject(),
      message: `${role} created successfully`
    });
  } catch (error) {
    console.error('Create user error:', error);
    next(error);
  }
};

/**
 * Update user
 * PUT /api/v1/users/:id
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, stationId, isActive, planId } = req.body;
    const currentUser = req.user;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check permissions
    const canEdit = await canAccessUser(currentUser, user);
    if (!canEdit) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Prevent self-deactivation
    if (id === currentUser.id && isActive === false) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate yourself' });
    }

    // If changing station, verify ownership
    if (stationId && stationId !== user.stationId) {
      if (currentUser.role === 'owner') {
        const station = await Station.findByPk(stationId);
        if (!station || station.ownerId !== currentUser.id) {
          return res.status(403).json({
            success: false,
            error: 'You can only move staff to your own stations'
          });
        }
      } else if (currentUser.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Only owner can change staff station'
        });
      }
    }


    // Allow super_admin to update planId for owners
    const updateFields = {
      name: name || user.name,
      phone: phone !== undefined ? phone : user.phone,
      stationId: stationId || user.stationId,
      isActive: isActive !== undefined ? isActive : user.isActive
    };

    if (user.role === 'owner' && currentUser.role === 'super_admin' && planId) {
      const plan = await Plan.findByPk(planId);
      if (!plan) {
        return res.status(400).json({ success: false, error: 'Invalid planId provided' });
      }
      updateFields.planId = planId;
    }

    const oldValues = user.toJSON();
    await user.update(updateFields);
    const newValues = updateFields;

    // Log user update
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

    res.json({
      success: true,
      data: user.toSafeObject(),
      message: 'User updated'
    });
  } catch (error) {
    console.error('Update user error:', error);
    next(error);
  }
};

/**
 * Deactivate user (soft delete)
 * DELETE /api/v1/users/:id
 */
exports.deactivateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Prevent deactivation of superadmin
    if (user.role === 'super_admin') {
      return res.status(403).json({ success: false, error: 'Superadmin cannot be deactivated.' });
    }

    // Can't deactivate yourself
    if (id === currentUser.id) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate yourself' });
    }

    // Check permissions
    const canEdit = await canAccessUser(currentUser, user);
    if (!canEdit) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const userData = user.toJSON();
    await user.update({ isActive: false });

    // Log user deactivation
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

    res.json({
      success: true,
      message: `User ${user.name} deactivated`
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    next(error);
  }
};

/**
 * Reset password
 * POST /api/v1/users/:id/reset-password
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const currentUser = req.user;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Can reset own password or managed users
    if (id !== currentUser.id) {
      const canEdit = await canAccessUser(currentUser, user);
      if (!canEdit) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    await user.update({ password: newPassword }); // Hook will hash it

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    next(error);
  }
};

/**
 * Get staff for a specific station
 * GET /api/v1/stations/:stationId/staff
 */
exports.getStationStaff = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { role } = req.query;
    const currentUser = req.user;

    // Verify station access
    const station = await Station.findByPk(stationId);
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    // Check permissions
    const currentRole = (currentUser.role || '').toLowerCase();
    if (currentRole === 'owner' && station.ownerId !== currentUser.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (['manager', 'employee'].includes(currentRole) && currentUser.stationId !== stationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const where = { stationId };
    if (role) where.role = role;

    const staff = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['role', 'ASC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      data: staff,
      summary: {
        managers: staff.filter(u => u.role === 'manager').length,
        employees: staff.filter(u => u.role === 'employee').length,
        total: staff.length
      }
    });
  } catch (error) {
    console.error('Get station staff error:', error);
    next(error);
  }
};

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
exports.getEffectiveFeatures = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Only super_admin can fetch arbitrary user's effective features
    if ((currentUser.role || '').toLowerCase() !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const targetUser = await User.findByPk(id, {
      include: [{ model: Station, as: 'station' }, { model: Plan, as: 'plan' }]
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
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

    res.json({
      success: true,
      data: {
        userId: targetUser.id,
        email: targetUser.email,
        role: targetUser.role,
        stationId: targetUser.stationId,
        plan: effectivePlan ? { id: effectivePlan.id, name: effectivePlan.name } : null,
        ownerPlanUsed,
        rolePermissions: rolePerms,
        planFeatures: planFeatures,
        effectivePermissions: effective
      }
    });
  } catch (error) {
    console.error('Get effective features error:', error);
    next(error);
  }
};
