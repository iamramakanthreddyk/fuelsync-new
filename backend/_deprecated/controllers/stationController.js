/**
 * Station Controller
 * Handles all station-related operations with multi-tenant support
 */

const { Station, User, Pump, Nozzle, FuelPrice, Sale } = require('../models');
const { Op } = require('sequelize');

/**
 * Create a new station
 * @route POST /api/v1/stations
 * @access Owner, Super Admin
 */
exports.createStation = async (req, res) => {
  try {
    const { name, location, address, contactInfo, licenseNumber } = req.body;

    // Validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Station name is required and must be at least 2 characters'
      });
    }

    // Check plan limits for non-super-admin users
    if (req.user.role !== 'super_admin') {
      const limits = req.user.getEffectiveLimits();
      const existingStations = await Station.count({
        include: [{
          model: User,
          as: 'users',
          where: { id: req.userId }
        }]
      });

      if (limits.maxStations !== -1 && existingStations >= limits.maxStations) {
        return res.status(403).json({
          success: false,
          error: `Plan limit reached. Maximum ${limits.maxStations} station(s) allowed.`,
          code: 'PLAN_LIMIT_EXCEEDED'
        });
      }
    }

    const station = await Station.create({
      name: name.trim(),
      location: location?.trim(),
      address: address || {},
      contactInfo: contactInfo || {},
      licenseNumber: licenseNumber?.trim(),
      isActive: true
    });

    // If owner is creating, associate them with the station
    if (req.user.role === 'owner' && !req.user.stationId) {
      await req.user.update({ stationId: station.id });
    }

    res.status(201).json({
      success: true,
      data: station,
      message: 'Station created successfully'
    });
  } catch (error) {
    console.error('Create station error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create station'
    });
  }
};

/**
 * Get all stations (with role-based filtering)
 * @route GET /api/v1/stations
 * @access All authenticated users
 */
exports.getStations = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    
    // Role-based filtering
    if (req.user.role !== 'super_admin') {
      // Non-super-admins can only see their assigned station
      if (req.user.stationId) {
        whereClause.id = req.user.stationId;
      } else {
        return res.json({
          success: true,
          data: { stations: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
        });
      }
    }

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { location: { [Op.iLike]: `%${search}%` } },
        { licenseNumber: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Status filter
    if (status !== undefined) {
      whereClause.isActive = status === 'active';
    }

    const { count, rows: stations } = await Station.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Pump,
          as: 'pumps',
          attributes: ['id', 'name', 'status'],
          required: false
        },
        {
          model: User,
          as: 'users',
          attributes: ['id', 'name', 'role'],
          where: { isActive: true },
          required: false
        }
      ],
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      distinct: true
    });

    // Add computed fields
    const stationsWithStats = stations.map(station => ({
      ...station.toJSON(),
      pumpCount: station.pumps?.length || 0,
      employeeCount: station.users?.filter(u => u.role === 'employee').length || 0,
      managerCount: station.users?.filter(u => u.role === 'manager').length || 0
    }));

    res.json({
      success: true,
      data: {
        stations: stationsWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get stations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stations'
    });
  }
};

/**
 * Get station by ID with full details
 * @route GET /api/v1/stations/:id
 * @access Owner of station, Manager, Super Admin
 */
exports.getStationById = async (req, res) => {
  try {
    const { id } = req.params;

    // Authorization check
    if (req.user.role !== 'super_admin' && req.user.stationId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this station'
      });
    }

    const station = await Station.findByPk(id, {
      include: [
        {
          model: Pump,
          as: 'pumps',
          include: [{
            model: Nozzle,
            as: 'nozzles',
            attributes: ['id', 'nozzleId', 'fuelType', 'status']
          }]
        },
        {
          model: User,
          as: 'users',
          attributes: ['id', 'name', 'email', 'role', 'isActive', 'lastLoginAt']
        },
        {
          model: FuelPrice,
          as: 'fuelPrices',
          order: [['validFrom', 'DESC']],
          limit: 2
        }
      ]
    });

    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }

    // Get today's sales summary
    const today = new Date().toISOString().split('T')[0];
    const todaySales = await Sale.findAll({
      where: {
        stationId: id,
        saleDate: today
      },
      attributes: [
        [require('sequelize').fn('SUM', require('sequelize').col('total_amount')), 'totalRevenue'],
        [require('sequelize').fn('SUM', require('sequelize').col('litres_sold')), 'totalLitres'],
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'transactionCount']
      ],
      raw: true
    });

    res.json({
      success: true,
      data: {
        ...station.toJSON(),
        todaySummary: {
          revenue: parseFloat(todaySales[0]?.totalRevenue || 0),
          litres: parseFloat(todaySales[0]?.totalLitres || 0),
          transactions: parseInt(todaySales[0]?.transactionCount || 0)
        }
      }
    });
  } catch (error) {
    console.error('Get station by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch station details'
    });
  }
};

