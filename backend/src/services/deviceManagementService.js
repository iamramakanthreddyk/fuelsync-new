/**
 * Device Management Service
 * 
 * Business logic for pump and nozzle management.
 * Responsibilities:
 * - Pump CRUD with auto-numbering and conflict resolution
 * - Nozzle CRUD with fuel type and status tracking
 * - Device status cascading (pump status affects nozzles)
 * - Latest reading tracking per nozzle
 * - Complex auto-retry logic for numbering conflicts
 */

const { Pump, Nozzle, Station, NozzleReading, sequelize } = require('./modelAccess');
const { Op } = require('sequelize');
const { logAudit } = require('../utils/auditLog');
const { createContextLogger } = require('./loggerService');

const logger = createContextLogger('DeviceManagementService');

// ===== CONSTANTS =====
const MAX_PUMP_NUMBER = 50;
const PUMP_CREATION_RETRY_ATTEMPTS = 50;

/**
 * Resolve pump number with conflict handling
 * 
 * Implements auto-numbering with retry logic:
 * 1. If provided, use it (with conflict check)
 * 2. If not provided, auto-assign (1 to MAX_PUMP_NUMBER)
 * 3. On conflict, try next available number (up to 50 attempts)
 * 
 * @param {string} stationId - Station ID
 * @param {number} desiredNumber - Requested pump number (optional)
 * @returns {Promise<number>} Resolved pump number
 * @throws {Error} If auto-numbering exhausted or invalid input
 */
async function resolvePumpNumber(stationId, desiredNumber) {
  if (desiredNumber !== null && desiredNumber !== undefined) {
    // Requested number: check if conflicts exist
    const existingPump = await Pump.findOne({
      where: {
        stationId,
        pumpNumber: desiredNumber
      }
    });
    if (existingPump) {
      throw new Error(`Pump number ${desiredNumber} already exists for this station`);
    }
    return desiredNumber;
  }

  // Auto-assign: find first available number
  for (let attempt = 1; attempt <= PUMP_CREATION_RETRY_ATTEMPTS; attempt++) {
    const existingPump = await Pump.findOne({
      where: {
        stationId,
        pumpNumber: attempt
      }
    });
    if (!existingPump) {
      logger.debug('Resolved pump number via auto-assign', { stationId, pumpNumber: attempt, attempts: attempt });
      return attempt;
    }
  }

  // Exhausted all attempts
  throw new Error(`Cannot assign pump number: all ${PUMP_CREATION_RETRY_ATTEMPTS} slots filled`);
}

/**
 * Create a new pump with auto-numbering
 * 
 * Business Logic:
 * - Auto-assigns pump number if not provided (1-50)
 * - Retries on conflicts (up to 50 attempts)
 * - Creates with 'active' status by default
 * - Records audit log
 * - Returns created pump details
 * 
 * Status Cascade:
 * When pump status changes to inactive/repair, all nozzles automatically:
 * - Set to 'inactive' status
 * - Logged via audit trail
 * 
 * @param {string} stationId - Station ID
 * @param {Object} dto - Pump data
 * @param {string} dto.name - Pump display name (optional, auto-generated if not provided)
 * @param {number} dto.pumpNumber - Pump number (optional, auto-assigned if not provided)
 * @param {string} dto.notes - Additional notes
 * @param {string} userId - User creating pump
 * @returns {Promise<Object>} Created pump with id, pumpNumber, name, status
 */
async function createPump(stationId, dto, userId) {
  const { name, pumpNumber, notes } = dto;

  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  // Resolve pump number (with auto-assign or conflict resolution)
  const finalPumpNumber = await resolvePumpNumber(stationId, pumpNumber);

  const pump = await Pump.create({
    stationId,
    name: name || `Pump ${finalPumpNumber}`,
    pumpNumber: finalPumpNumber,
    status: 'active',
    notes
  });

  logAudit({
    userId,
    action: 'PUMP_CREATED',
    resourceType: 'Pump',
    resourceId: pump.id,
    changes: {
      created: {
        stationId,
        pumpNumber: pump.pumpNumber,
        name: pump.name
      }
    }
  });

  logger.info('Pump created', { pumpId: pump.id, pumpNumber: pump.pumpNumber, stationId });
  return pump;
}

/**
 * Get all pumps for a station with nozzles and readings
 * 
 * Returns pumps with:
 * - Associated nozzles (all fuel types)
 * - Latest reading value per nozzle
 * - Full pump-to-nozzle hierarchy
 * - Ordered by pump number ascending
 * 
 * @param {string} stationId - Station ID
 * @returns {Promise<Array>} Pumps with nested nozzles and readings
 */
