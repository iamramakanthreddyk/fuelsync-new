/**
 * Station Controller
 * Station, Pump, and Nozzle management
 * 
 * MULTI-STATION SUPPORT:
 * - Owner can have multiple stations
 * - Station.ownerId links to owner User
 * - Staff have User.stationId for their assigned station
 * 
 * AUDIT LOGGING:
 * - All CREATE, UPDATE, DELETE operations logged to AuditLog
 * - Tracks: station creation, pump/nozzle changes, price updates
 */

// ===== SERVICE LAYER =====
const services = require('../services');

// ===== MODEL & DATABASE ACCESS =====
const { Station, Pump, Nozzle, User, FuelPrice, Plan, NozzleReading, Settlement, DailyTransaction, sequelize } = require('../services/modelAccess');

// ===== SEQUELIZE UTILITIES =====
const { Op, fn, col } = require('sequelize');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');
const { FUEL_TYPES } = require('../config/constants');
const { calculateDeduplicatedTotals, formatReadingResponse, validateReadingSequence, calculateSaleValue, calculateLitresSold } = require('../utils/readingHelpers');

// ===== CONSTANTS =====
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };

/**
 * Get readings for a station (test compatibility)
 * GET /stations/:stationId/readings
 */
exports.getStationReadings = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const user = req.user;

    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const where = { stationId };
    const include = [
      { model: Nozzle, as: 'nozzle', attributes: ['id', 'nozzleNumber', 'fuelType'] },
      { model: User, as: 'enteredByUser', attributes: ['id', 'name'] }
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
      data: {
        linked: {
          count: rows.filter(r => r.settlementId).length,
          readings: rows.filter(r => r.settlementId)
        },
        unlinked: {
          count: rows.filter(r => !r.settlementId).length,
          readings: rows.filter(r => !r.settlementId)
        },
        allReadingsCount: rows.length
      },
      readings: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};
// ============================================
// HELPER: Check if user can access station
// ============================================
const canAccessStation = async (user, stationId) => {
  if (user.role === 'super_admin') {
    return true;
  }
  
  if (user.role === 'owner') {
    // Owner can access stations they own
    const station = await Station.findByPk(stationId);
    
    if (!station) {
      return false;
    }
    
    return station.ownerId === user.id;
  }
  
  // Manager/Employee can only access their assigned station
  return user.stationId === stationId;
};

// ============================================
// STATION CRUD
// ============================================

/**
 * Get stations based on user role
 * - super_admin: All stations
 * - owner: Their owned stations
 * - manager/employee: Their assigned station only
 */
exports.getStations = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId, { include: [{ model: Plan, as: 'plan' }] });
    
    let where = { isActive: true };
    
    const role = (user.role || '').toLowerCase();
    if (role === 'super_admin' || role === 'superadmin') {
      // Super admin sees all
    } else if (role === 'owner') {
      // Owner sees stations they own
      where.ownerId = user.id;
    } else {
      // Manager/Employee sees only their assigned station
      if (user.stationId) {
        where.id = user.stationId;
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    const stations = await Station.findAll({
      where,
      include: [
        {
          model: Pump,
          as: 'pumps',
          attributes: ['id', 'name', 'status']
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email'],
          include: [{
            model: Plan,
            as: 'plan',
            attributes: ['id', 'name', 'maxStations', 'maxPumpsPerStation', 'priceMonthly']
          }]
        }
      ],
      order: [['name', 'ASC']]
    });

    // Calculate today's sales for each station
    const today = new Date().toISOString().split('T')[0];
    
    const stationIds = stations.map(s => s.id);
    const todaySalesData = await NozzleReading.findAll({
      attributes: [
        'stationId',
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'todaySales']
      ],
      where: {
        ...EXCLUDE_SAMPLE_READINGS,
        stationId: { [Op.in]: stationIds },
        readingDate: today,
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      group: ['stationId'],
      raw: true
    });

    // Create a map of stationId to todaySales
    const todaySalesMap = new Map();
    todaySalesData.forEach(item => {
      todaySalesMap.set(item.stationId, parseFloat(item.todaySales || 0));
    });


    res.json({
      success: true,
      data: stations.map(s => ({
        ...s.toJSON(),
        pumpCount: s.pumps?.length || 0,
        activePumps: s.pumps?.filter(p => p.status === 'active').length || 0,
        todaySales: todaySalesMap.get(s.id) || 0
      }))
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Create station (owner/super_admin only)
 */
exports.createStation = async (req, res, next) => {
  try {
    const { name, address, city, state, pincode, phone, email, gstNumber, ownerId, currentPlanId } = req.body;
    const user = await User.findByPk(req.userId, { include: [{ model: Plan, as: 'plan' }] });

    if (!name) {
      return res.status(400).json({ success: false, error: 'Station name is required' });
    }
    
    // Determine the owner
    let stationOwnerId;
    if (user.role === 'super_admin') {
      // Super admin must provide ownerId
      if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
        return res.status(400).json({ success: false, error: 'Owner ID is required when creating a station as super admin' });
      }
      const owner = await User.findByPk(ownerId);
      if (!owner) {
        return res.status(404).json({ success: false, error: 'Owner not found with the provided ID' });
      }
      if (owner.role !== 'owner') {
        return res.status(400).json({ success: false, error: 'The selected user is not an owner' });
      }
      stationOwnerId = ownerId;
    } else if (user.role === 'owner') {
      stationOwnerId = user.id;
    } else {
      return res.status(403).json({ success: false, error: 'Only owners and super admins can create stations' });
    }

    // Get owner for code generation
    const owner = await User.findByPk(stationOwnerId);
    if (!owner) {
      return res.status(404).json({ success: false, error: 'Owner not found' });
    }

    // Perform station creation in a transaction for code uniqueness
    const t = await sequelize.transaction();
    try {
      // Validate that the currentPlanId matches the owner's actual plan (if provided)
      if (currentPlanId) {
        const ownerWithPlan = await User.findByPk(stationOwnerId, { include: [{ model: Plan, as: 'plan' }], transaction: t });
        if (ownerWithPlan?.planId !== currentPlanId) {
          console.log('[PLANCHECK] Plan ID mismatch: owner has', ownerWithPlan?.planId, 'but client sent', currentPlanId);
          await t.rollback();
          return res.status(400).json({
            success: false,
            error: 'Plan validation failed. Owner\'s current plan does not match the provided plan ID.'
          });
        }
      }

      // Allow client to provide a preferred station code, otherwise auto-generate
      const namePrefix = owner.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
      let stationCode;

      if (req.body.code && String(req.body.code).trim()) {
        // Client provided a code - use it if unique
        stationCode = String(req.body.code).trim();
        const codeExists = await Station.findOne({ where: { code: stationCode }, transaction: t });
        if (codeExists) {
          console.log('[PLANCHECK] createStation rejecting: client provided duplicate code=', stationCode);
          await t.rollback();
          return res.status(403).json({
            success: false,
            error: 'Provided station code already exists and cannot be used',
            planLimitExceeded: false
          });
        }
      } else {
        // Auto-generate unique station code
        let codeNumber = 1;
        let codeFound = false;
        const maxAttempts = 100; // Reasonable limit
        let attempts = 0;

        while (!codeFound && attempts < maxAttempts) {
          const testCode = `${namePrefix}${String(codeNumber).padStart(3, '0')}`;
          const codeExists = await Station.findOne({ where: { code: testCode }, transaction: t });
          if (!codeExists) {
            stationCode = testCode;
            codeFound = true;
            console.log(`[PLANCHECK] createStation auto-generated code: ${stationCode}`);
            break;
          }
          codeNumber++;
          attempts++;
        }

        if (!codeFound) {
          await t.rollback();
          return res.status(500).json({ success: false, error: 'Could not generate unique station code' });
        }
      }

      console.log('✅ Using station code:', stationCode);

      console.log('[PLANCHECK] createStation creating with code=', stationCode, 'ownerId=', stationOwnerId);
      const station = await Station.create({
        ownerId: stationOwnerId,
        name,
        code: stationCode,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        gstNumber
      }, { transaction: t });

      // Log station creation
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        stationId: station.id,
        action: 'CREATE',
        entityType: 'Station',
        entityId: station.id,
        newValues: {
          id: station.id,
          name: station.name,
          code: station.code,
          ownerId: stationOwnerId,
          city,
          address
        },
        category: 'data',
        severity: 'info',
        description: `Created new station: ${name} (${stationCode})`
      });

      await t.commit();
      res.status(201).json({ success: true, data: station, message: 'Station created successfully' });
    } catch (err) {
      console.error('Error while creating station inside transaction:', err);
      try { await t.rollback(); } catch (e) { /* ignore */ }
      if (err.name === 'SequelizeValidationError') {
        const msg = err.errors?.[0]?.message || 'Validation failed';
        return res.status(400).json({ success: false, error: msg });
      }
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ success: false, error: 'A station with this code or name already exists' });
      }
      return res.status(500).json({ success: false, error: err.message || 'Failed to create station' });
    }

  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, error: 'Station code already exists' });
    }
    next(error);
  }
};

exports.getStation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const station = await Station.findByPk(id, {
      include: [
        {
          model: Pump,
          as: 'pumps',
          include: [{ model: Nozzle, as: 'nozzles' }]
        },
        {
          model: FuelPrice,
          as: 'fuelPrices',
          order: [['effectiveFrom', 'DESC']],
          limit: 10
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'staff',
          attributes: ['id', 'name', 'email', 'role', 'phone', 'isActive']
        }
      ]
    });

    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    // Authorization check using helper
    if (!(await canAccessStation(user, id))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Compute today's sales for this station
    const today = new Date().toISOString().split('T')[0];
    const todaySalesResult = await NozzleReading.findOne({
      attributes: [[sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'todaySales']],
      where: {
        ...EXCLUDE_SAMPLE_READINGS,
        stationId: id,
        readingDate: today,
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      raw: true
    });

    const todaySales = parseFloat(todaySalesResult?.todaySales || 0);

    // Compute last reading (most recent reading) for this station
    const lastReadingResult = await NozzleReading.findOne({
      where: { stationId: id },
      order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
      attributes: ['readingValue', 'readingDate'],
      raw: true
    });

    const lastReading = lastReadingResult ? parseFloat(lastReadingResult.readingValue || lastReadingResult.reading_value || 0) : null;

    res.json({ success: true, data: { ...station.toJSON(), todaySales, lastReading } });

  } catch (error) {
    next(error);
  }
};

