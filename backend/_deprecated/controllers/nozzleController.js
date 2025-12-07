/**
 * Nozzle Controller
 * Handles nozzle configuration and management
 */

const { Nozzle, Pump, Station, FuelPrice } = require('../models');
const { Op } = require('sequelize');

/**
 * Create a new nozzle for a pump
 * @route POST /api/v1/pumps/:pumpId/nozzles
 * @access Manager, Owner, Super Admin
 */
exports.createNozzle = async (req, res) => {
  try {
    const { pumpId } = req.params;
    const { nozzleId, nozzleNumber, fuelType, fuel_type, initialReading, initial_reading, maxFlowRate } = req.body;

    // Support both field names for backward compatibility
    const nozzleNum = nozzleNumber || nozzleId;
    const fuel = fuelType || fuel_type;
    const initial = initialReading || initial_reading || 0;

    // Validation
    if (!nozzleNum || nozzleNum < 1 || nozzleNum > 10) {
      return res.status(400).json({
        success: false,
        error: 'Nozzle number must be between 1 and 10'
      });
    }

    if (!fuel || !['petrol', 'diesel'].includes(fuel.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Fuel type must be petrol or diesel'
      });
    }

    // Find pump and verify station access
    const pump = await Pump.findByPk(pumpId, {
      include: [{ model: Station, as: 'station' }]
    });

    if (!pump) {
      return res.status(404).json({
        success: false,
        error: 'Pump not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super_admin' && req.user.stationId !== pump.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this pump'
      });
    }

    // Check for duplicate nozzle
    const existingNozzle = await Nozzle.findOne({
      where: { pumpId, nozzleNumber: nozzleNum }
    });

    if (existingNozzle) {
      return res.status(409).json({
        success: false,
        error: `Nozzle ${nozzleNum} already exists on this pump`
      });
    }

    const nozzle = await Nozzle.create({
      pumpId,
      stationId: pump.stationId, // Denormalize station ID
      nozzleNumber: nozzleNum,
      fuelType: fuel.toLowerCase(),
      initialReading: initial,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      data: nozzle,
      message: 'Nozzle created successfully'
    });
  } catch (error) {
    console.error('Create nozzle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create nozzle'
    });
  }
};

/**
 * Get all nozzles for a pump
 * @route GET /api/v1/pumps/:pumpId/nozzles
 * @access All authenticated users (with station access)
 */
exports.getNozzlesByPump = async (req, res) => {
  try {
    const { pumpId } = req.params;
    const { status } = req.query;

    const pump = await Pump.findByPk(pumpId);
    if (!pump) {
      return res.status(404).json({
        success: false,
        error: 'Pump not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super_admin' && req.user.stationId !== pump.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this pump'
      });
    }

    let whereClause = { pumpId };
    if (status) {
      whereClause.status = status;
    }

    const nozzles = await Nozzle.findAll({
      where: whereClause,
      order: [['nozzleId', 'ASC']]
    });

    // Get current fuel prices for the station
    const fuelPrices = await FuelPrice.findAll({
      where: { stationId: pump.stationId },
      order: [['validFrom', 'DESC']]
    });

    const priceMap = {};
    fuelPrices.forEach(fp => {
      if (!priceMap[fp.fuelType]) {
        priceMap[fp.fuelType] = fp.price;
      }
    });

    // Enrich nozzles with current price
    const enrichedNozzles = nozzles.map(n => ({
      ...n.toJSON(),
      currentPrice: priceMap[n.fuelType] || null
    }));

    res.json({
      success: true,
      data: {
        pump: {
          id: pump.id,
          name: pump.name,
          pumpSno: pump.pumpSno,
          status: pump.status
        },
        nozzles: enrichedNozzles
      }
    });
  } catch (error) {
    console.error('Get nozzles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nozzles'
    });
  }
};

/**
 * Get nozzle by ID
 * @route GET /api/v1/nozzles/:id
 * @access All authenticated users (with station access)
 */