async function getPumps(stationId) {
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  // Fetch pumps with nozzles
  const pumps = await Pump.findAll({
    where: { stationId },
    include: [
      {
        model: Nozzle,
        as: 'nozzles',
        attributes: ['id', 'nozzleNumber', 'fuelType', 'status']
      }
    ],
    order: [['pumpNumber', 'ASC']]
  });

  // Fetch latest reading per nozzle (ordered by readingDate DESC, deduplicated in memory)
  const pumpIds = pumps.map(p => p.id);
  const allReadings = await NozzleReading.findAll({
    attributes: ['nozzleId', 'readingValue', 'readingDate'],
    where: {
      nozzleId: {
        [Op.in]: pumpIds.flatMap(pumpId => {
          const pump = pumps.find(p => p.id === pumpId);
          return pump.nozzles.map(n => n.id);
        })
      }
    },
    raw: true,
    order: [['nozzleId', 'ASC'], ['readingDate', 'DESC']]
  });

  // Build readings map for efficient lookup (keeping only the latest per nozzle)
  const readingsMap = {};
  allReadings.forEach(r => {
    if (!readingsMap[r.nozzleId]) {
      readingsMap[r.nozzleId] = r;
    }
  });

  // Augment nozzles with readings
  pumps.forEach(pump => {
    pump.nozzles = pump.nozzles.map(nozzle => ({
      ...nozzle.toJSON(),
      latestReading: readingsMap[nozzle.id] || null
    }));
  });

  logger.debug('Retrieved pumps with nozzles', { stationId, count: pumps.length });
  return pumps;
}

/**
 * Update pump status and details
 * 
 * Status Changes:
 * When pump status changes to 'inactive' or 'repair':
 * - All nozzles automatically set to 'inactive'
 * - Cascading change is logged
 * 
 * @param {string} pumpId - Pump ID
 * @param {Object} updates - Fields to update (name, status, notes)
 * @param {string} userId - User performing update
 * @returns {Promise<Object>} Updated pump
 */