/**
 * Update station
 * @route PUT /api/v1/stations/:id
 * @access Owner of station, Super Admin
 */
exports.updateStation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, address, contactInfo, licenseNumber, isActive } = req.body;

    // Authorization check
    if (req.user.role !== 'super_admin' && req.user.stationId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this station'
      });
    }

    const station = await Station.findByPk(id);
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }

    // Build update object
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (location !== undefined) updates.location = location?.trim();
    if (address !== undefined) updates.address = address;
    if (contactInfo !== undefined) updates.contactInfo = contactInfo;
    if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber?.trim();
    if (isActive !== undefined && req.user.role === 'super_admin') {
      updates.isActive = isActive;
    }

    await station.update(updates);

    res.json({
      success: true,
      data: station,
      message: 'Station updated successfully'
    });
  } catch (error) {
    console.error('Update station error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update station'
    });
  }
};

/**
 * Delete station (soft delete by deactivating)
 * @route DELETE /api/v1/stations/:id
 * @access Super Admin only
 */
exports.deleteStation = async (req, res) => {
  try {
    const { id } = req.params;
    const { hardDelete = false } = req.query;

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Only super admin can delete stations'
      });
    }

    const station = await Station.findByPk(id, {
      include: [
        { model: User, as: 'users' },
        { model: Pump, as: 'pumps' }
      ]
    });

    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }

    // Check for active users
    const activeUsers = station.users?.filter(u => u.isActive) || [];
    if (activeUsers.length > 0 && !hardDelete) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete station with ${activeUsers.length} active user(s). Deactivate users first or use hard delete.`,
        activeUsers: activeUsers.map(u => ({ id: u.id, name: u.name, role: u.role }))
      });
    }

    if (hardDelete === 'true') {
      // Hard delete - cascades to related records
      await station.destroy();
      return res.json({
        success: true,
        message: 'Station permanently deleted'
      });
    }

    // Soft delete
    await station.update({ isActive: false });

    res.json({
      success: true,
      message: 'Station deactivated successfully'
    });
  } catch (error) {
    console.error('Delete station error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete station'
    });
  }
};

/**
 * Get station summary/stats
 * @route GET /api/v1/stations/:id/summary
 * @access Owner of station, Manager, Super Admin
 */
exports.getStationSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '7d' } = req.query;

    // Authorization check
    if (req.user.role !== 'super_admin' && req.user.stationId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this station'
      });
    }

    const station = await Station.findByPk(id);
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
      case '7d': startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setDate(startDate.getDate() - 30); break;
      case '90d': startDate.setDate(startDate.getDate() - 90); break;
      default: startDate.setDate(startDate.getDate() - 7);
    }

    // Get sales stats
    const salesStats = await Sale.findAll({
      where: {
        stationId: id,
        saleDate: { [Op.between]: [startDate, endDate] }
      },
      attributes: [
        'fuelType',
        [require('sequelize').fn('SUM', require('sequelize').col('total_amount')), 'revenue'],
        [require('sequelize').fn('SUM', require('sequelize').col('litres_sold')), 'litres'],
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'transactions']
      ],
      group: ['fuelType'],
      raw: true
    });

    // Get pump count
    const pumpCount = await Pump.count({ where: { stationId: id, status: 'active' } });
    
    // Get employee count
    const employeeCount = await User.count({ 
      where: { stationId: id, role: 'employee', isActive: true } 
    });

    // Format response
    const fuelBreakdown = {};
    let totalRevenue = 0;
    let totalLitres = 0;
    let totalTransactions = 0;

    salesStats.forEach(stat => {
      const revenue = parseFloat(stat.revenue || 0);
      const litres = parseFloat(stat.litres || 0);
      const transactions = parseInt(stat.transactions || 0);

      fuelBreakdown[stat.fuelType] = { revenue, litres, transactions };
      totalRevenue += revenue;
      totalLitres += litres;
      totalTransactions += transactions;
    });

    res.json({
      success: true,
      data: {
        station: {
          id: station.id,
          name: station.name,
          location: station.location
        },
        period,
        summary: {
          totalRevenue,
          totalLitres,
          totalTransactions,
          activePumps: pumpCount,
          activeEmployees: employeeCount
        },
        fuelBreakdown
      }
    });
  } catch (error) {
    console.error('Get station summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch station summary'
    });
  }
};