exports.updateStation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;

    // Check station access using helper
    if (!(await canAccessStation(user, id))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const station = await Station.findByPk(id);
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    const oldValues = station.toJSON();
    await station.update(updates);

    // Log station update
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      stationId: id,
      action: 'UPDATE',
      entityType: 'Station',
      entityId: id,
      oldValues: oldValues,
      newValues: updates,
      category: 'data',
      severity: 'info',
      description: `Updated station: ${station.name}`
    });

    res.json({ success: true, data: station, message: 'Station updated' });

  } catch (error) {
    next(error);
  }
};

/**
 * Update station settings (owner/super_admin only)
 * PUT /api/v1/stations/:id/settings
 * Dedicated endpoint for operational settings
 */
exports.updateStationSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { requireShiftForReadings, alertOnMissedReadings, missedReadingThresholdDays } = req.body;
    const user = req.user;

    // Only owner/super_admin can update settings
    if (!['owner', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only owners can update station settings' 
      });
    }

    // Check station access
    if (!(await canAccessStation(user, id))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const station = await Station.findByPk(id);
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    // Build settings update object (only include provided fields)
    const settingsUpdate = {};
    if (requireShiftForReadings !== undefined) {
      settingsUpdate.requireShiftForReadings = Boolean(requireShiftForReadings);
    }
    if (alertOnMissedReadings !== undefined) {
      settingsUpdate.alertOnMissedReadings = Boolean(alertOnMissedReadings);
    }
    if (missedReadingThresholdDays !== undefined) {
      const threshold = parseInt(missedReadingThresholdDays, 10);
      if (isNaN(threshold) || threshold < 1 || threshold > 30) {
        return res.status(400).json({
          success: false,
          error: 'missedReadingThresholdDays must be between 1 and 30'
        });
      }
      settingsUpdate.missedReadingThresholdDays = threshold;
    }

    if (Object.keys(settingsUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid settings provided to update'
      });
    }

    await station.update(settingsUpdate);

    res.json({
      success: true,
      data: {
        id: station.id,
        name: station.name,
        settings: {
          requireShiftForReadings: station.requireShiftForReadings,
          alertOnMissedReadings: station.alertOnMissedReadings,
          missedReadingThresholdDays: station.missedReadingThresholdDays
        }
      },
      message: 'Station settings updated'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get station settings
 * GET /api/v1/stations/:id/settings
 */
exports.getStationSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!(await canAccessStation(user, id))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const station = await Station.findByPk(id, {
      attributes: ['id', 'name', 'requireShiftForReadings', 'alertOnMissedReadings', 'missedReadingThresholdDays']
    });

    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    res.json({
      success: true,
      data: {
        id: station.id,
        name: station.name,
        settings: {
          requireShiftForReadings: station.requireShiftForReadings,
          alertOnMissedReadings: station.alertOnMissedReadings,
          missedReadingThresholdDays: station.missedReadingThresholdDays
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

// ============================================
// PUMP CRUD
// ============================================

exports.getPumps = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;

    console.log(`📋 GET PUMPS - Station: ${stationId}, User: ${user?.id}`);

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get pumps WITHOUT includes first (simple and reliable)
    const pumps = await Pump.findAll({
      where: { stationId },
      order: [['pumpNumber', 'ASC']],
      raw: false
    });

    console.log(`📋 FOUND ${pumps.length} PUMPS in station ${stationId}`);

    // Now separately fetch nozzles for each pump
    const pumpsWithNozzles = await Promise.all(
      pumps.map(async (pump) => {
        const nozzles = await Nozzle.findAll({
          where: { pumpId: pump.id },
          attributes: ['id', 'nozzleNumber', 'fuelType', 'status', 'initialReading'],
          order: [['nozzleNumber', 'ASC']],
          raw: true
        });

        // For each nozzle, fetch the latest reading from NozzleReading
        const nozzlesWithReading = await Promise.all(nozzles.map(async nozzle => {
          const lastReadingResult = await NozzleReading.findOne({
            where: { nozzleId: nozzle.id },
            order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
            attributes: ['id', 'readingValue', 'readingDate', 'createdAt'],
            raw: true
          });
          const lastReading = lastReadingResult ? parseFloat(lastReadingResult.readingValue || lastReadingResult.reading_value || 0) : null;
          const result = {
            ...nozzle,
            lastReading: lastReading !== null ? lastReading : (nozzle.initialReading !== undefined ? parseFloat(nozzle.initialReading) : 0),
            lastReadingDate: lastReadingResult ? lastReadingResult.readingDate : null
          };
          
          return result;
        }));

        return {
          ...pump.toJSON(),
          nozzles: nozzlesWithReading
        };
      })
    );

    console.log(`✅ Returning ${pumpsWithNozzles.length} pumps with nozzles`);
    res.json({ success: true, data: pumpsWithNozzles });

  } catch (error) {
    console.error('❌ getPumps error:', error.message);
    next(error);
  }
};

exports.createPump = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { name, notes, pumpNumber } = req.body;
    const user = req.user;

    console.log(`🔧 CREATE PUMP - Station: ${stationId}, User: ${user?.id}, Body:`, JSON.stringify(req.body));

    // Validate required parameters
    if (!stationId) {
      return res.status(400).json({ success: false, error: 'Station ID is required' });
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Plan limit check is done in middleware, so no need to check here

    // Declare finalPumpNumber variable
    let finalPumpNumber = null;
    let pump = null;

    // Validate request body
    if (pumpNumber !== undefined && pumpNumber !== null && pumpNumber !== '') {
      const num = parseInt(pumpNumber);
      if (isNaN(num) || num < 1) {
        return res.status(400).json({ success: false, error: 'Pump number must be a positive integer' });
      }
      finalPumpNumber = num;
    }

    if (name && typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Pump name must be a string' });
    }

    if (notes && typeof notes !== 'string') {
      return res.status(400).json({ success: false, error: 'Pump notes must be a string' });
    }
    
    if (finalPumpNumber == null || finalPumpNumber === '') {
      // Auto-generate pump number - find the next available number for this station
      let pumpNumberToTry = 1;
      let pumpCreated = false;
      const maxAttempts = 50; // Reasonable limit
      let attempts = 0;

      while (!pumpCreated && attempts < maxAttempts) {
        try {
          // Try to create pump with this number
          pump = await Pump.create({
            stationId,
            name: name || `Pump ${pumpNumberToTry}`,
            pumpNumber: pumpNumberToTry,
            status: 'active',
            notes
          });

          pumpCreated = true;
          finalPumpNumber = pumpNumberToTry;
          console.log(`🔧 Auto-generated pump number: ${finalPumpNumber}`);
          break; // Exit the loop since we succeeded
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            pumpNumberToTry++;
            attempts++;
          } else {
            throw error;
          }
        }
      }

      if (!pumpCreated) {
        return res.status(500).json({ success: false, error: 'Could not generate unique pump number' });
      }
    } else {
      console.log(`🔧 Using provided pump number: ${finalPumpNumber}`);
      // Check if pump with this number already exists
      const existingPump = await Pump.findOne({ where: { stationId, pumpNumber: finalPumpNumber } });

      if (existingPump) {
        return res.status(409).json({
          success: false,
          error: `Pump with number ${finalPumpNumber} already exists for this station`,
          existingPump: {
            id: existingPump.id,
            name: existingPump.name,
            status: existingPump.status
          }
        });
      }

      // Create new pump with provided number
      pump = await Pump.create({
        stationId,
        name: name || `Pump ${finalPumpNumber}`,
        pumpNumber: finalPumpNumber,
        status: 'active',
        notes
      });
    }

    console.log(`✅ PUMP CREATED - ID: ${pump.id}, Number: ${pump.pumpNumber}, Name: ${pump.name}`);
    res.status(201).json({ success: true, data: pump });

  } catch (error) {
    console.error(`❌ CREATE PUMP ERROR - Station: ${req.params.stationId}`, {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: error.code,
      sql: error.sql
    });

    // Handle specific error types
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        error: 'Pump with this number already exists for this station'
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid pump data',
        details: error.errors?.map(e => ({ field: e.path, message: e.message }))
      });
    }

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid station ID'
      });
    }

    // For any other error, return 500
    res.status(500).json({
      success: false,
      error: 'Internal server error while creating pump'
    });
  }
};

exports.updatePump = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, status, notes } = req.body;

    const pump = await Pump.findByPk(id, { include: [{ model: Station, as: 'station' }] });
    if (!pump) {
      return res.status(404).json({ success: false, error: 'Pump not found' });
    }

    const user = req.user;
    // Check station access
    if (!(await canAccessStation(user, pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await pump.update({ name, status, notes });

    // If pump goes to repair/inactive, update all nozzles
    if (status && status !== 'active') {
      await Nozzle.update(
        { status: 'inactive' },
        { where: { pumpId: id } }
      );
    }

    res.json({ success: true, data: pump });

  } catch (error) {
    next(error);
  }
};

exports.deletePump = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pump = await Pump.findByPk(id);
    if (!pump) {
      return res.status(404).json({ success: false, error: 'Pump not found' });
    }

    const user = req.user;
    if (!(await canAccessStation(user, pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Only managers and above (or owner of station) can delete pumps
    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to delete pump' });
    }

    // Delete associated nozzles first
    await Nozzle.destroy({ where: { pumpId: id } });
    await pump.destroy();

    res.json({ success: true, message: 'Pump deleted' });
  } catch (error) {
    next(error);
  }
};

// ============================================
// NOZZLE CRUD
// ============================================

exports.getNozzles = async (req, res, next) => {
  try {
    const { pumpId, stationId } = req.params;
    const user = req.user;

    let nozzles = [];

    if (pumpId) {
      const pump = await Pump.findByPk(pumpId);
      if (!pump) {
        return res.status(404).json({ success: false, error: 'Pump not found' });
      }
      if (!(await canAccessStation(user, pump.stationId))) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      nozzles = await Nozzle.findAll({ where: { pumpId }, order: [['nozzleNumber', 'ASC']] });
    } else if (stationId) {
      // Compatibility: return all nozzles for a station
      if (!(await canAccessStation(user, stationId))) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      nozzles = await Nozzle.findAll({ where: { stationId }, order: [['nozzleNumber', 'ASC']] });
    } else {
      return res.status(400).json({ success: false, error: 'pumpId or stationId is required' });
    }

    res.json({ success: true, data: nozzles, nozzles });

    // Also keep compatibility key
    // (some clients/tests expect `nozzles` at top-level)

  } catch (error) {
    next(error);
  }
};

// Get single nozzle by ID
exports.getNozzle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const nozzle = await Nozzle.findByPk(id, { include: [{ model: Pump, as: 'pump' }] });
    if (!nozzle) return res.status(404).json({ success: false, error: 'Nozzle not found' });

    if (!(await canAccessStation(user, nozzle.pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: nozzle, nozzle });
  } catch (err) {
    next(err);
  }
};

