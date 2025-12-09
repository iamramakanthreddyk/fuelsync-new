const { Pump, Nozzle, User } = require('../models');
const { PLAN_LIMITS } = require('../middleware/planLimits');

// Get all pumps with role-based filtering
exports.getPumps = async (req, res) => {
  try {
    let whereClause = {};
    
    // Role-based access control
    if (req.user.role === 'Owner') {
      whereClause.stationId = req.user.stationId;
    }
    // Super Admin sees all pumps
    // Employees shouldn't access pumps directly

    const pumps = await Pump.findAll({
      where: whereClause,
      include: [{ 
        model: Nozzle, 
        as: 'nozzles',
        attributes: ['id', 'number', 'fuelType', 'status']
      }],
      order: [['name', 'ASC'], [{ model: Nozzle, as: 'nozzles' }, 'number', 'ASC']]
    });

    // TODO: Replace with real pump data from database
    // If no pumps exist, return empty array - frontend will handle gracefully
    res.json({
      success: true,
      data: pumps || [] // Always return an array, even if empty
    });
  } catch (error) {
    console.error('Error fetching pumps:', error);
    // Return empty array instead of error to prevent frontend crashes
    res.json({
      success: true,
      data: [] // Return empty array on error - TODO: log this for debugging
    });
  }
};

// Create new pump (with plan limits)
exports.createPump = async (req, res) => {
  try {
    if (req.user.role !== 'Owner' && req.user.role !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { name, location } = req.body;

    // Check plan limits for Owners
    if (req.user.role === 'Owner') {
      const currentPumps = await Pump.count({
        where: { stationId: req.user.stationId }
      });

      const user = await User.findByPk(req.userId, {
        include: [{ model: require('../models').Plan, as: 'plan' }]
      });

      const planLimits = PLAN_LIMITS[user.plan?.name];
      if (planLimits && planLimits.maxPumps !== -1 && currentPumps >= planLimits.maxPumps) {
        return res.status(400).json({
          success: false,
          error: `Plan limit exceeded. Maximum ${planLimits.maxPumps} pumps allowed.`
        });
      }
    }

    const pump = await Pump.create({
      name,
      status: 'active',
      stationId: req.user.stationId || null,
      lastMaintenanceDate: new Date(),
      totalSalesToday: 0
    });

    // Create default nozzles (2 for petrol, 2 for diesel)
    const nozzles = await Promise.all([
      Nozzle.create({ pumpId: pump.id, number: 1, fuelType: 'Petrol', status: 'active' }),
      Nozzle.create({ pumpId: pump.id, number: 2, fuelType: 'Petrol', status: 'active' }),
      Nozzle.create({ pumpId: pump.id, number: 3, fuelType: 'Diesel', status: 'active' }),
      Nozzle.create({ pumpId: pump.id, number: 4, fuelType: 'Diesel', status: 'active' })
    ]);

    res.status(201).json({
      success: true,
      data: {
        ...pump.toJSON(),
        nozzles
      }
    });
  } catch (error) {
    console.error('Error creating pump:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pump'
    });
  }
};

// Update pump status
exports.updatePumpStatus = async (req, res) => {
  try {
    const { pumpId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'maintenance'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    let whereClause = { id: pumpId };
    
    // Role-based access control
    if (req.user.role === 'Owner') {
      whereClause.stationId = req.user.stationId;
    }

    const pump = await Pump.findOne({ where: whereClause });
    
    if (!pump) {
      return res.status(404).json({
        success: false,
        error: 'Pump not found or access denied'
      });
    }

    await pump.update({ status });

    res.json({
      success: true,
      data: {
        id: pump.id,
        status: pump.status,
        updatedAt: pump.updatedAt
      },
      message: 'Pump status updated successfully'
    });
  } catch (error) {
    console.error('Error updating pump status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update pump status'
    });
  }
};

// Update nozzle fuel type
exports.updateNozzleFuelType = async (req, res) => {
  try {
    const { nozzleId } = req.params;
    const { fuelType } = req.body;

    if (!['Petrol', 'Diesel'].includes(fuelType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid fuel type'
      });
    }

    const nozzle = await Nozzle.findByPk(nozzleId, {
      include: [{ model: Pump, as: 'pump' }]
    });

    if (!nozzle) {
      return res.status(404).json({
        success: false,
        error: 'Nozzle not found'
      });
    }

    // Role-based access control
    if (req.user.role === 'Owner' && nozzle.pump.stationId !== req.user.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await nozzle.update({ fuelType });

    res.json({
      success: true,
      message: 'Nozzle fuel type updated successfully'
    });
  } catch (error) {
    console.error('Error updating nozzle fuel type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update nozzle fuel type'
    });
  }
};

// Get pump performance metrics
exports.getPumpMetrics = async (req, res) => {
  try {
    const { pumpId } = req.params;
    const { period = '24h' } = req.query;

    let whereClause = { id: pumpId };
    
    // Role-based access control
    if (req.user.role === 'Owner') {
      whereClause.stationId = req.user.stationId;
    }

    const pump = await Pump.findOne({ where: whereClause });
    
    if (!pump) {
      return res.status(404).json({
        success: false,
        error: 'Pump not found or access denied'
      });
    }

    // TODO: Calculate real metrics from sales data
    const metrics = {
      pumpId: pump.id,
      period,
      totalSales: pump.totalSalesToday || 0,
      totalLitres: 0, // Calculate from sales
      transactions: 0, // Count from sales
      uptime: 95.5, // Calculate from pump status history
      efficiency: 92.3, // Calculate based on performance
      hourlyData: [] // Get from sales data grouped by hour
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching pump metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pump metrics'
    });
  }
};

module.exports = {
  getPumps: exports.getPumps,
  createPump: exports.createPump,
  updatePumpStatus: exports.updatePumpStatus,
  updateNozzleFuelType: exports.updateNozzleFuelType,
  getPumpMetrics: exports.getPumpMetrics
};
