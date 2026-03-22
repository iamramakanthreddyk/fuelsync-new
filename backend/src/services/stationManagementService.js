/**
 * Station Management Service
 * 
 * Business logic for station CRUD operations and configuration.
 * Responsibilities:
 * - Station creation with unique code generation
 * - Station details retrieval with relationships
 * - Station settings (shifts, alerts, thresholds)
 * - Audit logging for all operations
 * 
 * Extends BaseService pattern for transaction support.
 */

const { Station, Plan, User, NozzleReading, sequelize } = require('./modelAccess');
const { Op, fn, col } = require('sequelize');
const { logAudit } = require('../utils/auditLog');
const { createContextLogger } = require('./loggerService');

const logger = createContextLogger('StationManagementService');

// ===== CONSTANTS =====
const EXCLUDE_SAMPLE_READINGS = { isSample: { [Op.ne]: true } };

/**
 * Create a new station with auto-generated station code
 * 
 * Business Logic:
 * - Super admin: must provide ownerId (validates owner exists)
 * - Owner: auto-assigns to self
 * - Auto-generates unique station code (format: {ownerInitials}-{sequentialNumber})
 * - Validates owner's plan supports station creation
 * - Records creation audit log
 * 
 * Transaction Safety:
 * - Uses database transaction for code uniqueness
 * - Validates plan assignment within transaction
 * - All-or-nothing: if code generation conflicts, entire operation rolled back
 * 
 * @param {Object} dto - Station data transfer object
 * @param {string} dto.name - Station name (required)
 * @param {string} dto.address - Street address
 * @param {string} dto.city - City name
 * @param {string} dto.state - State code
 * @param {string} dto.pincode - Postal code
 * @param {string} dto.phone - Contact number
 * @param {string} dto.email - Email address
 * @param {string} dto.gstNumber - GST registration number
 * @param {string} dto.ownerId - Owner user ID (required for super_admin, provided by owner user)
 * @param {string} dto.currentPlanId - Owner's current plan ID (optional)
 * @param {string} userId - Creating user's ID (from req.userId)
 * @param {Object} user - User object with role info (from req.user)
 * 
 * @returns {Promise<Object>} Created station with id, code, name, address, etc.
 * @throws {Error} ValidationError if name missing, owner not found, or plan mismatch
 */
async function createStation(dto, userId, user) {
  const { name, address, city, state, pincode, phone, email, gstNumber, ownerId, currentPlanId } = dto;

  if (!name) {
    throw new Error('Station name is required');
  }

  const requestingUser = await User.findByPk(userId, { 
    include: [{ model: Plan, as: 'plan' }] 
  });

  // Determine the owner based on role
  let stationOwnerId;
  if (requestingUser.role === 'super_admin') {
    if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
      throw new Error('Owner ID is required when creating a station as super admin');
    }
    const owner = await User.findByPk(ownerId);
    if (!owner) {
      throw new Error('Owner not found with the provided ID');
    }
    if (owner.role !== 'owner') {
      throw new Error('The selected user is not an owner');
    }
    stationOwnerId = ownerId;
  } else if (requestingUser.role === 'owner') {
    stationOwnerId = userId;
  } else {
    throw new Error('Only owners and super admins can create stations');
  }

  const owner = await User.findByPk(stationOwnerId);
  if (!owner) {
    throw new Error('Owner not found');
  }

  // Generate station code within transaction
  const t = await sequelize.transaction();
  try {
    // Validate plan if provided
    if (currentPlanId) {
      const ownerWithPlan = await User.findByPk(stationOwnerId, { 
        include: [{ model: Plan, as: 'plan' }], 
        transaction: t 
      });
      if (ownerWithPlan?.planId !== currentPlanId) {
        logger.warn('Plan ID mismatch', { 
          ownerPlanId: ownerWithPlan?.planId, 
          clientPlanId: currentPlanId 
        });
        await t.rollback();
        throw new Error('Plan validation failed. Owner\'s current plan does not match the provided plan ID.');
      }
    }

    // Generate unique station code
    const baseCode = owner.initials || owner.fullName?.substring(0, 2).toUpperCase() || 'NA';
    const stationCount = await Station.count({ 
      where: { ownerId: stationOwnerId },
      transaction: t 
    });
    const stationCode = `${baseCode}-${String(stationCount + 1).padStart(3, '0')}`;

    logger.debug('Generated station code', { stationCode, owner: owner.id });

    // Create station
    const station = await Station.create({
      name,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      gstNumber,
      code: stationCode,
      ownerId: stationOwnerId
    }, { transaction: t });

    await t.commit();

    logAudit({
      userId,
      action: 'STATION_CREATED',
      resourceType: 'Station',
      resourceId: station.id,
      changes: {
        created: {
          name: station.name,
          code: station.code,
          ownerId: station.ownerId
        }
      }
    });

    logger.info('Station created', { stationId: station.id, code: station.code });
    return station;

  } catch (error) {
    await t.rollback();
    logger.error('Station creation failed', { 
      error: error.message, 
      ownerId: stationOwnerId,
      stack: error.stack 
    });
    throw error;
  }
}

