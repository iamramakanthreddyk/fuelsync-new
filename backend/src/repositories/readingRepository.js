/**
 * Reading Repository
 * Data access layer for nozzle readings
 */

const { NozzleReading, Nozzle, Pump, Station, User, DailyTransaction } = require('../models');
const { Op } = require('sequelize');

// Standard includes for a reading with all related data
const READING_INCLUDES = [
  {
    model: Nozzle,
    as: 'nozzle',
    attributes: ['id', 'name', 'fuelType'],
    include: [{ model: Pump, as: 'pump', attributes: ['id', 'name', 'stationId'] }]
  },
  {
    model: User,
    as: 'enteredByUser',
    attributes: ['id', 'name', 'email', 'role']
  },
  {
    model: User,
    as: 'assignedEmployee',
    attributes: ['id', 'name', 'email', 'role'],
    required: false
  },
  {
    model: DailyTransaction,
    as: 'transaction',
    required: false
  }
];

/**
 * Get readings with filters and pagination
 */
exports.getReadingsWithFilters = async ({
  stationId,
  pumpId,
  nozzleId,
  startDate,
  endDate,
  offset = 0,
  limit = 50,
  accessibleStationIds,
  employeeId
}) => {
  const where = {};

  if (stationId) where.stationId = stationId;
  if (pumpId) where.pumpId = pumpId;
  if (nozzleId) where.nozzleId = nozzleId;
  if (employeeId) {
    where[Op.or] = [
      { enteredBy: employeeId },
      { assignedEmployeeId: employeeId }
    ];
  }
  if (accessibleStationIds) where.stationId = { [Op.in]: accessibleStationIds };
  if (startDate || endDate) {
    where.readingDate = {};
    if (startDate) where.readingDate[Op.gte] = startDate;
    if (endDate) where.readingDate[Op.lte] = endDate;
  }

  return NozzleReading.findAndCountAll({
    where,
    include: READING_INCLUDES,
    order: [['readingDate', 'DESC'], ['createdAt', 'DESC']],
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    distinct: true
  });
};

/**
 * Calculate the effective sale value for a reading
 */
exports.calculateSaleValue = (reading) => {
  if (reading.isSample) return 0;
  return parseFloat(reading.totalAmount) || 0;
};

/**
 * Separate unlinked readings and compute totals
 * Unlinked = no settlementId (not yet settled)
 */
exports.getUnlinkedReadingsWithTotals = (readings) => {
  const unlinkedReadings = readings.filter(r => !r.settlementId);
  const totals = unlinkedReadings.reduce(
    (acc, r) => {
      acc.litresSold += parseFloat(r.litresSold) || 0;
      acc.totalAmount += parseFloat(r.totalAmount) || 0;
      return acc;
    },
    { litresSold: 0, totalAmount: 0 }
  );
  return { unlinkedReadings, totals };
};

/**
 * Get a single reading with all related models
 */
exports.getReadingWithRelations = async (id) => {
  const reading = await NozzleReading.findByPk(id, { include: READING_INCLUDES });
  return reading ? reading.toJSON() : null;
};

/**
 * Get all readings for a specific date
 */
exports.getReadingsForDate = async (stationId, date, accessibleStationIds) => {
  const where = { readingDate: date };
  if (stationId) where.stationId = stationId;
  if (accessibleStationIds) where.stationId = { [Op.in]: accessibleStationIds };

  const rows = await NozzleReading.findAll({
    where,
    include: READING_INCLUDES,
    order: [['createdAt', 'DESC']]
  });
  return rows.map(r => r.toJSON());
};

/**
 * Get latest reading for each nozzle in the given set of IDs
 * Returns a map: { [nozzleId]: readingValue }
 * This is used by Quick Data Entry to display previous readings
 */
exports.getLatestReadingsForNozzles = async (nozzleIds, stationId) => {
  if (!stationId) {
    throw new Error('stationId is required for getLatestReadingsForNozzles to prevent cross-station data mixing');
  }
  if (!nozzleIds || !nozzleIds.length) return {};

  const readings = await NozzleReading.findAll({
    where: { 
      nozzleId: { [Op.in]: nozzleIds },
      stationId
    },
    order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
  });

  // Keep only the latest per nozzle, extract just the reading value
  const result = {};
  for (const r of readings) {
    if (!result[r.nozzleId]) {
      // Return only the readingValue, not the full object
      result[r.nozzleId] = parseFloat(r.readingValue || 0);
    }
  }
  return result;
};

/**
 * Get daily summary for a station on a specific date
 */
exports.getDailySummary = async (stationId, date) => {
  const readings = await NozzleReading.findAll({
    where: { stationId, readingDate: date },
    include: [
      {
        model: Nozzle,
        as: 'nozzle',
        attributes: ['id', 'name', 'fuelType']
      }
    ],
    order: [['createdAt', 'ASC']]
  });

  const rows = readings.map(r => r.toJSON());
  const totals = rows.reduce(
    (acc, r) => {
      if (!r.isSample) {
        acc.litresSold += parseFloat(r.litresSold) || 0;
        acc.totalAmount += parseFloat(r.totalAmount) || 0;
        acc.readingCount += 1;
      }
      return acc;
    },
    { litresSold: 0, totalAmount: 0, readingCount: 0 }
  );

  return { readings: rows, totals };
};

/**
 * Get the most recent reading for a single nozzle
 */
exports.getLatestReadingForNozzle = async (nozzleId, stationId) => {
  if (!stationId) {
    throw new Error('stationId is required for getLatestReadingForNozzle to prevent cross-station data mixing');
  }
  const reading = await NozzleReading.findOne({
    where: { 
      nozzleId,
      stationId
    },
    order: [['readingDate', 'DESC'], ['createdAt', 'DESC']]
  });
  return reading ? reading.toJSON() : null;
};
