/**
 * Daily Closure Controller
 * Handles shift/day end reconciliation
 */

const { DailyClosure, Sale, Station, User, FuelTank, Pump, Nozzle, OCRReading } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Get closure data for preparation
 * @route GET /api/v1/closures/prepare
 */
exports.prepareClosure = async (req, res) => {
  try {
    const { date, shift } = req.query;
    const stationId = req.user.role === 'super_admin' ? req.query.stationId : req.user.stationId;

    if (!stationId) {
      return res.status(400).json({
        success: false,
        error: 'Station ID is required'
      });
    }

    const closureDate = date || new Date().toISOString().split('T')[0];
    const closureShift = shift || 'full_day';

    // Check for existing closure
    const existing = await DailyClosure.findOne({
      where: { stationId, closureDate, shift: closureShift }
    });

    if (existing && existing.status !== 'draft') {
      return res.status(409).json({
        success: false,
        error: 'A closure already exists for this date/shift',
        existingClosure: existing
      });
    }

    // Get sales data for the period
    let salesWhere = { stationId, saleDate: closureDate };
    if (closureShift !== 'full_day') {
      salesWhere.shift = closureShift;
    }

    const salesData = await Sale.findAll({
      where: salesWhere,
      attributes: [
        'fuelType',
        'shift',
        [fn('SUM', col('total_amount')), 'totalAmount'],
        [fn('SUM', col('litres_sold')), 'litresSold'],
        [fn('COUNT', col('id')), 'transactionCount']
      ],
      group: ['fuelType', 'shift'],
      raw: true
    });

    // Aggregate sales
    let totalSalesAmount = 0;
    let totalLitresSold = 0;
    let petrolLitres = 0;
    let dieselLitres = 0;
    let petrolAmount = 0;
    let dieselAmount = 0;
    let transactionCount = 0;

    salesData.forEach(s => {
      const amount = parseFloat(s.totalAmount || 0);
      const litres = parseFloat(s.litresSold || 0);
      const count = parseInt(s.transactionCount || 0);

      totalSalesAmount += amount;
      totalLitresSold += litres;
      transactionCount += count;

      if (s.fuelType === 'petrol') {
        petrolLitres += litres;
        petrolAmount += amount;
      } else if (s.fuelType === 'diesel') {
        dieselLitres += litres;
        dieselAmount += amount;
      }
    });

    // Get pump/nozzle readings for the period
    const readings = await OCRReading.findAll({
      where: {
        stationId,
        readingDate: closureDate
      },
      include: [{
        model: Pump,
        as: 'pump',
        attributes: ['id', 'name', 'pumpSno']
      }],
      order: [['pumpSno', 'ASC'], ['nozzleId', 'ASC'], ['readingTime', 'ASC']]
    });

    // Group readings by nozzle to get opening/closing
    const nozzleReadings = {};
    readings.forEach(r => {
      const key = `${r.pumpSno}-${r.nozzleId}`;
      if (!nozzleReadings[key]) {
        nozzleReadings[key] = {
          pumpId: r.pumpId,
          pumpSno: r.pumpSno,
          pumpName: r.pump?.name,
          nozzleId: r.nozzleId,
          fuelType: r.fuelType,
          openingReading: r.cumulativeVolume,
          closingReading: r.cumulativeVolume,
          openingTime: r.readingTime,
          closingTime: r.readingTime
        };
      } else {
        // Update closing reading
        nozzleReadings[key].closingReading = r.cumulativeVolume;
        nozzleReadings[key].closingTime = r.readingTime;
      }
    });

    // Calculate litres sold per nozzle
    const nozzleReadingsArray = Object.values(nozzleReadings).map(nr => ({
      ...nr,
      litresSold: nr.closingReading - nr.openingReading
    }));

    // Get tank dip readings (if available)
    const tanks = await FuelTank.findAll({
      where: { stationId, status: 'active' },
      attributes: ['id', 'tankNumber', 'fuelType', 'currentStock', 'lastDipReading', 'lastDipDate']
    });

    const dipReadings = tanks.map(t => ({
      tankId: t.id,
      tankNumber: t.tankNumber,
      fuelType: t.fuelType,
      currentStock: t.currentStock,
      lastDipReading: t.lastDipReading,
      lastDipDate: t.lastDipDate,
      openingDip: null, // To be filled by user
      closingDip: null  // To be filled by user
    }));

    // Return prepared data
    res.json({
      success: true,
      data: {
        closureDate,
        shift: closureShift,
        stationId,
        existingDraft: existing,
        sales: {
          totalSalesAmount,
          totalLitresSold,
          petrolLitres,
          dieselLitres,
          petrolAmount,
          dieselAmount,
          transactionCount
        },
        nozzleReadings: nozzleReadingsArray,
        dipReadings,
        expectedCash: totalSalesAmount // This would be adjusted for card/UPI payments
      }
    });
  } catch (error) {
    console.error('Prepare closure error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to prepare closure data'
    });
  }
};

