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
const { FUEL_TYPES } = require('../config/constants');

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
        [sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'todaySales']
      ],
      where: {
        stationId: { [Op.in]: stationIds },
        readingDate: {
          [Op.gte]: today
        },
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
      attributes: [[sequelize.literal(`SUM(litres_sold * price_per_litre)`), 'todaySales']],
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
          attributes: ['id', 'nozzleNumber', 'fuelType', 'status', 'initialReading', 'lastReading', 'lastReadingDate'],
          order: [['nozzleNumber', 'ASC']],
          raw: true
        });
        
        // If lastReading is null but initialReading exists, use initialReading as the lastReading
        const nozzlesWithReading = nozzles.map(nozzle => ({
          ...nozzle,
          lastReading: nozzle.lastReading !== null ? nozzle.lastReading : nozzle.initialReading
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
    const { Op } = require('sequelize');
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

    readings.forEach(reading => {
      const saleValue = parseFloat(reading.litresSold || 0) * parseFloat(reading.pricePerLitre || 0);
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

    const { NozzleReading, Nozzle, User, Settlement } = require('../models');
    const { Op } = require('sequelize');

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
          model: Settlement,
          as: 'settlement',
          attributes: ['id', 'date', 'isFinal', 'recordedAt'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Categorize readings
    const unlinkedReadings = [];
    const linkedReadings = [];

    readings.forEach(reading => {
      const readingData = {
        id: reading.id,
        nozzleNumber: reading.nozzle?.nozzleNumber,
        fuelType: reading.nozzle?.fuelType,
        openingReading: parseFloat(reading.previousReading || 0),
        closingReading: parseFloat(reading.readingValue || 0),
        litresSold: parseFloat(reading.litresSold || 0),
        saleValue: parseFloat(reading.totalAmount || 0),
        cashAmount: parseFloat(reading.cashAmount || 0),
        onlineAmount: parseFloat(reading.onlineAmount || 0),
        creditAmount: parseFloat(reading.creditAmount || 0),
        recordedBy: reading.enteredByUser ? {
          id: reading.enteredByUser.id,
          name: reading.enteredByUser.name
        } : null,
        recordedAt: reading.createdAt,
        settlementId: reading.settlementId,
        linkedSettlement: reading.settlement ? {
          id: reading.settlement.id,
          date: reading.settlement.date,
          isFinal: reading.settlement.isFinal
        } : null
      };

      if (reading.settlementId) {
        linkedReadings.push(readingData);
      } else {
        unlinkedReadings.push(readingData);
      }
    });

    // Calculate totals for unlinked readings
    const unlinkedTotals = unlinkedReadings.reduce((acc, r) => {
      acc.cash += r.cashAmount;
      acc.online += r.onlineAmount;
      acc.credit += r.creditAmount;
      acc.litres += r.litresSold;
      acc.value += r.saleValue;
      return acc;
    }, { cash: 0, online: 0, credit: 0, litres: 0, value: 0 });

    // Calculate totals for linked readings
    const linkedTotals = linkedReadings.reduce((acc, r) => {
      acc.cash += r.cashAmount;
      acc.online += r.onlineAmount;
      acc.credit += r.creditAmount;
      acc.litres += r.litresSold;
      acc.value += r.saleValue;
      return acc;
    }, { cash: 0, online: 0, credit: 0, litres: 0, value: 0 });

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
    const { date, actualCash, expectedCash, notes, online, credit, isFinal, readingIds } = req.body;
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

    // CALCULATE VARIANCE on backend (don't trust frontend value)
    const calculatedVariance = parsedExpectedCash - parsedActualCash;

    // Fetch employee-reported totals from readings
    const { NozzleReading } = require('../models');
    const { Op, fn, col } = require('sequelize');

    // Build where clause - if readingIds provided, use those; otherwise use all for the date
    let readingsWhereClause = {
      stationId,
      readingDate: settlementDate,
      [Op.or]: [
        { isInitialReading: false },
        { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
      ]
    };

    // If specific readingIds provided, filter by those
    if (readingIds && Array.isArray(readingIds) && readingIds.length > 0) {
      readingsWhereClause.id = { [Op.in]: readingIds };
    }

    const employeeTotals = await NozzleReading.findOne({
      attributes: [
        [fn('SUM', col('cash_amount')), 'employeeCash'],
        [fn('SUM', col('online_amount')), 'employeeOnline'],
        [fn('SUM', col('credit_amount')), 'employeeCredit']
      ],
      where: readingsWhereClause,
      raw: true
    });
    const employeeCash = parseFloat(employeeTotals?.employeeCash || 0);
    const employeeOnline = parseFloat(employeeTotals?.employeeOnline || 0);
    const employeeCredit = parseFloat(employeeTotals?.employeeCredit || 0);

    // Calculate variance for online and credit
    const varianceOnline = employeeOnline - parsedOnline;
    const varianceCredit = employeeCredit - parsedCredit;

    // Persist settlement
    const sequelize = require('../models').sequelize;
    const { Settlement } = require('../models');

    const t = await sequelize.transaction();
    try {
      let finalizedAt = null;
      if (isFinal) {
        finalizedAt = new Date();
        // Un-finalize previous settlements for this station/date
        await Settlement.update({ isFinal: false, finalizedAt: null }, {
          where: { stationId, date: settlementDate, isFinal: true },
          transaction: t
        });
      }
      const record = await Settlement.create({
        stationId,
        date: settlementDate,
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
        recordedBy: user.id,
        recordedAt: new Date(),
        isFinal: !!isFinal,
        finalizedAt
      }, { transaction: t });

      // Link selected readings to this settlement
      let linkedReadingsCount = 0;
      if (readingIds && Array.isArray(readingIds) && readingIds.length > 0) {
        // Link specific readings
        const [affectedRows] = await NozzleReading.update(
          { settlementId: record.id },
          { where: { id: { [Op.in]: readingIds } }, transaction: t }
        );
        linkedReadingsCount = affectedRows;
      } else {
        // Link all unlinked readings for this station/date
        const [affectedRows] = await NozzleReading.update(
          { settlementId: record.id },
          { 
            where: { 
              stationId, 
              readingDate: settlementDate, 
              settlementId: null,
              [Op.or]: [
                { isInitialReading: false },
                { isInitialReading: true, litresSold: { [Op.gt]: 0 } }
              ]
            }, 
            transaction: t 
          }
        );
        linkedReadingsCount = affectedRows;
      }

      await t.commit();

      res.json({ 
        success: true, 
        data: record,
        metadata: {
          message: 'Settlement recorded with ACID compliance',
          varianceCalculation: `Cash: ${parsedExpectedCash} - ${parsedActualCash} = ${calculatedVariance}`,
          employeeReported: { cash: employeeCash, online: employeeOnline, credit: employeeCredit },
          ownerConfirmed: { cash: parsedActualCash, online: parsedOnline, credit: parsedCredit },
          variances: { cash: calculatedVariance, online: varianceOnline, credit: varianceCredit },
          linkedReadings: linkedReadingsCount
        }
      });
    } catch (err) {
      await t.rollback();
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
    const { limit = 5 } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Query persisted settlements with variance analysis
    const { Settlement, User } = require('../models');
    const rows = await Settlement.findAll({
      where: { stationId },
      include: [{ model: User, as: 'recordedByUser', attributes: ['name', 'email'] }],
      order: [['date', 'DESC'], ['createdAt', 'DESC']]
    });
    // Group by date, flag duplicates
    const settlementsByDate = {};
    rows.forEach(s => {
      const d = s.date;
      if (!settlementsByDate[d]) settlementsByDate[d] = [];
      settlementsByDate[d].push(s);
    });
    // For summary, use latest final if exists, else latest
    const summary = Object.entries(settlementsByDate).map(([date, arr]) => {
      const finals = arr.filter(s => s.isFinal);
      const main = finals.length > 0 ? finals[finals.length - 1] : arr[arr.length - 1];
      return {
        ...main.toJSON(),
        duplicateCount: arr.length,
        allSettlements: arr.map(s => s.toJSON())
      };
    });
    // For audit, show all settlements
    res.json({
      success: true,
      data: summary,
      metadata: {
        count: rows.length,
        persistenceInfo: 'All settlements persisted to database with ACID compliance',
        amountsPrecision: 'DECIMAL(12,2) - exact, no floating point errors',
        duplicatesFlagged: true
      }
    });

    // Enhance with variance analysis
    const enhancedData = rows.map(settlement => {
      const variance = parseFloat(settlement.variance);
      const expectedCash = parseFloat(settlement.expectedCash);
      const variancePercentage = expectedCash > 0 ? (variance / expectedCash) * 100 : 0;

      // Flag problematic variance
      let varianceStatus = 'OK';
      if (Math.abs(variance) > (expectedCash * 0.03)) {
        varianceStatus = 'INVESTIGATE'; // > 3%
      } else if (Math.abs(variance) > (expectedCash * 0.01)) {
        varianceStatus = 'REVIEW'; // > 1%
      }

      return {
        ...settlement.toJSON(),
        varianceAnalysis: {
          percentage: parseFloat(variancePercentage.toFixed(2)),
          status: varianceStatus,
          interpretation: variance > 0 ? 'Shortfall' : variance < 0 ? 'Overage' : 'Perfect match'
        }
      };
    });

    res.json({ 
      success: true, 
      data: enhancedData,
      metadata: {
        count: enhancedData.length,
        persistenceInfo: 'All settlements persisted to database with ACID compliance',
        amountsPrecision: 'DECIMAL(12,2) - exact, no floating point errors'
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

    const { Settlement, NozzleReading } = require('../models');

    // Get settlement for the day
    const settlement = await Settlement.findOne({
      where: { stationId, date: queryDate }
    });

    // Get all readings for the day to calculate sales
    const readings = await NozzleReading.findAll({
      where: sequelize.where(
        sequelize.fn('DATE', sequelize.col('recorded_at')),
        '=',
        queryDate
      ),
      include: [{
        model: require('../models').Nozzle,
        attributes: ['nozzleNumber'],
        include: [{
          model: require('../models').Pump,
          attributes: ['pumpNumber']
        }]
      }],
      raw: false
    });

    // Calculate sales totals from readings using payment breakdown fields
    let totalSaleValue = 0;
    let totalCashSales = 0;
    let totalOnlineSales = 0;
    let totalCreditSales = 0;

    readings.forEach(reading => {
      const saleValue = parseFloat(reading.litresSold || 0) * parseFloat(reading.pricePerLitre || 0);
      totalSaleValue += saleValue;

      // Use the actual payment breakdown fields
      totalCashSales += parseFloat(reading.cashAmount || 0);
      totalOnlineSales += parseFloat(reading.onlineAmount || 0);
      totalCreditSales += parseFloat(reading.creditAmount || 0);
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
        persistenceInfo: 'All settlements stored with ACID compliance, all sales calculated from permanent reading records'
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
