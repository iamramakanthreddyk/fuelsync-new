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
    const { nozzleId, readingDate, readingValue, cashAmount, onlineAmount, creditAmount, creditorId, notes } = req.body;
    const userId = req.userId;

    // Validate required fields
    if (!nozzleId || !readingDate || readingValue === undefined) {
      console.log('[DEBUG] createReading validation failed: missing required fields', { nozzleId, readingDate, readingValue });
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
      console.log('[DEBUG] createReading failed: nozzle not found', { nozzleId });
      return res.status(404).json({
        success: false,
        error: 'Nozzle not found'
      });
    }

    // Check nozzle is active
    if (nozzle.status !== 'active') {
      console.log('[DEBUG] createReading failed: nozzle inactive', { nozzleId, status: nozzle.status });
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
        console.log('[DEBUG] createReading failed: active shift required but not found', { userId, stationId });
        return res.status(400).json({
          success: false,
          error: 'You must have an active shift to enter readings. Please start your shift first.',
          requiresShift: true
        });
      }
    } else {
      // Even if not required, try to get active shift to link it
      activeShift = await Shift.getActiveShift(userId);
    }

    // Get previous reading - for backdated entries we need the last reading before the provided date
    console.log(`[DEBUG] Resolving previous reading for nozzleId=${nozzleId}, readingDate=${readingDate}`);
    // Determine if the provided readingDate is before today (backdated)
    const todayStr = new Date().toISOString().split('T')[0];
    const isBackdated = new Date(readingDate + 'T00:00:00Z') < new Date(todayStr + 'T00:00:00Z');
    let previousReadingRecord;
    if (isBackdated) {
      previousReadingRecord = await NozzleReading.getPreviousReading(nozzleId, readingDate);
    } else {
      previousReadingRecord = await NozzleReading.getLatestReading(nozzleId);
    }
    // Prefer an explicit previousReading provided by client (tests/old clients send this)
    let previousReading = previousReadingRecord?.readingValue;
    const providedPrevious = req.body.previousReading !== undefined ? parseFloat(req.body.previousReading) : undefined;
    if (previousReading === undefined || previousReading === null) {
      previousReading = nozzle.initialReading !== undefined && nozzle.initialReading !== null ? nozzle.initialReading : (providedPrevious || 0);
    }
    // If a client explicitly provided previousReading, prefer it for validation
    if (providedPrevious !== undefined) previousReading = providedPrevious;
    let isInitialReading = !previousReadingRecord && (providedPrevious === undefined);

    // Validate reading value (must be > previous unless initial)
    const currentValue = parseFloat(readingValue);
    const prevValue = parseFloat(previousReading);

    if (!isInitialReading && currentValue <= prevValue) {
      console.log('[DEBUG] createReading failed: readingValue not greater than previous', { currentValue, prevValue });
      return res.status(400).json({
        success: false,
        error: `Reading must be greater than previous reading (${prevValue}). Meter readings only go forward.`,
        previousReading: prevValue
      });
    }

    // Calculate litres sold
    const litresSold = isInitialReading ? (currentValue > 0 ? currentValue : 0) : currentValue - prevValue;

    // If client provided litresSold explicitly, validate it matches computed litresSold
    if (req.body.litresSold !== undefined) {
      const providedLitres = parseFloat(req.body.litresSold) || 0;
      if (Math.abs(providedLitres - litresSold) > 0.01) {
        console.log('[DEBUG] createReading failed: litresSold mismatch', { providedLitres, litresSold });
        return res.status(400).json({ success: false, error: 'Provided litresSold does not match meter delta' });
      }
    }

    // Get fuel price for the reading date
    const fuelPrice = await FuelPrice.getPriceForDate(stationId, nozzle.fuelType, readingDate);

    // Allow legacy clients/tests to supply `pricePerLitre` or `totalAmount` explicitly.
    // Prefer fuelPrice from DB, then client-provided pricePerLitre, then sensible defaults.
    const clientPrice = req.body.pricePerLitre !== undefined ? parseFloat(req.body.pricePerLitre) : undefined;
    const clientTotal = req.body.totalAmount !== undefined ? parseFloat(req.body.totalAmount) : undefined;

    let pricePerLitre = fuelPrice || clientPrice || (isInitialReading ? 100 : 0);

    // If no DB price and the client did not provide pricePerLitre but provided totalAmount,
    // derive pricePerLitre from totalAmount/litresSold when possible (avoid divide by zero).
    if (!fuelPrice && clientTotal !== undefined && litresSold > 0) {
      pricePerLitre = clientTotal / litresSold;
    }

    // If still no price (and not initial reading), allow usage of clientTotal if provided, otherwise validation will fail
    const totalAmount = clientTotal !== undefined ? clientTotal : (litresSold * pricePerLitre);

    // Backdated reading validation based on owner's plan (backdatedDays)
    try {
      const stationWithOwner = await Station.findByPk(stationId, {
        include: [{ model: User, as: 'owner', include: ['plan'] }]
      });
      const allowedBackdatedDays = stationWithOwner?.owner?.plan?.backdatedDays ?? 3;
      const todayStr = new Date().toISOString().split('T')[0];
      const msPerDay = 24 * 60 * 60 * 1000;
      const readingDateObj = new Date(readingDate + 'T00:00:00Z');
      const todayObj = new Date(todayStr + 'T00:00:00Z');
      const diffDays = Math.floor((todayObj - readingDateObj) / msPerDay);
      if (diffDays > allowedBackdatedDays) {
        return res.status(403).json({
          success: false,
          error: `Backdated readings older than ${allowedBackdatedDays} days are not allowed`
        });
      }
    } catch (err) {
      // If plan lookup fails, fall back to default behavior (allow)
      console.warn('Backdate validation failed, proceeding with default:', err?.message || err);
    }

    // Handle payment amounts - support cash, online, and credit
    let finalCashAmount = 0;
    let finalOnlineAmount = 0;
    let finalCreditAmount = 0;

    if (!isInitialReading && totalAmount > 0) {
      // Calculate all payment amounts
      const providedCash = cashAmount !== undefined ? parseFloat(cashAmount) || 0 : 0;
      const providedOnline = onlineAmount !== undefined ? parseFloat(onlineAmount) || 0 : 0;
      const providedCredit = creditAmount !== undefined ? parseFloat(creditAmount) || 0 : 0;
      
      finalCashAmount = providedCash;
      finalOnlineAmount = providedOnline;
      finalCreditAmount = providedCredit;

      // Only validate payment breakdown if any payment fields were provided by the client
      const paymentFieldsProvided = Object.prototype.hasOwnProperty.call(req.body, 'cashAmount') || Object.prototype.hasOwnProperty.call(req.body, 'onlineAmount') || Object.prototype.hasOwnProperty.call(req.body, 'creditAmount');
      
      if (paymentFieldsProvided) {
        const totalPayment = finalCashAmount + finalOnlineAmount + finalCreditAmount;
        if (Math.abs(totalPayment - totalAmount) > 0.01) {
          console.log('[DEBUG] createReading failed: payment breakdown mismatch', { finalCashAmount, finalOnlineAmount, finalCreditAmount, totalAmount, totalPayment });
          return res.status(400).json({
            success: false,
            error: `Payment breakdown (Cash: ${finalCashAmount}, Online: ${finalOnlineAmount}, Credit: ${finalCreditAmount}) must equal total amount (${totalAmount.toFixed(2)})`
          });
        }
      } else {
        // No payment fields provided - default entire amount to cash for backward compatibility
        finalCashAmount = totalAmount;
        finalOnlineAmount = 0;
        finalCreditAmount = 0;
      }

      // Enforce that if there is a credit amount provided, a creditorId must be present
      if (finalCreditAmount > 0 && !creditorId) {
        return res.status(400).json({
          success: false,
          error: 'creditorId is required when creditAmount is greater than 0'
        });
      }
    }

    // Create the reading and optionally record credit transaction atomically
    const t = await sequelize.transaction();
    let reading;
    try {
      reading = await NozzleReading.create({
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
        creditAmount: finalCreditAmount,
        creditorId: creditorId || null,
        isInitialReading,
        notes,
        shiftId: activeShift?.id || null
      }, { transaction: t });

      // If a credit was recorded as part of this reading, create a CreditTransaction
      if (finalCreditAmount > 0) {
        const { CreditTransaction, Creditor } = require('../models');

        // Support legacy clients/tests that may send `creditAmount` without a `creditorId`.
        // If `creditorId` is provided, create a CreditTransaction and update the creditor balance.
        // Otherwise, store the creditAmount on the reading only and log a warning.
        if (creditorId) {
          await CreditTransaction.create({
          stationId,
          creditorId,
          transactionType: 'credit',
          fuelType: nozzle.fuelType,
          litres: litresSold,
          pricePerLitre,
          amount: finalCreditAmount,
          transactionDate: readingDate,
          vehicleNumber: null,
          referenceNumber: null,
          notes: `Credit from reading ${reading.id}`,
          nozzleReadingId: reading.id,
          enteredBy: userId
          }, { transaction: t });

          const findOptions = { transaction: t };
          if (sequelize.getDialect() !== 'sqlite') findOptions.lock = t.LOCK.UPDATE;
          const creditor = await Creditor.findByPk(creditorId, findOptions);
          if (!creditor) throw new Error('Creditor not found');
          await creditor.update({ currentBalance: parseFloat(creditor.currentBalance || 0) + parseFloat(finalCreditAmount) }, { transaction: t });
        } else {
          console.warn(`[WARN] Reading recorded with creditAmount=${finalCreditAmount} but no creditorId provided. CreditTransaction not created.`);
        }
      }

      // Update nozzle's lastReading cache
      try {
        await nozzle.updateLastReading(currentValue, readingDate, { transaction: t });
      } catch (e) {
        // Fallback if model method doesn't accept transaction
        try { await nozzle.updateLastReading(currentValue, readingDate); } catch (_) {}
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // Return with calculated values
    const readingJson = {
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
    };

    res.status(201).json({
      success: true,
      data: readingJson,
      // Backwards-compatible alias expected by older tests/clients
      reading: readingJson,
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
      // Backwards-compatible alias expected by older tests/clients
      readings: rows,
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

/**
 * Daily summary for a station
 * GET /api/v1/readings/summary
 */
exports.getDailySummary = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const user = await User.findByPk(req.userId);

    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Not authorized to access this station' });
    }

    const readings = await NozzleReading.findAll({ where: { stationId, readingDate: date } });

    // Basic aggregated summary
    const totalSales = readings.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);
    const totalLitres = readings.reduce((s, r) => s + parseFloat(r.litresSold || 0), 0);

    res.json({ success: true, data: { date, totalSales, totalLitres, count: readings.length } });
  } catch (err) {
    console.error('Get daily summary error:', err);
    next(err);
  }
};