exports.getNozzleById = async (req, res) => {
  try {
    const { id } = req.params;

    const nozzle = await Nozzle.findByPk(id, {
      include: [{
        model: Pump,
        as: 'pump',
        include: [{ model: Station, as: 'station' }]
      }]
    });

    if (!nozzle) {
      return res.status(404).json({
        success: false,
        error: 'Nozzle not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super_admin' && req.user.stationId !== nozzle.pump.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this nozzle'
      });
    }

    res.json({
      success: true,
      data: nozzle
    });
  } catch (error) {
    console.error('Get nozzle by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nozzle'
    });
  }
};

/**
 * Update nozzle
 * @route PUT /api/v1/nozzles/:id
 * @access Manager, Owner, Super Admin
 */
exports.updateNozzle = async (req, res) => {
  try {
    const { id } = req.params;
    const { fuelType, status, maxFlowRate } = req.body;

    const nozzle = await Nozzle.findByPk(id, {
      include: [{
        model: Pump,
        as: 'pump'
      }]
    });

    if (!nozzle) {
      return res.status(404).json({
        success: false,
        error: 'Nozzle not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super_admin' && req.user.stationId !== nozzle.pump.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this nozzle'
      });
    }

    // Build update object
    const updates = {};
    if (fuelType && ['petrol', 'diesel'].includes(fuelType.toLowerCase())) {
      updates.fuelType = fuelType.toLowerCase();
    }
    if (status && ['active', 'inactive'].includes(status)) {
      updates.status = status;
    }
    if (maxFlowRate !== undefined) {
      updates.maxFlowRate = maxFlowRate;
    }

    await nozzle.update(updates);

    res.json({
      success: true,
      data: nozzle,
      message: 'Nozzle updated successfully'
    });
  } catch (error) {
    console.error('Update nozzle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update nozzle'
    });
  }
};

/**
 * Delete nozzle
 * @route DELETE /api/v1/nozzles/:id
 * @access Owner, Super Admin
 */
exports.deleteNozzle = async (req, res) => {
  try {
    const { id } = req.params;

    const nozzle = await Nozzle.findByPk(id, {
      include: [{
        model: Pump,
        as: 'pump'
      }]
    });

    if (!nozzle) {
      return res.status(404).json({
        success: false,
        error: 'Nozzle not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super_admin' && req.user.stationId !== nozzle.pump.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this nozzle'
      });
    }

    // Check for associated readings/sales before deleting
    // For safety, we could soft-delete by setting status to 'inactive'
    await nozzle.update({ status: 'inactive' });

    res.json({
      success: true,
      message: 'Nozzle deactivated successfully'
    });
  } catch (error) {
    console.error('Delete nozzle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete nozzle'
    });
  }
};

/**
 * Bulk create/update nozzles for a pump
 * @route POST /api/v1/pumps/:pumpId/nozzles/bulk
 * @access Manager, Owner, Super Admin
 */
exports.bulkUpsertNozzles = async (req, res) => {
  try {
    const { pumpId } = req.params;
    const { nozzles } = req.body;

    if (!Array.isArray(nozzles) || nozzles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nozzles array is required'
      });
    }

    const pump = await Pump.findByPk(pumpId);
    if (!pump) {
      return res.status(404).json({
        success: false,
        error: 'Pump not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super_admin' && req.user.stationId !== pump.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this pump'
      });
    }

    const results = { created: [], updated: [], errors: [] };

    for (const nozzleData of nozzles) {
      try {
        const { nozzleId, fuelType, status = 'active', maxFlowRate } = nozzleData;

        if (!nozzleId || !fuelType) {
          results.errors.push({ nozzleId, error: 'nozzleId and fuelType are required' });
          continue;
        }

        const [nozzle, created] = await Nozzle.upsert({
          pumpId,
          nozzleId,
          fuelType: fuelType.toLowerCase(),
          status,
          maxFlowRate
        }, {
          returning: true
        });

        if (created) {
          results.created.push(nozzle.toJSON());
        } else {
          results.updated.push(nozzle.toJSON());
        }
      } catch (err) {
        results.errors.push({ nozzleId: nozzleData.nozzleId, error: err.message });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Created ${results.created.length}, updated ${results.updated.length} nozzles`
    });
  } catch (error) {
    console.error('Bulk upsert nozzles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update nozzles'
    });
  }
};