exports.createNozzle = async (req, res, next) => {
  try {
    const { pumpId } = req.params;
    const { fuelType, initialReading, notes, nozzleNumber } = req.body;

    console.log(`🔍 Creating nozzle - pumpId: ${pumpId}, fuelType: ${fuelType}`);

    const pump = await Pump.findByPk(pumpId);
    if (!pump) { return res.status(404).json({ success: false, error: 'Pump not found' }); }

    const user = await User.findByPk(req.userId);
    // Check station access
    if (!(await canAccessStation(user, pump.stationId))) { return res.status(403).json({ success: false, error: 'Access denied' }); }

    let finalNozzleNumber = nozzleNumber;
    let nozzle = null;
    if (!finalNozzleNumber) {
      // Auto-generate nozzle number - find the next available number for this pump
      let nozzleNumberToTry = 1;
      let nozzleCreated = false;
      const maxAttempts = 50; // Reasonable limit
      let attempts = 0;

      while (!nozzleCreated && attempts < maxAttempts) {
        try {
          // Try to create nozzle with this number
          nozzle = await Nozzle.create({
            pumpId,
            stationId: pump.stationId,
            nozzleNumber: nozzleNumberToTry,
            fuelType,
            initialReading: initialReading != null ? initialReading : 0,
            notes
          });

          nozzleCreated = true;
          finalNozzleNumber = nozzleNumberToTry;
          console.log(`🔍 Auto-generated nozzle number: ${finalNozzleNumber}`);
          break; // Exit the loop since we succeeded
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            nozzleNumberToTry++;
            attempts++;
          } else {
            throw error;
          }
        }
      }

      if (!nozzleCreated) {
        await t.rollback();
        return res.status(500).json({ success: false, error: 'Could not generate unique nozzle number' });
      }
    } else {
      console.log(`🔍 Using provided nozzle number: ${finalNozzleNumber}`);
      // Create nozzle with provided number
      nozzle = await Nozzle.create({
        pumpId,
        stationId: pump.stationId,
        nozzleNumber: finalNozzleNumber,
        fuelType,
        initialReading: initialReading != null ? initialReading : 0,
        notes
      });
    }

    console.log(`✅ NOZZLE CREATED - ID: ${nozzle.id}, Number: ${nozzle.nozzleNumber}, Pump: ${pumpId}`);
    res.status(201).json({ success: true, data: nozzle });

  } catch (error) {
    console.error(`❌ createNozzle error:`, error.message, 'name:', error.name);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, error: 'Nozzle with this number already exists for this pump' });
    }
    next(error);
  }
};