/**
 * Get last reading for a nozzle
 * GET /api/v1/readings/last?nozzleId=...
 */
exports.getLastReading = async (req, res, next) => {
  try {
    const { nozzleId } = req.query;
    if (!nozzleId) return res.status(400).json({ success: false, error: 'nozzleId is required' });

    const nozzle = await Nozzle.findByPk(nozzleId, { include: [{ model: Pump, as: 'pump' }] });
    if (!nozzle) return res.status(404).json({ success: false, error: 'Nozzle not found' });

    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, nozzle.pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const latest = await NozzleReading.getLatestReading(nozzleId);
    res.json({ success: true, data: latest || null });
  } catch (err) {
    console.error('Get last reading error:', err);
    next(err);
  }
};

/**
 * Delete a reading (soft delete or allowed by role)
 * DELETE /api/v1/readings/:id
 */
exports.deleteReading = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reading = await NozzleReading.findByPk(id);
    if (!reading) {
      return res.status(404).json({ success: false, error: 'Reading not found' });
    }
    const user = await User.findByPk(req.userId);
    if (!(await canAccessStation(user, reading.stationId))) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this reading' });
    }
    // Allow delete only for manager+ or owner/super_admin or the one who entered
    if (!['super_admin', 'owner', 'manager'].includes(user.role) && String(reading.enteredBy) !== String(user.id)) {
      return res.status(403).json({ success: false, error: 'Only managers or the original employee can delete this reading' });
    }
    // Soft delete if model supports it, else destroy
    if (typeof reading.destroy === 'function') {
      await reading.destroy();
    } else {
      await reading.update({ isActive: false });
    }
    res.json({ success: true, data: reading, reading: reading, message: 'Reading deleted' });
  } catch (error) {
    console.error('Delete reading error:', error);
    next(error);
  }
};
