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
    console.log(`[DEBUG] Calling getLatestReading for nozzleId=${nozzleId}`);
    const previousReadingRecord = await NozzleReading.getLatestReading(nozzleId);
    let previousReading = previousReadingRecord?.readingValue || nozzle.initialReading || 0;
    let isInitialReading = !previousReadingRecord;

    // Validate reading value (must be > previous unless initial)
    const currentValue = parseFloat(readingValue);
    const prevValue = parseFloat(previousReading);

    if (!isInitialReading && currentValue <= prevValue) {
      return res.status(400).json({
        success: false,
        error: `Reading must be greater than previous reading (${prevValue}). Meter readings only go forward.`,
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
    const { readingValue, cashAmount, onlineAmount, notes } = req.body;

    const reading = await NozzleReading.findByPk(id);
    if (!reading) {
      return res.status(404).json({ success: false, error: 'Reading not found' });
    }

    // Authorization check
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, reading.stationId))) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this reading' });
    }
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Only managers and above can edit readings' });
    }

    // Allow editing readingValue, cashAmount, onlineAmount, notes
    const updates = {};
    if (readingValue !== undefined) {
      updates.readingValue = parseFloat(readingValue);
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }
    if (cashAmount !== undefined) {
      updates.cashAmount = parseFloat(cashAmount) || 0;
    }
    if (onlineAmount !== undefined) {
      updates.onlineAmount = parseFloat(onlineAmount) || 0;
    }

    // Save old value for audit
    const oldReadingValue = parseFloat(reading.readingValue);
    const newReadingValue = updates.readingValue !== undefined ? updates.readingValue : oldReadingValue;

    // Update this reading
    await reading.update(updates);

    // Recalculate this and all subsequent readings for this nozzle
    const allReadings = await NozzleReading.findAll({
      where: {
        nozzleId: reading.nozzleId,
        readingDate: { [Op.gte]: reading.readingDate }
      },
      order: [['readingDate', 'ASC'], ['createdAt', 'ASC']]
    });

    let prevValue = null;
    // Get previous reading before this one
    const prevReading = await NozzleReading.getPreviousReading(reading.nozzleId, reading.readingDate);
    prevValue = prevReading ? parseFloat(prevReading.readingValue) : 0;

    for (const r of allReadings) {
      const currentValue = parseFloat(r.readingValue);
      const litresSold = prevValue !== null ? (currentValue - prevValue) : 0;
      // Get price per litre for this date
      const pricePerLitre = await FuelPrice.getPriceForDate(r.stationId, r.fuelType, r.readingDate) || 0;
      const totalAmount = litresSold * pricePerLitre;
      await r.update({
        previousReading: prevValue,
        litresSold,
        pricePerLitre,
        totalAmount
      });
      prevValue = currentValue;
    }

    // Audit log (simple console, replace with DB log if needed)
    console.log(`[AUDIT] User ${user.id} (${user.role}) updated reading ${id}: from ${oldReadingValue} to ${newReadingValue}`);

    res.json({
      success: true,
      data: await NozzleReading.findByPk(id),
      message: 'Reading updated and calculations refreshed'
    });
  } catch (error) {
    console.error('Update reading error:', error);
    next(error);
  }
};

/**
 * Get today's readings for current user
 * GET /api/v1/readings/today
 */
exports.getTodayReadings = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    const today = new Date().toISOString().split('T')[0];

    // Build where clause based on user role
    const where = { readingDate: today };

    // Station filter (with role-based access)
    if (user.role === 'super_admin') {
      // No additional filter - can see all
    } else if (user.role === 'owner') {
      // Owner can see readings for stations they own
      const ownerStations = await Station.findAll({ where: { ownerId: user.id } });
      const ownerStationIds = ownerStations.map(s => s.id);
      where.stationId = { [Op.in]: ownerStationIds };
    } else {
      // Manager/Employee can only access their assigned station
      where.stationId = user.stationId;
    }

    const readings = await NozzleReading.findAll({
      where,
      include: [
        {
          model: Nozzle,
          as: 'nozzle',
          attributes: ['id', 'nozzleNumber', 'fuelType'],
          include: [{
            model: Pump,
            as: 'pump',
            attributes: ['id', 'name', 'pumpNumber']
          }]
        },
        {
          model: User,
          as: 'enteredByUser',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: readings,
      count: readings.length
    });

  } catch (error) {
    console.error('Get today readings error:', error);
    next(error);
  }
};

exports.getLatestReadingsForNozzles = async (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : [];
  if (!ids.length) {
    return res.status(400).json({ error: 'No nozzle IDs provided' });
  }
  try {
    const results = {};
    for (const id of ids) {
      const latest = await NozzleReading.findOne({
        where: { nozzleId: id },
        order: [['readingDate', 'DESC']]
      });
      results[id] = latest ? latest.readingValue : null;
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch latest readings' });
  }
};
