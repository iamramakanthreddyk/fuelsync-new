/**
 * Reading Controller
 * Core business logic for nozzle readings and sales calculation
 * 
 * AUDIT LOGGING:
 * - CREATE: Reading submission is logged with category 'data', severity 'info'
 * - UPDATE: Reading updates are logged with before/after values
 * 
 * All CREATE/UPDATE operations are tracked via logAudit() from utils/auditLog
 * 
 * ARCHITECTURE (Dec 2025):
 * 1. Nozzle Reading = What was SOLD (meter reading + calculated liters/value)
 *    - Only contains: readingValue, previousReading, litresSold, totalAmount, notes
 *    - NO payment breakdown (cash/online/credit) - these are ALWAYS 0
 * 
 * 2. Daily Transaction = How it was PAID (payment breakdown allocation)
 *    - Created AFTER readings are submitted
 *    - Contains: paymentBreakdown (cash/online/credit) + creditAllocations
 *    - Groups all readings from a day with one payment summary
 *    - Example: 5 readings totaling ₹5000 → 1 transaction with cash:₹3000 + credit:₹2000
 * 
 * 3. Settlement = RECONCILIATION (what owner confirms as correct)
 *    - Owner reviews expected (from readings) vs actual (from cash entry)
 *    - Settles discrepancies and approves transactions
 */

const { NozzleReading, Nozzle, Pump, Station, FuelPrice, User, Shift, sequelize } = require('../models');
const { Op } = require('sequelize');
const { canAccessStation, verifyNozzleAccess, getAccessibleStationIds } = require('../middleware/accessControl');
const { logAudit } = require('../utils/auditLog');

/**
 * Enter a new nozzle reading (SIMPLIFIED - payment tracking moved to transactions)
 * POST /api/v1/readings
 * 
 * Now only accepts reading data:
 * - nozzleId, readingDate, readingValue
 * - Optional: pricePerLitre, totalAmount, litresSold, notes
 * 
 * Payment breakdown is now handled via DailyTransaction model
 */
