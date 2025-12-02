/**
 * Station Controller
 * Station, Pump, and Nozzle management
 * 
 * MULTI-STATION SUPPORT:
 * - Owner can have multiple stations
 * - Station.ownerId links to owner User
 * - Staff have User.stationId for their assigned station
 */

const { Station, Pump, Nozzle, User, FuelPrice, Plan, NozzleReading } = require('../models');
const { Op, fn, col } = require('sequelize');

// ============================================
// HELPER: Check if user can access station
// ============================================
const canAccessStation = async (user, stationId) => {
  if (user.role === 'super_admin') return true;
  
  if (user.role === 'owner') {
    // Owner can access stations they own
    const station = await Station.findByPk(stationId);
    return station && station.ownerId === user.id;
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
    
    if (user.role === 'super_admin') {
      // Super admin sees all
    } else if (user.role === 'owner') {
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

    // Auto-generate unique station code
    const ownerStationsCount = await Station.count({ where: { ownerId: stationOwnerId } });
    const namePrefix = owner.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    let stationCode = `${namePrefix}${String(ownerStationsCount + 1).padStart(3, '0')}`;
    
    // Ensure uniqueness - if code exists, increment
    let codeExists = await Station.findOne({ where: { code: stationCode } });
    let counter = ownerStationsCount + 2;
    while (codeExists) {
      stationCode = `${namePrefix}${String(counter).padStart(3, '0')}`;
      codeExists = await Station.findOne({ where: { code: stationCode } });
      counter++;
    }

    console.log('✅ Generated unique station code:', stationCode);

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
    });

    res.status(201).json({
      success: true,
      data: station,
      message: 'Station created successfully'
    });

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

    res.json({ success: true, data: station });

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

    // Check station access using helper
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const pumps = await Pump.findAll({
      where: { stationId },
      include: [{
        model: Nozzle,
        as: 'nozzles',
        attributes: ['id', 'nozzleNumber', 'fuelType', 'status']
      }],
      order: [['pumpNumber', 'ASC']]
    });

    res.json({ success: true, data: pumps });

  } catch (error) {
    next(error);
  }
};

exports.createPump = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { name, pumpNumber, notes } = req.body;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Plan limits are checked by enforcePlanLimit middleware

    const pump = await Pump.create({
      stationId,
      name: name || `Pump ${pumpNumber}`,
      pumpNumber,
      notes
    });

    res.status(201).json({ success: true, data: pump });

  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, error: 'Pump number already exists' });
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

// ============================================
// NOZZLE CRUD
// ============================================

exports.getNozzles = async (req, res, next) => {
  try {
    const { pumpId } = req.params;

    const pump = await Pump.findByPk(pumpId);
    if (!pump) {
      return res.status(404).json({ success: false, error: 'Pump not found' });
    }

    const user = req.user;
    // Check station access
    if (!(await canAccessStation(user, pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const nozzles = await Nozzle.findAll({
      where: { pumpId },
      order: [['nozzleNumber', 'ASC']]
    });

    res.json({ success: true, data: nozzles });

  } catch (error) {
    next(error);
  }
};

exports.createNozzle = async (req, res, next) => {
  try {
    const { pumpId } = req.params;
    const { nozzleNumber, fuelType, initialReading, notes } = req.body;

    const pump = await Pump.findByPk(pumpId);
    if (!pump) {
      return res.status(404).json({ success: false, error: 'Pump not found' });
    }

    const user = await User.findByPk(req.userId);
    // Check station access
    if (!(await canAccessStation(user, pump.stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Plan limits are checked by enforcePlanLimit middleware

    const nozzle = await Nozzle.create({
      pumpId,
      stationId: pump.stationId, // Denormalize for faster queries
      nozzleNumber,
      fuelType,
      initialReading: initialReading || 0,
      notes
    });

    res.status(201).json({ success: true, data: nozzle });

  } catch (error) {
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

    const fuelPrice = await FuelPrice.create({
      stationId,
      fuelType,
      price,
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