exports.updateNozzle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fuelType, status, initialReading, notes } = req.body;

    const nozzle = await Nozzle.findByPk(id, {
      include: [{ model: Pump, as: 'pump' }]
    });

    if (!nozzle) {
      return res.status(404).json({ success: false, error: 'Nozzle not found' });
    }

    const user = req.user;
    // Check station access
    if (!(await canAccessStation(user, nozzle.pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await nozzle.update({ fuelType, status, initialReading, notes });

    res.json({ success: true, data: nozzle });

  } catch (error) {
    next(error);
  }
};

exports.deleteNozzle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const nozzle = await Nozzle.findByPk(id, { include: [{ model: Pump, as: 'pump' }] });
    if (!nozzle) {
      return res.status(404).json({ success: false, error: 'Nozzle not found' });
    }

    const user = req.user;
    if (!(await canAccessStation(user, nozzle.stationId || nozzle.pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!['super_admin', 'owner', 'manager'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to delete nozzle' });
    }

    await nozzle.destroy();
    res.json({ success: true, message: 'Nozzle deleted' });
  } catch (error) {
    next(error);
  }
};

// ============================================
// FUEL PRICES
// ============================================

exports.getFuelPrices = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get latest price for each fuel type
    const prices = await FuelPrice.findAll({
      where: { stationId },
      order: [['fuelType', 'ASC'], ['effectiveFrom', 'DESC']],
      raw: true,
      attributes: ['id', 'stationId', 'fuelType', 'price', 'costPrice', 'effectiveFrom', 'createdAt', 'updatedAt']
    });

    // Group by fuel type, take latest
    const currentPrices = {};
    prices.forEach(p => {
      if (!currentPrices[p.fuelType]) {
        currentPrices[p.fuelType] = p;
      }
    });

    // Transform response to include costPrice in the expected format
    const transformedPrices = Object.values(currentPrices).map(p => ({
      id: p.id,
      stationId: p.stationId,
      fuelType: p.fuelType,
      price: p.price,
      costPrice: p.costPrice,  // Already in camelCase from attributes mapping
      effectiveFrom: p.effectiveFrom,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));

    res.json({
      success: true,
      data: {
        current: transformedPrices,
        history: prices
      },
      fuelPrices: {
        current: transformedPrices,
        history: prices
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.setFuelPrice = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { fuelType, price, costPrice, effectiveFrom } = req.body;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!fuelType || !price) {
      return res.status(400).json({ success: false, error: 'fuelType and price are required' });
    }

    // Validate price is a positive number
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ success: false, error: 'price must be a positive number' });
    }

    // Validate cost price if provided
    let numericCostPrice = null;
    if (costPrice) {
      numericCostPrice = parseFloat(costPrice);
      if (isNaN(numericCostPrice) || numericCostPrice <= 0) {
        return res.status(400).json({ success: false, error: 'costPrice must be a positive number' });
      }
      if (numericCostPrice >= numericPrice) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cost price must be less than selling price' 
        });
      }
    }

    const effectiveDate = effectiveFrom || new Date().toISOString().split('T')[0];

    // Try to find and update existing price for this fuel type on this date
    const existingPrice = await FuelPrice.findOne({
      where: {
        stationId,
        fuelType,
        effectiveFrom: effectiveDate
      }
    });

    let fuelPrice;
    let isUpdate = false;

    if (existingPrice) {
      // Update existing price
      await existingPrice.update({
        price: numericPrice,
        costPrice: numericCostPrice,
        updatedBy: req.userId
      });
      fuelPrice = existingPrice;
      isUpdate = true;
    } else {
      // Create new price
      fuelPrice = await FuelPrice.create({
        stationId,
        fuelType,
        price: numericPrice,
        costPrice: numericCostPrice,
        effectiveFrom: effectiveDate,
        updatedBy: req.userId
      });
    }

    // Log price update
    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      stationId,
      action: isUpdate ? 'UPDATE' : 'CREATE',
      entityType: 'FuelPrice',
      entityId: fuelPrice.id,
      newValues: {
        fuelType,
        price: numericPrice,
        costPrice: numericCostPrice || 'Not set',
        profitPerLitre: numericCostPrice ? (numericPrice - numericCostPrice).toFixed(2) : 'N/A'
      },
      category: 'pricing',
      severity: 'info',
      description: `${isUpdate ? 'Updated' : 'Set'} fuel price: ${fuelType} @ ₹${numericPrice}${numericCostPrice ? ` (cost: ₹${numericCostPrice})` : ''}`
    });

    res.status(isUpdate ? 200 : 201).json({
      success: true,
      data: fuelPrice,
      message: `${fuelType} price ${isUpdate ? 'updated' : 'set'} to ₹${price}${costPrice ? ` with cost ₹${costPrice}` : ''}`
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Check if price is set for a fuel type on a specific date
 * GET /api/v1/stations/:stationId/prices/check?fuelType=petrol&date=2025-01-01
 * Used by frontend to validate before allowing sales entry
 */
exports.checkPriceSet = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { fuelType, date } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!fuelType) {
      return res.status(400).json({ 
        success: false, 
        error: 'fuelType query parameter is required' 
      });
    }

    const validFuelTypes = Object.values(FUEL_TYPES);
    if (!validFuelTypes.includes(fuelType)) {
      return res.status(400).json({ 
        success: false, 
        error: `fuelType must be one of: ${validFuelTypes.join(', ')}` 
      });
    }

    const checkDate = date || new Date().toISOString().split('T')[0];
    const price = await FuelPrice.getPriceForDate(stationId, fuelType, checkDate);

    res.json({
      success: true,
      data: {
        fuelType,
        date: checkDate,
        priceSet: price !== null,
        price: price,
        message: price !== null 
          ? `Price for ${fuelType} on ${checkDate}: ₹${price}` 
          : `No price set for ${fuelType} on or before ${checkDate}`
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get daily sales summary for a specific station and date
 * GET /stations/:stationId/daily-sales?date=YYYY-MM-DD
 */
exports.getDailySales = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const queryDate = date || new Date().toISOString().split('T')[0];

    // Get station info
    const station = await Station.findByPk(stationId, {
      attributes: ['id', 'name']
    });

    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    // Get all readings for the date
    const readings = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: queryDate,
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      include: [{
        model: Nozzle,
        as: 'nozzle',
        attributes: ['fuelType', 'nozzleNumber']
      }],
      raw: false
    });

    if (!readings || readings.length === 0) {
      return res.json({
        success: true,
        data: {
          date: queryDate,
          stationId,
          stationName: station.name,
          totalSaleValue: 0,
          totalLiters: 0,
          readingsCount: 0,
          byFuelType: {},
          expectedCash: 0,
          paymentSplit: { cash: 0, online: 0, credit: 0 },
          readings: []
        }
      });
    }

    // Calculate summary
    let totalSaleValue = 0;
    let totalLiters = 0;
    let totalCash = 0;
    let totalOnline = 0;
    let totalCredit = 0;
    const byFuelType = {};
    const readingsList = [];

    // Iterate readings to build summary lists and per-fuel totals
    readings.forEach(reading => {
      const saleValue = parseFloat(reading.totalAmount || 0) ||
        (parseFloat(reading.litresSold || 0) * parseFloat(reading.pricePerLitre || 0));
      const liters = parseFloat(reading.litresSold || 0);
      const fuelType = reading.fuelType || reading.nozzle?.fuelType || reading.Nozzle?.fuelType || 'unknown';

      totalSaleValue += saleValue;
      totalLiters += liters;

      if (!byFuelType[fuelType]) {
        byFuelType[fuelType] = { liters: 0, value: 0 };
      }
      byFuelType[fuelType].liters += liters;
      byFuelType[fuelType].value += saleValue;

      readingsList.push({
        id: reading.id,
        nozzleNumber: reading.nozzle?.nozzleNumber || reading.Nozzle?.nozzleNumber,
        fuelType,
        liters,
        saleValue
      });
    });

    // Use shared helper to compute deduplicated payment totals
    const paymentTotals = calcDeduplicatedTotals(readings);
    totalCash = paymentTotals.cash;
    totalOnline = paymentTotals.online;
    totalCredit = paymentTotals.credit;

    res.json({
      success: true,
      data: {
        date: queryDate,
        stationId,
        stationName: station.name,
        totalSaleValue: parseFloat(totalSaleValue.toFixed(2)),
        totalLiters: parseFloat(totalLiters.toFixed(2)),
        readingsCount: readings.length,
        byFuelType,
        expectedCash: parseFloat(totalCash.toFixed(2)),
        paymentSplit: {
          cash: parseFloat(totalCash.toFixed(2)),
          online: parseFloat(totalOnline.toFixed(2)),
          credit: parseFloat(totalCredit.toFixed(2))
        },
        readings: readingsList
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get readings available for settlement (unlinked or for review)
 * GET /stations/:stationId/readings-for-settlement?date=YYYY-MM-DD
 * 
 * Returns readings not yet linked to any settlement for owner to select and review.
 * Includes employee name, nozzle info, payment breakdown, and timestamps.
 */
exports.getReadingsForSettlement = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const queryDate = date || new Date().toISOString().split('T')[0];

    // Fetch all readings for this station/date with details
    const readings = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: queryDate,
        [Op.or]: [
          { isInitialReading: false },
          { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
        ]
      },
      include: [
        { 
          model: Nozzle, 
          as: 'nozzle', 
          attributes: ['nozzleNumber', 'fuelType'] 
        },
        { 
          model: User, 
          as: 'enteredByUser', 
          attributes: ['id', 'name', 'email'] 
        },
        {
          model: User,
          as: 'assignedEmployee',
          attributes: ['id', 'name'],
          required: false
        },
        {
          model: Settlement,
          as: 'settlement',
          attributes: ['id', 'date', 'isFinal', 'recordedAt'],
          required: false
        },
        {
          model: DailyTransaction,
          as: 'transaction',
          attributes: ['id', 'transactionDate', 'status', 'createdBy', 'paymentBreakdown'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // ALSO fetch all DailyTransactions for this date (authoritative source of payment data)
    const dailyTransactions = await DailyTransaction.findAll({
      where: {
        stationId,
        transactionDate: queryDate
      },
      attributes: ['id', 'transactionDate', 'paymentBreakdown'],
      raw: true
    });

    // Build payment breakdown map from DailyTransactions (keyed by transaction ID)
    const paymentMap = {};
    let totalPaymentBreakdown = { cash: 0, online: 0, credit: 0 };
    
    dailyTransactions.forEach(tx => {
      const pbData = tx.paymentBreakdown || {};
      paymentMap[tx.id] = {
        cash: parseFloat(pbData.cash || 0),
        online: parseFloat(pbData.online || 0),
        credit: parseFloat(pbData.credit || 0)
      };
      totalPaymentBreakdown.cash += parseFloat(pbData.cash || 0);
      totalPaymentBreakdown.online += parseFloat(pbData.online || 0);
      totalPaymentBreakdown.credit += parseFloat(pbData.credit || 0);
    });

    // Categorize readings and include transaction.paymentBreakdown (DailyTransaction is authoritative)
    const unlinkedReadings = [];
    const linkedReadings = [];

    for (const reading of readings) {
      const txId = reading.transactionId;
      const paymentBreakdown = txId && paymentMap[txId] 
        ? paymentMap[txId]
        : {};

      const readingData = {
        id: reading.id,
        nozzleNumber: reading.nozzle?.nozzleNumber,
        fuelType: reading.nozzle?.fuelType,
        openingReading: parseFloat(reading.previousReading || 0),
        closingReading: parseFloat(reading.readingValue || 0),
        litresSold: parseFloat(reading.litresSold || 0),
        saleValue: parseFloat(reading.totalAmount || 0),
        recordedBy: reading.enteredByUser ? {
          id: reading.enteredByUser.id,
          name: reading.enteredByUser.name
        } : null,
        assignedEmployeeId: reading.assignedEmployeeId || null,
        assignedEmployee: reading.assignedEmployee ? {
          id: reading.assignedEmployee.id,
          name: reading.assignedEmployee.name
        } : null,
        recordedAt: reading.createdAt,
        status: reading.status || (reading.settlementId ? 'settled' : 'unsettled'),
        settlementId: reading.settlementId,
        carriedForwardFrom: reading.carriedForwardFrom,
        linkedSettlement: reading.settlement ? {
          id: reading.settlement.id,
          date: reading.settlement.date,
          isFinal: reading.settlement.isFinal,
          status: reading.settlement.status
        } : null,
        transaction: reading.transaction ? {
          id: reading.transaction.id,
          transactionDate: reading.transaction.transactionDate,
          status: reading.transaction.status,
          createdBy: reading.transaction.createdBy,
          paymentBreakdown: paymentBreakdown
        } : null
      };

      if (reading.settlementId) {
        linkedReadings.push(readingData);
      } else {
        unlinkedReadings.push(readingData);
      }
    }

    
    
    // Calculate totals for unlinked readings
    const unlinkedTotals = calcDeduplicatedTotals(unlinkedReadings);

    // Calculate totals for linked readings
    const linkedTotals = calcDeduplicatedTotals(linkedReadings);

    res.json({
      success: true,
      data: {
        date: queryDate,
        stationId,
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
        linked: {
          count: linkedReadings.length,
          readings: linkedReadings,
          totals: {
            cash: parseFloat(linkedTotals.cash.toFixed(2)),
            online: parseFloat(linkedTotals.online.toFixed(2)),
            credit: parseFloat(linkedTotals.credit.toFixed(2)),
            litres: parseFloat(linkedTotals.litres.toFixed(2)),
            value: parseFloat(linkedTotals.value.toFixed(2))
          }
        },
        allReadingsCount: readings.length
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Record daily settlement
 * POST /stations/:stationId/settlements
 * 
 * IMPORTANT: Variance is CALCULATED on backend to prevent manipulation
 * Formula: variance = expectedCash - actualCash
 * Also stores employee-reported values from readings for comparison.
 * 
 * @param {string[]} readingIds - Optional array of reading IDs to link to this settlement.
 *   If provided, only these readings will be aggregated and linked.
 *   If not provided, all unlinked readings for the station/date will be used.
 */
exports.recordSettlement = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { date, actualCash, expectedCash, notes, online, credit, status, readingIds, employeeShortfalls } = req.body;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const settlementDate = date || new Date().toISOString().split('T')[0];

    // Parse owner-confirmed amounts
    const parsedExpectedCash = parseFloat(expectedCash || 0);
    const parsedActualCash = parseFloat(actualCash || 0);
    const parsedOnline = parseFloat(online || 0);
    const parsedCredit = parseFloat(credit || 0);

    // Determine settlement status (support both legacy isFinal and new status)
    const settlementStatus = status || (req.body.isFinal ? 'final' : 'draft');
    const isFinal = settlementStatus === 'final' || req.body.isFinal === true;

    // VALIDATE all settlement amounts
    const validationErrors = [];
    if (parsedExpectedCash < 0) validationErrors.push('expectedCash cannot be negative');
    if (parsedActualCash < 0) validationErrors.push('actualCash cannot be negative');
    if (parsedOnline < 0) validationErrors.push('online amount cannot be negative');
    if (parsedCredit < 0) validationErrors.push('credit amount cannot be negative');
    
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid settlement amounts',
        details: validationErrors
      });
    }

    // CALCULATE VARIANCE on backend (don't trust frontend value)
    const calculatedVariance = parsedExpectedCash - parsedActualCash;

    // Fetch employee-reported totals exclusively from DailyTransaction (source-of-truth)

    let transactions = [];
    if (readingIds && Array.isArray(readingIds) && readingIds.length > 0) {
      // Fetch possible transactions for station/date and filter by readingIds overlap
      const possibleTxns = await DailyTransaction.findAll({ where: { stationId, transactionDate: settlementDate }, raw: true });
      const selectedSet = new Set(readingIds);
      transactions = possibleTxns.filter(txn => {
        const ids = Array.isArray(txn.reading_ids) ? txn.reading_ids : txn.readingIds || [];
        return ids.some(id => selectedSet.has(id));
      });
    } else {
      // Aggregate all transactions for the station/date
      transactions = await DailyTransaction.findAll({ where: { stationId, transactionDate: settlementDate }, raw: true });
    }

    // Sum paymentBreakdown across matched transactions (only source of tender entries from employees)
    let employeeCash = 0, employeeOnline = 0, employeeCredit = 0;
    transactions.forEach(txn => {
      const pb = txn.payment_breakdown || txn.paymentBreakdown || {};
      employeeCash += parseFloat(pb.cash || 0);
      employeeOnline += parseFloat(pb.online || 0);
      employeeCredit += parseFloat(pb.credit || 0);
    });

    employeeCash = parseFloat(employeeCash.toFixed(2));
    employeeOnline = parseFloat(employeeOnline.toFixed(2));
    employeeCredit = parseFloat(employeeCredit.toFixed(2));
    const calculatedTotalSaleValue = parseFloat((employeeCash + employeeOnline + employeeCredit).toFixed(2));

    // Calculate variance for all payment methods
    const varianceOnline = employeeOnline - parsedOnline;
    const varianceCredit = employeeCredit - parsedCredit;
    
    // VALIDATION: Check that owner-confirmed amounts don't exceed significant tolerance from employee reports
    const TOLERANCE_PERCENTAGE = 5; // Allow 5% variance for rounding/corrections
    const onlineVariancePercent = employeeOnline > 0 ? Math.abs(varianceOnline) / employeeOnline * 100 : 0;
    const creditVariancePercent = employeeCredit > 0 ? Math.abs(varianceCredit) / employeeCredit * 100 : 0;
    
    // Log variances for debugging
    console.log(`[SETTLEMENT VALIDATION] Online - Reported: ${employeeOnline}, Actual: ${parsedOnline}, Variance: ${varianceOnline} (${onlineVariancePercent.toFixed(2)}%)`);
    console.log(`[SETTLEMENT VALIDATION] Credit - Reported: ${employeeCredit}, Actual: ${parsedCredit}, Variance: ${varianceCredit} (${creditVariancePercent.toFixed(2)}%)`);
    
    // Warn if variances exceed tolerance (but don't block)
    const warningMessages = [];
    if (onlineVariancePercent > TOLERANCE_PERCENTAGE && employeeOnline > 0) {
      warningMessages.push(`Online variance ${onlineVariancePercent.toFixed(2)}% exceeds ${TOLERANCE_PERCENTAGE}% tolerance. Reported: ${employeeOnline}, Confirmed: ${parsedOnline}`);
    }
    if (creditVariancePercent > TOLERANCE_PERCENTAGE && employeeCredit > 0) {
      warningMessages.push(`Credit variance ${creditVariancePercent.toFixed(2)}% exceeds ${TOLERANCE_PERCENTAGE}% tolerance. Reported: ${employeeCredit}, Confirmed: ${parsedCredit}`);
    }

    // Persist settlement

    const t = await sequelize.transaction();
    try {
      let finalizedAt = null;
      
      // Create settlement record first (always as draft initially)
      const record = await Settlement.create({
        stationId,
        date: settlementDate,
        totalSaleValue: calculatedTotalSaleValue,
        expectedCash: parsedExpectedCash,
        actualCash: parsedActualCash,
        variance: parseFloat(calculatedVariance.toFixed(2)),
        employeeCash,
        employeeOnline,
        employeeCredit,
        online: parsedOnline,
        credit: parsedCredit,
        varianceOnline: parseFloat(varianceOnline.toFixed(2)),
        varianceCredit: parseFloat(varianceCredit.toFixed(2)),
        notes: notes || '',
        employeeShortfalls: employeeShortfalls || null,
        readingIds: readingIds || null,
        recordedBy: user.id,
        recordedAt: new Date(),
        status: settlementStatus,
        isFinal: false,          // Always created as draft initially
        finalizedAt: null
      }, { transaction: t });

      // Link selected readings to this settlement and update their status
      let linkedReadingsCount = 0;
      let actualReadingIds = readingIds;
      
      if (readingIds && Array.isArray(readingIds) && readingIds.length > 0) {
        // Link specific readings and update status to 'settled'
        const [affectedRows] = await NozzleReading.update(
          { settlementId: record.id, status: 'settled' },
          { where: { id: { [Op.in]: readingIds } }, transaction: t }
        );
        linkedReadingsCount = affectedRows;
        actualReadingIds = readingIds;
      } else {
        // Link all unlinked readings for this station/date and update status
        const linkedReadings = await NozzleReading.findAll({
          where: {
            stationId,
            readingDate: settlementDate,
            settlementId: null,
            [Op.or]: [
              { isInitialReading: false },
              { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
            ]
          },
          attributes: ['id'],
          transaction: t,
          raw: true
        });
        
        const linkedReadingIds = linkedReadings.map(r => r.id);
        
        const [affectedRows] = await NozzleReading.update(
          { settlementId: record.id, status: 'settled' },
          {
            where: { id: { [Op.in]: linkedReadingIds } },
            transaction: t
          }
        );
        linkedReadingsCount = affectedRows;
        actualReadingIds = linkedReadingIds;
      }

      // Update settlement with actual readingIds for employee shortfall calculation
      if (actualReadingIds && actualReadingIds.length > 0) {
        await Settlement.update(
          { readingIds: actualReadingIds },
          { where: { id: record.id }, transaction: t }
        );
      }

      // Verify settlement integrity if finalizing
      if (isFinal) {
        try {
          const verificationResult = await services.settlementVerificationService.verifySettlementComplete(
            record.id,     // settlementId
            stationId,     // stationId
            settlementDate, // date (should match settlement.date)
            t              // pass transaction context for consistency
          );

          if (!verificationResult.canFinalize) {
            await t.rollback();
            return res.status(400).json({
              success: false,
              error: 'Settlement verification failed - cannot finalize',
              details: verificationResult.issues,
              checks: verificationResult.checks
            });
          }

          // Verification passed - mark as final
          finalizedAt = new Date();
          
          // Un-finalize previous settlements for this station/date
          await Settlement.update({ isFinal: false, finalizedAt: null }, {
            where: { stationId, date: settlementDate, isFinal: true },
            transaction: t
          });

          // Mark this settlement as final
          await Settlement.update(
            { isFinal: true, finalizedAt },
            { where: { id: record.id }, transaction: t }
          );
        } catch (verificationErr) {
          console.error('[recordSettlement] Verification error:', verificationErr);
          await t.rollback();
          throw verificationErr;
        }
      }

      await t.commit();

      const responseData = { 
        success: true, 
        data: record,
        metadata: {
            message: 'Settlement recorded. Employee tender totals aggregated from DailyTransaction only',
            varianceCalculation: `Cash: ${parsedExpectedCash} - ${parsedActualCash} = ${calculatedVariance}`,
            employeeReported: { cash: employeeCash, online: employeeOnline, credit: employeeCredit },
            ownerConfirmed: { cash: parsedActualCash, online: parsedOnline, credit: parsedCredit },
            variances: { 
              cash: calculatedVariance, 
              online: varianceOnline, 
              credit: varianceCredit,
              cashPercent: employeeCash > 0 ? ((calculatedVariance / employeeCash) * 100).toFixed(2) : '0.00',
              onlinePercent: employeeOnline > 0 ? (onlineVariancePercent).toFixed(2) : '0.00',
              creditPercent: employeeCredit > 0 ? (creditVariancePercent).toFixed(2) : '0.00'
            },
            linkedReadings: linkedReadingsCount
          }
      };
      
      // Add warnings if variances exceed tolerance
      if (warningMessages.length > 0) {
        responseData.warnings = warningMessages;
      }
      
      res.json(responseData);
    } catch (err) {
      if (!t.finished) {
        await t.rollback();
      }
      throw err;
    }

  } catch (error) {
    next(error);
  }
};

/**
 * Get settlement history for a station
 * GET /stations/:stationId/settlements?limit=5
 * 
 * PERSISTENCE DETAILS:
 * - All settlements are permanently stored in `settlements` table
 * - Amounts stored as DECIMAL(12,2) - exact precision, no rounding errors
 * - Variance automatically calculated: expectedCash - actualCash
 * - Includes audit trail: who recorded, when, notes
 * - Status tracking: recorded/approved/disputed
 */
exports.getSettlements = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { limit = 5, startDate, endDate } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Query persisted settlements with variance analysis

    // Build date filter if provided
    const whereClause = { stationId };
    if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.date = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.date = { [Op.lte]: endDate };
    }

    const rows = await Settlement.findAll({
      where: whereClause,
      include: [{ model: User, as: 'recordedByUser', attributes: ['name', 'email'] }],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: limit ? parseInt(limit) : undefined
    });
    // Group by date, flag duplicates and pick a main settlement (latest final if present)
    const settlementsByDate = {};
    rows.forEach(s => {
      const d = s.date;
      if (!settlementsByDate[d]) settlementsByDate[d] = [];
      settlementsByDate[d].push(s);
    });

    const summary = Object.entries(settlementsByDate).map(([date, arr]) => {
      const finals = arr.filter(s => s.isFinal);
      const latestFinal = finals.length > 0 ? finals[finals.length - 1] : null;
      const main = latestFinal || arr[arr.length - 1];

      // Provide clearer metadata while keeping legacy `duplicateCount` for compatibility
      return {
        ...main.toJSON(),
        duplicateCount: arr.length,
        attempts: arr.length,
        latestFinalId: latestFinal ? latestFinal.id : null,
        latestRecordId: arr[arr.length - 1].id,
        mainSettlement: main.toJSON(),
        allSettlements: arr.map(s => s.toJSON()),
        settlementDate: date // Store date for later use
      };
    });
    
    // Recalculate expectedCash based on current transactions and add variance analysis
    const enhancedSummary = await Promise.all(summary.map(async (entry) => {
      // Fetch all transactions for this settlement date
      const transactions = await DailyTransaction.findAll({
        where: { stationId, transactionDate: entry.settlementDate },
        raw: true
      });

      // Sum cash from all transactions for this date
      let recalculatedExpectedCash = 0;
      transactions.forEach(txn => {
        const pb = txn.payment_breakdown || txn.paymentBreakdown || {};
        recalculatedExpectedCash += parseFloat(pb.cash || 0);
      });
      recalculatedExpectedCash = parseFloat(recalculatedExpectedCash.toFixed(2));

      // Use recalculated expectedCash, but keep the original in a separate field for audit
      const actualCash = parseFloat(entry.actualCash || 0);
      const recalculatedVariance = recalculatedExpectedCash - actualCash;
      const variancePercentage = recalculatedExpectedCash > 0 ? (recalculatedVariance / recalculatedExpectedCash) * 100 : 0;

      let varianceStatus = 'OK';
      if (Math.abs(recalculatedVariance) > (recalculatedExpectedCash * 0.03)) {
        varianceStatus = 'INVESTIGATE';
      } else if (Math.abs(recalculatedVariance) > (recalculatedExpectedCash * 0.01)) {
        varianceStatus = 'REVIEW';
      }

      return {
        ...entry,
        expectedCash: recalculatedExpectedCash, // Update with recalculated value
        originalExpectedCash: parseFloat(entry.expectedCash || 0), // Preserve original for audit
        variance: parseFloat(recalculatedVariance.toFixed(2)), // Recalculate variance
        varianceAnalysis: {
          percentage: parseFloat(variancePercentage.toFixed(2)),
          status: varianceStatus,
          interpretation: recalculatedVariance > 0 ? 'Shortfall' : recalculatedVariance < 0 ? 'Overage' : 'Perfect match'
        }
      };
    }));

    // Return grouped summary with variance analysis (single response)
    res.json({
      success: true,
      data: enhancedSummary,
      metadata: {
        count: enhancedSummary.length,
        persistenceInfo: 'All settlements persisted to database with ACID compliance',
        amountsPrecision: 'DECIMAL(12,2) - exact, no floating point errors',
        duplicatesFlagged: true,
        expectedCashRecalculated: 'True - expectedCash recalculated from current transactions for accuracy after post-settlement entries'
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Compare settlement vs daily sales
 * GET /stations/:stationId/settlement-vs-sales?date=2025-12-09
 * 
 * ANSWERS: How is settlement different from actual sales calculated by system?
 * - SALES = Revenue from readings (what was sold)
 * - SETTLEMENT = Cash reconciliation (what cash we counted)
 * - Both needed for complete business control
 */
exports.getVarianceSummary = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate } = req.query;
    const user = req.user;

    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const where = { stationId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = startDate;
      if (endDate) where.date[Op.lte] = endDate;
    }

    const settlements = await Settlement.findAll({
      where,
      order: [['date', 'ASC']]
    });

    if (!settlements || settlements.length === 0) {
      return res.json({
        success: true,
        data: {
          periodStart: startDate,
          periodEnd: endDate,
          settlementCount: 0,
          totalVariance: 0,
          avgDailyVariance: 0,
          totalExpectedCash: 0,
          variancePercentage: 0,
          byDay: [],
          summary: { status: 'NO_DATA', message: 'No settlements recorded' }
        }
      });
    }

    const byDay = {};
    let totalVariance = 0;
    let totalExpectedCash = 0;
    let totalVarianceOnline = 0;
    let totalVarianceCredit = 0;

    // Use settlement variance values directly - they're already calculated based on linked readings
    for (const s of settlements) {
      const dateStr = typeof s.date === 'string' ? s.date : s.date.toISOString().split('T')[0];

      // Use the variances already calculated in the settlement (based on its linked readings)
      // Don't recalculate from ALL transactions for the date - that would include unrelated transactions
      const variance = parseFloat(s.variance || 0);
      const varianceOnline = parseFloat(s.varianceOnline || 0);
      const varianceCredit = parseFloat(s.varianceCredit || 0);

      if (!byDay[dateStr]) {
        byDay[dateStr] = { 
          date: dateStr, 
          variance: 0, 
          varianceOnline: 0, 
          varianceCredit: 0, 
          expectedCash: 0, 
          settlementCount: 0 
        };
      }

      byDay[dateStr].variance += variance;
      byDay[dateStr].varianceOnline += varianceOnline;
      byDay[dateStr].varianceCredit += varianceCredit;
      byDay[dateStr].expectedCash += parseFloat(s.expectedCash || 0);
      byDay[dateStr].settlementCount += 1;
      
      // Total variance is the sum of all variances (cash + online + credit)
      totalVariance += variance + varianceOnline + varianceCredit;
      totalExpectedCash += parseFloat(s.expectedCash || 0);
      totalVarianceOnline += varianceOnline;
      totalVarianceCredit += varianceCredit;
    }

    const byDayArray = Object.values(byDay).map(day => {
      const dayTotalVariance = day.variance + day.varianceOnline + day.varianceCredit;
      const dayExpectedTotal = day.expectedCash;
      return {
        ...day,
        totalVariance: parseFloat(dayTotalVariance.toFixed(2)),
        variancePercentage: dayExpectedTotal > 0 ? parseFloat(((dayTotalVariance / dayExpectedTotal) * 100).toFixed(2)) : 0
      };
    });

    const avgDailyVariance = byDayArray.length > 0 ? totalVariance / byDayArray.length : 0;
    const variancePercentage = totalExpectedCash > 0 ? parseFloat(((totalVariance / totalExpectedCash) * 100).toFixed(2)) : 0;

    let status = 'HEALTHY';
    if (Math.abs(variancePercentage) > 3) status = 'INVESTIGATE';
    else if (Math.abs(variancePercentage) > 1) status = 'REVIEW';

    res.json({
      success: true,
      data: {
        periodStart: startDate,
        periodEnd: endDate,
        settlementCount: settlements.length,
        dayCount: byDayArray.length,
        totalVariance: parseFloat(totalVariance.toFixed(2)),
        totalVarianceCash: parseFloat((totalVariance - totalVarianceOnline - totalVarianceCredit).toFixed(2)),
        totalVarianceOnline: parseFloat(totalVarianceOnline.toFixed(2)),
        totalVarianceCredit: parseFloat(totalVarianceCredit.toFixed(2)),
        avgDailyVariance: parseFloat(avgDailyVariance.toFixed(2)),
        totalExpectedCash: parseFloat(totalExpectedCash.toFixed(2)),
        variancePercentage,
        byDay: byDayArray,
        summary: {
          status,
          interpretation: totalVariance > 0 ? 'Shortfall' : totalVariance < 0 ? 'Overage' : 'Perfect',
          message: status === 'HEALTHY' ? `Total variance is ${Math.abs(variancePercentage).toFixed(2)}% (acceptable) - Cash: ${totalVariance - totalVarianceOnline - totalVarianceCredit}, Online: ${totalVarianceOnline}, Credit: ${totalVarianceCredit}` : `${status} - variance is ${Math.abs(variancePercentage).toFixed(2)}%`
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getSettlementVsSales = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const queryDate = date || new Date().toISOString().split('T')[0];



    // Get settlement for the day
    const settlement = await Settlement.findOne({
      where: { stationId, date: queryDate }
    });

    // Get all readings for the day to calculate sales (litres × price)
    const readings = await NozzleReading.findAll({
      where: sequelize.where(
        sequelize.fn('DATE', sequelize.col('recorded_at')),
        '=',
        queryDate
      ),
      include: [{
        model: Nozzle,
        attributes: ['nozzleNumber'],
        include: [{
          model: Pump,
          attributes: ['pumpNumber']
        }]
      }],
      raw: false
    });

    // Calculate sales totals from readings using litresSold × pricePerLitre
    let totalSaleValue = 0;
    readings.forEach(reading => {
      const saleValue = parseFloat(reading.litresSold || 0) * parseFloat(reading.pricePerLitre || 0);
      totalSaleValue += saleValue;
    });

    // Aggregate payment breakdown from DailyTransaction (source of tender entries)
    const txns = await DailyTransaction.findAll({ where: { stationId, transactionDate: queryDate }, raw: true });
    let totalCashSales = 0, totalOnlineSales = 0, totalCreditSales = 0;
    txns.forEach(tx => {
      const pb = tx.payment_breakdown || tx.paymentBreakdown || {};
      totalCashSales += parseFloat(pb.cash || 0);
      totalOnlineSales += parseFloat(pb.online || 0);
      totalCreditSales += parseFloat(pb.credit || 0);
    });

    res.json({
      success: true,
      data: {
        date: queryDate,
        sales: {
          definition: 'Total value of fuel sold based on meter readings',
          totalSaleValue: parseFloat(totalSaleValue.toFixed(2)),
          breakdown: {
            cash: parseFloat(totalCashSales.toFixed(2)),
            online: parseFloat(totalOnlineSales.toFixed(2)),
            credit: parseFloat(totalCreditSales.toFixed(2))
          },
          readingsCount: readings.length,
          basis: 'System calculated from nozzle meters × fuel price'
        },
        settlement: settlement ? {
          definition: 'Physical cash count vs. expected from readings',
          date: settlement.date,
          expectedCash: parseFloat(settlement.expectedCash),
          actualCash: parseFloat(settlement.actualCash),
          variance: parseFloat(settlement.variance),
          variancePercentage: settlement.expectedCash > 0 
            ? parseFloat(((settlement.variance / settlement.expectedCash) * 100).toFixed(2))
            : 0,
          onlineRef: parseFloat(settlement.online),
          creditRef: parseFloat(settlement.credit),
          notes: settlement.notes,
          recordedBy: settlement.recordedBy,
          recordedAt: settlement.recordedAt,
          basis: 'Manager physical count + system readings verification'
        } : null,
        comparison: settlement ? {
          salesVsSettlement: {
            salesCashSales: parseFloat(totalCashSales.toFixed(2)),
            settlementExpectedCash: parseFloat(settlement.expectedCash),
            match: Math.abs(totalCashSales - settlement.expectedCash) < 0.01,
            difference: parseFloat((totalCashSales - settlement.expectedCash).toFixed(2))
          },
          purpose: {
            sales: 'Revenue tracking (what we SOLD)',
            settlement: 'Cash control (what CASH we have)',
            together: 'Complete business visibility and audit trail'
          },
          whyBothNeeded: [
            'Sales shows revenue for accounting and tax',
            'Settlement shows if we collected the cash',
            'Discrepancies indicate issues (theft, counting error, etc)',
            'Variance tracking enables audit trail'
          ]
        } : null
      },
      metadata: {
        persistenceInfo: 'All settlements stored with ACID compliance, sales calculated from readings, payment breakdown aggregated from DailyTransaction (employee tender entries)'
      }
    });

  } catch (error) {
    next(error);
  }
};

// ⭐ DIAGNOSTIC: Show raw database state for debugging orphaned records

exports.getStationDiagnostics = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Query using raw sequelize to bypass any ORM transformations
    const sequelize = Pump.sequelize;
    
    // Get all pumps with raw query
    const rawPumps = await sequelize.query(
      `SELECT * FROM pumps WHERE station_id = :stationId ORDER BY pump_number ASC`,
      { 
        replacements: { stationId },
        type: sequelize.QueryTypes.SELECT 
      }
    );

    // Get all nozzles for these pumps
    let rawNozzles = [];
    if (rawPumps.length > 0) {
      const pumpIds = rawPumps.map(p => p.id).join("','");
      rawNozzles = await sequelize.query(
        `SELECT * FROM nozzles WHERE pump_id IN ('${pumpIds}') ORDER BY pump_id, nozzle_number ASC`,
        { type: sequelize.QueryTypes.SELECT }
      );
    }

    // Get using ORM for comparison
    const ormPumps = await Pump.findAll({
      where: { stationId },
      include: [{ model: Nozzle, as: 'nozzles' }],
      order: [['pumpNumber', 'ASC']],
      raw: true,
      subQuery: false
    });

    res.json({
      success: true,
      station: { id: stationId },
      rawQuery: {
        pumpCount: rawPumps.length,
        pumps: rawPumps,
        nozzleCount: rawNozzles.length,
        nozzles: rawNozzles
      },
      ormQuery: {
        pumpCount: ormPumps.length,
        pumps: ormPumps
      },
      discrepancy: {
        pumpCountMatch: rawPumps.length === ormPumps.length,
        message: rawPumps.length === ormPumps.length ? 
          'Raw and ORM query return same pump count' : 
          `MISMATCH: Raw has ${rawPumps.length} pumps but ORM has ${ormPumps.length}`
      }
    });

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    next(error);
  }
};

/**
 * Get employee shortfall analysis for a station
 * Aggregates employee-wise shortfalls from settlements
 * 
 * Query params:
 *   startDate: YYYY-MM-DD
 *   endDate: YYYY-MM-DD
 */
exports.getEmployeeShortfalls = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate } = req.query;
    const user = req.user;

    // Validate dates first
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'startDate and endDate are required',
        example: 'GET /api/v1/stations/:stationId/employee-shortfalls?startDate=2026-01-01&endDate=2026-01-31'
      });
    }



    // Handle "all" case - get shortfalls for all user's stations
    let stationIds = [stationId];
    
    if (stationId === 'all') {
      let whereClause = { isActive: true };

      // Get stations accessible to this user based on role
      if (user.role === 'super_admin') {
        // Super admin can see all stations
        // No additional filter
      } else if (user.role === 'owner') {
        // Owner can only see stations they own
        whereClause.ownerId = user.id;
      } else if (user.role === 'manager' || user.role === 'employee') {
        // Manager/Employee can only see their assigned station
        if (!user.stationId) {
          return res.json({
            success: true,
            data: [],
            metadata: {
              stationId: 'all',
              dateRange: { startDate, endDate },
              totalEmployeesAffected: 0,
              totalShortfallAmount: 0
            }
          });
        }
        whereClause.id = user.stationId;
      } else {
        // Unknown role
        return res.status(403).json({ success: false, error: 'Invalid user role' });
      }

      const userStations = await Station.findAll({
        where: whereClause,
        attributes: ['id'],
        raw: true
      });

      stationIds = userStations.map(s => s.id);
      
      if (stationIds.length === 0) {
        console.log(`[EmployeeShortfalls] No stations found for user ${user.id} with role ${user.role}`);
        return res.json({
          success: true,
          data: [],
          metadata: {
            stationId: 'all',
            dateRange: { startDate, endDate },
            totalEmployeesAffected: 0,
            totalShortfallAmount: 0
          }
        });
      }
    } else {
      // Check single station access
      if (!(await canAccessStation(user, stationId))) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    // Use the employee shortfalls service to calculate shortfalls
    const allShortfalls = [];
    
    console.log(`[StationController-EmployeeShortfalls] Querying for stationIds:`, stationIds);
    
    for (const sid of stationIds) {
      try {
        const shortfalls = await services.employeeShortfallsService.getEmployeeShortfallsForDateRange({
          stationId: sid,
          startDate,
          endDate
        });
        
        console.log(`[StationController-EmployeeShortfalls] Station ${sid}: Found ${shortfalls.length} employee shortfalls`);
        allShortfalls.push(...shortfalls);
      } catch (error) {
        console.warn(`[EmployeeShortfalls] Error for station ${sid}:`, error.message);
        // Continue processing other stations
      }
    }

    // Merge and aggregate if multiple stations
    let result = allShortfalls;
    if (stationIds.length > 1) {
      const mergedMap = new Map();
      
      allShortfalls.forEach(emp => {
        const key = emp.employeeName;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, {
            employeeName: emp.employeeName,
            employeeId: emp.employeeId,
            totalShortfall: 0,
            daysWithShortfall: new Set(),
            averagePerDay: 0,
            settlementsCount: 0,
            shortfallDates: new Set(),
            lastShortfallDate: null
          });
        }
        
        const merged = mergedMap.get(key);
        merged.totalShortfall += emp.totalShortfall;
        merged.settlementsCount += emp.settlementsCount;
        (emp.shortfallDates || []).forEach(d => merged.shortfallDates.add(d));
        if (emp.lastShortfallDate && (!merged.lastShortfallDate || emp.lastShortfallDate > merged.lastShortfallDate)) {
          merged.lastShortfallDate = emp.lastShortfallDate;
        }
      });
      
      result = Array.from(mergedMap.values()).map(emp => {
        const daysCount = emp.shortfallDates.size;
        return {
          employeeName: emp.employeeName,
          employeeId: emp.employeeId,
          totalShortfall: parseFloat(emp.totalShortfall.toFixed(2)),
          daysWithShortfall: daysCount,
          averagePerDay: daysCount > 0 ? parseFloat((emp.totalShortfall / daysCount).toFixed(2)) : 0,
          settlementsCount: emp.settlementsCount,
          shortfallDates: Array.from(emp.shortfallDates).sort(),
          lastShortfallDate: emp.lastShortfallDate
        };
      });
    }

    // Sort by highest shortfall first
    result.sort((a, b) => b.totalShortfall - a.totalShortfall);

    console.log(`[StationController-EmployeeShortfalls] Final result: ${result.length} employees with shortfalls`);

    res.json({
      success: true,
      data: result,
      metadata: {
        stationId: stationId === 'all' ? 'all' : stationId,
        dateRange: { startDate, endDate },
        totalEmployeesAffected: result.length,
        totalShortfallAmount: parseFloat(
          result.reduce((sum, e) => sum + e.totalShortfall, 0).toFixed(2)
        ),
        calculatedUsing: 'employee-shortfalls-service (from readings analysis)'
      }
    });

  } catch (error) {
    console.error('Employee shortfall error:', error);
    next(error);
  }
};

/**
 * Get employee sales breakdown for a station
 * Aggregates sales by employee, fuel type, and payment method
 * 
 * Query params:
 *   startDate: YYYY-MM-DD
 *   endDate: YYYY-MM-DD
 */
exports.getEmployeeSalesBreakdown = async (req, res, next) => {
  try {
    // Handle both /all/employee-sales (no stationId param) and /:stationId/employee-sales
    let { stationId } = req.params;
    // If no stationId in params, check if this is the /all route
    if (!stationId) {
      stationId = 'all';
    }
    
    const { startDate, endDate } = req.query;
    const user = req.user;

    // Validate dates first
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'startDate and endDate are required',
        example: 'GET /api/v1/stations/:stationId/employee-sales?startDate=2026-02-01&endDate=2026-02-28'
      });
    }



    // Handle "all" case - get sales for all user's stations
    let stationIds = [stationId];
    
    if (stationId === 'all') {
      let whereClause = { isActive: true };

      // Get stations accessible to this user based on role
      if (user.role === 'super_admin') {
        // Super admin can see all stations
        console.log(`[EmployeeSalesBreakdown] Super admin - checking all stations`);
        // No additional filter
      } else if (user.role === 'owner') {
        // Owner can only see stations they own
        whereClause.ownerId = user.id;
        console.log(`[EmployeeSalesBreakdown] Owner (ID: ${user.id}) - filtering by ownerId`);
      } else if (user.role === 'manager' || user.role === 'employee') {
        // Manager/Employee can only see their assigned station
        console.log(`[EmployeeSalesBreakdown] ${user.role.toUpperCase()} requesting all - stationId=${user.stationId}`);
        if (!user.stationId) {
          console.warn(`[EmployeeSalesBreakdown] ${user.role} without stationId assignment - returning empty`);
          return res.json({
            success: true,
            data: [],
            summary: {
              totalEmployees: 0,
              totalSales: 0,
              totalQuantity: 0,
              totalCash: 0,
              totalOnline: 0,
              totalCredit: 0,
              dateRange: { startDate, endDate }
            }
          });
        }
        whereClause.id = user.stationId;
      } else {
        // Unknown role
        return res.status(403).json({ success: false, error: 'Invalid user role' });
      }

      const userStations = await Station.findAll({
        where: whereClause,
        attributes: ['id', 'name'],
        raw: true
      });

      console.log(`[EmployeeSalesBreakdown] Found ${userStations.length} accessible stations:`, userStations.map(s => `${s.id} (${s.name})`));
      
      stationIds = userStations.map(s => s.id);
      
      if (stationIds.length === 0) {
        console.log(`[EmployeeSalesBreakdown] No stations found for user ${user.id} with role ${user.role}`);
        return res.json({
          success: true,
          data: [],
          summary: {
            totalEmployees: 0,
            totalSales: 0,
            totalQuantity: 0,
            totalCash: 0,
            totalOnline: 0,
            totalCredit: 0,
            dateRange: { startDate, endDate }
          }
        });
      }
    } else {
      // Check single station access
      if (!(await canAccessStation(user, stationId))) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    // Fetch sales data for all stations
    const allSalesData = [];
    
    console.log(`[EmployeeSalesBreakdown] Processing ${stationIds.length} station(s) for ${startDate}-${endDate}`);
    
    for (const sid of stationIds) {
      try {
        console.log(`[EmployeeSalesBreakdown] Fetching data for station ${sid}...`);
        const sales = await services.employeeSalesService.getEmployeeSalesBreakdown({
          stationId: sid,
          startDate,
          endDate
        });
        
        console.log(`[EmployeeSalesBreakdown] Station ${sid} returned ${Array.isArray(sales) ? sales.length : 'invalid'} employee records`);
        if (sales && Array.isArray(sales) && sales.length > 0) {
          console.log(`[EmployeeSalesBreakdown] Adding ${sales.length} records from station ${sid}`);
          allSalesData.push(...sales);
        }
      } catch (error) {
        console.error(`[EmployeeSalesBreakdown] Error fetching data for station ${sid}:`, error.message);
      }
    }

    console.log(`[EmployeeSalesBreakdown] Total accumulated: ${allSalesData.length} employee records across all stations`);

    // Merge data if multiple stations
    let result = allSalesData;
    if (stationIds.length > 1) {
      const mergedMap = new Map();
      
      allSalesData.forEach(emp => {
        const key = emp.employeeName;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, {
            employeeId: emp.employeeId,
            employeeName: emp.employeeName,
            totalSales: 0,
            totalQuantity: 0,
            totalCash: 0,
            totalOnline: 0,
            totalCredit: 0,
            totalTransactions: 0,
            byFuelType: new Map(),
            lastActivityDate: null
          });
        }
        
        const merged = mergedMap.get(key);
        merged.totalSales += emp.totalSales;
        merged.totalQuantity += emp.totalQuantity;
        merged.totalCash += emp.totalCash;
        merged.totalOnline += emp.totalOnline;
        merged.totalCredit += emp.totalCredit;
        merged.totalTransactions += emp.totalTransactions;
        
        if (!merged.lastActivityDate || emp.lastActivityDate > merged.lastActivityDate) {
          merged.lastActivityDate = emp.lastActivityDate;
        }

        // Merge fuel types
        emp.byFuelType.forEach(fuel => {
          const fuelKey = fuel.fuelType;
          if (!merged.byFuelType.has(fuelKey)) {
            merged.byFuelType.set(fuelKey, {
              fuelType: fuel.fuelType,
              quantity: 0,
              saleValue: 0,
              cashAmount: 0,
              onlineAmount: 0,
              creditAmount: 0,
              transactionCount: 0
            });
          }
          
          const mergedFuel = merged.byFuelType.get(fuelKey);
          mergedFuel.quantity += fuel.quantity;
          mergedFuel.saleValue += fuel.saleValue;
          mergedFuel.cashAmount += fuel.cashAmount;
          mergedFuel.onlineAmount += fuel.onlineAmount;
          mergedFuel.creditAmount += fuel.creditAmount;
          mergedFuel.transactionCount += fuel.transactionCount;
        });
      });
      
      result = Array.from(mergedMap.values()).map(emp => {
        const avgTxn = emp.totalTransactions > 0 
          ? emp.totalSales / emp.totalTransactions 
          : 0;

        const byFuelType = Array.from(emp.byFuelType.values()).map(fuel => ({
          fuelType: fuel.fuelType,
          quantity: parseFloat(fuel.quantity.toFixed(3)),
          saleValue: parseFloat(fuel.saleValue.toFixed(2)),
          cashAmount: parseFloat(fuel.cashAmount.toFixed(2)),
          onlineAmount: parseFloat(fuel.onlineAmount.toFixed(2)),
          creditAmount: parseFloat(fuel.creditAmount.toFixed(2)),
          transactionCount: fuel.transactionCount,
          averageTransactionValue: fuel.transactionCount > 0
            ? parseFloat((fuel.saleValue / fuel.transactionCount).toFixed(2))
            : 0
        })).sort((a, b) => b.saleValue - a.saleValue);

        return {
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          totalSales: parseFloat(emp.totalSales.toFixed(2)),
          totalQuantity: parseFloat(emp.totalQuantity.toFixed(3)),
          totalCash: parseFloat(emp.totalCash.toFixed(2)),
          totalOnline: parseFloat(emp.totalOnline.toFixed(2)),
          totalCredit: parseFloat(emp.totalCredit.toFixed(2)),
          totalTransactions: emp.totalTransactions,
          averageTransaction: parseFloat(avgTxn.toFixed(2)),
          byFuelType,
          lastActivityDate: emp.lastActivityDate
        };
      });
    }

    // Calculate summary
    const summary = {
      totalEmployees: result.length,
      totalSales: parseFloat(result.reduce((sum, e) => sum + e.totalSales, 0).toFixed(2)),
      totalQuantity: parseFloat(result.reduce((sum, e) => sum + e.totalQuantity, 0).toFixed(3)),
      totalCash: parseFloat(result.reduce((sum, e) => sum + e.totalCash, 0).toFixed(2)),
      totalOnline: parseFloat(result.reduce((sum, e) => sum + e.totalOnline, 0).toFixed(2)),
      totalCredit: parseFloat(result.reduce((sum, e) => sum + e.totalCredit, 0).toFixed(2)),
      dateRange: { startDate, endDate }
    };

    res.json({
      success: true,
      data: result,
      summary
    });

  } catch (error) {
    console.error('Employee sales breakdown error:', error);
    next(error);
  }
};

