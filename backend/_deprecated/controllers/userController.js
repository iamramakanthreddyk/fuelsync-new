
const { User, Plan } = require('../models');
const { PLAN_LIMITS, getEffectiveLimits } = require('../middleware/planLimits');

// Get all users (Super Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Super Admin only.'
      });
    }

    const users = await User.findAll({
      include: [{ model: Plan, as: 'plan' }],
      attributes: { exclude: ['password'] }
    });

    // Add effective limits to each user
    const usersWithLimits = users.map(user => ({
      ...user.toJSON(),
      effectiveLimits: getEffectiveLimits(user)
    }));

    res.json({
      success: true,
      data: usersWithLimits
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
};

// Create employee (Owner only, within plan limits)
exports.createEmployee = async (req, res) => {
  try {
    if (req.user.role !== 'Pump Owner') {
      return res.status(403).json({
        success: false,
        error: 'Only Pump Owners can create employees'
      });
    }

    const { name, email, password } = req.body;

    // Check plan limits using effective limits
    const currentEmployees = await User.count({
      where: { stationId: req.user.stationId, role: 'Employee' }
    });

    const effectiveLimits = getEffectiveLimits(req.user);
    if (effectiveLimits.maxEmployees !== -1 && currentEmployees >= effectiveLimits.maxEmployees) {
      return res.status(400).json({
        success: false,
        error: `Plan limit exceeded. Maximum ${effectiveLimits.maxEmployees} employees allowed.`
      });
    }

    const employee = await User.create({
      name,
      email,
      password,
      role: 'Employee',
      stationId: req.user.stationId,
      planId: req.user.planId
    });

    res.status(201).json({
      success: true,
      data: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role
      }
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create employee'
    });
  }
};

// Update user plan (Super Admin only)
exports.updateUserPlan = async (req, res) => {
  try {
    if (req.user.role !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Super Admin only.'
      });
    }

    const { userId } = req.params;
    const { planName } = req.body;

    const plan = await Plan.findOne({ where: { name: planName } });
    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan name'
      });
    }

    await User.update(
      { planId: plan.id },
      { where: { id: userId } }
    );

    res.json({
      success: true,
      message: `User plan updated to ${planName}`
    });
  } catch (error) {
    console.error('Error updating user plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user plan'
    });
  }
};

// Set custom limits for user (Super Admin only)
exports.setCustomLimits = async (req, res) => {
  try {
    if (req.user.role !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Super Admin only.'
      });
    }

    const { userId } = req.params;
    const { maxUploadsPerDay, maxEmployees, maxPumps, maxStations } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Build custom limits object (only include provided values)
    const customLimits = {};
    if (maxUploadsPerDay !== undefined) customLimits.maxUploadsPerDay = maxUploadsPerDay;
    if (maxEmployees !== undefined) customLimits.maxEmployees = maxEmployees;
    if (maxPumps !== undefined) customLimits.maxPumps = maxPumps;
    if (maxStations !== undefined) customLimits.maxStations = maxStations;

    await user.update({ customLimits });

    res.json({
      success: true,
      message: 'Custom limits updated successfully',
      data: {
        userId,
        customLimits,
        effectiveLimits: getEffectiveLimits(user)
      }
    });
  } catch (error) {
    console.error('Error setting custom limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set custom limits'
    });
  }
};

// Delete user (Super Admin only, with confirmation)
exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Super Admin only.'
      });
    }

    const { userId } = req.params;
    const { confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: 'Deletion must be confirmed',
        requiresConfirmation: true
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
};

module.exports = {
  getAllUsers: exports.getAllUsers,
  createEmployee: exports.createEmployee,
  updateUserPlan: exports.updateUserPlan,
  setCustomLimits: exports.setCustomLimits,
  deleteUser: exports.deleteUser
};