exports.createReading = async (req, res, next) => {
  try {
    const { 
      nozzleId, nozzle_id,
      readingDate, reading_date,
      readingValue, reading_value,
      notes,
      pricePerLitre, price_per_litre,
      totalAmount, total_amount,
      litresSold, litres_sold,
      previousReading, previous_reading
    } = req.body;
    const userId = req.userId;

    console.log('[DEBUG] createReading received params:', {
      nozzleId, nozzle_id,
      readingDate, reading_date,
      readingValue, reading_value,
      totalAmount: req.body.totalAmount, total_amount,
      pricePerLitre: req.body.pricePerLitre, price_per_litre,
      previousReading: req.body.previousReading, previous_reading,
      litresSold: req.body.litresSold, litres_sold
    });

    // Validate required fields
    const finalNozzleId = nozzleId || nozzle_id;
    const finalReadingDate = readingDate || reading_date;
    const finalReadingValue = readingValue !== undefined ? readingValue : reading_value;
    const finalPricePerLitre = pricePerLitre !== undefined ? pricePerLitre : price_per_litre;
    const finalTotalAmount = totalAmount !== undefined ? totalAmount : total_amount;
    const finalLitresSold = litresSold !== undefined ? litresSold : litres_sold;
    const finalPreviousReading = previousReading !== undefined ? previousReading : previous_reading;
    
    if (!finalNozzleId || !finalReadingDate || finalReadingValue === undefined) {
      console.log('[DEBUG] createReading validation failed: missing required fields', { finalNozzleId, finalReadingDate, finalReadingValue });
      return res.status(400).json({
        success: false,
        error: 'nozzleId, readingDate, and readingValue are required'
      });
    }

    // Get nozzle with pump and station info
    const nozzle = await Nozzle.findByPk(finalNozzleId, {
      include: [{
        model: Pump,
        as: 'pump',
        include: [{ model: Station, as: 'station' }]
      }]
    });

    if (!nozzle) {
      console.log('[DEBUG] createReading failed: nozzle not found', { nozzleId: finalNozzleId });
      return res.status(404).json({
        success: false,
        error: 'Nozzle not found'
      });
    }

    // Check nozzle is active
    if (nozzle.status !== 'active') {
      console.log('[DEBUG] createReading failed: nozzle inactive', { nozzleId: finalNozzleId, status: nozzle.status });
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
    console.log(`[DEBUG] Resolving previous reading for nozzleId=${finalNozzleId}, readingDate=${finalReadingDate}`);
    // Determine if the provided readingDate is before today (backdated)
    const todayStr = new Date().toISOString().split('T')[0];
    const isBackdated = new Date(finalReadingDate + 'T00:00:00Z') < new Date(todayStr + 'T00:00:00Z');
    let previousReadingRecord;
    if (isBackdated) {
      previousReadingRecord = await NozzleReading.getPreviousReading(finalNozzleId, finalReadingDate);
    } else {
      previousReadingRecord = await NozzleReading.getLatestReading(finalNozzleId);
    }
    // Prefer an explicit previousReading provided by client (tests/old clients send this)
    let calculatedPreviousReading = previousReadingRecord?.readingValue;
    const providedPrevious = finalPreviousReading;
    
    // Determine previousReading: explicit > lastReading > initialReading > 0
    if (providedPrevious !== undefined) {
      calculatedPreviousReading = providedPrevious;
    } else if (calculatedPreviousReading === undefined || calculatedPreviousReading === null) {
      // No previous reading found and no explicit previousReading provided
      // For first reading, use initialReading if available, otherwise 0
      calculatedPreviousReading = nozzle.initialReading !== undefined && nozzle.initialReading !== null
        ? nozzle.initialReading
        : 0;
    }
    
    let isInitialReading = !previousReadingRecord && (providedPrevious === undefined);

    // Validate reading value (must be > previous unless initial)
    const currentValue = parseFloat(finalReadingValue);
    const prevValue = parseFloat(calculatedPreviousReading);

    if (!isInitialReading && currentValue <= prevValue) {
      console.log('[DEBUG] createReading failed: readingValue not greater than previous', { currentValue, prevValue });
      return res.status(400).json({
        success: false,
        error: `Reading must be greater than previous reading (${prevValue}). Meter readings only go forward.`,
        previousReading: prevValue
      });
    }

    // Calculate litres sold: always use currentValue - previousReading
    // For first readings, previousReading is already set to initialReading (or 0)
    let calculatedLitresSold = Math.max(0, currentValue - prevValue);

    // If client provided litresSold explicitly, validate it matches computed litresSold
    if (finalLitresSold !== undefined) {
      const providedLitres = parseFloat(finalLitresSold) || 0;
      if (Math.abs(providedLitres - calculatedLitresSold) > 0.01) {
        console.error('❌ [VALIDATION ERROR] litresSold mismatch:', {
          nozzleId: finalNozzleId,
          stationId,
          isInitialReading,
          currentReading: currentValue,
          previousReading: prevValue,
          meterDelta: calculatedLitresSold,
          providedLitres,
          difference: Math.abs(providedLitres - calculatedLitresSold),
          readingDate: finalReadingDate,
          fuelType: nozzle.fuelType
        });
        return res.status(400).json({ 
          success: false, 
          error: 'Provided litresSold does not match meter delta',
          details: {
            meterDelta: calculatedLitresSold,
            provided: providedLitres,
            previousReading: prevValue,
            currentReading: currentValue
          }
        });
      }
    }

    // Get fuel price for the reading date
    const fuelPrice = await FuelPrice.getPriceForDate(stationId, nozzle.fuelType, finalReadingDate);

    // Initialize pricePerLitre from: provided value > db fuel price > default
    let calculatedPricePerLitre = finalPricePerLitre || fuelPrice || (isInitialReading ? 100 : 0);

    // Backdated reading validation based on owner's plan (backdatedDays)
    try {
      const stationWithOwner = await Station.findByPk(stationId, {
        include: [{ model: User, as: 'owner', include: ['plan'] }]
      });
      const allowedBackdatedDays = stationWithOwner?.owner?.plan?.backdatedDays ?? 3;
      const todayStr = new Date().toISOString().split('T')[0];
      const msPerDay = 24 * 60 * 60 * 1000;
      const readingDateObj = new Date(finalReadingDate + 'T00:00:00Z');
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

    // SIMPLIFIED: Determine totalAmount from calculation or client input
    // Payment breakdown now handled in DailyTransaction, not per-reading
    let effectiveTotalAmount = finalTotalAmount;
    
    if (calculatedLitresSold > 0) {
      if (!effectiveTotalAmount && calculatedPricePerLitre > 0) {
        // Calculate from litres and price
        effectiveTotalAmount = calculatedLitresSold * calculatedPricePerLitre;
      } else if (!effectiveTotalAmount && fuelPrice) {
        // Use fuel price from database
        effectiveTotalAmount = calculatedLitresSold * fuelPrice;
        calculatedPricePerLitre = fuelPrice;
      }
    }
    
    // If still no total amount, initialize to 0
    effectiveTotalAmount = parseFloat(effectiveTotalAmount) || 0;

    // Ensure pumpId is set - get from nozzle.pumpId or from nozzle.pump.id if not available
    const finalPumpId = nozzle.pumpId || (nozzle.pump ? nozzle.pump.id : null);
    if (!finalPumpId) {
      console.error('[ERROR] Cannot determine pumpId for reading:', { nozzleId: finalNozzleId, nozzlePumpId: nozzle.pumpId, nozzlePump: nozzle.pump });
      return res.status(400).json({
        success: false,
        error: 'Unable to determine pump for this nozzle'
      });
    }

    // Create reading (simplified - no payment breakdown stored per reading)
    const t = await sequelize.transaction();
    let reading;
    try {
      console.log('[DEBUG] Saving reading with values:', {
        nozzleId,
        stationId,
        pumpId: finalPumpId,
        fuelType: nozzle.fuelType,
        enteredBy: userId,
        readingDate,
        readingValue: currentValue,
        previousReading: prevValue,
        litresSold,
        pricePerLitre: calculatedPricePerLitre,
        totalAmount: effectiveTotalAmount,
        isInitialReading,
        notes
      });
      
      reading = await NozzleReading.create({
        nozzleId,
        stationId,
        pumpId: finalPumpId,
        fuelType: nozzle.fuelType,
        enteredBy: userId,
        readingDate,
        readingValue: currentValue,
        previousReading: prevValue,
        litresSold: calculatedLitresSold,
        pricePerLitre: calculatedPricePerLitre,
        totalAmount: effectiveTotalAmount,
        isInitialReading,
        notes,
        shiftId: activeShift?.id || null,
        // Payment fields kept for backward compatibility but NOT used in new workflow
        // Payment breakdown is now stored in DailyTransaction model
        cashAmount: 0,
        onlineAmount: 0,
        creditAmount: 0,
        creditorId: null,
        paymentBreakdown: {}
      }, { transaction: t });

      // Update nozzle's lastReading cache
      try {
        await nozzle.updateLastReading(currentValue, finalReadingDate, { transaction: t });
      } catch (e) {
        // Fallback if model method doesn't accept transaction
        try { await nozzle.updateLastReading(currentValue, finalReadingDate); } catch (_) {}
      }

      // Log reading submission
      await logAudit({
        userId,
        userEmail: user.email,
        userRole: user.role,
        stationId,
        action: 'CREATE',
        entityType: 'NozzleReading',
        entityId: reading.id,
        newValues: {
          id: reading.id,
          nozzleId,
          litresSold: calculatedLitresSold,
          totalAmount: effectiveTotalAmount,
          fuelType: nozzle.fuelType
        },
        category: 'data',
        severity: 'info',
        description: `Recorded reading: ${calculatedLitresSold}L of ${nozzle.fuelType} for ₹${effectiveTotalAmount}`
      });

      await t.commit();

      // Best-effort fallback: update nozzle cache via raw query
      try {
        await sequelize.query(
          'UPDATE nozzles SET last_reading = :val, last_reading_date = :date WHERE id = :id',
          { replacements: { val: currentValue, date: finalReadingDate, id: nozzle.id } }
        );
      } catch (rawErr) {
        console.warn(`[WARN] Raw nozzle cache update failed for nozzle ${nozzle.id}:`, rawErr?.message || rawErr);
      }
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
        : `Sale recorded: ${calculatedLitresSold.toFixed(3)}L = ₹${effectiveTotalAmount.toFixed(2)}. Payment breakdown recorded separately via DailyTransaction.`,
      note: 'Payment breakdown (cash/online/credit) is NOT stored in readings. Use DailyTransaction API to record payment allocation.'
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
      },
      {
        model: require('../models').Creditor,
        as: 'creditor',
        attributes: ['id', 'name', 'businessName', 'currentBalance']
      }
    ];

    const { count, rows } = await NozzleReading.findAndCountAll({
      where,
      include,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
    });

    // Always return structure with linked/unlinked for compatibility
    // Always include saleValue = litresSold * pricePerLitre for each reading
    const addSaleValue = r => ({
      ...r.toJSON(),
      saleValue: (parseFloat(r.litresSold) || 0) * (parseFloat(r.pricePerLitre) || 0)
    });
    const readingsWithSaleValue = rows.map(addSaleValue);

    // Include transaction/paymentBreakdown directly on readings (DailyTransaction is authoritative)
    // Re-run the query with transaction included if not already present
    const { DailyTransaction } = require('../models');
    const readingsWithTx = await NozzleReading.findAll({
      where,
      include: [
        {
          model: Nozzle,
          as: 'nozzle',
          attributes: ['id', 'nozzleNumber', 'fuelType'],
          include: [{ model: Pump, as: 'pump', attributes: ['id', 'name', 'pumpNumber'], where: pumpId ? { id: pumpId } : undefined }]
        },
        { model: User, as: 'enteredByUser', attributes: ['id', 'name'] },
        { model: require('../models').Creditor, as: 'creditor', attributes: ['id', 'name', 'businessName', 'currentBalance'] },
        { model: DailyTransaction, as: 'transaction', attributes: ['id', 'transactionDate', 'status', 'createdBy', 'paymentBreakdown'], required: false }
      ],
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
    });

    // Map saleValue and ensure transaction.paymentBreakdown is present as normalized object
    const readingsWithPayments = readingsWithTx.map(r => {
      const obj = r.toJSON();
      obj.saleValue = (parseFloat(obj.litresSold) || 0) * (parseFloat(obj.pricePerLitre) || 0);
      if (obj.transaction) {
        obj.transaction.paymentBreakdown = obj.transaction.paymentBreakdown || obj.transaction.payment_breakdown || {};
      }
      return obj;
    });

    const linkedReadings = readingsWithPayments.filter(r => r.settlementId);
    const unlinkedReadings = readingsWithPayments.filter(r => !r.settlementId);

    const unlinkedTotals = unlinkedReadings.reduce((acc, r) => {
      const pb = r.transaction?.paymentBreakdown || {};
      acc.cash += parseFloat(pb.cash || 0);
      acc.online += parseFloat(pb.online || 0);
      acc.credit += parseFloat(pb.credit || 0);
      acc.litres += parseFloat(r.litresSold || 0);
      acc.value += parseFloat(r.saleValue || 0);
      return acc;
    }, { cash: 0, online: 0, credit: 0, litres: 0, value: 0 });

    res.json({
      success: true,
      data: {
        linked: {
          count: linkedReadings.length,
          readings: linkedReadings
        },
        unlinked: {
          count: unlinkedReadings.length,
          readings: unlinkedReadings,
          totals: {
            cash: parseFloat(unlinkedTotals.cash.toFixed(2)),
            online: parseFloat(unlinkedTotals.online.toFixed(2)),
            credit: parseFloat(unlinkedTotals.credit.toFixed(2)),
            litres: parseFloat(unlinkedTotals.litres.toFixed(2)),
            value: parseFloat(unlinkedTotals.value.toFixed(2))
          }
        },
        allReadingsCount: readingsWithPayments.length
      },
      readings: readingsWithPayments,
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
        },
        {
          model: require('../models').Creditor,
          as: 'creditor',
          attributes: ['id', 'name', 'businessName', 'currentBalance']
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
    const { readingValue, paymentBreakdown, notes } = req.body;

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

    // Allow editing readingValue and notes only. Per-reading tender fields are deprecated
    // and must not be updated here. Payment splits are managed via DailyTransaction.
    const updates = {};
    if (readingValue !== undefined) {
      updates.readingValue = parseFloat(readingValue);
    }
    if (notes !== undefined) {
      updates.notes = notes;
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

    // Refresh nozzle cache: set nozzle.lastReading to latest reading for that nozzle
    try {
      const nozzle = await Nozzle.findByPk(reading.nozzleId);
      if (nozzle) {
        const latest = await NozzleReading.findOne({
          where: { nozzleId: reading.nozzleId },
          order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
          attributes: ['readingValue', 'readingDate'],
          raw: true
        });
        const val = latest ? parseFloat(latest.readingValue || latest.reading_value || 0) : null;
        const date = latest ? (latest.readingDate || latest.reading_date) : null;
        try {
          await nozzle.updateLastReading(val, date);
        } catch (e) {
          try { await nozzle.updateLastReading(val, date, {}); } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('[WARN] Failed to refresh nozzle cache after updateReading', e?.message || e);
    }

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
    return res.status(400).json({ success: false, error: 'No nozzle IDs provided' });
  }
  try {
    const results = {};
    for (const id of ids) {
      const latest = await NozzleReading.findOne({
        where: { nozzleId: id },
        order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
        attributes: ['id', 'nozzleId', 'readingValue', 'readingDate', 'createdAt'],
        raw: true
      });
      results[id] = latest ? latest.readingValue : null;
      
      // Debug log to verify which reading is being returned
      if (latest) {
        console.log(`[LATEST READING] Nozzle ${id}: value=${latest.readingValue}, date=${latest.readingDate}, createdAt=${latest.createdAt}`);
      }
    }
    res.json({ success: true, data: results });
  } catch (err) {
    // Instead of 500, return empty data for no data or query errors
    console.error('[ERROR] getLatestReadingsForNozzles:', err.message);
    res.json({ success: true, data: {} });
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

    // Refresh nozzle cache: if this was the latest, recompute latest and update nozzle
    try {
      const nozzle = await Nozzle.findByPk(reading.nozzleId);
      if (nozzle) {
        const latest = await NozzleReading.findOne({
          where: { nozzleId: reading.nozzleId },
          order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
          attributes: ['readingValue', 'readingDate'],
          raw: true
        });
        const val = latest ? parseFloat(latest.readingValue || latest.reading_value || 0) : null;
        const date = latest ? (latest.readingDate || latest.reading_date) : null;
        try {
          await nozzle.updateLastReading(val, date);
        } catch (e) {
          try { await nozzle.updateLastReading(val, date, {}); } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('[WARN] Failed to refresh nozzle cache after deleteReading', e?.message || e);
    }

    res.json({ success: true, data: reading, reading: reading, message: 'Reading deleted' });
  } catch (error) {
    console.error('Delete reading error:', error);
    next(error);
  }
};