/**
 * Get all expenses across all accessible stations
 * GET /api/v1/stations/all/expenses?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 
 * Returns expenses from all stations accessible to the user based on their role:
 * - super_admin: All stations
 * - owner: Stations they own
 * - manager/employee: Only their assigned station
 */
exports.getAllExpenses = async (req, res, next) => {
  try {
    const { startDate, endDate, category, frequency, approvalStatus, page = 1, limit = 50 } = req.query;
    const user = req.user;

    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
        example: 'GET /api/v1/stations/all/expenses?startDate=2026-02-01&endDate=2026-02-28'
      });
    }



    // Determine which stations user can access
    let stationIds = [];
    let whereClause = { isActive: true };

    if (user.role === 'super_admin') {
      // Super admin can see all stations
      console.log('[getAllExpenses] Super admin - querying all stations');
    } else if (user.role === 'owner') {
      // Owner can only see stations they own
      whereClause.ownerId = user.id;
      console.log(`[getAllExpenses] Owner ${user.id} - filtering by ownerId`);
    } else if (user.role === 'manager' || user.role === 'employee') {
      // Manager/Employee can only see their assigned station
      if (!user.stationId) {
        console.warn(`[getAllExpenses] ${user.role} without stationId assignment`);
        return res.json({
          success: true,
          data: [],
          summary: {
            totalExpenses: 0,
            approvedTotal: 0,
            pendingTotal: 0,
            dateRange: { startDate, endDate }
          }
        });
      }
      whereClause.id = user.stationId;
      console.log(`[getAllExpenses] ${user.role} - assigned to station ${user.stationId}`);
    } else {
      return res.status(403).json({ success: false, error: 'Invalid user role' });
    }

    // Get all accessible stations
    const stations = await Station.findAll({
      where: whereClause,
      attributes: ['id', 'name'],
      raw: true
    });

    stationIds = stations.map(s => s.id);
    console.log(`[getAllExpenses] Found ${stationIds.length} accessible stations`);

    if (stationIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: {
          totalExpenses: 0,
          approvedTotal: 0,
          pendingTotal: 0,
          dateRange: { startDate, endDate }
        }
      });
    }

    // Build expense query where clause
    const expenseWhere = {
      stationId: { [Op.in]: stationIds },
      expenseDate: { [Op.between]: [startDate, endDate] }
    };

    if (category) expenseWhere.category = category;
    if (frequency) expenseWhere.frequency = frequency;
    if (approvalStatus) expenseWhere.approvalStatus = approvalStatus;

    const offset = (page - 1) * limit;

    // Fetch expenses with pagination
    const { count, rows: expenses } = await ExpenseModel.findAndCountAll({
      where: expenseWhere,
      include: [
        { model: UserModel, as: 'enteredByUser', attributes: ['id', 'name', 'role'] },
        { model: UserModel, as: 'approvedByUser', attributes: ['id', 'name', 'role'], required: false },
        { model: Station, as: 'station', attributes: ['id', 'name'], required: false }
      ],
      order: [['expenseDate', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Fix any data inconsistencies where approvedBy is set but status is still pending
    // (legacy records created before auto-approval logic was added)
    for (const expense of expenses) {
      if (expense && expense.approvedBy && expense.approvalStatus === 'pending') {
        expense.approvalStatus = 'auto_approved';
        await expense.save();
      }
    }

    // Calculate totals (run AFTER the fix loop so corrected statuses are reflected)
    const approvedTotal = await ExpenseModel.sum('amount', {
      where: {
        ...expenseWhere,
        approvalStatus: { [Op.in]: ['approved', 'auto_approved'] }
      }
    });
    const pendingTotal = await ExpenseModel.sum('amount', {
      where: {
        ...expenseWhere,
        approvalStatus: 'pending'
      }
    });

    // Breakdown by category
    const byCategory = await ExpenseModel.findAll({
      attributes: ['category', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
      where: {
        ...expenseWhere,
        approvalStatus: { [Op.in]: ['approved', 'auto_approved'] }
      },
      group: ['category'],
      raw: true
    });

    // Breakdown by frequency
    const byFrequency = await ExpenseModel.findAll({
      attributes: ['frequency', [sequelize.fn('SUM', sequelize.col('amount')), 'total'], [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: {
        ...expenseWhere,
        approvalStatus: { [Op.in]: ['approved', 'auto_approved'] }
      },
      group: ['frequency'],
      raw: true
    });

    res.json({
      success: true,
      data: expenses,
      summary: {
        totalExpenses: count,
        approvedTotal: approvedTotal || 0,
        pendingTotal: pendingTotal || 0,
        total: approvedTotal || 0,
        byCategory,
        byFrequency,
        dateRange: { startDate, endDate },
        stationsIncluded: stationIds.length
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('[getAllExpenses] Error:', error);
    next(error);
  }
};