/**
 * Create or update a daily closure
 * @route POST /api/v1/closures
 */
exports.createClosure = async (req, res) => {
  try {
    const {
      closureDate,
      shift,
      actualCash,
      cardPayments = 0,
      upiPayments = 0,
      creditSales = 0,
      dipReadings,
      nozzleReadings,
      notes
    } = req.body;

    const stationId = req.user.role === 'super_admin' ? req.body.stationId : req.user.stationId;

    if (!stationId || !closureDate || !shift) {
      return res.status(400).json({
        success: false,
        error: 'Station ID, closure date, and shift are required'
      });
    }

    // Calculate sales from database
    let salesWhere = { stationId, saleDate: closureDate };
    if (shift !== 'full_day') {
      salesWhere.shift = shift;
    }

    const salesData = await Sale.findAll({
      where: salesWhere,
      attributes: [
        'fuelType',
        [fn('SUM', col('total_amount')), 'totalAmount'],
        [fn('SUM', col('litres_sold')), 'litresSold'],
        [fn('COUNT', col('id')), 'transactionCount']
      ],
      group: ['fuelType'],
      raw: true
    });

    let totalSalesAmount = 0;
    let totalLitresSold = 0;
    let petrolLitres = 0;
    let dieselLitres = 0;
    let petrolAmount = 0;
    let dieselAmount = 0;
    let transactionCount = 0;

    salesData.forEach(s => {
      const amount = parseFloat(s.totalAmount || 0);
      const litres = parseFloat(s.litresSold || 0);
      const count = parseInt(s.transactionCount || 0);

      totalSalesAmount += amount;
      totalLitresSold += litres;
      transactionCount += count;

      if (s.fuelType === 'petrol') {
        petrolLitres += litres;
        petrolAmount += amount;
      } else if (s.fuelType === 'diesel') {
        dieselLitres += litres;
        dieselAmount += amount;
      }
    });

    // Calculate expected cash (total - card - UPI - credit)
    const expectedCash = totalSalesAmount - cardPayments - upiPayments - creditSales;
    const cashVariance = actualCash !== undefined ? actualCash - expectedCash : null;

    // Check for existing closure
    const existing = await DailyClosure.findOne({
      where: { stationId, closureDate, shift }
    });

    let closure;
    const closureData = {
      stationId,
      closureDate,
      shift,
      totalSalesAmount,
      totalLitresSold,
      petrolLitres,
      dieselLitres,
      petrolAmount,
      dieselAmount,
      transactionCount,
      expectedCash,
      actualCash,
      cashVariance,
      cardPayments,
      upiPayments,
      creditSales,
      dipReadings,
      nozzleReadings,
      notes,
      status: 'draft',
      preparedBy: req.userId
    };

    if (existing) {
      if (existing.status === 'approved') {
        return res.status(409).json({
          success: false,
          error: 'Cannot modify an approved closure'
        });
      }
      await existing.update(closureData);
      closure = existing;
    } else {
      closure = await DailyClosure.create(closureData);
    }

    res.status(existing ? 200 : 201).json({
      success: true,
      data: closure,
      message: existing ? 'Closure updated' : 'Closure created'
    });
  } catch (error) {
    console.error('Create closure error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create closure'
    });
  }
};

