/**
 * Plans Routes
 * Subscription plans management for super admin
 */

const express = require('express');
const router = express.Router();
const { Plan } = require('../models');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/permissions');

// Predefined plans that can be created
const PREDEFINED_PLANS = ['Free', 'Basic', 'Premium', 'Enterprise'];

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/plans
 * Get all plans (for dropdowns and listings)
 */
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC']],
      attributes: ['id', 'name', 'description', 'priceMonthly', 'priceYearly', 'maxStations', 'maxPumpsPerStation', 'maxNozzlesPerPump', 'maxEmployees', 'maxCreditors', 'backdatedDays', 'analyticsDays', 'canExport', 'canTrackExpenses', 'canTrackCredits', 'canViewProfitLoss', 'maxExportsMonthly', 'maxReportsMonthly', 'maxManualEntriesMonthly', 'exportMaxRows', 'reportDataDays', 'salesReportsDays', 'profitReportsDays', 'analyticsDataDays', 'auditLogsDays', 'transactionHistoryDays', 'sortOrder', 'isActive']
    });

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plans'
    });
  }
});

/**
 * GET /api/v1/plans/:id
 * Get single plan details
 */
router.get('/:id', async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plan'
    });
  }
});

/**
 * POST /api/v1/plans
 * Create a new plan (super admin only) - Only predefined plans allowed
 */
router.post('/', requireRole(['super_admin']), async (req, res) => {
  try {
    // Validate that only predefined plans can be created
    if (!req.body.name || !PREDEFINED_PLANS.includes(req.body.name)) {
      return res.status(400).json({
        success: false,
        error: `Invalid plan name. Only predefined plans are allowed: ${PREDEFINED_PLANS.join(', ')}`
      });
    }

    // Check for existing plan name
    const existing = await Plan.findOne({ where: { name: req.body.name } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Plan already exists'
      });
    }
    const plan = await Plan.create(req.body);
    res.status(201).json({
      success: true,
      data: plan,
      message: 'Plan created successfully'
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create plan'
    });
  }
});

/**
 * PUT /api/v1/plans/:id
 * Update a plan (super admin only)
 */
router.put('/:id', requireRole(['super_admin']), async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    // Allow updating features (JSON) and isActive
    let updateData = { ...req.body };
    if (typeof req.body.features === 'object' && req.body.features !== null) {
      // Merge features with existing
      updateData.features = { ...plan.features, ...req.body.features };
    }

    await plan.update(updateData);

    res.json({
      success: true,
      data: plan,
      message: 'Plan updated successfully'
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update plan'
    });
  }
});

/**
 * DELETE /api/v1/plans/:id
 * Soft delete a plan (super admin only)
 */
router.delete('/:id', requireRole(['super_admin']), async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    // Soft delete by setting isActive to false
    await plan.update({ isActive: false });

    res.json({
      success: true,
      message: 'Plan deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete plan'
    });
  }
});

module.exports = router;
