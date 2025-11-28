/**
 * Reading Controller
 * Core business logic for nozzle readings and sales calculation
 */

const { NozzleReading, Nozzle, Pump, Station, FuelPrice, User, Shift, sequelize } = require('../models');
const { Op } = require('sequelize');
const { canAccessStation, verifyNozzleAccess, getAccessibleStationIds } = require('../middleware/accessControl');

/**
 * Enter a new nozzle reading
 * POST /api/v1/readings
 */
exports.createReading = async (req, res, next) => {
  try {
    const { nozzleId, readingDate, readingValue, cashAmount, onlineAmount, notes } = req.body;
    const userId = req.userId;

    // Validate required fields
    if (!nozzleId || !readingDate || readingValue === undefined) {
      return res.status(400).json({
        success: false,
        error: 'nozzleId, readingDate, and readingValue are required'
      });
    }

    // Get nozzle with pump and station info
    const nozzle = await Nozzle.findByPk(nozzleId, {
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

    // Check nozzle is active
    if (nozzle.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Nozzle is ${nozzle.status}. Cannot enter reading.`
      });
    }

    const stationId = nozzle.pump.stationId;

    // Authorization: user must have access to this station
    const user = await User.findByPk(userId);
    
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to enter readings for this station'
      });
    }
    
    // Get station settings
    const station = await Station.findByPk(stationId);
    
    // Check if shift is required and user has an active shift
    let activeShift = null;
    if (station.requireShiftForReadings) {
      activeShift = await Shift.getActiveShift(userId);
      
      if (!activeShift) {
        return res.status(400).json({
          success: false,
          error: 'You must have an active shift to enter readings. Please start your shift first.',
          requiresShift: true
        });
      }
      
      // Verify shift is for the same station
      if (String(activeShift.stationId) !== String(stationId)) {
        return res.status(400).json({
          success: false,
          error: 'Your active shift is for a different station',
          requiresShift: true
        });
      }
    } else {
      // Even if not required, try to get active shift to link it
      activeShift = await Shift.getActiveShift(userId);
    }

    // Get previous reading
    const previousReadingRecord = await NozzleReading.getLatestReading(nozzleId);
    let previousReading = previousReadingRecord?.readingValue || nozzle.initialReading || 0;
    let isInitialReading = !previousReadingRecord;

    // Validate reading value (must be >= previous)
    const currentValue = parseFloat(readingValue);
    const prevValue = parseFloat(previousReading);

    if (currentValue < prevValue) {
      return res.status(400).json({
        success: false,
        error: `Reading must be >= previous reading (${prevValue}). Meter readings only go forward.`,
        previousReading: prevValue
      });
    }

    // Calculate litres sold
    const litresSold = isInitialReading ? 0 : currentValue - prevValue;

    // Get fuel price for the reading date
    const fuelPrice = await FuelPrice.getPriceForDate(stationId, nozzle.fuelType, readingDate);
    
    if (!fuelPrice && !isInitialReading) {
      return res.status(400).json({
        success: false,
        error: `No fuel price set for ${nozzle.fuelType} on ${readingDate}. Please set fuel price first.`
      });
    }

    // Calculate total amount
    const pricePerLitre = fuelPrice || 0;
    const totalAmount = litresSold * pricePerLitre;

    // Handle payment amounts
    let finalCashAmount = 0;
    let finalOnlineAmount = 0;

    if (!isInitialReading && totalAmount > 0) {
      if (cashAmount !== undefined && onlineAmount !== undefined) {
        // Both provided - validate they sum to total
        finalCashAmount = parseFloat(cashAmount) || 0;
        finalOnlineAmount = parseFloat(onlineAmount) || 0;
        
        if (Math.abs((finalCashAmount + finalOnlineAmount) - totalAmount) > 0.01) {
          return res.status(400).json({
            success: false,
            error: `Cash (${finalCashAmount}) + Online (${finalOnlineAmount}) must equal Total (${totalAmount})`
          });
        }
      } else if (cashAmount !== undefined) {
        // Only cash provided - calculate online
        finalCashAmount = parseFloat(cashAmount) || 0;
        finalOnlineAmount = totalAmount - finalCashAmount;
        
        if (finalOnlineAmount < 0) {
          return res.status(400).json({
            success: false,
            error: `Cash amount (${finalCashAmount}) cannot exceed total (${totalAmount})`
          });
        }
      } else if (onlineAmount !== undefined) {
        // Only online provided - calculate cash
        finalOnlineAmount = parseFloat(onlineAmount) || 0;
        finalCashAmount = totalAmount - finalOnlineAmount;
        
        if (finalCashAmount < 0) {
          return res.status(400).json({
            success: false,
            error: `Online amount (${finalOnlineAmount}) cannot exceed total (${totalAmount})`
          });
        }
      } else {
        // Neither provided - default to 100% cash
        finalCashAmount = totalAmount;
        finalOnlineAmount = 0;
      }
    }

    // Create the reading
    const reading = await NozzleReading.create({
      nozzleId,
      stationId,
      pumpId: nozzle.pumpId,
      fuelType: nozzle.fuelType,
      enteredBy: userId,
      readingDate,
      readingValue: currentValue,
      previousReading: prevValue,
      litresSold,
      pricePerLitre,
      totalAmount,
      cashAmount: finalCashAmount,
      onlineAmount: finalOnlineAmount,
      isInitialReading,
      notes,
      shiftId: activeShift?.id || null
    });
    
    // Update nozzle's lastReading cache
    await nozzle.updateLastReading(currentValue, readingDate);

    // Return with calculated values
    res.status(201).json({
      success: true,
      data: {
        ...reading.toJSON(),
        nozzle: {
          id: nozzle.id,
          number: nozzle.nozzleNumber,
          fuelType: nozzle.fuelType
        },
        pump: {
          id: nozzle.pump.id,
          name: nozzle.pump.name
        }
      },
      message: isInitialReading 
        ? 'Initial reading recorded. This nozzle is now ready for daily entries.'
        : `Sale recorded: ${litresSold}L = ₹${totalAmount.toFixed(2)}`
    });

  } catch (error) {
    console.error('Create reading error:', error);
    next(error);
  }
};

/**
 * Get previous reading for a nozzle (for UI display)
 * GET /api/v1/readings/previous/:nozzleId
 */
exports.getPreviousReading = async (req, res, next) => {
  try {
    const { nozzleId } = req.params;
    const { date } = req.query; // Optional: get previous before a specific date

    const nozzle = await Nozzle.findByPk(nozzleId, {
      include: [{ model: Pump, as: 'pump' }]
    });

    if (!nozzle) {
      return res.status(404).json({
        success: false,
        error: 'Nozzle not found'
      });
    }

    let previousReading;
    
    if (date) {
      previousReading = await NozzleReading.getPreviousReading(nozzleId, date);
    } else {
      previousReading = await NozzleReading.getLatestReading(nozzleId);
    }

    // Get current fuel price
    const stationId = nozzle.pump.stationId;
    const priceDate = date || new Date().toISOString().split('T')[0];
    const currentPrice = await FuelPrice.getPriceForDate(stationId, nozzle.fuelType, priceDate);

    res.json({
      success: true,
      data: {
        nozzle: {
          id: nozzle.id,
          number: nozzle.nozzleNumber,
          fuelType: nozzle.fuelType,
          status: nozzle.status,
          initialReading: nozzle.initialReading
        },
        pump: {
          id: nozzle.pump.id,
          name: nozzle.pump.name,
          status: nozzle.pump.status
        },
        previousReading: previousReading?.readingValue || nozzle.initialReading || 0,
        previousDate: previousReading?.readingDate || null,
        currentPrice: currentPrice || null,
        hasReadings: !!previousReading
      }
    });

  } catch (error) {
    console.error('Get previous reading error:', error);
    next(error);
  }
};

/**
 * Get readings list with filters
 * GET /api/v1/readings
 */
exports.getReadings = async (req, res, next) => {
  try {
    const { 
      stationId, 
      pumpId, 
      nozzleId, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50 
    } = req.query;

    const offset = (page - 1) * limit;
    const user = await User.findByPk(req.userId);

    // Build where clause
    const where = {};

    // Station filter (with role-based access)
    if (user.role === 'super_admin') {
      if (stationId) where.stationId = stationId;
    } else if (user.role === 'owner') {
      // Owner can see readings for stations they own
      const ownerStations = await Station.findAll({ where: { ownerId: user.id } });
      const ownerStationIds = ownerStations.map(s => s.id);
      if (stationId) {
        if (!ownerStationIds.includes(stationId)) {
          return res.status(403).json({
            success: false,
            error: 'Not authorized to view readings for this station'
          });
        }
        where.stationId = stationId;
      } else {
        where.stationId = { [Op.in]: ownerStationIds };
      }
    } else {
      // Manager/Employee can only access their assigned station
      where.stationId = user.stationId;
    }

    // Nozzle filter
    if (nozzleId) {
      where.nozzleId = nozzleId;
    }

    // Date range filter
    if (startDate && endDate) {
      where.readingDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.readingDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.readingDate = { [Op.lte]: endDate };
    }

    // Pump filter requires join
    const include = [
      {
        model: Nozzle,
        as: 'nozzle',
        attributes: ['id', 'nozzleNumber', 'fuelType'],
        include: [{
          model: Pump,
          as: 'pump',
          attributes: ['id', 'name', 'pumpNumber'],
          where: pumpId ? { id: pumpId } : undefined
        }]
      },
      {
        model: User,
        as: 'enteredByUser',
        attributes: ['id', 'name']
      }
    ];

    const { count, rows } = await NozzleReading.findAndCountAll({
      where,
      include,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get readings error:', error);
    next(error);
  }
};

/**
 * Get a single reading by ID
 * GET /api/v1/readings/:id
 */
exports.getReadingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const reading = await NozzleReading.findByPk(id, {
      include: [
        {
          model: Nozzle,
          as: 'nozzle',
          include: [{ model: Pump, as: 'pump' }]
        },
        {
          model: User,
          as: 'enteredByUser',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!reading) {
      return res.status(404).json({
        success: false,
        error: 'Reading not found'
      });
    }

    // Authorization check
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, reading.stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this reading'
      });
    }

    res.json({
      success: true,
      data: reading
    });

  } catch (error) {
    console.error('Get reading by ID error:', error);
    next(error);
  }
};

/**
 * Update a reading (same day only, manager+ role)
 * PUT /api/v1/readings/:id
 */
exports.updateReading = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cashAmount, onlineAmount, notes } = req.body;

    const reading = await NozzleReading.findByPk(id);

    if (!reading) {
      return res.status(404).json({
        success: false,
        error: 'Reading not found'
      });
    }

    // Authorization check
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, reading.stationId))) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this reading'
      });
    }

    // Only manager+ can edit
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only managers and above can edit readings'
      });
    }

    // Same day check (allow edit only on same day)
    const today = new Date().toISOString().split('T')[0];
    const readingDay = new Date(reading.createdAt).toISOString().split('T')[0];
    
    if (today !== readingDay && user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Can only edit readings from the same day'
      });
    }

    // Update payment if provided
    const updates = {};
    
    if (notes !== undefined) {
      updates.notes = notes;
    }

    if (!reading.isInitialReading) {
      const totalAmount = parseFloat(reading.totalAmount);
      
      if (cashAmount !== undefined && onlineAmount !== undefined) {
        const cash = parseFloat(cashAmount) || 0;
        const online = parseFloat(onlineAmount) || 0;
        
        if (Math.abs((cash + online) - totalAmount) > 0.01) {
          return res.status(400).json({
            success: false,
            error: `Cash + Online must equal Total (${totalAmount})`
          });
        }
        
        updates.cashAmount = cash;
        updates.onlineAmount = online;
      } else if (cashAmount !== undefined) {
        const cash = parseFloat(cashAmount) || 0;
        updates.cashAmount = cash;
        updates.onlineAmount = totalAmount - cash;
      } else if (onlineAmount !== undefined) {
        const online = parseFloat(onlineAmount) || 0;
        updates.onlineAmount = online;
        updates.cashAmount = totalAmount - online;
      }
    }

    await reading.update(updates);

    res.json({
      success: true,
      data: reading,
      message: 'Reading updated successfully'
    });

  } catch (error) {
    console.error('Update reading error:', error);
    next(error);
  }
};