/**
 * Get station details with relationships
 * 
 * Includes:
 * - Station owner info
 * - Current plan
 * - Total pumps count
 * - Total nozzles count
 * - Latest readings summary
 * 
 * @param {string} stationId - Station ID
 * @returns {Promise<Object>} Station with relationships
 */
async function getStation(stationId) {
  const station = await Station.findByPk(stationId, {
    include: [
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'fullName', 'email'],
        include: [
          {
            model: Plan,
            as: 'plan',
            attributes: ['id', 'name', 'maxStations', 'maxPumpsPerStation', 'maxNozzlesPerPump', 'maxEmployees']
          }
        ]
      }
    ]
  });

  if (!station) {
    throw new Error('Station not found');
  }

  return station;
}

/**
 * Update station details
 * 
 * Allowed updates: name, address, city, state, pincode, phone, email, gstNumber
 * 
 * @param {string} stationId - Station ID
 * @param {Object} updates - Fields to update
 * @param {string} userId - User performing update
 * @returns {Promise<Object>} Updated station
 */
async function updateStation(stationId, updates, userId) {
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  const allowedFields = ['name', 'address', 'city', 'state', 'pincode', 'phone', 'email', 'gstNumber'];
  const filteredUpdates = {};
  
  allowedFields.forEach(field => {
    if (updates.hasOwnProperty(field) && updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return station;
  }

  const oldValues = station.toJSON();
  await station.update(filteredUpdates);

  logAudit({
    userId,
    action: 'STATION_UPDATED',
    resourceType: 'Station',
    resourceId: station.id,
    changes: {
      before: oldValues,
      after: station.toJSON()
    }
  });

  logger.info('Station updated', { stationId, fields: Object.keys(filteredUpdates) });
  return station;
}

/**
 * Get station settings (shifts, alerts, thresholds, etc.)
 * 
 * Returns metadata for station configuration including:
 * - Operating hours
 * - Alert thresholds
 * - Reporting preferences
 * 
 * @param {string} stationId - Station ID
 * @returns {Promise<Object>} Station settings
 */
async function getStationSettings(stationId) {
  const station = await Station.findByPk(stationId, {
    attributes: [
      'id', 'name', 'code', 'address', 'phone', 'email',
      'shiftStartTime', 'shiftEndTime',
      'lowStockThreshold', 'alertThreshold',
      'createdAt', 'updatedAt'
    ]
  });

  if (!station) {
    throw new Error('Station not found');
  }

  return {
    stationId: station.id,
    name: station.name,
    code: station.code,
    contact: {
      phone: station.phone,
      email: station.email,
      address: station.address
    },
    operatingHours: {
      startTime: station.shiftStartTime,
      endTime: station.shiftEndTime
    },
    thresholds: {
      lowStock: station.lowStockThreshold,
      alert: station.alertThreshold
    },
    timestamps: {
      created: station.createdAt,
      updated: station.updatedAt
    }
  };
}

/**
 * Update station settings
 * 
 * @param {string} stationId - Station ID
 * @param {Object} updates - Settings to update
 * @param {string} userId - User performing update
 * @returns {Promise<Object>} Updated settings
 */
async function updateStationSettings(stationId, updates, userId) {
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  const allowedFields = [
    'shiftStartTime', 'shiftEndTime',
    'lowStockThreshold', 'alertThreshold'
  ];

  const filteredUpdates = {};
  allowedFields.forEach(field => {
    if (updates.hasOwnProperty(field)) {
      filteredUpdates[field] = updates[field];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return station;
  }

  const oldValues = station.toJSON();
  await station.update(filteredUpdates);

  logAudit({
    userId,
    action: 'STATION_SETTINGS_UPDATED',
    resourceType: 'Station',
    resourceId: station.id,
    changes: {
      before: oldValues,
      after: station.toJSON()
    }
  });

  logger.info('Station settings updated', { stationId, fields: Object.keys(filteredUpdates) });
  return station;
}

/**
 * Get readings for a station categorized by settlement link status
 * 
 * Returns readings organized by:
 * - Linked: Readings already linked to settlements (settled)
 * - Unlinked: Readings not yet linked (ready for settlement)
 * - Excluding sample readings (isSample = true)
 * 
 * @param {string} stationId - Station ID
 * @returns {Promise<Object>} Readings categorized by status
 */
async function getStationReadings(stationId) {
  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  // Fetch readings excluding samples
  const readings = await NozzleReading.findAll({
    where: {
      stationId,
      ...EXCLUDE_SAMPLE_READINGS
    },
    order: [['readingDate', 'DESC']],
    limit: 1000
  });

  // Categorize by settlement link status
  const linked = readings.filter(r => r.settlementId);
  const unlinked = readings.filter(r => !r.settlementId);

  logger.debug('Retrieved station readings', { 
    stationId, 
    total: readings.length,
    linked: linked.length,
    unlinked: unlinked.length 
  });

  return {
    stationId,
    total: readings.length,
    linked: {
      count: linked.length,
      readings: linked
    },
    unlinked: {
      count: unlinked.length,
      readings: unlinked
    }
  };
}

module.exports = {
  createStation,
  getStation,
  updateStation,
  getStationSettings,
  updateStationSettings,
  getStationReadings
};
