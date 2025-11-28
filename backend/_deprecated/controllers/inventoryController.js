/**
 * Inventory Controller
 * Manages fuel tanks, stock levels, and deliveries
 */

const { FuelTank, FuelDelivery, Station, User, Sale } = require('../models');
const { Op, fn, col } = require('sequelize');

// ============================================
// FUEL TANK OPERATIONS
// ============================================

/**
 * Create a new fuel tank
 * @route POST /api/v1/inventory/tanks
 */
exports.createTank = async (req, res) => {
  try {
    const { tankNumber, fuelType, capacity, reorderLevel, currentStock = 0 } = req.body;
    const stationId = req.user.role === 'super_admin' ? req.body.stationId : req.user.stationId;

    if (!stationId) {
      return res.status(400).json({
        success: false,
        error: 'Station ID is required'
      });
    }

    if (!tankNumber || !fuelType || !capacity) {
      return res.status(400).json({
        success: false,
        error: 'Tank number, fuel type, and capacity are required'
      });
    }

    // Check for duplicate tank number
    const existing = await FuelTank.findOne({
      where: { stationId, tankNumber }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Tank ${tankNumber} already exists at this station`
      });
    }

    const tank = await FuelTank.create({
      stationId,
      tankNumber,
      fuelType: fuelType.toLowerCase(),
      capacity,
      currentStock,
      reorderLevel: reorderLevel || capacity * 0.2, // Default 20% of capacity
      status: 'active'
    });

    res.status(201).json({
      success: true,
      data: tank,
      message: 'Fuel tank created successfully'
    });
  } catch (error) {
    console.error('Create tank error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create fuel tank'
    });
  }
};

/**
 * Get all tanks for a station
 * @route GET /api/v1/inventory/tanks
 */
exports.getTanks = async (req, res) => {
  try {
    const stationId = req.user.role === 'super_admin' ? req.query.stationId : req.user.stationId;
    const { status, fuelType } = req.query;

    if (!stationId && req.user.role !== 'super_admin') {
      return res.json({
        success: true,
        data: { tanks: [] }
      });
    }

    let whereClause = {};
    if (stationId) whereClause.stationId = stationId;
    if (status) whereClause.status = status;
    if (fuelType) whereClause.fuelType = fuelType.toLowerCase();

    const tanks = await FuelTank.findAll({
      where: whereClause,
      include: [{
        model: Station,
        as: 'station',
        attributes: ['id', 'name']
      }],
      order: [['tankNumber', 'ASC']]
    });

    // Calculate stock percentage and low stock alerts
    const tanksWithAlerts = tanks.map(tank => {
      const stockPercentage = (tank.currentStock / tank.capacity) * 100;
      const isLowStock = tank.reorderLevel && tank.currentStock <= tank.reorderLevel;
      
      return {
        ...tank.toJSON(),
        stockPercentage: Math.round(stockPercentage * 100) / 100,
        isLowStock,
        availableCapacity: tank.capacity - tank.currentStock
      };
    });

    res.json({
      success: true,
      data: { tanks: tanksWithAlerts }
    });
  } catch (error) {
    console.error('Get tanks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fuel tanks'
    });
  }
};

/**
 * Update tank details or stock level
 * @route PUT /api/v1/inventory/tanks/:id
 */
exports.updateTank = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentStock, reorderLevel, status, lastDipReading } = req.body;

    const tank = await FuelTank.findByPk(id, {
      include: [{ model: Station, as: 'station' }]
    });

    if (!tank) {
      return res.status(404).json({
        success: false,
        error: 'Tank not found'
      });
    }

    // Authorization
    if (req.user.role !== 'super_admin' && req.user.stationId !== tank.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this tank'
      });
    }

    const updates = {};
    if (currentStock !== undefined) {
      if (currentStock > tank.capacity) {
        return res.status(400).json({
          success: false,
          error: `Stock cannot exceed tank capacity of ${tank.capacity} litres`
        });
      }
      updates.currentStock = currentStock;
    }
    if (reorderLevel !== undefined) updates.reorderLevel = reorderLevel;
    if (status) updates.status = status;
    if (lastDipReading !== undefined) {
      updates.lastDipReading = lastDipReading;
      updates.lastDipDate = new Date();
    }

    await tank.update(updates);

    res.json({
      success: true,
      data: tank,
      message: 'Tank updated successfully'
    });
  } catch (error) {
    console.error('Update tank error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tank'
    });
  }
};

/**
 * Record dip reading (physical measurement)
 * @route POST /api/v1/inventory/tanks/:id/dip
 */
exports.recordDipReading = async (req, res) => {
  try {
    const { id } = req.params;
    const { dipReading, adjustStock = false } = req.body;

    const tank = await FuelTank.findByPk(id);

    if (!tank) {
      return res.status(404).json({
        success: false,
        error: 'Tank not found'
      });
    }

    if (req.user.role !== 'super_admin' && req.user.stationId !== tank.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    const variance = dipReading - tank.currentStock;

    const updates = {
      lastDipReading: dipReading,
      lastDipDate: new Date()
    };

    if (adjustStock) {
      updates.currentStock = dipReading;
    }

    await tank.update(updates);

    res.json({
      success: true,
      data: {
        tank,
        variance,
        variancePercentage: tank.currentStock > 0 
          ? Math.round((variance / tank.currentStock) * 10000) / 100 
          : 0,
        stockAdjusted: adjustStock
      },
      message: adjustStock ? 'Dip reading recorded and stock adjusted' : 'Dip reading recorded'
    });
  } catch (error) {
    console.error('Record dip error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record dip reading'
    });
  }
};

// ============================================
// FUEL DELIVERY OPERATIONS
// ============================================

/**
 * Record a fuel delivery
 * @route POST /api/v1/inventory/deliveries
 */
exports.createDelivery = async (req, res) => {
  try {
    const {
      tankId,
      deliveryDate,
      deliveryTime,
      supplierName,
      vehicleNumber,
      invoiceNumber,
      orderedQuantity,
      receivedQuantity,
      pricePerLitre,
      notes
    } = req.body;

    const stationId = req.user.role === 'super_admin' ? req.body.stationId : req.user.stationId;

    if (!tankId || !receivedQuantity || !pricePerLitre) {
      return res.status(400).json({
        success: false,
        error: 'Tank ID, received quantity, and price per litre are required'
      });
    }

    const tank = await FuelTank.findByPk(tankId);
    if (!tank) {
      return res.status(404).json({
        success: false,
        error: 'Tank not found'
      });
    }

    if (req.user.role !== 'super_admin' && req.user.stationId !== tank.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Check capacity
    const newStock = parseFloat(tank.currentStock) + parseFloat(receivedQuantity);
    if (newStock > tank.capacity) {
      return res.status(400).json({
        success: false,
        error: `Delivery would exceed tank capacity. Available space: ${(tank.capacity - tank.currentStock).toFixed(2)} litres`
      });
    }

    const stockBefore = tank.currentStock;
    const totalAmount = receivedQuantity * pricePerLitre;
    const variance = orderedQuantity ? receivedQuantity - orderedQuantity : 0;

    // Create delivery record
    const delivery = await FuelDelivery.create({
      stationId: tank.stationId,
      tankId,
      fuelType: tank.fuelType,
      deliveryDate: deliveryDate || new Date().toISOString().split('T')[0],
      deliveryTime,
      supplierName,
      vehicleNumber,
      invoiceNumber,
      orderedQuantity: orderedQuantity || receivedQuantity,
      receivedQuantity,
      pricePerLitre,
      totalAmount,
      stockBefore,
      stockAfter: newStock,
      variance,
      status: 'pending',
      notes,
      receivedBy: req.userId
    });

    // Update tank stock
    await tank.update({ currentStock: newStock });

    res.status(201).json({
      success: true,
      data: {
        delivery,
        tank: {
          id: tank.id,
          tankNumber: tank.tankNumber,
          stockBefore,
          stockAfter: newStock
        }
      },
      message: 'Delivery recorded successfully'
    });
  } catch (error) {
    console.error('Create delivery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record delivery'
    });
  }
};

/**
 * Get deliveries
 * @route GET /api/v1/inventory/deliveries
 */
exports.getDeliveries = async (req, res) => {
  try {
    const { startDate, endDate, tankId, status, page = 1, limit = 20 } = req.query;
    const stationId = req.user.role === 'super_admin' ? req.query.stationId : req.user.stationId;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (stationId) whereClause.stationId = stationId;
    if (tankId) whereClause.tankId = tankId;
    if (status) whereClause.status = status;
    
    if (startDate || endDate) {
      whereClause.deliveryDate = {};
      if (startDate) whereClause.deliveryDate[Op.gte] = startDate;
      if (endDate) whereClause.deliveryDate[Op.lte] = endDate;
    }

    const { count, rows: deliveries } = await FuelDelivery.findAndCountAll({
      where: whereClause,
      include: [
        { model: FuelTank, as: 'tank', attributes: ['id', 'tankNumber', 'fuelType'] },
        { model: User, as: 'receivedByUser', attributes: ['id', 'name'] },
        { model: User, as: 'verifiedByUser', attributes: ['id', 'name'] }
      ],
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['deliveryDate', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        deliveries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get deliveries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deliveries'
    });
  }
};

/**
 * Verify a delivery
 * @route PUT /api/v1/inventory/deliveries/:id/verify
 */
exports.verifyDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['verified', 'disputed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be verified or disputed'
      });
    }

    const delivery = await FuelDelivery.findByPk(id);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    if (req.user.role !== 'super_admin' && req.user.stationId !== delivery.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    if (req.user.role === 'employee') {
      return res.status(403).json({
        success: false,
        error: 'Only managers and above can verify deliveries'
      });
    }

    await delivery.update({
      status,
      verifiedBy: req.userId,
      verifiedAt: new Date(),
      notes: notes ? `${delivery.notes || ''}\n[Verification: ${notes}]` : delivery.notes
    });

    res.json({
      success: true,
      data: delivery,
      message: `Delivery ${status}`
    });
  } catch (error) {
    console.error('Verify delivery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify delivery'
    });
  }
};

/**
 * Get inventory summary
 * @route GET /api/v1/inventory/summary
 */
exports.getInventorySummary = async (req, res) => {
  try {
    const stationId = req.user.role === 'super_admin' ? req.query.stationId : req.user.stationId;

    if (!stationId && req.user.role !== 'super_admin') {
      return res.json({
        success: true,
        data: { tanks: [], totals: {} }
      });
    }

    let whereClause = { status: 'active' };
    if (stationId) whereClause.stationId = stationId;

    const tanks = await FuelTank.findAll({
      where: whereClause,
      order: [['fuelType', 'ASC'], ['tankNumber', 'ASC']]
    });

    // Aggregate by fuel type
    const totals = { petrol: { capacity: 0, stock: 0, tanks: 0 }, diesel: { capacity: 0, stock: 0, tanks: 0 } };
    const lowStockTanks = [];

    tanks.forEach(tank => {
      const fuelType = tank.fuelType;
      if (totals[fuelType]) {
        totals[fuelType].capacity += parseFloat(tank.capacity);
        totals[fuelType].stock += parseFloat(tank.currentStock);
        totals[fuelType].tanks += 1;
      }

      if (tank.reorderLevel && tank.currentStock <= tank.reorderLevel) {
        lowStockTanks.push({
          id: tank.id,
          tankNumber: tank.tankNumber,
          fuelType: tank.fuelType,
          currentStock: tank.currentStock,
          reorderLevel: tank.reorderLevel,
          capacity: tank.capacity
        });
      }
    });

    // Calculate percentages
    Object.keys(totals).forEach(fuelType => {
      totals[fuelType].percentage = totals[fuelType].capacity > 0
        ? Math.round((totals[fuelType].stock / totals[fuelType].capacity) * 10000) / 100
        : 0;
    });

    res.json({
      success: true,
      data: {
        tanks: tanks.map(t => ({
          ...t.toJSON(),
          stockPercentage: Math.round((t.currentStock / t.capacity) * 10000) / 100
        })),
        totals,
        lowStockTanks,
        alerts: {
          lowStockCount: lowStockTanks.length
        }
      }
    });
  } catch (error) {
    console.error('Inventory summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory summary'
    });
  }
};