async function updatePump(pumpId, updates, userId) {
  const pump = await Pump.findByPk(pumpId, {
    include: [{ model: Station, as: 'station' }]
  });
  if (!pump) {
    throw new Error('Pump not found');
  }

  const allowedFields = ['name', 'status', 'notes'];
  const filteredUpdates = {};

  allowedFields.forEach(field => {
    if (updates.hasOwnProperty(field) && updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return pump;
  }

  const oldValues = pump.toJSON();

  // If status changes to inactive/repair, cascade to nozzles
  if (filteredUpdates.status && ['inactive', 'repair'].includes(filteredUpdates.status)) {
    await Nozzle.update(
      { status: 'inactive' },
      { where: { pumpId } }
    );

    logAudit({
      userId,
      action: 'NOZZLE_STATUS_CASCADED',
      resourceType: 'Pump',
      resourceId: pumpId,
      changes: {
        trigger: 'Pump status changed',
        affectedResource: 'All nozzles for this pump',
        newStatus: 'inactive'
      }
    });

    logger.info('Nozzle status cascaded', { pumpId, newPumpStatus: filteredUpdates.status });
  }

  await pump.update(filteredUpdates);

  logAudit({
    userId,
    action: 'PUMP_UPDATED',
    resourceType: 'Pump',
    resourceId: pump.id,
    changes: {
      before: oldValues,
      after: pump.toJSON()
    }
  });

  logger.info('Pump updated', { pumpId, fields: Object.keys(filteredUpdates) });
  return pump;
}

/**
 * Resolve nozzle number with auto-assignment
 * 
 * Similar to pump numbering:
 * 1. If provided, use it (check conflict)
 * 2. If not provided, auto-assign (1 to MAX)
 * 3. On conflict, try next available
 * 
 * @param {string} pumpId - Pump ID
 * @param {number} desiredNumber - Requested nozzle number
 * @returns {Promise<number>} Resolved nozzle number
 */
async function resolveNozzleNumber(pumpId, desiredNumber) {
  if (desiredNumber !== null && desiredNumber !== undefined) {
    const existingNozzle = await Nozzle.findOne({
      where: { pumpId, nozzleNumber: desiredNumber }
    });
    if (existingNozzle) {
      throw new Error(`Nozzle number ${desiredNumber} already exists for this pump`);
    }
    return desiredNumber;
  }

  // Auto-assign
  for (let attempt = 1; attempt <= PUMP_CREATION_RETRY_ATTEMPTS; attempt++) {
    const existingNozzle = await Nozzle.findOne({
      where: { pumpId, nozzleNumber: attempt }
    });
    if (!existingNozzle) {
      logger.debug('Resolved nozzle number via auto-assign', { pumpId, nozzleNumber: attempt });
      return attempt;
    }
  }

  throw new Error(`Cannot assign nozzle number: all slots filled for pump`);
}

/**
 * Create a new nozzle for a pump
 * 
 * Business Logic:
 * - Auto-assigns nozzle number if not provided
 * - Requires fuel type (e.g., 'diesel', 'petrol', 'cng')
 * - Creates with pump's current status (inherit from pump)
 * - Records audit log
 * 
 * @param {string} pumpId - Pump ID
 * @param {Object} dto - Nozzle data
 * @param {number} dto.nozzleNumber - Nozzle number (optional, auto-assigned)
 * @param {string} dto.fuelType - Fuel type (required: 'diesel', 'petrol', 'cng', etc.)
 * @param {string} dto.notes - Additional notes
 * @param {string} userId - User creating nozzle
 * @returns {Promise<Object>} Created nozzle with id, nozzleNumber, fuelType, status
 */
async function createNozzle(pumpId, dto, userId) {
  const { nozzleNumber, fuelType, notes } = dto;

  if (!fuelType) {
    throw new Error('Fuel type is required');
  }

  // Verify pump exists and get its status
  const pump = await Pump.findByPk(pumpId, {
    include: [{ model: Station, as: 'station' }]
  });
  if (!pump) {
    throw new Error('Pump not found');
  }

  // Resolve nozzle number
  const finalNozzleNumber = await resolveNozzleNumber(pumpId, nozzleNumber);

  // Create nozzle with pump's status
  const nozzle = await Nozzle.create({
    pumpId,
    nozzleNumber: finalNozzleNumber,
    fuelType,
    status: pump.status === 'active' ? 'active' : 'inactive',
    notes
  });

  logAudit({
    userId,
    action: 'NOZZLE_CREATED',
    resourceType: 'Nozzle',
    resourceId: nozzle.id,
    changes: {
      created: {
        pumpId,
        nozzleNumber: nozzle.nozzleNumber,
        fuelType: nozzle.fuelType
      }
    }
  });

  logger.info('Nozzle created', { nozzleId: nozzle.id, pumpId, fuelType });
  return nozzle;
}

/**
 * Get nozzles for a pump or station
 * 
 * @param {string} pumpId - (Optional) Filter by pump ID
 * @param {string} stationId - (Optional) Filter by station ID (fetches all nozzles for station)
 * @returns {Promise<Array>} Array of nozzles
 */
async function getNozzles(pumpId, stationId) {
  const where = {};
  if (pumpId) {
    where.pumpId = pumpId;
  } else if (stationId) {
    where.stationId = stationId;
  }

  if (!pumpId && !stationId) {
    throw new Error('pumpId or stationId is required');
  }

  const nozzles = await Nozzle.findAll({
    where,
    order: [['nozzleNumber', 'ASC']]
  });

  logger.debug('Nozzles retrieved', { pumpId, stationId, count: nozzles.length });
  return nozzles;
}

/**
 * Update nozzle details
 * 
 * @param {string} nozzleId - Nozzle ID
 * @param {Object} updates - Fields to update
 * @param {string} userId - User performing update
 * @returns {Promise<Object>} Updated nozzle
 */
async function updateNozzle(nozzleId, updates, userId) {
  const nozzle = await Nozzle.findByPk(nozzleId, {
    include: [{ model: Pump, as: 'pump' }]
  });
  if (!nozzle) {
    throw new Error('Nozzle not found');
  }

  const allowedFields = ['status', 'fuelType', 'notes'];
  const filteredUpdates = {};

  allowedFields.forEach(field => {
    if (updates.hasOwnProperty(field) && updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return nozzle;
  }

  const oldValues = nozzle.toJSON();
  await nozzle.update(filteredUpdates);

  logAudit({
    userId,
    action: 'NOZZLE_UPDATED',
    resourceType: 'Nozzle',
    resourceId: nozzle.id,
    changes: {
      before: oldValues,
      after: nozzle.toJSON()
    }
  });

  logger.info('Nozzle updated', { nozzleId, fields: Object.keys(filteredUpdates) });
  return nozzle;
}

/**
 * Delete a pump and cascade delete its nozzles
 * 
 * @param {string} pumpId - Pump ID
 * @param {string} userId - User performing delete
 * @returns {Promise<void>}
 */
async function deletePump(pumpId, userId) {
  const pump = await Pump.findByPk(pumpId);
  if (!pump) {
    throw new Error('Pump not found');
  }

  await pump.destroy();

  logAudit({
    userId,
    action: 'PUMP_DELETED',
    resourceType: 'Pump',
    resourceId: pumpId,
    changes: { deleted: true }
  });

  logger.info('Pump deleted', { pumpId });
}

/**
 * Delete a nozzle
 * 
 * @param {string} nozzleId - Nozzle ID
 * @param {string} userId - User performing delete
 * @returns {Promise<void>}
 */
async function deleteNozzle(nozzleId, userId) {
  const nozzle = await Nozzle.findByPk(nozzleId);
  if (!nozzle) {
    throw new Error('Nozzle not found');
  }

  await nozzle.destroy();

  logAudit({
    userId,
    action: 'NOZZLE_DELETED',
    resourceType: 'Nozzle',
    resourceId: nozzleId,
    changes: { deleted: true }
  });

  logger.info('Nozzle deleted', { nozzleId });
}

module.exports = {
  createPump,
  getPumps,
  updatePump,
  createNozzle,
  getNozzles,
  updateNozzle,
  deletePump,
  deleteNozzle,
  resolvePumpNumber,
  resolveNozzleNumber
};