/**
 * Submit closure for approval
 * @route PUT /api/v1/closures/:id/submit
 */
exports.submitClosure = async (req, res) => {
  try {
    const { id } = req.params;

    const closure = await DailyClosure.findByPk(id);

    if (!closure) {
      return res.status(404).json({
        success: false,
        error: 'Closure not found'
      });
    }

    if (req.user.role !== 'super_admin' && req.user.stationId !== closure.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    if (closure.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Only draft closures can be submitted'
      });
    }

    await closure.update({ status: 'submitted' });

    res.json({
      success: true,
      data: closure,
      message: 'Closure submitted for approval'
    });
  } catch (error) {
    console.error('Submit closure error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit closure'
    });
  }
};

/**
 * Approve or reject a closure
 * @route PUT /api/v1/closures/:id/review
 */
exports.reviewClosure = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be approve or reject'
      });
    }

    const closure = await DailyClosure.findByPk(id);

    if (!closure) {
      return res.status(404).json({
        success: false,
        error: 'Closure not found'
      });
    }

    if (req.user.role !== 'super_admin' && req.user.stationId !== closure.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Only managers and above can approve
    if (!['manager', 'owner', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only managers and above can review closures'
      });
    }

    if (closure.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        error: 'Only submitted closures can be reviewed'
      });
    }

    if (action === 'approve') {
      await closure.update({
        status: 'approved',
        approvedBy: req.userId,
        approvedAt: new Date()
      });
    } else {
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required'
        });
      }
      await closure.update({
        status: 'rejected',
        rejectionReason,
        approvedBy: req.userId,
        approvedAt: new Date()
      });
    }

    res.json({
      success: true,
      data: closure,
      message: `Closure ${action}d`
    });
  } catch (error) {
    console.error('Review closure error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to review closure'
    });
  }
};

/**
 * Get closures
 * @route GET /api/v1/closures
 */
exports.getClosures = async (req, res) => {
  try {
    const { startDate, endDate, status, shift, page = 1, limit = 20 } = req.query;
    const stationId = req.user.role === 'super_admin' ? req.query.stationId : req.user.stationId;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (stationId) whereClause.stationId = stationId;
    if (status) whereClause.status = status;
    if (shift) whereClause.shift = shift;

    if (startDate || endDate) {
      whereClause.closureDate = {};
      if (startDate) whereClause.closureDate[Op.gte] = startDate;
      if (endDate) whereClause.closureDate[Op.lte] = endDate;
    }

    const { count, rows: closures } = await DailyClosure.findAndCountAll({
      where: whereClause,
      include: [
        { model: Station, as: 'station', attributes: ['id', 'name'] },
        { model: User, as: 'preparedByUser', attributes: ['id', 'name'] },
        { model: User, as: 'approvedByUser', attributes: ['id', 'name'] }
      ],
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['closureDate', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        closures,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get closures error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch closures'
    });
  }
};

/**
 * Get closure by ID
 * @route GET /api/v1/closures/:id
 */
exports.getClosureById = async (req, res) => {
  try {
    const { id } = req.params;

    const closure = await DailyClosure.findByPk(id, {
      include: [
        { model: Station, as: 'station', attributes: ['id', 'name', 'location'] },
        { model: User, as: 'preparedByUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'approvedByUser', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!closure) {
      return res.status(404).json({
        success: false,
        error: 'Closure not found'
      });
    }

    if (req.user.role !== 'super_admin' && req.user.stationId !== closure.stationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    res.json({
      success: true,
      data: closure
    });
  } catch (error) {
    console.error('Get closure by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch closure'
    });
  }
};
