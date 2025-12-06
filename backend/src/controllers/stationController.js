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
    
    const { name, address, city, state, pincode, phone, email, gstNumber, ownerId } = req.body;
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
      const ownerStationsCount = stationCount; // already computed in transaction
      const namePrefix = owner.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
      let stationCode = (req.body.code && String(req.body.code).trim()) ? String(req.body.code).trim() : `${namePrefix}${String(ownerStationsCount + 1).padStart(3, '0')}`;

      // Ensure uniqueness only AFTER plan-limit check (within transaction)
      let codeExists = await Station.findOne({ where: { code: stationCode }, transaction: t });
      console.log('[PLANCHECK] createStation codeExists=', !!codeExists, 'stationCode=', stationCode, 'clientProvided=', !!req.body.code);
      if (codeExists) {
        // If client explicitly provided a code that already exists, reject
        if (req.body.code && String(req.body.code).trim() === stationCode) {
          console.log('[PLANCHECK] createStation rejecting: client provided duplicate code=', stationCode);
          await t.rollback();
          return res.status(403).json({
            success: false,
            error: 'Provided station code already exists and cannot be used',
            planLimitExceeded: false
          });
        }

        // Otherwise fallback to generating a new unique code
        let counter = ownerStationsCount + 2;
        let fallback = `${namePrefix}${String(counter).padStart(3, '0')}`;
        while (await Station.findOne({ where: { code: fallback }, transaction: t })) {
          counter++;
          fallback = `${namePrefix}${String(counter).padStart(3, '0')}`;
        }
        console.log('[PLANCHECK] createStation falling back to code=', fallback);
        stationCode = fallback;
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

    console.log(`📋 GET PUMPS - Station: ${stationId}, User: ${user?.id}, Role: ${user?.role}, UserId from req: ${req.userId}`);
    console.log(`📋 Full user object:`, { id: user?.id, role: user?.role, stationId: user?.stationId });

    // Check station access using helper
    const hasAccess = await canAccessStation(user, stationId);
    console.log(`📋 canAccessStation result:`, hasAccess);
    
    if (!hasAccess) {
      // Get the station to provide better error info
      const station = await Station.findByPk(stationId);
      console.log(`❌ ACCESS DENIED for user ${user?.id} to station ${stationId}. Station exists: ${!!station}, StationOwner: ${station?.ownerId}`);
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied',
        details: {
          userRole: user?.role,
          userId: user?.id,
          userStationId: user?.stationId,
          requestedStationId: stationId,
          stationExists: !!station,
          stationOwnerId: station?.ownerId
        }
      });
    }

    // ⭐ DEBUG: Get ALL pumps first to see what's in DB
    const allPumpsRaw = await Pump.findAll({
      where: { stationId },
      raw: true
    });
    console.log(`📊 ALL PUMPS IN DB FOR STATION (raw): ${allPumpsRaw.length}`);
    allPumpsRaw.forEach(p => {
      console.log(`  - Pump: ID=${p.id}, Number=${p.pump_number}, Name=${p.name}, Status=${p.status}, Created=${p.created_at}`);
    });

    const pumps = await Pump.findAll({
      where: { stationId },
      include: [{
        model: Nozzle,
        as: 'nozzles',
        attributes: ['id', 'nozzleNumber', 'fuelType', 'status', 'lastReading', 'lastReadingDate']
      }],
      order: [['pumpNumber', 'ASC']]
    });

    console.log(`📋 FOUND ${pumps.length} PUMPS in station ${stationId}`);
    res.json({ success: true, data: pumps, pumps, debugAllPumpsInDb: allPumpsRaw });

  } catch (error) {
    next(error);
  }
};

