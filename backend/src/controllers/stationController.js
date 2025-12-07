/**
 * Station Controller
 * Station, Pump, and Nozzle management
 * 
 * MULTI-STATION SUPPORT:
 * - Owner can have multiple stations
 * - Station.ownerId links to owner User
 * - Staff have User.stationId for their assigned station
 */

const { Station, Pump, Nozzle, User, FuelPrice, Plan, NozzleReading, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');

console.log('[INIT] stationController loaded');

// ============================================
// HELPER: Check if user can access station
// ============================================
const canAccessStation = async (user, stationId) => {
  console.log(`🔐 canAccessStation check - userId: ${user?.id}, role: ${user?.role}, stationId: ${stationId}`);
  
  if (user.role === 'super_admin') {
    console.log(`✅ super_admin can access any station`);
    return true;
  }
  
  if (user.role === 'owner') {
    // Owner can access stations they own
    const station = await Station.findByPk(stationId);
    console.log(`🔍 Station lookup - Found: ${!!station}, Owner: ${station?.ownerId}, UserID: ${user.id}, Match: ${station?.ownerId === user.id}`);
    
    if (!station) {
      console.log(`❌ Station ${stationId} not found`);
      return false;
    }
    
    const isOwner = station.ownerId === user.id;
    if (!isOwner) {
      console.log(`❌ User ${user.id} is not owner of station ${stationId}. Station owner: ${station.ownerId}`);
    } else {
      console.log(`✅ User ${user.id} is owner of station ${stationId}`);
    }
    
    return isOwner;
  }
  
  // Manager/Employee can only access their assigned station
  const canAccess = user.stationId === stationId;
  console.log(`🔍 Manager/Employee check - userStationId: ${user.stationId}, requestStationId: ${stationId}, canAccess: ${canAccess}`);
  return canAccess;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stationIds = stations.map(s => s.id);
    const todaySalesData = await NozzleReading.findAll({
      attributes: [
        'stationId',
        [fn('SUM', col('total_amount')), 'todaySales']
      ],
      where: {
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.gte]: today
        }
      },
      group: ['stationId'],
      raw: true
    });

    // Create a map of stationId to todaySales
    const todaySalesMap = new Map();
    todaySalesData.forEach(item => {
      todaySalesMap.set(item.stationId, parseFloat(item.todaySales || 0));
    });

    // Aggregate latest cached nozzle reading per station (use denormalized Nozzle.lastReading)
    let lastReadingMap = new Map();
    if (stationIds.length > 0) {
      const nozzleLastReadings = await Nozzle.findAll({
        where: { stationId: { [Op.in]: stationIds } },
        attributes: [
          'stationId',
          [fn('MAX', col('last_reading_date')), 'lastReadingDate'],
          [fn('MAX', col('last_reading')), 'lastReading']
        ],
        group: ['stationId'],
        raw: true
      });

      nozzleLastReadings.forEach(item => {
        lastReadingMap.set(item.stationId, item.lastReading != null ? parseFloat(item.lastReading) : null);
      });
    }

    res.json({
      success: true,
      data: stations.map(s => ({
        ...s.toJSON(),
        pumpCount: s.pumps?.length || 0,
        activePumps: s.pumps?.filter(p => p.status === 'active').length || 0,
        todaySales: todaySalesMap.get(s.id) || 0,
        lastReading: lastReadingMap.get(s.id) || null
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
    console.log('🔍 RAW REQUEST BODY:', req.body);
    console.log('🔍 Request body keys:', Object.keys(req.body));
    console.log('🔍 Request body entries:', Object.entries(req.body));
    
    const { name, address, city, state, pincode, phone, email, gstNumber, ownerId, currentPlanId } = req.body;
    const user = await User.findByPk(req.userId, { include: [{ model: Plan, as: 'plan' }] });

    console.log('🔍 Station creation request:');
    console.log('  - User role:', user.role);
    console.log('  - name received:', name);
    console.log('  - phone received:', phone);
    console.log('  - ownerId received:', ownerId);
    console.log('  - ownerId type:', typeof ownerId);
    console.log('  - ownerId === undefined?', ownerId === undefined);
    console.log('  - ownerId === null?', ownerId === null);
    console.log('  - Full body:', JSON.stringify(req.body, null, 2));

    if (!name) {
      return res.status(400).json({ success: false, error: 'Station name is required' });
    }
    
    // Determine the owner
    let stationOwnerId;
    if (user.role === 'super_admin') {
      // Super admin must provide ownerId
      if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
        console.error('❌ Station creation failed: Invalid ownerId');
        console.error('   ownerId value:', ownerId);
        console.error('   Request body:', req.body);
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

    // Perform plan limit check and creation in a transaction to avoid races
    const t = await sequelize.transaction();
    try {
      const ownerWithPlan = await User.findByPk(stationOwnerId, { include: [{ model: Plan, as: 'plan' }], transaction: t });
      console.log('[PLANCHECK] createStation ownerId=', stationOwnerId, 'plan=', ownerWithPlan?.plan?.name, 'maxStations=', ownerWithPlan?.plan?.maxStations);
      
      // Validate that the currentPlanId matches the owner's actual plan
      if (currentPlanId && ownerWithPlan?.planId !== currentPlanId) {
        console.log('[PLANCHECK] Plan ID mismatch: owner has', ownerWithPlan?.planId, 'but client sent', currentPlanId);
        await t.rollback();
        return res.status(400).json({
          success: false,
          error: 'Plan validation failed. Owner\'s current plan does not match the provided plan ID.'
        });
      }
      
      const stationCount = await Station.count({ where: { ownerId: stationOwnerId }, transaction: t });
      console.log('[PLANCHECK] createStation currentStationCount=', stationCount);
      if (ownerWithPlan && ownerWithPlan.plan && ownerWithPlan.plan.maxStations != null) {
        if ((stationCount + 1) > ownerWithPlan.plan.maxStations) {
          console.log('[PLANCHECK] Blocking createStation: limit reached');
          await t.rollback();
          return res.status(403).json({
            success: false,
            error: `Plan limit reached. Your ${ownerWithPlan.plan.name} plan allows ${ownerWithPlan.plan.maxStations} station(s). You currently have ${stationCount}.`,
            planLimitExceeded: true
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

      // Post-create verification (still inside transaction)
      const stationCountPost = await Station.count({ where: { ownerId: stationOwnerId }, transaction: t });
      if (ownerWithPlan && ownerWithPlan.plan && ownerWithPlan.plan.maxStations != null && stationCountPost > ownerWithPlan.plan.maxStations) {
        console.log('[PLANCHECK] Rolling back station create: would exceed plan after create', stationCountPost, ownerWithPlan.plan.maxStations);
        await t.rollback();
        return res.status(403).json({ success: false, error: 'Plan limit exceeded after creation attempt', planLimitExceeded: true });
      }

      await t.commit();
      res.status(201).json({ success: true, data: station, message: 'Station created successfully' });
    } catch (err) {
      console.error('Error while creating station inside transaction:', err);
      try { await t.rollback(); } catch (e) { /* ignore */ }
      return res.status(500).json({ success: false, error: 'Internal server error' });
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySalesResult = await NozzleReading.findOne({
      attributes: [[fn('SUM', col('total_amount')), 'todaySales']],
      where: {
        stationId: id,
        readingDate: { [Op.gte]: today }
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

    await station.update(updates);
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
          attributes: ['id', 'nozzleNumber', 'fuelType', 'status', 'lastReading', 'lastReadingDate'],
          order: [['nozzleNumber', 'ASC']],
          raw: true
        });
        return {
          ...pump.toJSON(),
          nozzles
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
  let t;
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

    // Start transaction
    t = await sequelize.transaction();
    console.log(`🔧 Transaction started for pump creation`);

    // Declare finalPumpNumber variable
    let finalPumpNumber = null;
    let pump = null;

    // Validate request body
    if (pumpNumber !== undefined && pumpNumber !== null && pumpNumber !== '') {
      const num = parseInt(pumpNumber);
      if (isNaN(num) || num < 1) {
        await t.rollback();
        return res.status(400).json({ success: false, error: 'Pump number must be a positive integer' });
      }
      finalPumpNumber = num;
    }

    if (name && typeof name !== 'string') {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Pump name must be a string' });
    }

    if (notes && typeof notes !== 'string') {
      await t.rollback();
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
          }, { transaction: t });

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
        await t.rollback();
        return res.status(500).json({ success: false, error: 'Could not generate unique pump number' });
      }
    } else {
      console.log(`🔧 Using provided pump number: ${finalPumpNumber}`);
      // Check if pump with this number already exists
      const existingPump = await Pump.findOne({ where: { stationId, pumpNumber: finalPumpNumber }, transaction: t });

      if (existingPump) {
        await t.rollback();
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
      }, { transaction: t });
    }

    // Post-create verification
    const pumpCountPost = await Pump.count({ where: { stationId }, transaction: t });
    if (ownerId) {
      const owner = await User.findByPk(ownerId, { include: [{ model: Plan, as: 'plan' }], transaction: t });
      if (owner && owner.plan && owner.plan.maxPumpsPerStation != null && pumpCountPost > owner.plan.maxPumpsPerStation) {
        console.log('[PLANCHECK] Rolling back pump create: would exceed plan after create', pumpCountPost, owner.plan.maxPumpsPerStation);
        await t.rollback();
        return res.status(403).json({ success: false, error: 'Plan limit exceeded after creation attempt', planLimitExceeded: true });
      }
    }

    await t.commit();

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

    // Try to rollback transaction if it exists
    if (t) {
      try {
        await t.rollback();
        console.log(`🔧 Transaction rolled back`);
      } catch (rollbackError) {
        console.error(`❌ Failed to rollback transaction:`, rollbackError.message);
      }
    }

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
  const t = await sequelize.transaction();
  let owner = null;
  try {
    const { pumpId } = req.params;
    const { fuelType, initialReading, notes, nozzleNumber } = req.body;

    console.log(`🔍 Creating nozzle - pumpId: ${pumpId}, fuelType: ${fuelType}`);

    const pump = await Pump.findByPk(pumpId, { transaction: t });
    if (!pump) { await t.rollback(); return res.status(404).json({ success: false, error: 'Pump not found' }); }

    const user = await User.findByPk(req.userId, { transaction: t });
    // Check station access
    if (!(await canAccessStation(user, pump.stationId))) { await t.rollback(); return res.status(403).json({ success: false, error: 'Access denied' }); }

    // Defensive transactional plan check: ensure pump's owner plan allows another nozzle
    try {
      const pumpRecord = await Pump.findByPk(pumpId, { include: [{ model: Station, as: 'station' }], transaction: t });
      const ownerId = pumpRecord?.station?.ownerId || pumpRecord?.stationId && (await Station.findByPk(pumpRecord.stationId, { transaction: t }))?.ownerId;
      console.log('[PLANCHECK] createNozzle pumpId=', pumpId, 'ownerId=', ownerId);
      if (ownerId) {
        owner = await User.findByPk(ownerId, { include: [{ model: Plan, as: 'plan' }], transaction: t });
        console.log('[PLANCHECK] createNozzle ownerPlan=', owner?.plan?.name, 'maxNozzlesPerPump=', owner?.plan?.maxNozzlesPerPump);
        if (owner && owner.plan && owner.plan.maxNozzlesPerPump) {
          const nozzleCount = await Nozzle.count({ where: { pumpId }, transaction: t });
          console.log('[PLANCHECK] createNozzle nozzleCount=', nozzleCount);
          if ((nozzleCount + 1) > owner.plan.maxNozzlesPerPump) {
            await t.rollback();
            return res.status(403).json({
              success: false,
              error: `Plan limit reached. Your ${owner.plan.name} plan allows ${owner.plan.maxNozzlesPerPump} nozzle(s) per pump. This pump has ${nozzleCount}.`,
              planLimitExceeded: true
            });
          }
        }
      }
    } catch (err) {
      console.error('Error while checking nozzle plan limits:', err);
    }

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
          }, { transaction: t });

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
      }, { transaction: t });
    }

    // Post-create verification
    const nozzleCountPost = await Nozzle.count({ where: { pumpId }, transaction: t });
    if (owner && owner.plan && owner.plan.maxNozzlesPerPump != null && nozzleCountPost > owner.plan.maxNozzlesPerPump) {
      console.log('[PLANCHECK] Rolling back nozzle create: would exceed plan after create', nozzleCountPost, owner.plan.maxNozzlesPerPump);
      await t.rollback();
      return res.status(403).json({ success: false, error: 'Plan limit exceeded after creation attempt', planLimitExceeded: true });
    }

    await t.commit();

    console.log(`✅ NOZZLE CREATED - ID: ${nozzle.id}, Number: ${nozzle.nozzleNumber}, Pump: ${pumpId}`);
    res.status(201).json({ success: true, data: nozzle });

  } catch (error) {
    try { await t.rollback(); } catch (e) { /* ignore */ }
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
      order: [['fuelType', 'ASC'], ['effectiveFrom', 'DESC']]
    });

    // Group by fuel type, take latest
    const currentPrices = {};
    prices.forEach(p => {
      if (!currentPrices[p.fuelType]) {
        currentPrices[p.fuelType] = p;
      }
    });

    res.json({
      success: true,
      data: {
        current: Object.values(currentPrices),
        history: prices
      },
      fuelPrices: {
        current: Object.values(currentPrices),
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
    const { fuelType, price, effectiveFrom } = req.body;
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

    const fuelPrice = await FuelPrice.create({
      stationId,
      fuelType,
      price: numericPrice,
      effectiveFrom: effectiveFrom || new Date().toISOString().split('T')[0],
      updatedBy: req.userId
    });

    res.status(201).json({
      success: true,
      data: fuelPrice,
      message: `${fuelType} price set to ₹${price}`
    });

  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        success: false, 
        error: 'Price already set for this fuel type on this date' 
      });
    }
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

    const validFuelTypes = ['petrol', 'diesel'];
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
        readingDate: queryDate
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

    readings.forEach(reading => {
      const saleValue = parseFloat(reading.totalAmount || 0);
      const liters = parseFloat(reading.litresSold || 0);
      const fuelType = reading.fuelType || reading.Nozzle?.fuelType || 'unknown';
      let cash = parseFloat(reading.cashAmount || 0);
      let online = parseFloat(reading.onlineAmount || 0);
      let credit = parseFloat(reading.creditAmount || 0);

      console.log(`[DEBUG] Reading ${reading.id}: totalAmount=${reading.totalAmount}, cashAmount=${reading.cashAmount}, onlineAmount=${reading.onlineAmount}, creditAmount=${reading.creditAmount}`);
      console.log(`[DEBUG] Reading ${reading.id}: cashAmount type=${typeof reading.cashAmount}, value=${reading.cashAmount}`);

      // Handle legacy readings where payment amounts weren't set or are null - default to cash
      const cashIsZeroOrNull = reading.cashAmount === null || reading.cashAmount === undefined || parseFloat(reading.cashAmount || 0) === 0;
      const onlineIsZeroOrNull = reading.onlineAmount === null || reading.onlineAmount === undefined || parseFloat(reading.onlineAmount || 0) === 0;
      const creditIsZeroOrNull = reading.creditAmount === null || reading.creditAmount === undefined || parseFloat(reading.creditAmount || 0) === 0;
      
      if (cashIsZeroOrNull && onlineIsZeroOrNull && creditIsZeroOrNull && saleValue > 0) {
        cash = saleValue;
        console.log(`[DEBUG] Defaulting reading ${reading.id} to cash: ₹${cash} (all payments are zero/null)`);
      }

      console.log(`[DEBUG] Final payment breakdown for reading ${reading.id}: cash=${cash}, online=${online}, credit=${credit}`);

      totalSaleValue += saleValue;
      totalLiters += liters;
      totalCash += cash;
      totalOnline += online;
      totalCredit += credit;

      if (!byFuelType[fuelType]) {
        byFuelType[fuelType] = { liters: 0, value: 0 };
      }
      byFuelType[fuelType].liters += liters;
      byFuelType[fuelType].value += saleValue;

      readingsList.push({
        id: reading.id,
        nozzleNumber: reading.Nozzle?.nozzleNumber,
        fuelType,
        liters,
        saleValue
      });
    });

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
 * Record daily settlement
 * POST /stations/:stationId/settlements
 */
exports.recordSettlement = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { date, actualCash, expectedCash, variance, notes } = req.body;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const settlementDate = date || new Date().toISOString().split('T')[0];

    // For now, just record the intent and return success
    // This will be stored once the settlements table is created
    res.json({
      success: true,
      data: {
        id: `settlement_${stationId}_${settlementDate}_${Date.now()}`,
        stationId,
        date: settlementDate,
        actualCash: parseFloat(actualCash || 0),
        expectedCash: parseFloat(expectedCash || 0),
        variance: parseFloat(variance || 0),
        notes: notes || '',
        recordedBy: user.id,
        recordedAt: new Date().toISOString(),
        status: 'recorded'
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get settlement history for a station
 * GET /stations/:stationId/settlements?limit=5
 */
exports.getSettlements = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { limit = 5 } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // For now return empty array until settlements table is created
    res.json({
      success: true,
      data: [],
      message: 'Settlement history feature coming soon'
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