exports.createPump = async (req, res, next) => {
  const t = await sequelize.transaction();
  let owner = null; // owner will be resolved inside transactional check
  try {
    const { stationId } = req.params;
    const { name, pumpNumber, notes } = req.body;
    const user = req.user;

    // Normalize pumpNumber to integer
    const normalizedPumpNumber = parseInt(pumpNumber, 10);
    console.log(`🔧 CREATE PUMP - Station: ${stationId}, Pump#: ${normalizedPumpNumber} (input: ${pumpNumber}), User: ${user.id}`);

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      await t.rollback();
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // ⭐ CHECK FOR DUPLICATE PUMP NUMBER BEFORE ATTEMPTING CREATE
    console.log(`🔎 Checking for duplicate pump - stationId: ${stationId}, pumpNumber: ${normalizedPumpNumber}`);
    const existingPump = await Pump.findOne({ where: { stationId, pumpNumber: normalizedPumpNumber }, transaction: t });
    if (existingPump) {
      console.log(`⚠️  PUMP ALREADY EXISTS - ID: ${existingPump.id}, Name: ${existingPump.name}, Status: ${existingPump.status}, Created: ${existingPump.createdAt}, Updated: ${existingPump.updatedAt}`);
      
      // Also check what getPumps would return
      const allPumpsInStation = await Pump.findAll({ where: { stationId }, transaction: t });
      console.log(`📊 Total pumps in station (from findAll): ${allPumpsInStation.length}`);
      allPumpsInStation.forEach(p => {
        console.log(`  - Pump: ID=${p.id}, Number=${p.pumpNumber}, Name=${p.name}, Status=${p.status}`);
      });
      
      await t.rollback();
      return res.status(409).json({ 
        success: false, 
        error: `Pump number ${normalizedPumpNumber} already exists in this station (ID: ${existingPump.id})`,
        existingPump: {
          id: existingPump.id,
          pumpNumber: existingPump.pumpNumber,
          name: existingPump.name,
          status: existingPump.status,
          createdAt: existingPump.createdAt,
          updatedAt: existingPump.updatedAt
        },
        allPumpsInStation: allPumpsInStation.map(p => ({ id: p.id, number: p.pumpNumber, name: p.name, status: p.status }))
      });
    }

    // Defensive transactional plan check: verify owner's plan allows another pump for this station
    try {
      const station = await Station.findByPk(stationId, { transaction: t });
      const ownerId = station?.ownerId;
      if (ownerId) {
        owner = await User.findByPk(ownerId, { include: [{ model: Plan, as: 'plan' }], transaction: t });
        if (owner && owner.plan && owner.plan.maxPumpsPerStation) {
          const pumpCount = await Pump.count({ where: { stationId }, transaction: t });
          console.log('[PLANCHECK] createPump pumpCount=', pumpCount, 'planLimit=', owner.plan.maxPumpsPerStation);
          if ((pumpCount + 1) > owner.plan.maxPumpsPerStation) {
            await t.rollback();
            return res.status(403).json({
              success: false,
              error: `Plan limit reached. Your ${owner.plan.name} plan allows ${owner.plan.maxPumpsPerStation} pump(s) per station. This station has ${pumpCount}.`,
              planLimitExceeded: true
            });
          }
        }
      }
    } catch (err) {
      console.error('Error while checking pump plan limits:', err);
    }

    const pump = await Pump.create({ stationId, name: name || `Pump ${normalizedPumpNumber}`, pumpNumber: normalizedPumpNumber, notes }, { transaction: t });

    // Post-create verification
    const pumpCountPost = await Pump.count({ where: { stationId }, transaction: t });
    if (owner && owner.plan && owner.plan.maxPumpsPerStation != null && pumpCountPost > owner.plan.maxPumpsPerStation) {
      console.log('[PLANCHECK] Rolling back pump create: would exceed plan after create', pumpCountPost, owner.plan.maxPumpsPerStation);
      await t.rollback();
      return res.status(403).json({ success: false, error: 'Plan limit exceeded after creation attempt', planLimitExceeded: true });
    }

    await t.commit();

    console.log(`✅ PUMP CREATED - ID: ${pump.id}, Number: ${pump.pumpNumber}`);
    res.status(201).json({ success: true, data: pump });

  } catch (error) {
    console.error(`❌ CREATE PUMP ERROR - Station: ${req.params.stationId}, Pump#: ${req.body.pumpNumber}`, error.message);
    try { await t.rollback(); } catch (e) { /* ignore */ }
    if (error.name === 'SequelizeUniqueConstraintError') {
      // Composite unique constraint on (station_id, pump_number)
      return res.status(409).json({ 
        success: false, 
        error: `Pump number ${parseInt(req.body.pumpNumber, 10)} already exists in this station` 
      });
    }
    next(error);
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
    const { nozzleNumber, fuelType, initialReading, notes } = req.body;

    console.log(`🔍 Creating nozzle - pumpId: ${pumpId}, nozzleNumber: ${nozzleNumber} (type: ${typeof nozzleNumber}), fuelType: ${fuelType}`);

    const pump = await Pump.findByPk(pumpId, { transaction: t });
    if (!pump) { await t.rollback(); return res.status(404).json({ success: false, error: 'Pump not found' }); }

    const user = await User.findByPk(req.userId, { transaction: t });
    // Check station access
    if (!(await canAccessStation(user, pump.stationId))) { await t.rollback(); return res.status(403).json({ success: false, error: 'Access denied' }); }

    // ⭐ CHECK FOR DUPLICATE NOZZLE NUMBER BEFORE ATTEMPTING CREATE
    // Ensure nozzleNumber is an integer
    const normalizedNozzleNumber = parseInt(nozzleNumber, 10);
    console.log(`🔎 Checking for duplicate - pumpId: ${pumpId}, nozzleNumber: ${normalizedNozzleNumber}`);
    
    const existingNozzle = await Nozzle.findOne({ 
      where: { 
        pumpId, 
        nozzleNumber: normalizedNozzleNumber 
      }, 
      transaction: t 
    });
    
    console.log(`📊 findOne result: ${existingNozzle ? 'FOUND' : 'NOT FOUND'}`);
    if (existingNozzle) {
      await t.rollback();
      console.log(`⚠️  NOZZLE ALREADY EXISTS - ID: ${existingNozzle.id}, Nozzle#: ${existingNozzle.nozzleNumber}, Pump#: ${pumpId}`);
      return res.status(409).json({ 
        success: false, 
        error: `Nozzle number ${normalizedNozzleNumber} already exists on this pump (ID: ${existingNozzle.id})`,
        existingNozzle: {
          id: existingNozzle.id,
          nozzleNumber: existingNozzle.nozzleNumber,
          fuelType: existingNozzle.fuelType,
          createdAt: existingNozzle.createdAt
        }
      });
    }

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

    const nozzle = await Nozzle.create({ pumpId, stationId: pump.stationId, nozzleNumber: normalizedNozzleNumber, fuelType, initialReading: initialReading != null ? initialReading : 0, notes }, { transaction: t });

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
      return res.status(409).json({ success: false, error: 'Nozzle number already exists on this pump' });
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
      const fuelType = reading.Nozzle?.fuelType || 'unknown';
      const cash = parseFloat(reading.cashAmount || 0);
      const online = parseFloat(reading.onlineAmount || 0);
      const credit = parseFloat(reading.creditAmount || 0);

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
